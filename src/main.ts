import { addIcon, MarkdownView, Notice, Platform, Plugin, removeIcon, TFile, WorkspaceLeaf } from "obsidian";
import { createHwpx } from "./frame";
import { availablePath, DocumentPicker, supported, VaultWriter } from "./files";
import { ExternalHwpView, EXTERNAL_VIEW_TYPE, HwpView, VIEW_TYPE, type Draft } from "./view";
import { chooseNative, chosenVaultFolder, claimExplorerTicket, createExternalHwpx, DiskFile, readExternalText, resolveDocument, vaultRoot, type DocumentFile } from "./desktop";
import { noteHtml } from "./markdown";
import { HangleSettings, NEW_ICON, NEW_ICON_SVG } from "./settings";
import { isRecord } from "./guards";

const NEW_BASENAME = "새 한글 문서";

export default class HangleEditor extends Plugin {
  writer!: VaultWriter;
  private drafts = new WeakMap<WorkspaceLeaf, Draft>();
  private openedExternal = new Set<string>();
  private recentExternal: DiskFile[] = [];
  settings = { showRibbon: true, newDocumentFolder: "" };
  private ribbon?: HTMLElement;
  async onload() {
    const saved: unknown = await this.loadData();
    const data = isRecord(saved) ? saved : {};
    this.settings = {
      showRibbon: data.showRibbon !== false,
      newDocumentFolder: typeof data.newDocumentFolder === "string" ? data.newDocumentFolder : ""
    };
    this.writer = new VaultWriter(this.app.vault);
    addIcon(NEW_ICON, NEW_ICON_SVG);
    this.register(() => removeIcon(NEW_ICON));
    this.updateRibbon();
    this.addSettingTab(new HangleSettings(this));
    this.registerView(VIEW_TYPE, leaf => new HwpView(leaf, this));
    this.registerView(EXTERNAL_VIEW_TYPE, leaf => new ExternalHwpView(leaf, this));
    this.registerObsidianProtocolHandler("hangle-editor", params => {
      const win = this.app.workspace.containerEl.win as Window & { process?: { env?: { LOCALAPPDATA?: string } } };
      const local = win.process?.env?.LOCALAPPDATA;
      if (Platform.isWin && local && typeof params.ticket === "string") {
        this.app.workspace.onLayoutReady(() => this.report(claimExplorerTicket(params.ticket, local).then(path => this.openPath(path))));
      }
    });
    this.registerExtensions(["hwp", "hwpx"], VIEW_TYPE);
    this.addCommand({ id: "new-document", name: "새 한글 문서 만들기 (HWPX)", callback: () => this.report(this.newDocument()) });
    this.addCommand({ id: "new-attachment-document", name: "첨부파일 위치에 새 HWPX 만들기", callback: () => this.report(this.newAttachmentDocument()) });
    this.addCommand({ id: "open-document", name: "한글 문서 열기", callback: () => this.report(this.pick()) });
    this.addCommand({ id: "import-md", name: "Markdown에서 HWPX 만들기", callback: () => this.report(this.importMarkdown()) });
    for (const [id, name, action] of [["save-document", "한글 문서 저장", "save"],
      ["save-as", "한글 문서 다른 이름으로 저장", "save-as"], ["export-pdf", "PDF 내보내기", "pdf"],
      ["export-md", "Markdown 내보내기", "md"]]) {
      this.addCommand({ id, name, checkCallback: checking => {
        const view = this.app.workspace.getActiveViewOfType(HwpView) ?? this.app.workspace.getActiveViewOfType(ExternalHwpView);
        if (!view?.canEdit()) return false;
        if (!checking) this.report(view.action(action));
        return true;
      } });
    }
  }
  async setRibbon(visible: boolean) {
    this.settings.showRibbon = visible;
    this.updateRibbon();
    await this.saveData(this.settings);
  }
  async setNewDocumentFolder(path: string) {
    this.settings.newDocumentFolder = path;
    await this.saveData(this.settings);
  }
  private updateRibbon() {
    if (this.settings.showRibbon && !this.ribbon) {
      this.ribbon = this.addRibbonIcon(NEW_ICON, "새 한글 문서 만들기 (HWPX)", () => this.report(this.newDocument()));
    }
    this.ribbon?.toggleClass("hangle-editor-ribbon-off", !this.settings.showRibbon);
  }
  report(promise: Promise<unknown>) {
    void promise.catch(error => new Notice(error instanceof Error ? error.message : String(error), 10000));
  }
  private pickerWindow() { return this.app.workspace.getMostRecentLeaf()?.view.containerEl.win ?? this.app.workspace.containerEl.win; }
  async selectDefaultFolder(win: Window): Promise<boolean> {
    const root = vaultRoot(this.app);
    const selected = await chooseNative(win, "folder", this.settings.newDocumentFolder ? root + "/" + this.settings.newDocumentFolder : root);
    if (!selected) return false;
    await this.setNewDocumentFolder(await chosenVaultFolder(this.app, selected));
    return true;
  }
  hasOpenedExternal(path: string) { return this.openedExternal.has(path); }
  async openInLeaf(leaf: WorkspaceLeaf, file: DocumentFile) {
    if (file instanceof TFile) { await leaf.openFile(file); return; }
    this.openedExternal.add(file.path);
    this.recentExternal = [file, ...this.recentExternal.filter(other => other.path !== file.path)].slice(0, 20);
    if (leaf.view instanceof ExternalHwpView && leaf.view.getState().externalPath === file.path && !leaf.view.canEdit()) {
      await leaf.view.show(file);
      return;
    }
    await leaf.setViewState({ type: EXTERNAL_VIEW_TYPE, active: true, state: { externalPath: file.path } });
  }
  async open(file: DocumentFile) { await this.openInLeaf(this.app.workspace.getLeaf("tab"), file); }
  async openPath(path: string, leaf?: WorkspaceLeaf) {
    const file = await resolveDocument(this.app, path);
    if (leaf) await this.openInLeaf(leaf, file);
    else await this.open(file);
  }
  async resume(draft: Draft) {
    const { target, snapshot } = draft;
    if (snapshot.losses > 0) target.protectOriginal = true;
    if (target.kind === "vault" && this.app.vault.getAbstractFileByPath(target.original.path) !== target.original) {
      const message = await this.writer.inOrder(() => this.writer.write(target, snapshot.bytes, snapshot.losses));
      if (message) new Notice(message, 10000);
      await this.open(target.file);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    this.drafts.set(leaf, draft);
    await this.openInLeaf(leaf, target.original);
  }
  takeDraft(leaf: WorkspaceLeaf, file: DocumentFile): Draft | undefined {
    const draft = this.drafts.get(leaf);
    this.drafts.delete(leaf);
    return draft && (draft.target.original === file || (draft.target.kind === "external" && file instanceof DiskFile && draft.target.original.path === file.path)) ? draft : undefined;
  }
  async newDocument() {
    const { vault } = this.app;
    const path = this.settings.newDocumentFolder;
    const folder = path ? vault.getFolderByPath(path) : vault.getRoot();
    if (!folder) throw Error(`새 문서 기본 폴더를 찾을 수 없습니다: ${path}. Hangle Editor 설정에서 폴더를 다시 선택하세요.`);
    await this.createDocument(() => availablePath(vault, folder, NEW_BASENAME, "hwpx"));
  }
  async newAttachmentDocument() {
    // Capture the source before the editor creates a frame or the user switches tabs.
    const source = this.app.workspace.getActiveFile()?.path ?? "";
    await this.createDocument(() => this.app.fileManager.getAvailablePathForAttachment(NEW_BASENAME + ".hwpx", source));
  }
  private async createDocument(nextPath: () => string | Promise<string>, html = "") {
    const bytes = await createHwpx(this.app.workspace.containerEl, html);
    const file = await this.writer.inOrder(async () => this.app.vault.createBinary(await nextPath(), bytes));
    await this.open(file);
  }
  async importMarkdown(file?: DocumentFile) {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    let source = file ?? active?.file;
    if (!source) {
      const selected = await chooseNative(this.pickerWindow(), "markdown");
      if (!selected) return;
      source = await resolveDocument(this.app, selected, ["md"]);
    }
    if (source instanceof DiskFile) {
      const html = await noteHtml(this.app, source, await readExternalText(source));
      const bytes = await createHwpx(this.app.workspace.containerEl, html);
      const copy = await this.writer.inOrder(() => createExternalHwpx(source, bytes));
      await this.open(copy);
      return;
    }
    const text = active?.file === source ? active.editor.getValue() : await this.app.vault.read(source);
    await this.createDocument(() => availablePath(this.app.vault, source.parent, source.basename, "hwpx"), await noteHtml(this.app, source, text));
  }
  async pick(recent = false, win = this.pickerWindow()) {
    if (!recent) {
      const selected = await chooseNative(win, "document");
      if (selected) await this.openPath(selected);
      return;
    }
    const vault = this.app.vault;
    const files = this.app.workspace.getLastOpenFiles().map(path => vault.getAbstractFileByPath(path))
      .filter((f): f is TFile => f instanceof TFile && supported(f));
    const recentFiles = [...this.recentExternal, ...files];
    if (!recentFiles.length) { new Notice("최근에 연 한글 문서가 없습니다."); return; }
    new DocumentPicker(this.app, recentFiles, file => this.report(file instanceof DiskFile ? this.openPath(file.path) : this.open(file))).open();
  }
}
