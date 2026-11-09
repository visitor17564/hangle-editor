import { App, FileSystemAdapter, Platform, TFile } from "obsidian";
import * as nativeFs from "node:fs/promises";
import * as nativePath from "node:path";
import { isRecord } from "./guards";

interface NewHandle {
  writeFile(bytes: Uint8Array): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}
interface DiskIO {
  readFile(path: string): Promise<Uint8Array>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
  open(path: string, flags: string, mode: number): Promise<NewHandle>;
  stat(path: string): Promise<{ isFile(): boolean; mode: number; mtimeMs: number }>;
  lstat(path: string): Promise<{ isFile(): boolean; size: number; mtimeMs: number }>;
  realpath(path: string): Promise<string>;
  rename(source: string, dest: string): Promise<void>;
  unlink(path: string): Promise<void>;
}
interface Paths {
  sep: string;
  basename(path: string, suffix?: string): string;
  dirname(path: string): string;
  extname(path: string): string;
  isAbsolute(path: string): boolean;
  relative(from: string, to: string): string;
  join(...parts: string[]): string;
}
function isDiskIO(value: unknown): value is DiskIO {
  return isRecord(value) && ["readFile","open","stat","lstat","realpath","rename","unlink"].every(k => typeof value[k] === "function");
}
function isPaths(value: unknown): value is Paths {
  return isRecord(value) && typeof value.sep === "string" &&
    ["basename","dirname","extname","isAbsolute","relative","join"].every(k => typeof value[k] === "function");
}
const diskModule: unknown = nativeFs;
const pathModule: unknown = nativePath;
function disk(): DiskIO { if (isDiskIO(diskModule)) return diskModule; throw Error("파일 시스템을 열 수 없습니다."); }
function paths(): Paths { if (isPaths(pathModule)) return pathModule; throw Error("파일 경로를 확인할 수 없습니다."); }

export class DiskFile {
  readonly name: string;
  readonly extension: string;
  readonly basename: string;
  readonly directory: string;
  constructor(readonly path: string) {
    const p = paths(), suffix = p.extname(path);
    this.name = p.basename(path);
    this.basename = p.basename(path, suffix);
    this.extension = suffix.slice(1).toLowerCase();
    this.directory = p.dirname(path);
  }
}
export type DocumentFile = TFile | DiskFile;
export function vaultRoot(app: App): string {
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) return adapter.getBasePath();
  throw Error("데스크톱의 로컬 보관함에서 사용할 수 있습니다.");
}
function relativeTo(root: string, file: string): string | null {
  const p = paths(), relative = p.relative(root, file);
  if (relative === ".." || relative.startsWith(".." + p.sep) || p.isAbsolute(relative)) return null;
  return relative.split(p.sep).join("/");
}
function allowedPath(path: string, extensions: readonly string[]) {
  const p = paths();
  if (!p.isAbsolute(path) || path.includes("\0") || !extensions.includes(p.extname(path).slice(1).toLowerCase())) return false;
  // Standard drive paths and user-selected shares are supported. Device paths and NTFS streams are not files to edit.
  return !Platform.isWin || (!/^[/\\]{2}[?.][/\\]/.test(path) && !path.replace(/^[a-z]:/i, "").includes(":"));
}
export async function resolveDocument(app: App, path: string, extensions = ["hwp", "hwpx"]): Promise<DocumentFile> {
  if (!allowedPath(path, extensions)) throw Error("지원하는 문서의 전체 파일 경로가 필요합니다.");
  const io = disk(), real = await io.realpath(path);
  if (!allowedPath(real, extensions) || !(await io.stat(real)).isFile()) throw Error("열 수 있는 문서 파일이 아닙니다.");
  const relative = relativeTo(await io.realpath(vaultRoot(app)), real);
  const indexed = relative === null ? null : app.vault.getFileByPath(relative);
  return indexed ?? new DiskFile(real);
}
export function readExternal(file: DiskFile): Promise<ArrayBuffer> {
  return disk().readFile(file.path).then(bytes => Uint8Array.from(bytes).buffer);
}
export function readExternalText(file: DiskFile): Promise<string> { return disk().readFile(file.path, "utf8"); }
export async function externalImage(source: DiskFile, link: string): Promise<DiskFile | null> {
  if (!/\.(?:png|jpe?g|gif|webp|bmp)$/i.test(link) || link.includes("\0") || /^[a-z][\w+.-]*:|^[/\\]/i.test(link)) return null;
  const p = paths(), io = disk(), candidate = p.join(source.directory, link);
  if (relativeTo(source.directory, candidate) === null) return null;
  try {
    const real = await io.realpath(candidate);
    if (relativeTo(source.directory, real) === null || !(await io.stat(real)).isFile()) return null;
    return new DiskFile(real);
  } catch { return null; }
}
export async function chosenVaultFolder(app: App, selected: string): Promise<string> {
  const io = disk();
  const relative = relativeTo(await io.realpath(vaultRoot(app)), await io.realpath(selected));
  if (relative === null || (relative && !app.vault.getFolderByPath(relative))) throw Error("새 문서 기본 폴더는 현재 보관함 안에서 선택하세요.");
  return relative;
}

interface PickerOptions {
  title: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: string[];
}
interface DialogHost {
  getCurrentWindow(): unknown;
  dialog: {
    showOpenDialog(parent: unknown, options: PickerOptions): Promise<unknown>;
    showSaveDialog(parent: unknown, options: PickerOptions): Promise<unknown>;
  };
}
type Renderer = Window & { require?(id: "electron"): unknown };
function isDialogHost(value: unknown): value is DialogHost {
  return isRecord(value) && typeof value.getCurrentWindow === "function" && isRecord(value.dialog) &&
    typeof value.dialog.showOpenDialog === "function" && typeof value.dialog.showSaveDialog === "function";
}
function host(win: Window): DialogHost {
  const electron = (win as Renderer).require?.("electron");
  if (isRecord(electron) && isDialogHost(electron.remote)) return electron.remote;
  throw Error("데스크톱 파일 선택 창을 열 수 없습니다.");
}
export async function chooseNative(win: Window, kind: "document" | "markdown" | "folder", start?: string): Promise<string | null> {
  const remote = host(win);
  const folder = kind === "folder", markdown = kind === "markdown";
  const options: PickerOptions = { title: folder ? "새 문서 기본 폴더 선택" : markdown ? "가져올 Markdown 열기" : "한글 문서 열기",
    properties: [folder ? "openDirectory" : "openFile"], defaultPath: start };
  if (!folder) options.filters = [{ name: markdown ? "Markdown" : "한글 문서", extensions: markdown ? ["md"] : ["hwpx","hwp"] }];
  const result = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), options);
  if (!isRecord(result) || result.canceled !== false) return null;
  const files: unknown = result.filePaths;
  return Array.isArray(files) && typeof files[0] === "string" ? files[0] : null;
}
const labels = { hwpx: "한글 문서", hwp: "한글 호환 문서", pdf: "PDF", md: "Markdown" };
export async function chooseNativeOutput(win: Window, file: DiskFile, only?: "pdf" | "md"): Promise<string | null> {
  const remote = host(win), formats = only ? [only] : ["hwpx","hwp","pdf","md"] as const;
  const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), { title: only ? labels[only] + " 내보내기" : "다른 이름으로 저장",
    defaultPath: paths().join(file.directory, file.basename + (only ? "" : " (사본)") + "." + (only ?? "hwpx")),
    filters: formats.map(ext => ({ name: labels[ext], extensions: [ext] })) });
  if (!isRecord(result) || result.canceled !== false || typeof result.filePath !== "string") return null;
  if (!allowedPath(result.filePath, formats)) throw Error("선택한 파일 형식에 맞는 확장자를 지정하세요.");
  return result.filePath;
}
function missing(error: unknown) { return isRecord(error) && error.code === "ENOENT"; }
export async function writeExternal(path: string, bytes: ArrayBuffer, existingRequired: boolean): Promise<void> {
  if (!allowedPath(path, ["hwp","hwpx","pdf","md"]) || !bytes.byteLength) throw Error("저장할 파일이나 문서 데이터가 올바르지 않습니다.");
  const io = disk();
  let mode: number;
  try {
    const stat = await io.stat(path);
    if (!stat.isFile()) throw Error("일반 파일에만 저장할 수 있습니다.");
    mode = stat.mode & 0o777;
    if ((mode & 0o222) === 0) throw Error("읽기 전용 파일입니다. 다른 이름으로 저장하세요.");
  } catch (error) {
    if (!missing(error)) throw error;
    if (existingRequired) throw Error("원본 파일이 이동되었거나 삭제되었습니다. 다른 이름으로 저장하세요.");
    await createExclusive(path, bytes);
    return;
  }
  // Write alongside the original so a failed write cannot truncate it and rename stays on one volume.
  const temporary = paths().join(paths().dirname(path), ".hangle-" + crypto.randomUUID() + ".tmp");
  let owned = false;
  try {
    const handle = await io.open(temporary, "wx", mode);
    owned = true;
    try { await handle.writeFile(new Uint8Array(bytes)); await handle.sync(); } finally { await handle.close(); }
    await io.rename(temporary, path);
    owned = false;
  } finally {
    if (owned) await io.unlink(temporary).catch(() => {});
  }
}
async function createExclusive(path: string, bytes: ArrayBuffer) {
  const handle = await disk().open(path, "wx", 0o666);
  try { try { await handle.writeFile(new Uint8Array(bytes)); await handle.sync(); } finally { await handle.close(); } }
  catch (error) { await disk().unlink(path).catch(() => {}); throw error; }
}
export async function createExternalHwpx(source: DiskFile, bytes: ArrayBuffer): Promise<DiskFile> {
  for (let n = 1; ; n++) {
    const dest = paths().join(source.directory, source.basename + (n === 1 ? "" : " " + n) + ".hwpx");
    try { await createExclusive(dest, bytes); return new DiskFile(dest); }
    catch (error) { if (!isRecord(error) || error.code !== "EEXIST") throw error; }
  }
}
export async function saveNativeOutput(app: App, source: DiskFile, selected: string, bytes: ArrayBuffer): Promise<DocumentFile> {
  const io = disk(), p = paths();
  let dest: string;
  try { dest = await io.realpath(selected); }
  catch (error) {
    if (!missing(error)) throw error;
    dest = p.join(await io.realpath(p.dirname(selected)), p.basename(selected));
  }
  if (!allowedPath(dest, [p.extname(selected).slice(1).toLowerCase()])) throw Error("선택한 파일과 실제 파일의 형식이 다릅니다.");
  if (p.relative(source.path, dest) === "") throw Error("다른 이름으로 저장할 파일을 선택하세요.");
  const relative = relativeTo(await io.realpath(vaultRoot(app)), dest);
  if (relative !== null) {
    const file = app.vault.getFileByPath(relative);
    if (!file) return app.vault.createBinary(relative, bytes);
    await app.vault.modifyBinary(file, bytes);
    return file;
  }
  await writeExternal(dest, bytes, false);
  return new DiskFile(dest);
}
interface FilePathReader { getPathForFile(file: File): string; }
function isFilePathReader(value: unknown): value is FilePathReader {
  return isRecord(value) && typeof value.getPathForFile === "function";
}
export function droppedPath(win: Window, file: File): string | undefined {
  const electron = (win as Renderer).require?.("electron");
  if (isRecord(electron) && isFilePathReader(electron.webUtils)) return electron.webUtils.getPathForFile(file) || undefined;
  return "path" in file && typeof file.path === "string" ? file.path : undefined;
}
export async function claimExplorerTicket(token: string, localAppData: string): Promise<string> {
  if (!/^[a-f0-9]{32}$/i.test(token) || !paths().isAbsolute(localAppData)) throw Error("유효하지 않은 탐색기 열기 요청입니다.");
  const request = paths().join(localAppData, "HangleEditor", "requests", token + ".txt");
  const io = disk(), info = await io.lstat(request);
  if (!info.isFile() || info.size > 131072 || Date.now() - info.mtimeMs > 24 * 60 * 60 * 1000) throw Error("유효하지 않거나 만료된 탐색기 열기 요청입니다.");
  const path = await io.readFile(request, "utf8");
  await io.unlink(request); // Only one instance may claim a request.
  return path;
}
