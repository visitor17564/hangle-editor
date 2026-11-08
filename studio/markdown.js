import { unzipSync, strFromU8 } from "fflate";

const children = (node, tag) => Array.from(node.children).filter(child => child.localName === tag);
const first = (node, tag) => children(node, tag)[0];
const descendants = (node, tag) => Array.from(node.getElementsByTagNameNS("*", tag));
const el = (tag, text) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
};
const wrap = (tag, content) => { const element = el(tag); element.append(content); return element; };

function readXml(bytes) {
  const xml = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw Error("HWPX 문서 구조를 읽지 못했습니다.");
  return xml;
}

function imageUrl(type, bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return "data:" + type + ";base64," + btoa(binary);
}

// Use rhwp's HWPX serializer for both source formats. Walk the logical sections
// and cells once rather than reassembling paragraphs from visual page breaks.
export function documentHtml(engine) {
  const files = unzipSync(engine.borrowDocumentHandle().exportHwpx(), { filter: entry =>
    /^Contents\/(?:header\.xml|section\d+\.xml|content\.hpf)$/.test(entry.name) || /^BinData\//i.test(entry.name) });
  const header = readXml(files["Contents/header.xml"]);
  const styles = new Map(descendants(header, "style").map(s => [s.getAttribute("id"), s]));
  const chars = new Map(descendants(header, "charPr").map(c => [c.getAttribute("id"), c]));
  const manifest = readXml(files["Contents/content.hpf"]);
  const assets = new Map(descendants(manifest, "item").map(a => [a.getAttribute("id"), a]));
  const sections = Object.keys(files).filter(name => /^Contents\/section\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)\.xml/)[1]) - Number(b.match(/(\d+)\.xml/)[1]));
  const out = el("div");

  function picture(pic) {
    const ref = descendants(pic, "img")[0]?.getAttribute("binaryItemIDRef");
    const asset = assets.get(ref), type = asset?.getAttribute("media-type");
    const href = asset?.getAttribute("href")?.replace(/^(?:\.\.\/|\.\/)/, "");
    const alt = first(pic, "shapeComment")?.textContent || "그림";
    if (!files[href] || !/^image\/(png|jpeg|gif|webp|bmp)$/i.test(type)) return document.createTextNode("[" + alt + "]");
    const img = el("img"); img.alt = alt; img.src = imageUrl(type, files[href]); return img;
  }

  function table(source) {
    const node = el("table");
    for (const [rowIndex, row] of children(source, "tr").entries()) {
      const tr = el("tr");
      for (const cell of children(row, "tc")) {
        const td = el(rowIndex === 0 ? "th" : "td"), span = first(cell, "cellSpan");
        for (const name of ["colSpan", "rowSpan"]) {
          const count = Number(span?.getAttribute(name));
          if (count > 1) td.setAttribute(name, String(count));
        }
        for (const p of children(first(cell, "subList") ?? cell, "p")) paragraph(p, td);
        tr.append(td);
      }
      node.append(tr);
    }
    return node;
  }

  function paragraph(p, parent) {
    const style = styles.get(p.getAttribute("styleIDRef"));
    const name = [style?.getAttribute("name"), style?.getAttribute("engName")].join(" ");
    const heading = /(?:개요|제목|Heading|Outline)\s*([1-6])(?!\d)/i.exec(name);
    const tag = heading ? "h" + heading[1] : "p";
    let block = el(tag);
    const flush = () => { if (block.childNodes.length) parent.append(block); block = el(tag); };
    for (const run of children(p, "run")) {
      const cs = chars.get(run.getAttribute("charPrIDRef"));
      for (const item of run.children) {
        if (item.localName === "t") {
          const text = document.createDocumentFragment();
          for (const part of item.childNodes) {
            if (part.nodeType === Node.TEXT_NODE) text.append(part.textContent);
            else if (part.localName === "lineBreak") text.append(el("br"));
            else if (part.localName === "tab") text.append("\t");
            else text.append(part.textContent || " ");
          }
          let content = text;
          if (cs && first(cs, "bold")) content = wrap("strong", content);
          if (cs && first(cs, "italic")) content = wrap("em", content);
          if (cs && first(cs, "strikeout")?.getAttribute("shape") && first(cs, "strikeout").getAttribute("shape") !== "NONE") content = wrap("del", content);
          block.append(content);
        } else if (item.localName === "tbl") { flush(); parent.append(table(item)); }
        else if (item.localName === "pic") block.append(picture(item));
        else {
          // Captions, notes and text boxes have their own paragraph lists.
          for (const sub of descendants(item, "subList").filter(s => !s.parentElement.closest("subList"))) {
            flush();
            for (const inner of children(sub, "p")) paragraph(inner, parent);
          }
        }
      }
    }
    flush();
  }
  for (const section of sections) {
    const doc = readXml(files[section]);
    for (const p of children(doc.documentElement, "p")) paragraph(p, out);
  }
  return out.innerHTML;
}

// The input is never attached to the DOM. rhwp's native HTML importer handles
// editable character runs, tables and data images. Outline styles carry headings
// into the saved HWPX so future exports can recover their levels.
export function importMarkdownHtml(engine, html) {
  engine.createNewDocument();
  if (!html.trim()) return;
  const root = new DOMParser().parseFromString(html, "text/html").body;
  root.querySelectorAll("script,style,iframe,object,embed,svg,link,base,meta").forEach(n => n.remove());
  root.querySelectorAll("input[type=checkbox]").forEach(n => n.replaceWith(n.checked ? "[x] " : "[ ] "));
  for (const img of root.querySelectorAll("img")) {
    if (!/^data:image\/(?:png|jpeg|gif|webp|bmp);base64,/i.test(img.getAttribute("src") || "")) {
      img.replaceWith(img.alt || img.getAttribute("src") || "[그림]");
    }
  }
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href") || "";
    if (href && href !== a.textContent && !/^(?:javascript|data):/i.test(href)) a.append(" (" + href + ")");
    a.replaceWith(...a.childNodes);
  }
  root.querySelectorAll("del,s").forEach(n => { const s = el("span"); s.style.textDecoration = "line-through"; s.append(...n.childNodes); n.replaceWith(s); });
  const doc = engine.borrowDocumentHandle();
  const styles = JSON.parse(doc.getStyleList());
  const groups = [];
  function put(node, level = 0) {
    // rhwp starts its first style run at the first inline tag. Mark leading plain
    // text explicitly so a later bold/italic run cannot extend back to offset 0.
    const parents = node.tagName === "TABLE" ? node.querySelectorAll("td,th,p") : [node];
    for (const parent of parents) {
      for (const text of Array.from(parent.childNodes).filter(n => n.nodeType === Node.TEXT_NODE)) {
        text.replaceWith(wrap("span", text.cloneNode()));
      }
    }
    if (level || !groups.length) groups.push({ level, html: [] });
    groups.at(-1).html.push(node.outerHTML);
  }
  function blocks(parent, prefix = "") {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim()) put(el("p", prefix + node.textContent));
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = node.tagName;
      if (tag === "UL" || tag === "OL") {
        let num = Number(node.getAttribute("start") || 1);
        for (const li of Array.from(node.children).filter(n => n.tagName === "LI")) {
          const nested = Array.from(li.children).filter(n => n.matches("ol,ul"));
          nested.forEach(n => n.remove());
          const p = el("p", prefix + (tag === "OL" ? num++ + ". " : "• "));
          p.append(...li.childNodes); put(p);
          for (const list of nested) blocks(wrap("div", list), prefix + "  ");
        }
      } else if (tag === "TABLE") put(node);
      else if (tag === "PRE") {
        for (const line of node.textContent.replace(/\n$/, "").split("\n")) {
          const span = el("span", line); span.style.fontFamily = "monospace"; put(wrap("p", span));
        }
      } else if (tag === "BLOCKQUOTE" || tag === "DIV") blocks(node, tag === "BLOCKQUOTE" ? prefix + "> " : prefix);
      else if (tag === "HR") put(el("p", "────"));
      else {
        const p = el("p", prefix);
        if (tag === "IMG") p.append(node.cloneNode(true)); else p.append(...node.childNodes);
        put(p, /^H[1-6]$/.test(tag) ? Number(tag[1]) : 0);
      }
    }
  }
  blocks(root);
  doc.beginBatch();
  try {
    for (const [index, group] of groups.entries()) {
      const para = doc.getParagraphCount(0) - 1;
      // The next group starts in an existing empty paragraph, beyond any table
      // anchor. Splitting an outline or a table anchor would copy its style or move it.
      const html = group.html.join("") + (index < groups.length - 1 ? "<p></p>" : "");
      const result = JSON.parse(doc.pasteHtml(0, para, 0, html));
      if (!result.ok) throw Error("Markdown 문단을 한글 문서로 옮기지 못했습니다.");
      if (group.level) {
        const style = styles.find(s => s.englishName === "Outline " + group.level);
        if (style) doc.applyStyle(0, para, style.id);
      }
    }
  } finally { doc.endBatch(); }
}
