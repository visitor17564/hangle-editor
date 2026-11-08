// rhwp already places the caret on mousedown, including inside nested cells.
function paragraphAtCaret(input) {
  const { cursor, wasm } = input;
  if (cursor.isInHeaderFooter()) {
    const para = cursor.hfParaIdx;
    const info = JSON.parse(wasm.getHeaderFooterParaInfo(cursor.hfSectionIdx, cursor.headerFooterMode === "header", cursor.hfApplyTo, para));
    return { text: info.text, length: info.charCount, offset: cursor.hfCharOffset,
      move: offset => cursor.setHfCursorPosition(para, offset), anchor: () => cursor.setHfAnchor() };
  }
  if (cursor.isInFootnote()) {
    const para = cursor.fnInnerParaIdx;
    const text = wasm.getFootnoteInfo(cursor.fnSectionIdx, cursor.fnParaIdx, cursor.fnControlIdx).texts[para];
    return { text, length: Array.from(text).length, offset: cursor.fnCharOffset,
      move: offset => cursor.setFnCursorPosition(para, offset), anchor: () => cursor.setFnAnchor() };
  }
  const pos = cursor.getPosition();
  const { sectionIndex: sec, paragraphIndex: para, parentParaIndex: parent, cellPath } = pos;
  let length, text;
  if (cellPath?.length > 1) {
    const path = JSON.stringify(cellPath);
    length = wasm.getCellParagraphLengthByPath(sec, parent, path);
    text = wasm.getTextInCellByPath(sec, parent, path, 0, length);
  } else if (parent !== undefined) {
    const cell = [sec, parent, pos.controlIndex, pos.cellIndex, pos.cellParaIndex];
    length = wasm.getCellParagraphLength(...cell);
    text = wasm.getTextInCell(...cell, 0, length);
  } else {
    length = wasm.getParagraphLength(sec, para);
    text = wasm.getTextRange(sec, para, 0, length);
  }
  return { text, length, offset: pos.charOffset,
    move: offset => cursor.moveTo({ ...pos, charOffset: offset }), anchor: () => cursor.setAnchor() };
}

export function installTextSelection(surface, input) {
  const content = surface.querySelector("#scroll-content");
  function select(event) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (!input.isActive() || !content.contains(event.target) || input.imagePlacementMode || input.textboxPlacementMode ||
        input.connectorDrawingMode || input.polygonDrawingMode || input.cursor.isInPictureObjectSelection() ||
        input.cursor.isInTableObjectSelection() || input.cursor.isInCellSelectionMode()) return;
    const rect = input.cursor.getRect();
    if (!rect) return;
    const zoom = input.viewportManager.getZoom(), bounds = content.getBoundingClientRect();
    const pageLeft = input.virtualScroll.getPageLeftResolved(rect.pageIndex, content.clientWidth);
    const x = (event.clientX - bounds.left - pageLeft) / zoom;
    const y = (event.clientY - bounds.top - input.virtualScroll.getPageOffset(rect.pageIndex)) / zoom;
    if (y < rect.y - 1 || y > rect.y + rect.height + 1) return;

    const para = paragraphAtCaret(input);
    let start = 0, end = para.length;
    if (event.type === "dblclick") {
      const chars = Array.from(para.text); // WASM counts Unicode scalars, including supplementary characters as one.
      if (!chars.length) return;
      // hitTest returns an insertion offset. The right half of a glyph maps to the next caret.
      start = Math.max(0, Math.min(chars.length - 1, para.offset - (x < rect.x ? 1 : 0)));
      end = start + 1;
      const space = /\s/u.test(chars[start]);
      while (start > 0 && /\s/u.test(chars[start - 1]) === space) start--;
      while (end < chars.length && /\s/u.test(chars[end]) === space) end++;
    }
    if (end <= start) return;
    event.preventDefault();
    input.cursor.clearSelection();
    para.move(start);
    para.anchor();
    para.move(end);
    input.cursor.resetPreferredX();
    input.updateCaret(true);
    input.focus();
  }
  surface.addEventListener("dblclick", select);
  surface.addEventListener("click", event => { if (event.detail === 3) select(event); });
}
