import { PluginSettingTab, Setting } from "obsidian";
import type HangleEditor from "./main";

export const NEW_ICON = "hangle-editor-new";
// Obsidian scales custom icons from its 100 × 100 icon coordinate system.
export const NEW_ICON_SVG = '<g fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"><path d="M58 88H19V10h41l19 19v28M59 11v19h19M37 35h9M30 44h23"/><ellipse cx="41.5" cy="57" rx="9" ry="7"/><path d="M76 63v26M63 76h26"/></g>';

export class HangleSettings extends PluginSettingTab {
  constructor(private editor: HangleEditor) { super(editor.app, editor); }
  display() {
    this.containerEl.empty();
    new Setting(this.containerEl).setName("새 한글 문서 리본 아이콘")
      .setDesc("왼쪽 리본에서 새 HWPX 문서를 만듭니다.")
      .addToggle(toggle => toggle.setValue(this.editor.showRibbon).onChange(async value => {
        await this.editor.setRibbon(value);
      }));
  }
}
