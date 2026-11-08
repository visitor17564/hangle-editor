import { studioGzip, wasmGzip } from "hangle-editor:assets";

const decode64 = (value: string): ArrayBuffer => Uint8Array.from(atob(value), ch => ch.charCodeAt(0)).buffer;
async function unpack(value: string) {
  const stream = new Blob([decode64(value)]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}
let assets: Promise<[string, ArrayBuffer]> | undefined;
function loadAssets() {
  return assets ??= Promise.all([unpack(studioGzip).then(bytes => new TextDecoder().decode(bytes)), unpack(wasmGzip)]);
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
      port1.onmessage = ({ data }) => {
        if (data?.type === "created" && data.bytes instanceof ArrayBuffer && data.bytes.byteLength) {
          if (data.losses) reject(Error(`문서 변환 중 보존할 수 없는 개체가 ${data.losses}개 있습니다.`));
          else resolve(data.bytes);
        } else reject(Error(data?.message || "HWPX를 생성하지 못했습니다."));
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
    this.channel.port1.onmessage = ({ data }) => {
      if (data?.type === "closing") {
        this.closing = data;
        for (const [id, request] of this.requests) {
          if (request.format !== this.format) continue;
          this.requests.delete(id);
          request.resolve(data);
        }
      } else if (data?.type === "reply") {
        const job = this.requests.get(data.id);
        if (!job) return;
        this.requests.delete(data.id);
        if (data.error || !(data.bytes instanceof ArrayBuffer)) job.reject(Error(data.error || "문서 데이터를 받을 수 없습니다."));
        else job.resolve(data);
      } else if (data) {
        if (data.type === "ready") this.ready = true;
        this.onEvent(data);
      }
    };
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
