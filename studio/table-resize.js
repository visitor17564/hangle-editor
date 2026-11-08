import { ensureTableCellBboxCache } from "@upstream/engine/table-bbox-cache";

function boundsOf(cells, pageIndex) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const cell of cells) {
    left = Math.min(left, cell.x);
    top = Math.min(top, cell.y);
    right = Math.max(right, cell.x + cell.w);
    bottom = Math.max(bottom, cell.y + cell.h);
  }
  return { pageIndex, x: left, y: top, width: right - left, height: bottom - top };
}

function resizeObject(input, ref, cells, before, after) {
  const { wasm } = input;
  const args = [ref.sec, ref.ppi, ref.ci];
  const path = ref.cellPath?.length > 1 ? JSON.stringify(ref.cellPath) : null;
  const scaleX = after.width / before.width, scaleY = after.height / before.height;
  const rendered = new Map();
  for (const cell of cells) {
    const previous = rendered.get(cell.cellIdx);
    if (!previous || cell.h > previous.h) rendered.set(cell.cellIdx, cell);
  }
  const indices = path ? rendered.keys() :
    Array.from({ length: wasm.getTableDimensions(...args).cellCount }, (_, index) => index);
  // Use stored dimensions once per logical cell. Rendered boxes can repeat across
  // pages and change height with text wrapping, especially in merged cells.
  const updates = [];
  for (const cellIdx of indices) {
    const size = path ? wasm.getCellPropertiesByPath(ref.sec, ref.ppi, path, cellIdx) : wasm.getCellProperties(...args, cellIdx);
    const visible = rendered.get(cellIdx);
    // A zero or text-expanded row has no useful stored starting height.
    const width = size.width || (visible?.w ?? 0) * 75;
    const visibleHeight = (visible?.h ?? 0) * 75;
    const height = visibleHeight > size.height + 75 ? visibleHeight : size.height;
    const widthDelta = scaleX === 1 ? 0 : Math.round(width * scaleX - size.width);
    const heightDelta = scaleY === 1 ? 0 : Math.round(height * scaleY - size.height);
    if (widthDelta || heightDelta) updates.push({ cellIdx, widthDelta, heightDelta });
  }
  if (!updates.length) return;
  const props = path ? null : wasm.getTableProperties(...args);
  input.executeOperation({ kind: "snapshot", operationType: "resizeTableCells", operation(engine) {
    if (path) engine.resizeTableCellsByPath(ref.sec, ref.ppi, path, updates);
    else engine.resizeTableCells(...args, updates);
    if (props && !props.treatAsChar) {
      // Preserve the opposite edge of a floating table. Inline tables follow
      // their paragraph anchor when layout runs, as they do for keyboard edits.
      const visible = engine.getTableCellBboxes(...args, before.pageIndex).filter(cell => cell.pageIndex === before.pageIndex);
      if (visible.length) {
        const actual = boundsOf(visible, before.pageIndex);
        const dx = Math.round((after.x - actual.x) * 75), dy = Math.round((after.y - actual.y) * 75);
        if (dx || dy) engine.setTableProperties(...args, {
          horzOffset: props.horzOffset + (props.horzAlign === "Right" ? -dx : dx),
          vertOffset: props.vertOffset + (props.vertAlign === "Bottom" ? -dy : dy)
        });
      }
    }
    return input.cursor.getPosition();
  } });
}

export function installTableResize(surface, input) {
  const content = surface.querySelector("#scroll-content");
  function target(event) {
    const ref = input.cursor.getSelectedTableRef();
    if (!ref || !input.isActive() || input.isFormMode() || !content.contains(event.target)) return null;
    const bounds = content.getBoundingClientRect(), cx = event.clientX - bounds.left, cy = event.clientY - bounds.top;
    const scroll = input.virtualScroll, zoom = input.viewportManager.getZoom(), page = scroll.getPageAtPoint(cx, cy);
    if (page < 0) return null;
    const cells = ensureTableCellBboxCache(input, { sec: ref.sec, ppi: ref.ppi, ci: ref.ci, path: ref.cellPath }, page);
    if (!cells) return null;
    const onPage = cells.filter(cell => cell.pageIndex === page);
    if (!onPage.length) return null;
    const x = (cx - scroll.getPageLeftResolved(page, content.clientWidth)) / zoom, y = (cy - scroll.getPageOffset(page)) / zoom;
    const handle = input.tableObjectRenderer.getHandleAtPoint(cx, cy);
    if (handle) return { handle, ref, cells, zoom, box: boundsOf(onPage, page) };
    const edge = input.tableResizeRenderer.hitTestBorder(x, y, onPage);
    // Leave the perimeter available for moving the table between handles.
    if (!edge || edge.index === 0) return null;
    const lines = input.tableResizeRenderer.computeBorderLines(onPage);
    const axis = edge.type === "col" ? lines.colLines : lines.rowLines;
    if (edge.index === axis.at(-1)?.index) return null;
    return { edge, onPage, x, y };
  }

  surface.addEventListener("mousemove", event => {
    if (event.buttons || !input.cursor.isInTableObjectSelection()) return;
    const hit = target(event);
    if (hit?.edge) surface.style.cursor = hit.edge.type === "col" ? "col-resize" : "row-resize";
  });
  surface.addEventListener("mousedown", down => {
    if (down.button !== 0 || down.shiftKey || down.ctrlKey || down.altKey || down.metaKey) return;
    const hit = target(down);
    if (!hit) return;
    if (hit.edge) {
      input.startResizeDrag(hit.edge, hit.x, hit.y, hit.onPage);
      if (!input.isResizeDragging) return;
      down.preventDefault();
      down.stopImmediatePropagation();
      input.focus();
      return;
    }
    down.preventDefault();
    down.stopImmediatePropagation();
    input.focus();
    const { handle, box, zoom } = hit;
    const west = handle.includes("w"), north = handle.includes("n");
    const horizontal = west || handle.includes("e"), vertical = north || handle.includes("s");
    const listeners = new AbortController(), options = { capture: true, signal: listeners.signal };
    function geometry(event) {
      const dx = (event.clientX - down.clientX) / zoom, dy = (event.clientY - down.clientY) / zoom;
      const width = horizontal ? Math.max(1, box.width + (west ? -dx : dx)) : box.width;
      const height = vertical ? Math.max(1, box.height + (north ? -dy : dy)) : box.height;
      return { pageIndex: box.pageIndex, width, height, x: box.x + (west ? box.width - width : 0), y: box.y + (north ? box.height - height : 0) };
    }
    function finish(event) {
      listeners.abort();
      try {
        if (event && input.cursor.getSelectedTableRef() === hit.ref) {
          const after = geometry(event);
          if (Math.max(Math.abs(after.width - box.width), Math.abs(after.height - box.height)) * zoom >= 2) {
            resizeObject(input, hit.ref, hit.cells, box, after);
          }
        }
      } finally {
        surface.style.cursor = "";
        input.renderTableObjectSelection();
      }
    }
    surface.style.cursor = handle + "-resize";
    document.addEventListener("mousemove", event => {
      event.stopImmediatePropagation();
      if (!(event.buttons & 1)) { finish(); return; }
      input.tableObjectRenderer.renderDragPreview(geometry(event), zoom);
    }, options);
    document.addEventListener("mouseup", event => {
      if (event.button !== 0) return;
      event.stopImmediatePropagation();
      finish(event);
    }, options);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); finish(); }
    }, options);
    window.addEventListener("blur", () => finish(), { once: true, signal: listeners.signal });
  }, true);
}
