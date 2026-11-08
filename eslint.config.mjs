import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  globalIgnores(["main.js", "node_modules/"]),
  ...obsidianmd.configs.recommended,
  { files: ["src/**/*.ts"], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  // These modules run inside their own sandboxed iframe. The Obsidian host's
  // activeDocument is neither available there nor the document of this editor.
  { files: ["studio/**/*.js"], rules: { "obsidianmd/prefer-active-doc": "off" } },
  // These inline styles are serialized into a document for rhwp's HTML importer;
  // a UI theme class would lose strikethrough and fixed-width text in the HWPX.
  { files: ["studio/markdown.js"], rules: { "obsidianmd/no-static-styles-assignment": "off" } }
]);
