import { Buffer } from "node:buffer";
import { brotliDecompress } from "node:zlib";
import { studioBrotli, wasmBrotli } from "hangle-editor:assets";
import { isRecord } from "./guards";

type NativeEditCommands = { copy(): void; cut(): void; paste(): void };
type DesktopWindow = Window & {
  require?(id: "electron"): { remote: { getCurrentWebContents(): NativeEditCommands } };
};

function unpack(value: string): Promise<ArrayBuffer> {
  // The desktop host supplies Brotli. The sandboxed editor receives only the decoded bytes.
  return new Promise((resolve, reject) => brotliDecompress(Buffer.from(value, "base64"), (error, bytes) => {
    if (error) reject(error);
    else resolve(Uint8Array.from(bytes).buffer);
  }));
}
let assets: Promise<[string, ArrayBuffer]> | undefined;
function loadAssets() {
  return assets ??= Promise.all([unpack(studioBrotli).then(bytes => new TextDecoder().decode(bytes)), unpack(wasmBrotli)]);
}
function createFrame(container: HTMLElement) {
  return container.createEl("iframe", { cls: "hangle-editor-frame", attr: {
    title: "한글 문서 편집기", sandbox: "allow-scripts allow-modals", referrerpolicy: "no-referrer"
  } });
}
function connect(frame: HTMLIFrameElement, port: MessagePort, studio: string, data: object) {
  frame.addEventListener("load", () => {
    // The sandboxed srcdoc has an opaque origin. Further traffic uses its private port.
    frame.contentWindow?.postMessage(data, "*", [port]);
  }, { once: true });
  frame.srcdoc = studio;
}
export async function createHwpx(container: HTMLElement, html = ""): Promise<ArrayBuffer> {
  const [studio, engine] = await loadAssets();
  const frame = createFrame(container);
  frame.hidden = true;
  const { port1, port2 } = new MessageChannel();
  let timer: number | undefined;
  try {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      timer = window.setTimeout(() => reject(Error("HWPX 생성 시간이 초과됐습니다.")), 120000);
      port1.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (isRecord(data) && data.type === "created" && data.bytes instanceof ArrayBuffer && data.bytes.byteLength && isCount(data.losses)) {
          if (data.losses) reject(Error(`문서 변환 중 보존할 수 없는 개체가 ${data.losses}개 있습니다.`));
          else resolve(data.bytes);
        } else reject(Error(isRecord(data) && typeof data.message === "string" ? data.message : "HWPX를 생성하지 못했습니다."));
      };
      connect(frame, port2, studio, { type: "hangle-editor-create", engine, html });
    });
  } finally {
    window.clearTimeout(timer);
    port1.close();
    port2.close();
    frame.remove();
  }
}
export interface Snapshot { bytes: ArrayBuffer; revision: number; losses: number }
export type EditorEvent = { type: "changed"; revision: number } | { type: "action"; action: string } |
  { type: "ready"; pages: number } | { type: "error" | "failed"; message: string } |
  { type: "import"; name: string; bytes: ArrayBuffer };

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function snapshotFrom({ bytes, revision, losses }: Record<string, unknown>): Snapshot | undefined {
  // A clean document legitimately sends an empty buffer when closing or checking for changes.
  if (bytes instanceof ArrayBuffer && isCount(revision) && isCount(losses)) return { bytes, revision, losses };
}
function editorEvent(data: Record<string, unknown>): EditorEvent | undefined {
  const { type } = data;
  switch (type) {
    case "changed": if (isCount(data.revision)) return { type, revision: data.revision }; break;
    case "action": if (typeof data.action === "string") return { type, action: data.action }; break;
    case "ready": if (isCount(data.pages)) return { type, pages: data.pages }; break;
    case "error": case "failed": if (typeof data.message === "string") return { type, message: data.message }; break;
    case "import": if (typeof data.name === "string" && data.bytes instanceof ArrayBuffer) return { type, name: data.name, bytes: data.bytes }; break;
  }
}

export class StudioFrame {
  private channel = new MessageChannel();
  private iframe: HTMLIFrameElement;
  private requests = new Map<number, { format: string; resolve: (value: Snapshot) => void; reject: (reason: Error) => void }>();
  private closing?: Snapshot;
  private format = "hwp";
  private nextId = 0;
  private disposed = false;
  ready = false;

  constructor(container: HTMLElement, private onEvent: (event: EditorEvent) => void) {
    this.iframe = createFrame(container);
    this.channel.port1.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (!isRecord(data) || this.disposed) return;
      if (data.type === "closing") {
        const snapshot = snapshotFrom(data);
        if (!snapshot) return;
        this.closing = snapshot;
        for (const [id, request] of this.requests) {
          if (request.format !== this.format) continue;
          this.requests.delete(id);
          request.resolve(snapshot);
        }
      } else if (data.type === "reply" && isCount(data.id)) {
        const job = this.requests.get(data.id);
        if (!job) return;
        this.requests.delete(data.id);
        const snapshot = snapshotFrom(data);
        if (typeof data.error === "string") job.reject(Error(data.error));
        else if (snapshot) job.resolve(snapshot);
        else job.reject(Error("문서 데이터를 받을 수 없습니다."));
      } else if (data.type === "clipboard-command") {
        this.runClipboardCommand(data.command);
      } else {
        const event = editorEvent(data);
        if (!event) return;
        if (event.type === "ready") this.ready = true;
        this.onEvent(event);
      }
    };
  }
  private runClipboardCommand(command: unknown) {
    if (command !== "copy" && command !== "cut" && command !== "paste") return;
    const doc = this.iframe.ownerDocument;
    if (!this.ready || this.disposed || doc.activeElement !== this.iframe || !doc.hasFocus() ||
        !doc.defaultView?.navigator.userActivation.isActive) return;
    // Chromium delivers the native edit event to the focused frame, including in
    // an Obsidian pop-out. Clipboard bytes never cross the plugin message port.
    try {
      const contents = (doc.defaultView as DesktopWindow).require?.("electron").remote.getCurrentWebContents();
      if (!contents) throw Error();
      contents[command]();
    } catch {
      this.onEvent({ type: "error", message: "클립보드 명령을 실행하지 못했습니다." });
    }
  }
  async load(bytes: ArrayBuffer, name: string, edited = false) {
    this.format = /\.hwpx$/i.test(name) ? "hwpx" : "hwp";
    const [html, engine] = await loadAssets();
    if (this.disposed) return;
    connect(this.iframe, this.channel.port2, html, { type: "hangle-editor-connect", engine, bytes, name, edited,
      dark: this.iframe.ownerDocument.body.classList.contains("theme-dark") });
  }
  theme(dark: boolean) { this.channel.port1.postMessage({ type: "theme", dark }); }
  saved(revision: number, message: string) { this.channel.port1.postMessage({ type: "saved", revision, message }); }
  snapshot(format: string, after = -1): Promise<Snapshot> {
    if (this.closing && format === this.format) return Promise.resolve(this.closing);
    if (!this.ready || this.disposed) return Promise.reject(Error("편집기가 준비되지 않았습니다."));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.requests.delete(id); reject(Error("편집기에서 저장 응답을 받지 못했습니다."));
      }, format === "pdf" ? 180000 : 20000);
      this.requests.set(id, {
        format,
        resolve: value => { window.clearTimeout(timer); resolve(value); },
        reject: error => { window.clearTimeout(timer); reject(error); }
      });
      this.channel.port1.postMessage({ type: "snapshot", id, format, after });
    });
  }
  dispose() {
    this.disposed = true;
    this.channel.port1.close();
    for (const job of this.requests.values()) job.reject(Error("편집기 탭을 닫았습니다."));
    this.requests.clear();
    this.iframe.remove();
  }
}
