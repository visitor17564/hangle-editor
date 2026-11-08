import { EditableFileView, Notice, Platform, TFile, WorkspaceLeaf } from "obsidian";
import type HangleEditor from "./main";
import { availablePath, choosePath, formatOf, targetFor, UnsavedDialog, validName, type WriteTarget, type OutputFormat } from "./files";
import { StudioFrame, type EditorEvent, type Snapshot } from "./frame";
import { asMarkdown } from "./markdown";

export const VIEW_TYPE = "hangle-editor";
export interface Draft { target: WriteTarget; snapshot: Snapshot; }

class DocumentSession {
  private frame: StudioFrame;
  private status: HTMLElement;
  private revision = 0;
  private storedRevision = 0;
  private pending: Promise<unknown> = Promise.resolve();
  private closing?: Promise<void>;
  private stopping = false;
  readonly target: WriteTarget;
  get ready() { return this.frame.ready && !this.stopping; }
  get dirty() { return this.revision > this.storedRevision; }

  constructor(private plugin: HangleEditor, container: HTMLElement, file: TFile, bytes: ArrayBuffer,
      private showCopy: (file: TFile) => Promise<void>, draft?: Draft) {
    this.target = draft?.target ?? targetFor(file, bytes);
    this.status = container.createDiv({ cls: "hangle-editor-status", text: "한글 문서를 여는 중…" });
    this.frame = new StudioFrame(container, e => this.receive(e));
    void this.frame.load(bytes, file.name, !!draft).catch(error => this.fail(String(error)));
  }
  theme(dark: boolean) { this.frame.theme(dark); }
  private fail(message: string) {
    this.status.hidden = false;
    this.status.textContent = "문서를 열 수 없습니다.\n" + message;
    this.frame.dispose();
  }
  private receive(event: EditorEvent) {
    if (event.type === "failed") { this.fail(event.message); return; }
    if (event.type === "error") { new Notice(event.message, 10000); return; }
    if (event.type === "ready") { this.status.hidden = true; return; }
    if (this.stopping) return;
    if (event.type === "changed") {
      this.revision = event.revision;
    } else if (event.type === "action") {
      this.plugin.report(this.action(event.action));
    } else if (event.type === "import") {
      this.plugin.report(this.importFile(event.name, event.bytes));
    }
  }
  private async importFile(name: string, bytes: ArrayBuffer) {
    if (!validName(name) || !/\.hwpx?$/i.test(name) || !(bytes instanceof ArrayBuffer)) return;
    const dot = name.lastIndexOf(".");
    const path = availablePath(this.plugin.app.vault, this.target.original.parent, name.slice(0, dot), name.slice(dot + 1).toLowerCase());
    const file = await this.plugin.app.vault.createBinary(path, bytes);
    await this.plugin.open(file);
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const job = this.pending.then(work);
    this.pending = job.catch(() => {});
    return job;
  }
  private save() {
    const previous = this.pending;
    const job = this.plugin.writer.inOrder(async () => {
      await previous;
      await this.persist(await this.frame.snapshot(formatOf(this.target.file)));
    });
    this.pending = job.catch(() => {});
    return job;
  }
  private async persist(snapshot: Snapshot, closing = false) {
    const { file } = this.target;
    if (!snapshot.bytes.byteLength) throw Error("편집 내용을 읽지 못했습니다.");
    let message;
    try {
      message = await this.plugin.writer.write(this.target, snapshot.bytes, snapshot.losses);
    } catch (error) {
      if (!closing) throw error;
      // Keep the captured bytes accessible even if the vault becomes read-only on close.
      const fragment = this.status.ownerDocument.createDocumentFragment();
      fragment.createDiv({ text: `보관함에 저장하지 못했습니다. ${String(error)}` });
      const button = fragment.createEl("button", { text: "편집본 내려받기" });
      const notice = new Notice(fragment, 0);
      button.addEventListener("click", () => {
        const url = URL.createObjectURL(new Blob([snapshot.bytes], { type: "application/octet-stream" }));
        const link = button.ownerDocument.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        notice.hide();
      });
      return;
    }
    this.storedRevision = snapshot.revision;
    this.frame.saved(snapshot.revision, "저장됨 · " + this.target.file.path);
    if (message) new Notice(message, 12000);
  }
  async action(action: string) {
    if (!this.ready) return;
    if (action === "new") { await this.plugin.newDocument(); return; }
    if (action === "import-md") { await this.plugin.importMarkdown(); return; }
    if (action === "palette") {
      const doc = this.status.ownerDocument;
      doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP", bubbles: true,
        cancelable: true, ctrlKey: !Platform.isMacOS, metaKey: Platform.isMacOS }));
      return;
    }
    if (action === "open" || action === "recent") { this.plugin.pick(action === "recent"); return; }
    if (action === "save") { await this.save(); return; }
    if (action !== "save-as" && action !== "pdf" && action !== "md") return;

    const { app } = this.plugin, file = this.target.file;
    const only = action === "save-as" ? undefined : action;
    const initial = availablePath(app.vault, file.parent, only ? file.basename : file.basename + " (사본)", only ?? "hwpx").split("/").pop()!;
    const path = await choosePath(app, file.parent, initial, only);
    if (!path || !this.ready) return;
    const format = path.split(".").pop()!.toLowerCase() as OutputFormat;
    const editable = format === "hwpx" || format === "hwp";
    const copy = await this.enqueue(async () => {
      const snapshot = await this.frame.snapshot(format === "md" ? "html" : format);
      const copy = format === "md" ? await app.vault.create(path, asMarkdown(snapshot.bytes))
        : await app.vault.createBinary(path, snapshot.bytes);
      const loss = snapshot.losses ? ` · 일부 개체 ${snapshot.losses}건을 보존하지 못했습니다.` : "";
      new Notice("저장됨 · " + path + loss, snapshot.losses ? 10000 : 4000);
      if (editable) {
        this.storedRevision = snapshot.revision;
        this.frame.saved(snapshot.revision, "저장됨 · " + path);
      }
      return copy;
    });
    if (editable && !this.stopping) await this.showCopy(copy);
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopping = true;
    this.closing = this.enqueue(async () => {
      // Probe even if the change notification is still queued behind a tab close.
      if (!this.frame.ready) return;
      const snapshot = await this.frame.snapshot(formatOf(this.target.file), this.storedRevision);
      if (snapshot.revision <= this.storedRevision) return;
      const choice = await new UnsavedDialog(this.plugin.app, this.target.file.path).ask();
      if (choice === "save") await this.plugin.writer.inOrder(() => this.persist(snapshot, true));
      if (choice === "keep") await this.plugin.resume({ target: this.target, snapshot });
    }).catch(error => {
      new Notice(`한글 문서 저장 실패 (${this.target.original.path})\n${String(error)}`, 0);
    }).finally(() => { this.frame.dispose(); this.status.remove(); });
    return this.closing;
  }
}

export class HwpView extends EditableFileView {
  private session?: DocumentSession;
  private generation = 0;
  constructor(leaf: WorkspaceLeaf, private plugin: HangleEditor) { super(leaf); }
  getViewType() { return VIEW_TYPE; }
  getIcon() { return "file-text"; }
  canAcceptExtension(extension: string) { return /^hwpx?$/i.test(extension); }
  canEdit() { return this.session?.ready ?? false; }
  async action(action: string) { await this.session?.action(action); }
  protected async onOpen() {
    this.registerEvent(this.app.workspace.on("css-change", () =>
      this.session?.theme(this.containerEl.ownerDocument.body.classList.contains("theme-dark"))));
    this.registerDomEvent(this.containerEl.win, "beforeunload", event => {
      if (this.session?.dirty) { event.preventDefault(); event.returnValue = false; }
    });
  }
  async onLoadFile(file: TFile) {
    const token = ++this.generation;
    await this.release();
    if (token !== this.generation) return;
    this.contentEl.empty();
    try {
      const draft = this.plugin.takeDraft(this.leaf, file);
      const bytes = draft?.snapshot.bytes ?? await this.app.vault.readBinary(file);
      if (token === this.generation) this.session = new DocumentSession(
        this.plugin, this.contentEl, file, bytes, copy => this.leaf.openFile(copy), draft);
    } catch (error) {
      if (token === this.generation) this.contentEl.createDiv({ cls: "hangle-editor-status", text: "파일 읽기 실패 · " + String(error) });
    }
  }
  private async release() {
    const session = this.session;
    this.session = undefined;
    await session?.close();
  }
  async onUnloadFile() { ++this.generation; await this.release(); }
  protected async onClose() { ++this.generation; await this.release(); }
}
