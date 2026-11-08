import { addIcon, MarkdownView, Notice, Plugin, removeIcon, TFile, WorkspaceLeaf } from "obsidian";
import { createHwpx } from "./frame";
import { availablePath, DocumentPicker, supported, VaultWriter } from "./files";
import { HwpView, VIEW_TYPE, type Draft } from "./view";
import { noteHtml } from "./markdown";
import { HangleSettings, NEW_ICON, NEW_ICON_SVG } from "./settings";
import { isRecord } from "./guards";

const NEW_BASENAME = "새 한글 문서";

export default class HangleEditor extends Plugin {
  writer!: VaultWriter;
  private drafts = new WeakMap<WorkspaceLeaf, Draft>();
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
    this.registerExtensions(["hwp", "hwpx"], VIEW_TYPE);
    this.addCommand({ id: "new-document", name: "새 한글 문서 만들기 (HWPX)", callback: () => this.report(this.newDocument()) });
    this.addCommand({ id: "new-attachment-document", name: "첨부파일 위치에 새 HWPX 만들기", callback: () => this.report(this.newAttachmentDocument()) });
    this.addCommand({ id: "open-document", name: "한글 문서 열기", callback: () => this.pick() });
    this.addCommand({ id: "import-md", name: "Markdown에서 HWPX 만들기", callback: () => this.report(this.importMarkdown()) });
    for (const [id, name, action] of [["save-document", "한글 문서 저장", "save"],
      ["save-as", "한글 문서 다른 이름으로 저장", "save-as"], ["export-pdf", "PDF 내보내기", "pdf"],
      ["export-md", "Markdown 내보내기", "md"]]) {
      this.addCommand({ id, name, checkCallback: checking => {
        const view = this.app.workspace.getActiveViewOfType(HwpView);
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
  async open(file: TFile) { await this.app.workspace.getLeaf("tab").openFile(file); }
  async resume(draft: Draft) {
    const { target, snapshot } = draft;
    if (snapshot.losses > 0) target.protectOriginal = true;
    if (this.app.vault.getAbstractFileByPath(target.original.path) !== target.original) {
      const message = await this.writer.inOrder(() => this.writer.write(target, snapshot.bytes, snapshot.losses));
      if (message) new Notice(message, 10000);
      await this.open(target.file);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    this.drafts.set(leaf, draft);
    await leaf.openFile(target.original);
  }
  takeDraft(leaf: WorkspaceLeaf, file: TFile): Draft | undefined {
    const draft = this.drafts.get(leaf);
    this.drafts.delete(leaf);
    return draft?.target.original === file ? draft : undefined;
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
  async importMarkdown(file?: TFile) {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    const source = file ?? active?.file;
    if (!source) {
      const notes = this.app.vault.getMarkdownFiles();
      if (!notes.length) { new Notice("보관함에 Markdown 노트가 없습니다."); return; }
      new DocumentPicker(this.app, notes, chosen => this.report(this.importMarkdown(chosen)), "HWPX로 가져올 Markdown 노트 찾기").open();
      return;
    }
    const text = active?.file === source ? active.editor.getValue() : await this.app.vault.read(source);
    await this.createDocument(() => availablePath(this.app.vault, source.parent, source.basename, "hwpx"), await noteHtml(this.app, source, text));
  }
  pick(recent = false) {
    const vault = this.app.vault;
    const files = recent ? this.app.workspace.getLastOpenFiles().map(path => vault.getAbstractFileByPath(path))
      .filter((f): f is TFile => f instanceof TFile && supported(f)) : vault.getFiles().filter(supported);
    if (!files.length) { new Notice(recent ? "최근에 연 한글 문서가 없습니다." : "보관함에 한글 문서가 없습니다."); return; }
    new DocumentPicker(this.app, files, file => this.report(this.open(file))).open();
  }
}
