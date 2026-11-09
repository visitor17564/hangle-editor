import { EditableFileView, ItemView, Notice, Platform, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import type HangleEditor from "./main";
import { availablePath, choosePath, formatOf, targetFor, UnsavedDialog, type WriteTarget, type OutputFormat } from "./files";
import { chooseNativeOutput, DiskFile, droppedPath, readExternal, saveNativeOutput, type DocumentFile } from "./desktop";
import { isRecord } from "./guards";
import { StudioFrame, type EditorEvent, type Snapshot } from "./frame";
import { asMarkdown } from "./markdown";

export const VIEW_TYPE = "hangle-editor";
export const EXTERNAL_VIEW_TYPE = "hangle-editor-external";
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

  constructor(private plugin: HangleEditor, container: HTMLElement, file: DocumentFile, bytes: ArrayBuffer,
      private showCopy: (file: DocumentFile) => Promise<void>, draft?: Draft) {
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
    } else if (event.type === "drop") {
      const path = droppedPath(this.status.win, event.file);
      this.plugin.report(path ? this.plugin.openPath(path) : this.plugin.pick(false, this.status.win));
    }
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
      const fragment = createFragment();
      fragment.createDiv({ text: `문서를 저장하지 못했습니다. ${String(error)}` });
      const button = fragment.createEl("button", { text: "편집본 내려받기" });
      const link = fragment.createEl("a", { attr: { download: file.name, hidden: "" } });
      const notice = new Notice(fragment, 0);
      button.addEventListener("click", () => {
        const url = URL.createObjectURL(new Blob([snapshot.bytes], { type: "application/octet-stream" }));
        link.href = url;
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
    if (action === "open" || action === "recent") { await this.plugin.pick(action === "recent", this.status.win); return; }
    if (action === "save") { await this.save(); return; }
    if (action !== "save-as" && action !== "pdf" && action !== "md") return;

    const { app } = this.plugin, file = this.target.file;
    const only = action === "save-as" ? undefined : action;
    let path: string | null;
    if (file instanceof DiskFile) path = await chooseNativeOutput(this.status.win, file, only);
    else {
      const initial = availablePath(app.vault, file.parent, only ? file.basename : file.basename + " (사본)", only ?? "hwpx").split("/").pop()!;
      path = await choosePath(app, file.parent, initial, only);
    }
    if (!path || !this.ready) return;
    const format = path.split(".").pop()!.toLowerCase() as OutputFormat;
    const editable = format === "hwpx" || format === "hwp";
    const copy = await this.enqueue(async () => {
      const snapshot = await this.frame.snapshot(format === "md" ? "html" : format);
      const bytes = format === "md" ? new TextEncoder().encode(asMarkdown(snapshot.bytes)).buffer : snapshot.bytes;
      const copy = file instanceof DiskFile ? await saveNativeOutput(app, file, path, bytes) : await app.vault.createBinary(path, bytes);
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

class EditorTab {
  private session?: DocumentSession;
  private generation = 0;
  constructor(private view: ItemView, private plugin: HangleEditor) {}
  bind() {
    const { view } = this;
    view.registerEvent(view.app.workspace.on("css-change", () =>
      this.session?.theme(view.containerEl.ownerDocument.body.classList.contains("theme-dark"))));
    view.registerDomEvent(view.containerEl.win, "beforeunload", event => {
      if (this.session?.dirty) event.preventDefault();
    });
  }
  get ready() { return this.session?.ready ?? false; }
  async action(action: string) { await this.session?.action(action); }
  async load(file: DocumentFile) {
    const token = ++this.generation, { view, plugin } = this;
    await this.release();
    if (token !== this.generation) return;
    view.contentEl.empty();
    try {
      const draft = plugin.takeDraft(view.leaf, file);
      const bytes = draft?.snapshot.bytes ?? (file instanceof DiskFile ? await readExternal(file) : await view.app.vault.readBinary(file));
      if (token === this.generation) this.session = new DocumentSession(plugin, view.contentEl, file, bytes,
        copy => plugin.openInLeaf(view.leaf, copy), draft);
    } catch (error) {
      if (token === this.generation) view.contentEl.createDiv({ cls: "hangle-editor-status", text: "파일 읽기 실패 · " + String(error) });
    }
  }
  private async release() {
    const session = this.session;
    this.session = undefined;
    await session?.close();
  }
  async close() { ++this.generation; await this.release(); }
}

export class HwpView extends EditableFileView {
  private editor: EditorTab;
  constructor(leaf: WorkspaceLeaf, plugin: HangleEditor) { super(leaf); this.editor = new EditorTab(this, plugin); }
  getViewType() { return VIEW_TYPE; }
  getIcon() { return "file-text"; }
  canAcceptExtension(extension: string) { return /^hwpx?$/i.test(extension); }
  canEdit() { return this.editor.ready; }
  action(action: string) { return this.editor.action(action); }
  protected async onOpen() { this.editor.bind(); }
  onLoadFile(file: TFile) { return this.editor.load(file); }
  onUnloadFile() { return this.editor.close(); }
  protected onClose() { return this.editor.close(); }
}

export class ExternalHwpView extends ItemView {
  private editor: EditorTab;
  private source?: DiskFile;
  constructor(leaf: WorkspaceLeaf, private plugin: HangleEditor) { super(leaf); this.editor = new EditorTab(this, plugin); }
  getViewType() { return EXTERNAL_VIEW_TYPE; }
  getIcon() { return "file-text"; }
  getDisplayText() { return this.source?.name ?? "외부 한글 문서"; }
  getState() { return this.source ? { externalPath: this.source.path } : {}; }
  async show(file: DiskFile) { this.source = file; await this.editor.load(file); }
  canEdit() { return this.editor.ready; }
  action(action: string) { return this.editor.action(action); }
  protected async onOpen() { this.editor.bind(); }
  protected onClose() { return this.editor.close(); }
  async setState(state: unknown, result: ViewStateResult) {
    await super.setState(state, result);
    if (!isRecord(state) || typeof state.externalPath !== "string" || !/\.hwpx?$/i.test(state.externalPath)) return;
    const path = state.externalPath;
    if (this.source?.path === path && this.editor.ready) return;
    this.source = new DiskFile(path);
    if (this.plugin.hasOpenedExternal(path)) { await this.editor.load(this.source); return; }
    // A synced workspace may contain another computer's path. Read it only after a local choice.
    await this.editor.close();
    this.contentEl.empty();
    const status = this.contentEl.createDiv({cls:"hangle-editor-status"});
    status.createDiv({text:path});
    status.createEl("button",{text:"외부 원본 다시 열기"}).addEventListener("click",() =>
      this.plugin.report(this.plugin.openPath(path, this.leaf)));
  }
}
