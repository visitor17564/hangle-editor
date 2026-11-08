import "./storage.js";
import init from "@wasm/rhwp.js";
import { WasmBridge, EventBus, DocumentDirtyState } from "@hop/upstream/core";
import { CanvasView, Ruler } from "@hop/upstream/view";
import { InputHandler, CellSelectionRenderer, TableObjectRenderer, TableResizeRenderer } from "@hop/upstream/editor";
import { CommandPalette, ContextMenu, MenuBar, initStyleToolbarOverflow } from "@hop/upstream/ui";
import { Toolbar } from "@hop/ui/toolbar";
import { enhanceCustomSelects } from "@hop/ui/custom-select";
import { createCommandRuntime } from "@hop/host/command-runtime";
import { createRendererSession } from "@hop/host/renderer-session";
import { initToolbarLabels } from "@hop/host/toolbar-labels";
import { loadDocumentForOpen } from "@hop/core/document-open";
import { PDFDocument } from "pdf-lib";
import { loadWebFonts } from "./fonts.js";

const byId = id => document.getElementById(id);
const status = text => { byId("sb-message").textContent = text; };
const bus = new EventBus();
const state = new DocumentDirtyState(bus);
class EditorEngine extends WasmBridge {
  loadDocumentWithPassword(bytes, password, name) {
    super.loadDocumentWithPassword(bytes, password, name);
    this.savePassword = password;
  }
  exportFile(format) {
    const encrypted = this.requiresPasswordForSave;
    if (encrypted && !this.savePassword) throw Error("문서 암호를 확인할 수 없습니다.");
    if (format === "hwpx") return encrypted ? this.exportHwpxWithPasswordAndReport(this.savePassword) : this.exportHwpxWithReport();
    return encrypted ? this.exportHwpWithPasswordAndReport(this.savePassword) : this.exportHwpWithReport();
  }
}
const wasm = new EditorEngine();
let port, canvas, input, toolbar, revision = 0, loading = true;
const runtime = createCommandRuntime({
  wasm, eventBus: bus, documentState: state,
  getInputHandler: () => input, getCanvasView: () => canvas, setStatusMessage: status
});
const send = data => port.postMessage(data);
function dirty() {
  if (loading) return;
  revision++;
  state.markDirty("edit");
  status("수정됨");
  send({ type: "changed", revision });
}
bus.on("document-changed", dirty);
bus.on("document-mutated", dirty);
bus.on("document-dirty-changed", () => bus.emit("command-state-changed"));
bus.on("vault-action", action => send({ type: "action", action }));
bus.on("vault-error", message => send({ type: "error", message }));
bus.on("equation-edit-request", () => runtime.dispatcher.dispatch("insert:equation-edit"));

function setupChrome() {
  const surface = byId("scroll-container");
  canvas = new CanvasView(surface, wasm, bus, createRendererSession());
  const scroll = canvas.getVirtualScroll(), viewport = canvas.getViewportManager();
  new Ruler(byId("h-ruler"), byId("v-ruler"), surface, bus, wasm, scroll, viewport);
  input = new InputHandler(surface, wasm, bus, scroll, viewport);
  input.setDispatcher(runtime.dispatcher);
  input.setContextMenu(new ContextMenu(runtime.dispatcher, runtime.registry));
  input.setCommandPalette(new CommandPalette(runtime.registry, runtime.dispatcher));
  input.setCellSelectionRenderer(new CellSelectionRenderer(surface, scroll));
  input.setTableObjectRenderer(new TableObjectRenderer(surface, scroll));
  input.setTableResizeRenderer(new TableResizeRenderer(surface, scroll));
  input.setPictureObjectRenderer(new TableObjectRenderer(surface, scroll, true));
  toolbar = new Toolbar(byId("style-bar"), wasm, bus, runtime.dispatcher);
  initStyleToolbarOverflow(byId("style-bar"));
  initToolbarLabels();
  enhanceCustomSelects(document);
  new MenuBar(byId("menu-bar"), bus, runtime.dispatcher, runtime.registry);
  document.querySelector('[data-cmd="file:new-window"] .md-label').textContent = "새 탭";
  for (const button of document.querySelectorAll(".tb-btn[data-cmd], .tb-split-item[data-cmd]")) {
    button.addEventListener("mousedown", event => {
      event.preventDefault();
      button.closest(".tb-split")?.classList.remove("open");
      runtime.dispatcher.dispatch(button.dataset.cmd, { anchorEl: button });
    });
  }
  document.addEventListener("mousedown", event => {
    const split = event.target.closest(".tb-split-arrow")?.closest(".tb-split");
    document.querySelectorAll(".tb-split.open").forEach(el => { if (el !== split) el.classList.remove("open"); });
    if (split) { event.preventDefault(); split.classList.toggle("open"); }
  });
  document.addEventListener("rhwp-modal-dialog-closed", () => { if (input.isActive()) input.focus(); });
  for (const [id, delta] of [["sb-zoom-in", 0.1], ["sb-zoom-out", -0.1]]) {
    byId(id).onclick = () => viewport.setZoom(viewport.getZoom() + delta);
  }
  const fit = page => {
    const { width, height } = wasm.getPageInfo(0);
    viewport.setZoom(Math.max(0.1, Math.min(4, (surface.clientWidth - 40) / width, page ? (surface.clientHeight - 40) / height : Infinity)));
  };
  byId("sb-zoom-fit").onclick = () => fit(true);
  byId("sb-zoom-fit-width").onclick = () => fit(false);
  bus.on("zoom-level-display", zoom => { byId("sb-zoom-val").textContent = Math.round(zoom * 100) + "%"; });
  bus.on("current-page-changed", (page, total) => {
    byId("sb-page").textContent = `${page + 1} / ${total} 쪽`;
    byId("sb-section").textContent = `구역 ${wasm.getPageInfo(page).sectionIndex + 1} / ${wasm.getDocumentInfo().sectionCount}`;
  });
  bus.on("insert-mode-changed", insert => { byId("sb-mode").textContent = insert ? "삽입" : "수정"; });
  bus.on("picture-object-selection-changed", selected => {
    document.querySelector(".tb-rotate-group").style.display = selected ? "" : "none";
  });
  bus.on("headerFooterModeChanged", mode => {
    const group = document.querySelector(".tb-headerfooter-group");
    group.style.display = mode === "none" ? "none" : "";
    group.querySelector(".tb-hf-label").textContent = mode === "header" ? "머리말" : "꼬리말";
    surface.classList.toggle("hf-editing", mode !== "none");
  });
  document.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.isComposing) return;
    const key = event.key.toLowerCase();
    let command;
    if (key === "s" && !event.altKey) command = event.shiftKey ? "file:save-as" : "file:save";
    if (key === "o" && !event.shiftKey) command = event.altKey ? "file:open-recent" : "file:open";
    if (key === "p" && !event.altKey && !event.shiftKey) command = "file:print";
    if (!command || document.querySelector(".dialog-overlay")) return;
    event.preventDefault(); event.stopImmediatePropagation();
    runtime.dispatcher.dispatch(command);
  }, true);
  document.addEventListener("dragover", e => e.preventDefault());
  document.addEventListener("drop", async e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && /\.hwpx?$/i.test(file.name)) {
      const bytes = await file.arrayBuffer();
      port.postMessage({ type: "import", name: file.name, bytes }, [bytes]);
    }
  });
}

async function exportPdf() {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < wasm.pageCount; index++) {
    const { width, height } = wasm.getPageInfo(index);
    const bitmap = document.createElement("canvas"), scale = 1.5;
    bitmap.width = Math.ceil(width * scale); bitmap.height = Math.ceil(height * scale);
    wasm.renderPageToCanvas(index, bitmap, scale);
    const png = await new Promise((resolve, reject) => bitmap.toBlob(blob =>
      blob ? resolve(blob) : reject(Error("PDF 페이지를 만들 수 없습니다.")), "image/png"));
    const image = await pdf.embedPng(await png.arrayBuffer());
    const page = pdf.addPage([width * 0.75, height * 0.75]);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    bitmap.width = bitmap.height = 0;
  }
  return pdf.save();
}

async function handle({ data }) {
  try {
    if (data.type === "snapshot") {
      input.flushDeferredPaginationIfNeeded("save", false);
      const version = revision;
      const output = version <= (data.after ?? -1) ? { bytes: new Uint8Array() } :
        data.format === "pdf" ? { bytes: await exportPdf() } : wasm.exportFile(data.format);
      const buffer = output.bytes.slice().buffer;
      port.postMessage({ type: "reply", id: data.id, bytes: buffer, revision: version,
        losses: output.contentLoss?.count ?? 0 }, [buffer]);
    } else if (data.type === "saved" && revision === data.revision) {
      state.markClean("vault-save"); status(data.message || "저장됨");
    } else if (data.type === "theme") {
      document.documentElement.dataset.themeEffective = data.dark ? "dark" : "light";
      bus.emit("theme-changed", { effective: data.dark ? "dark" : "light" });
    }
  } catch (error) {
    send({ type: "reply", id: data.id, error: error.message ?? String(error) });
  }
}

async function connect(event) {
  if (event.source !== window.parent || event.data?.type !== "hwp-editor-connect" || !event.ports[0]) return;
  window.removeEventListener("message", connect);
  port = event.ports[0];
  const { engine, bytes, name, dark } = event.data;
  try {
    document.documentElement.dataset.themeEffective = dark ? "dark" : "light";
    await init({ module_or_path: engine });
    await wasm.initialize();
    await loadWebFonts();
    const info = await loadDocumentForOpen(wasm, new Uint8Array(bytes), name);
    if (!info) throw Error("문서 열기를 취소했습니다.");
    setupChrome();
    canvas.prepareDocumentLoad();
    await canvas.loadDocument();
    toolbar.setEnabled(true);
    toolbar.initFontDropdown(info.fontsUsed);
    toolbar.initStyleDropdown();
    input.activateWithCaretPosition();
    status(name);
    loading = false;
    port.onmessage = handle;
    // The shell may detach the iframe before Obsidian calls its asynchronous close hook.
    window.addEventListener("pagehide", () => {
      try {
        input.flushDeferredPaginationIfNeeded("close", false);
        const result = state.isDirty() ? wasm.exportFile(/\.hwpx$/i.test(name) ? "hwpx" : "hwp") : null;
        const buffer = result?.bytes.slice().buffer ?? new ArrayBuffer(0);
        port.postMessage({ type: "closing", revision, bytes: buffer, losses: result?.contentLoss.count ?? 0 }, [buffer]);
      } catch (error) { send({ type: "error", message: String(error) }); }
    }, { once: true });
    send({ type: "ready", pages: wasm.pageCount });
    if (event.data.edited) dirty();
  } catch (error) {
    send({ type: "failed", message: error.message ?? String(error) });
  }
}
window.addEventListener("message", connect);
