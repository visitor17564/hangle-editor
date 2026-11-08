import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile, TFolder, Vault, normalizePath } from "obsidian";

export type Format = "hwp" | "hwpx";
export type OutputFormat = Format | "pdf" | "md";
export function supported(file: TFile): boolean { return /^hwpx?$/i.test(file.extension); }
export const formatOf = (file: TFile): Format => file.extension.toLowerCase() === "hwpx" ? "hwpx" : "hwp";

function sibling(folder: TFolder | null, name: string): string {
  return normalizePath(folder && !folder.isRoot() ? folder.path + "/" + name : name);
}
export function validName(name: string): boolean {
  return !!name && !/[<>:"/\\|?*\u0000-\u001f]/.test(name) && !/[. ]$/.test(name) &&
    !name.startsWith(".") && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name);
}
export function availablePath(vault: Vault, folder: TFolder | null, base: string, extension: string): string {
  let path = sibling(folder, base + "." + extension);
  for (let n = 2; vault.getAbstractFileByPath(path); n++) path = sibling(folder, base + " " + n + "." + extension);
  return path;
}
export class DocumentPicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private files: TFile[], private choose: (file: TFile) => void, placeholder = "HWPX 또는 HWP 문서 찾기") {
    super(app);
    this.setPlaceholder(placeholder);
  }
  getItems() { return this.files; }
  getItemText(file: TFile) { return file.path; }
  onChooseItem(file: TFile) { this.choose(file); }
}
type CloseChoice = "save" | "discard" | "keep";
export class UnsavedDialog extends Modal {
  private finish: (choice: CloseChoice) => void = () => {};
  constructor(app: App, private filename: string) { super(app); }
  ask(): Promise<CloseChoice> { return new Promise(resolve => { this.finish = resolve; this.open(); }); }
  onOpen() {
    this.setTitle("변경 사항을 저장할까요?");
    this.contentEl.createEl("p", { text: this.filename });
    const choose = (choice: CloseChoice) => { this.finish(choice); this.close(); };
    new Setting(this.contentEl)
      .addButton(b => b.setButtonText("버리기").onClick(() => choose("discard")))
      .addButton(b => b.setButtonText("계속 편집").onClick(() => choose("keep")))
      .addButton(b => b.setButtonText("저장").setCta().onClick(() => choose("save")));
  }
  onClose() { this.finish("keep"); this.contentEl.empty(); }
}
export class FileNameDialog extends Modal {
  private finish: (name: string | null) => void = () => {};
  constructor(app: App, private heading: string, private initial: string, private accept: (name: string) => string | null,
      private chooseFormat: boolean) { super(app); }
  ask(): Promise<string | null> {
    return new Promise(resolve => { this.finish = resolve; this.open(); });
  }
  onOpen() {
    this.setTitle(this.heading);
    const field = this.contentEl.createEl("input", { type: "text", cls: "hangle-editor-filename", attr: { "aria-label": "파일 이름" } });
    field.value = this.initial;
    let extension = this.initial.split(".").pop()!;
    if (this.chooseFormat) {
      const formats: Record<OutputFormat, string> = { hwpx: "한글 문서 (.hwpx)", hwp: "한글 호환 문서 (.hwp)",
        pdf: "PDF (.pdf)", md: "Markdown (.md)" };
      new Setting(this.contentEl).setName("파일 형식").addDropdown(drop => {
        drop.addOptions(formats).setValue(extension).onChange(value => {
          extension = value;
          field.value = field.value.replace(/\.(?:hwpx?|pdf|md)$/i, "") + "." + value;
        });
        field.addEventListener("input", () => {
          const typed = field.value.split(".").pop()?.toLowerCase() ?? "";
          if (Object.hasOwn(formats, typed)) { extension = typed; drop.setValue(typed); }
        });
      });
    }
    const submit = () => {
      let name = field.value.trim();
      if (name && !name.includes(".")) name += "." + extension;
      const error = !validName(name) ? "사용할 수 있는 파일 이름을 입력하세요." : this.accept(name);
      if (error) { new Notice(error); return; }
      this.finish(name); this.close();
    };
    field.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); submit(); } });
    new Setting(this.contentEl).addButton(b => b.setButtonText("취소").onClick(() => this.close()))
      .addButton(b => b.setButtonText("저장").setCta().onClick(submit));
    field.focus();
    field.setSelectionRange(0, Math.max(0, this.initial.lastIndexOf(".")));
  }
  onClose() { this.finish(null); this.contentEl.empty(); }
}
export async function choosePath(app: App, folder: TFolder | null, initial: string, only?: "pdf" | "md"): Promise<string | null> {
  const title = only === "md" ? "Markdown 내보내기" : only === "pdf" ? "PDF 내보내기" : "다른 이름으로 저장";
  const name = await new FileNameDialog(app, title, initial, candidate => {
    const ext = candidate.split(".").pop()?.toLowerCase();
    if (!candidate.includes(".") || !(only ? ext === only : ["hwpx", "hwp", "md", "pdf"].includes(ext ?? ""))) {
      return only ? `.${only} 확장자를 입력하세요.` : ".hwpx, .hwp, .pdf 또는 .md 확장자를 입력하세요.";
    }
    return app.vault.getAbstractFileByPath(sibling(folder, candidate)) ? "같은 이름의 파일이 이미 있습니다." : null;
  }, !only).ask();
  return name ? sibling(folder, name) : null;
}

export interface WriteTarget { original: TFile; file: TFile; protectOriginal: boolean; }
export function targetFor(file: TFile, bytes: ArrayBuffer): WriteTarget {
  const data = new Uint8Array(bytes);
  const signature = formatOf(file) === "hwpx" ? [0x50, 0x4b, 0x03, 0x04] : [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return { original: file, file, protectOriginal: !signature.every((v, i) => data[i] === v) };
}

// Reserve the save order before requesting bytes from a tab's asynchronous frame.
export class VaultWriter {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private vault: Vault) {}
  inOrder<T>(operation: () => Promise<T>): Promise<T> {
    const job = this.pending.then(operation);
    this.pending = job.catch(() => {});
    return job;
  }
  async write(target: WriteTarget, bytes: ArrayBuffer, losses: number): Promise<string | null> {
    const file = target.file;
    const current = this.vault.getFileByPath(file.path);
    const limited = target.file === target.original && (losses > 0 || target.protectOriginal);
    let message: string | null = null;
    if (!current || limited) {
      const suffix = !current ? "복구 사본" : "변환 사본";
      const folder = file.parent && this.vault.getAbstractFileByPath(file.parent.path) === file.parent ? file.parent : this.vault.getRoot();
      const dest = availablePath(this.vault, folder, target.original.basename + " (" + suffix + ")", formatOf(target.original));
      target.file = await this.vault.createBinary(dest, bytes);
      message = !current ? `원본이 삭제되어 편집 내용을 ${dest}에 저장했습니다.` :
        `원본 형식 또는 일부 개체를 그대로 저장할 수 없어 ${dest}에 저장했습니다.`;
    } else {
      await this.vault.modifyBinary(current, bytes);
      target.file = current;
    }
    return message;
  }
}
