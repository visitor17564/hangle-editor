import { build } from "esbuild";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { hop, rhwp } from "./upstream.mjs";

const root = path.resolve(import.meta.dirname, "..");
const host = path.join(hop, "apps/studio-host");
const upstream = path.join(rhwp, "rhwp-studio/src");
const core = path.join(host, "vendor/rhwp-core");
const local = path.join(root, "studio");
const read = file => readFileSync(file, "utf8").replace(/\r\n/g, "\n");
function gzip64(data) {
  const bytes = gzipSync(data, { level: 9 });
  bytes[9] = 255; // Use the same gzip OS field on every build platform.
  return bytes.toString("base64");
}
const wasm = readFileSync(path.join(core, "rhwp_bg.wasm"));
const provenance = JSON.parse(read(path.join(core, "PROVENANCE.json")));
if (createHash("sha256").update(wasm).digest("hex") !== provenance.artifacts["rhwp_bg.wasm"].sha256) throw Error("Unexpected rhwp WASM binary");

const overrides = JSON.parse(read(path.join(hop, "config/rhwp-studio-overrides.json"))).overrides;
const aliases = new Map(overrides.map(({ id }) => [id, path.join(host, "src", id)]));
aliases.set("command/commands/file", path.join(local, "file-commands.js"));
aliases.set("core/local-fonts", path.join(upstream, "core/local-fonts.ts"));
aliases.set("core/font-loader", path.join(local, "fonts.js"));
function sourceFile(file) {
  const result = [file, file + ".ts", file + ".js", path.join(file, "index.ts")].find(candidate => existsSync(candidate) && path.extname(candidate));
  if (!result) throw Error("Missing editor source: " + file);
  return result;
}

const editorImports = {
  name: "hop-browser",
  setup(b) {
    b.onResolve({ filter: /^@wasm\/rhwp\.js$/ }, () => ({ path: path.join(core, "rhwp.js") }));
    b.onResolve({ filter: /^@hop\// }, ({ path: id }) => ({ path: sourceFile(path.join(host, "src", id.slice(5))) }));
    b.onResolve({ filter: /^@upstream\// }, ({ path: id }) => ({ path: sourceFile(path.join(upstream, id.slice(10))) }));
    b.onResolve({ filter: /^@\// }, ({ path: id }) => {
      const key = id.slice(2);
      const file = aliases.get(key) ?? (key.startsWith("upstream/") ? path.join(host, "src", key) : path.join(upstream, key));
      return { path: sourceFile(file) };
    });
    b.onResolve({ filter: /^\.\/font-loader(\.ts)?$/ }, () => ({ path: path.join(local, "fonts.js") }));
    // The theme contains two external sprite URLs. Omit the declarations before esbuild
    // resolves any assets; studio/icons.css supplies only the Lucide glyphs we use.
    b.onLoad({ filter: /[\\/]styles[\\/]base\.css$/ }, ({ path: file }) => {
      if (file !== path.join(upstream, "styles", "base.css")) return;
      const contents = read(file).replace(/^\s*--ui-icon-sprite-url:[^;\n]+;/gm, "");
      return { contents, loader: "css", resolveDir: path.dirname(file) };
    });
  }
};

const editor = await build({
  absWorkingDir: root, entryPoints: { editor: "studio/editor.js", theme: "studio/style.css" },
  outdir: "build", write: false, bundle: true, format: "iife", target: "chrome120", minify: true,
  nodePaths: [path.join(root, "node_modules")], loader: { ".svg": "dataurl" }, plugins: [editorImports],
  external: ["@tauri-apps/api/core"], // Tree-shaken native platform detector.
  define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env.BASE_URL": '""',
    "import.meta.url": '"about:srcdoc"', "__APP_VERSION__": JSON.stringify(provenance.version),
    "__HOP_VERSION__": JSON.stringify(JSON.parse(read(path.join(hop, "package.json"))).version) },
  legalComments: "inline"
});
const js = editor.outputFiles.find(f => f.path.endsWith(".js")).text;
if (js.includes("@tauri-apps/")) throw Error("A native HOP dependency reached the browser bundle");
const css = editor.outputFiles.filter(f => f.path.endsWith(".css")).map(f => f.text).join("\n");
const template = read(path.join(host, "index.html"));
// The hash allows only this pinned script inside the opaque-origin editor frame.
const escapedJs = js.replace(/<\/script/gi, "<\\/script");
const hash = createHash("sha256").update(escapedJs).digest("base64");
const csp = `default-src 'none'; script-src 'sha256-${hash}' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'`;
const html = template.replace(/<link rel="icon"[^>]*>/, () => `<meta http-equiv="Content-Security-Policy" content="${csp}">`)
  .replace('<link rel="stylesheet" href="/src/style.css" />', () => `<style>${css}</style>`)
  .replace('<script type="module" src="/src/main.ts"></script>', () => `<script>${escapedJs}</script>`);
if (!html.includes(csp) || html.includes('src="/src/main.ts"')) throw Error("Unknown HOP editor template");
const payload = {
  studioGzip: gzip64(html), wasmGzip: gzip64(wasm)
};

const notices = [
  path.join(root, "LICENSE"), path.join(hop, "LICENSE"), path.join(rhwp, "THIRD_PARTY_LICENSES.md"),
  path.join(root, "licenses/encoding_rs-0.8.42.txt"),
  ...["@noble/hashes/LICENSE", "pdf-lib/LICENSE.md", "@pdf-lib/standard-fonts/LICENSE.md",
    "@pdf-lib/upng/LICENSE", "pako/LICENSE", "tslib/LICENSE.txt", "tslib/CopyrightNotice.txt",
    "marked/LICENSE", "fflate/LICENSE", "lucide-static/LICENSE"].map(f => path.join(root, "node_modules", f))
].map(file => read(file).replaceAll("*/", "* /")).join("\n\n");
await build({
  absWorkingDir: root, entryPoints: ["src/main.ts"], outfile: "main.js", bundle: true, format: "cjs",
  platform: "browser", target: "chrome120", external: ["obsidian"], minify: true,
  banner: { js: "/*! Hangle Editor / HOP / rhwp and bundled dependencies\n" + notices + "\n*/" },
  plugins: [{ name: "editor-assets", setup(b) {
    b.onResolve({ filter: /^hangle-editor:assets$/ }, () => ({ path: "assets", namespace: "hwp" }));
    b.onLoad({ filter: /.*/, namespace: "hwp" }, () => ({ contents: Object.entries(payload).map(([k,v]) => `export const ${k}=${JSON.stringify(v)}`).join("\n") }));
  }}]
});
