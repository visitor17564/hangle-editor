import { EditableFileView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type HwpEditor from "./main";
import { availablePath, choosePath, formatOf, targetFor, validName, type WriteTarget } from "./files";
import { StudioFrame, type EditorEvent } from "./frame";

export const VIEW_TYPE = "hwp-editor";

class DocumentSession {
  private frame: StudioFrame;
  private status: HTMLElement;
  private storedRevision = 0;
  private timer?: number;
  private pending: Promise<unknown> = Promise.resolve();
  private closing?: Promise<void>;
  private stopping = false;
  readonly target: WriteTarget;
  get ready() { return this.frame.ready && !this.stopping; }

  constructor(private plugin: HwpEditor, container: HTMLElement, file: TFile, bytes: ArrayBuffer) {
    this.target = targetFor(file, bytes);
    this.status = container.createDiv({ cls: "hwp-editor-status", text: "한글 문서를 여는 중…" });
    this.frame = new StudioFrame(container, e => this.receive(e));
    void this.frame.load(bytes, file.name).catch(error => this.fail(String(error)));
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
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.plugin.report(this.enqueue(() => this.save())), 1000);
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
  private async save(closing = false) {
    const { file } = this.target;
    const snapshot = await this.frame.snapshot(formatOf(file), this.storedRevision);
    if (snapshot.revision <= this.storedRevision) return;
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
    if (action === "new") { await this.plugin.newDocument(this.target.original.parent ?? undefined); return; }
    if (action === "open" || action === "recent") { this.plugin.pick(action === "recent"); return; }
    if (action === "save") { await this.enqueue(() => this.save()); return; }
    if (action !== "save-as" && action !== "pdf") return;

    const { app } = this.plugin, file = this.target.file, pdf = action === "pdf";
    const extension = pdf ? "pdf" : formatOf(file);
    const initial = availablePath(app.vault, file.parent, pdf ? file.basename : file.basename + " (사본)", extension).split("/").pop()!;
    const path = await choosePath(app, file.parent, initial, pdf);
    if (!path || !this.ready) return;
    await this.enqueue(async () => {
      const snapshot = await this.frame.snapshot(pdf ? "pdf" : /\.hwpx$/i.test(path) ? "hwpx" : "hwp");
      const copy = await app.vault.createBinary(path, snapshot.bytes);
      const loss = snapshot.losses ? ` · 일부 개체 ${snapshot.losses}건을 보존하지 못했습니다.` : "";
      new Notice("저장됨 · " + path + loss, snapshot.losses ? 10000 : 4000);
      if (!pdf) await this.plugin.open(copy);
    });
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopping = true;
    window.clearTimeout(this.timer);
    this.closing = this.enqueue(async () => {
      // Probe even if the change notification is still queued behind a tab close.
      if (this.frame.ready) await this.save(true);
    }).catch(error => {
      new Notice(`한글 문서 저장 실패 (${this.target.original.path})\n${String(error)}`, 0);
    }).finally(() => { this.frame.dispose(); this.status.remove(); });
    return this.closing;
  }
}

export class HwpView extends EditableFileView {
  private session?: DocumentSession;
  private generation = 0;
  constructor(leaf: WorkspaceLeaf, private plugin: HwpEditor) { super(leaf); }
  getViewType() { return VIEW_TYPE; }
  getIcon() { return "file-text"; }
  canAcceptExtension(extension: string) { return /^hwpx?$/i.test(extension); }
  canEdit() { return this.session?.ready ?? false; }
  async action(action: string) { await this.session?.action(action); }
  protected async onOpen() {
    this.registerEvent(this.app.workspace.on("css-change", () =>
      this.session?.theme(this.containerEl.ownerDocument.body.classList.contains("theme-dark"))));
  }
  async onLoadFile(file: TFile) {
    const token = ++this.generation;
    await this.release();
    if (token !== this.generation) return;
    this.contentEl.empty();
    try {
      const bytes = await this.app.vault.readBinary(file);
      if (token === this.generation) this.session = new DocumentSession(this.plugin, this.contentEl, file, bytes);
    } catch (error) {
      if (token === this.generation) this.contentEl.createDiv({ cls: "hwp-editor-status", text: "파일 읽기 실패 · " + String(error) });
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
