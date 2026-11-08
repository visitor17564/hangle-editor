import { Notice, Plugin, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import { blankHwp } from "hwp-editor:assets";
import { decode64 } from "./frame";
import { availablePath, DocumentPicker, supported, VaultWriter } from "./files";
import { HwpView, VIEW_TYPE, type Draft } from "./view";

export default class HwpEditor extends Plugin {
  writer!: VaultWriter;
  private drafts = new WeakMap<WorkspaceLeaf, Draft>();
  onload() {
    this.writer = new VaultWriter(this.app.vault);
    this.registerView(VIEW_TYPE, leaf => new HwpView(leaf, this));
    this.registerExtensions(["hwp", "hwpx"], VIEW_TYPE);
    this.addCommand({ id: "new-document", name: "새 한글 문서", callback: () => this.report(this.newDocument()) });
    this.addCommand({ id: "open-document", name: "한글 문서 열기", callback: () => this.pick() });
    for (const [id, name, action] of [["save-document", "한글 문서 저장", "save"],
      ["save-as", "한글 문서 다른 이름으로 저장", "save-as"], ["export-pdf", "PDF 내보내기", "pdf"]]) {
      this.addCommand({ id, name, checkCallback: checking => {
        const view = this.app.workspace.getActiveViewOfType(HwpView);
        if (!view?.canEdit()) return false;
        if (!checking) this.report(view.action(action));
        return true;
      } });
    }
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof TFolder) menu.addItem(item => item.setTitle("새 한글 문서").setIcon("file-plus")
        .onClick(() => this.report(this.newDocument(file))));
    }));
  }
  report(promise: Promise<unknown>) {
    void promise.catch(error => new Notice(error instanceof Error ? error.message : String(error), 10000));
  }
  async open(file: TFile) { await this.app.workspace.getLeaf("tab").openFile(file); }
  async resume(draft: Draft) {
    const { target, snapshot } = draft;
    if (snapshot.losses > 0) target.protectOriginal = true;
    if (this.app.vault.getAbstractFileByPath(target.original.path) !== target.original) {
      const message = await this.writer.write(target, snapshot.bytes, snapshot.losses);
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
  async newDocument(folder = this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? "")) {
    const path = availablePath(this.app.vault, folder, "새 한글 문서", "hwp");
    await this.open(await this.app.vault.createBinary(path, decode64(blankHwp)));
  }
  pick(recent = false) {
    const vault = this.app.vault;
    const files = recent ? this.app.workspace.getLastOpenFiles().map(path => vault.getAbstractFileByPath(path))
      .filter((f): f is TFile => f instanceof TFile && supported(f)) : vault.getFiles().filter(supported);
    if (!files.length) { new Notice(recent ? "최근에 연 한글 문서가 없습니다." : "보관함에 한글 문서가 없습니다."); return; }
    new DocumentPicker(this.app, files, file => this.report(this.open(file))).open();
  }
}
