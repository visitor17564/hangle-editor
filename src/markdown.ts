import { App, TFile, getFrontMatterInfo, htmlToMarkdown, sanitizeHTMLToDom } from "obsidian";
import { Marked, type TokenizerExtension } from "marked";

const imageTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };

const wikiLinks: TokenizerExtension = {
  name: "vault-link", level: "inline", start: text => text.search(/!?\[\[/),
  tokenizer(source) {
    const match = /^(!?)\[\[([^\]\n|]+)(?:\|([^\]\n]*))?\]\]/.exec(source);
    if (!match) return;
    const [, embed, href, alias] = match;
    const label = alias || href;
    return { type: embed ? "image" : "link", raw: match[0], href, title: null,
      text: label, tokens: [{ type: "text", raw: label, text: label }] };
  }
};

async function imageData(app: App, file: TFile, mime: string): Promise<string> {
  const bytes = await app.vault.readBinary(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(Error("첨부 이미지를 데이터 URL로 변환하지 못했습니다."));
    };
    reader.onerror = () => reject(Error(reader.error?.message ?? "첨부 이미지를 읽지 못했습니다."));
    reader.readAsDataURL(new Blob([bytes], { type: mime }));
  });
}

export async function noteHtml(app: App, file: TFile, text: string): Promise<string> {
  const images = new Map<string, Promise<string>>();
  const parser = new Marked({ gfm: true, async: true, extensions: [wikiLinks], walkTokens: async token => {
    if (token.type !== "image") return;
    const href: unknown = token.href; // Marked also passes extension tokens with arbitrary fields.
    if (typeof href !== "string" || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) return;
    let path = href;
    try { path = decodeURIComponent(path); } catch { /* Literal percent in a filename. */ }
    const asset = app.metadataCache.getFirstLinkpathDest(path, file.path);
    const mime = asset && imageTypes[asset.extension.toLowerCase()];
    if (!asset || !mime) return;
    if (!images.has(asset.path)) images.set(asset.path, imageData(app, asset, mime));
    token.href = await images.get(asset.path)!;
  } });
  return await parser.parse(text.slice(getFrontMatterInfo(text).contentStart));
}

function tableMarkdown(table: HTMLTableElement): string {
  // Obsidian renders HTML tables when GFM cannot represent the original spans.
  if (table.querySelector("[colspan], [rowspan], table")) return table.outerHTML;
  const rows = Array.from(table.rows, row => Array.from(row.cells, cell =>
    htmlToMarkdown(cell.innerHTML).trim().replace(/\r?\n+/g, "<br>").replace(/\|/g, "\\|")));
  if (!rows.length) return "";
  const width = Math.max(...rows.map(row => row.length));
  const line = (row: string[]) => "| " + Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ") + " |";
  return [line(rows[0]), line(Array<string>(width).fill("---")), ...rows.slice(1).map(line)].join("\n");
}

export function asMarkdown(bytes: ArrayBuffer): string {
  const fragment = sanitizeHTMLToDom(new TextDecoder().decode(bytes));
  const blocks: string[] = [];
  let list: string[] = [];
  let ordered = false;
  const flush = () => { if (list.length) { blocks.push(list.join("\n")); list = []; } };
  for (const node of Array.from(fragment.children)) {
    if (node.tagName === "TABLE") {
      flush(); blocks.push(tableMarkdown(node as HTMLTableElement));
      continue;
    }
    const md = htmlToMarkdown(node.outerHTML).trim();
    if (node.tagName === "P" && /^(?:[•●▪]|\d+[.)])\s/.test((node.textContent ?? "").trimStart())) {
      const numbered = /^\d/.test((node.textContent ?? "").trimStart());
      if (list.length && numbered !== ordered) flush();
      ordered = numbered;
      list.push(md.replace(/^[•●▪]\s+/, "- ").replace(/^(\d+)\\([.)])\s+/, "$1$2 "));
    } else {
      flush();
      if (md) blocks.push(md);
    }
  }
  flush();
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}
