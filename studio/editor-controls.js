import { prepareRhwpInternalClipboardHtml } from "@hop/upstream/clipboard";
import { tableObjectClipboardTarget } from "@upstream/engine/table-object-clipboard-target";
import { closeToolbarSplitMenus, setToolbarSplitOpen } from "@upstream/ui/toolbar-split-menu";
import { enableToolbarScroll, fitMenus } from "./menu-layout.js";

export function installEditorControls(runtime, input, send) {
  const menu = document.getElementById("menu-bar"), toolbar = document.getElementById("icon-toolbar");
  fitMenus(menu);
  enableToolbarScroll(toolbar);
  for (const command of ["cut", "copy", "paste"]) {
    const id = "edit:" + command;
    const original = runtime.registry.get(id);
    runtime.registry.register({ ...original, canExecute(ctx) {
      if (command === "cut" && input.cursor.getSelectedTableRef()?.cellPath?.length > 1) return false;
      return original.canExecute({ ...ctx, hasSelection: ctx.hasSelection || !!input.getNonEmptyHeaderFooterSelection() });
    }, execute() {
      input.focus();
      send({ type: "clipboard-command", command });
    } });
  }
  // rhwp handles native clipboard events for text and pictures. Its table command
  // uses navigator.clipboard instead, which an opaque iframe cannot access.
  function copyTable(event) {
    const ref = input.cursor.getSelectedTableRef();
    if (!ref || !event.clipboardData || event.target !== input.textarea) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const cutting = event.type === "cut";
    if (cutting && (input.isFormMode() || ref.cellPath?.length > 1)) return;
    const target = tableObjectClipboardTarget(ref);
    const args = [ref.sec, ref.ppi, target.controlIndex, target.ownerCellPathJson];
    input.wasm.copyControl(...args);
    const text = input.wasm.getClipboardText() || "[표]";
    let markup = "";
    try { markup = input.wasm.exportControlHtml(...args); } catch { /* The internal marker still supports an in-document paste. */ }
    const html = prepareRhwpInternalClipboardHtml(input, markup, text);
    event.clipboardData.setData("text/plain", text);
    event.clipboardData.setData("text/html", html);
    if (cutting) input.performDelete();
  }
  document.addEventListener("copy", copyTable, true);
  document.addEventListener("cut", copyTable, true);

  menu.addEventListener("mousedown", event => {
    if (event.button === 0 && event.target.closest("[data-cmd]")) event.preventDefault();
  });
  toolbar.addEventListener("mousedown", event => {
    if (event.button === 0 && event.target.closest("button, [data-cmd]")) event.preventDefault();
  });
  toolbar.addEventListener("click", event => {
    const arrow = event.target.closest(".tb-split-arrow");
    if (arrow) {
      const split = arrow.closest(".tb-split");
      closeToolbarSplitMenus(toolbar, split);
      setToolbarSplitOpen(split, !split.classList.contains("open"));
      return;
    }
    const item = event.target.closest("[data-cmd]");
    if (!item) return;
    closeToolbarSplitMenus(toolbar);
    runtime.dispatcher.dispatch(item.dataset.cmd, { anchorEl: item });
  });
  document.addEventListener("mousedown", event => {
    closeToolbarSplitMenus(toolbar, event.target.closest(".tb-split"));
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeToolbarSplitMenus(toolbar); });
}
