import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile, TFolder, Vault, normalizePath } from "obsidian";

export type Format = "hwp" | "hwpx";
export function supported(file: TFile): boolean { return /^hwpx?$/i.test(file.extension); }
export const formatOf = (file: TFile): Format => file.extension.toLowerCase() === "hwpx" ? "hwpx" : "hwp";
export function sameBytes(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const left = new Uint8Array(a), right = new Uint8Array(b);
  return left.every((value, index) => value === right[index]);
}

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
  constructor(app: App, private files: TFile[], private choose: (file: TFile) => void) {
    super(app);
    this.setPlaceholder("HWP 또는 HWPX 문서 찾기");
  }
  getItems() { return this.files; }
  getItemText(file: TFile) { return file.path; }
  onChooseItem(file: TFile) { this.choose(file); }
}
export class FileNameDialog extends Modal {
  private finish: (name: string | null) => void = () => {};
  constructor(app: App, private heading: string, private initial: string, private accept: (name: string) => string | null) { super(app); }
  ask(): Promise<string | null> {
    return new Promise(resolve => { this.finish = resolve; this.open(); });
  }
  onOpen() {
    this.setTitle(this.heading);
    const field = this.contentEl.createEl("input", { type: "text", cls: "hwp-editor-filename", attr: { "aria-label": "파일 이름" } });
    field.value = this.initial;
    const submit = () => {
      const name = field.value.trim();
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
export async function choosePath(app: App, folder: TFolder | null, initial: string, pdf = false): Promise<string | null> {
  const name = await new FileNameDialog(app, pdf ? "PDF 내보내기" : "다른 이름으로 저장", initial, candidate => {
    if (!(pdf ? /\.pdf$/i : /\.hwpx?$/i).test(candidate)) return pdf ? ".pdf 확장자를 입력하세요." : ".hwp 또는 .hwpx 확장자를 입력하세요.";
    return app.vault.getAbstractFileByPath(sibling(folder, candidate)) ? "같은 이름의 파일이 이미 있습니다." : null;
  }).ask();
  return name ? sibling(folder, name) : null;
}

export interface WriteTarget { original: TFile; file: TFile; baseline: ArrayBuffer; protectOriginal: boolean; }
export function targetFor(file: TFile, bytes: ArrayBuffer): WriteTarget {
  const data = new Uint8Array(bytes);
  const signature = formatOf(file) === "hwpx" ? [0x50, 0x4b, 0x03, 0x04] : [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return { original: file, file, baseline: bytes, protectOriginal: !signature.every((v, i) => data[i] === v) };
}

// Obsidian has no binary Vault.process(). Serialize writes across all editor leaves,
// then compare the actual vault bytes with those this particular tab opened.
export class VaultWriter {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private vault: Vault) {}
  write(target: WriteTarget, bytes: ArrayBuffer, losses: number): Promise<string | null> {
    const job = this.pending.then(() => this.persist(target, bytes, losses));
    this.pending = job.catch(() => {});
    return job;
  }
  private async persist(target: WriteTarget, bytes: ArrayBuffer, losses: number): Promise<string | null> {
    const file = target.file;
    const exists = this.vault.getAbstractFileByPath(file.path) === file;
    const changed = !exists || !sameBytes(await this.vault.readBinary(file), target.baseline);
    const limited = target.file === target.original && (losses > 0 || target.protectOriginal);
    let message: string | null = null;
    if (changed || limited) {
      const suffix = changed ? "충돌 사본" : "변환 사본";
      const folder = file.parent && this.vault.getAbstractFileByPath(file.parent.path) === file.parent ? file.parent : this.vault.getRoot();
      const dest = availablePath(this.vault, folder, target.original.basename + " (" + suffix + ")", formatOf(target.original));
      target.file = await this.vault.createBinary(dest, bytes);
      message = changed ? `원본이 변경되어 편집 내용을 ${dest}에 저장했습니다.` :
        `원본 형식 또는 일부 개체를 그대로 저장할 수 없어 ${dest}에 저장했습니다.`;
    } else {
      await this.vault.modifyBinary(file, bytes);
    }
    target.baseline = bytes;
    return message;
  }
}
