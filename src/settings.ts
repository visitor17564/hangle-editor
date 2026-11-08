import { App, FuzzySuggestModal, PluginSettingTab, Setting, type SettingDefinitionItem, TFolder } from "obsidian";
import type HangleEditor from "./main";

export const NEW_ICON = "hangle-editor-new";
// Obsidian scales custom icons from its 100 × 100 icon coordinate system.
export const NEW_ICON_SVG = '<g fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"><path d="M58 88H19V10h41l19 19v28M59 11v19h19M37 35h9M30 44h23"/><ellipse cx="41.5" cy="57" rx="9" ry="7"/><path d="M76 63v26M63 76h26"/></g>';

const ROOT_LABEL = "보관함 최상위";
const FOLDER_LABEL = "새 문서 기본 폴더";
const RIBBON_LABEL = "새 한글 문서 리본 아이콘";
const RIBBON_DESC = "왼쪽 리본에서 새 HWPX 문서를 만듭니다.";

class FolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private choose: (path: string) => void) {
    super(app);
    this.setPlaceholder("새 HWPX를 저장할 보관함 폴더 찾기");
  }
  getItems() {
    const { vault } = this.app;
    return [vault.getRoot(), ...vault.getAllFolders().sort((a, b) => a.path.localeCompare(b.path))];
  }
  getItemText(folder: TFolder) { return folder.isRoot() ? ROOT_LABEL : folder.path; }
  onChooseItem(folder: TFolder) { this.choose(folder.isRoot() ? "" : folder.path); }
}

export class HangleSettings extends PluginSettingTab {
  constructor(private editor: HangleEditor) { super(editor.app, editor); }
  private folderDescription() { return `새 HWPX 저장 위치: ${this.editor.settings.newDocumentFolder || ROOT_LABEL}`; }
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      { name: FOLDER_LABEL, desc: this.folderDescription(), aliases: ["저장 위치", "HWPX", "folder"],
        render: setting => { this.folderButton(setting); } },
      { name: RIBBON_LABEL, desc: RIBBON_DESC, aliases: ["ribbon", "아이콘 표시"],
        control: { type: "toggle", key: "showRibbon", defaultValue: true } }
    ];
  }
  async setControlValue(key: string, value: unknown) {
    if (key === "showRibbon" && typeof value === "boolean") await this.editor.setRibbon(value);
  }
  private folderButton(destination: Setting) {
    destination.addButton(button => button.setButtonText("폴더 선택").onClick(() => {
      new FolderPicker(this.app, path => {
        this.editor.report(this.editor.setNewDocumentFolder(path).then(() => { destination.setDesc(this.folderDescription()); }));
      }).open();
    }));
  }
  // Obsidian 1.12.x has no declarative settings renderer.
  display() {
    this.containerEl.empty();
    this.folderButton(new Setting(this.containerEl).setName(FOLDER_LABEL).setDesc(this.folderDescription()));
    new Setting(this.containerEl).setName(RIBBON_LABEL).setDesc(RIBBON_DESC)
      .addToggle(toggle => toggle.setValue(this.editor.settings.showRibbon).onChange(async value => {
        await this.editor.setRibbon(value);
      }));
  }
}
