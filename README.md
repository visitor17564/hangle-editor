# Hangle Editor

I built Hangle Editor after seeing rhwp and HOP because I wanted to edit Korean Hangul documents alongside the notes in my personal knowledge vault. Opening a document, changing a table, or exporting a PDF should be possible in Obsidian without installing a full office suite. [한국어 사용 안내](README.ko.md)

Edward Kim’s rhwp reads, lays out, and writes HWP and HWPX documents. HOP provides the editing interface. This plugin brings their work into Obsidian tabs and adds vault saving, command palette actions, and Markdown conversion. It also adapts clipboard commands, table resizing, and word and paragraph selection for desktop Obsidian. [rhwp](https://github.com/edwardkim/rhwp) · [HOP](https://github.com/golbin/hop)

## Installation

In desktop Obsidian 1.12.4 or later, open **Settings → Community plugins → Browse**, search for **Hangle Editor**, then install and enable it. [Obsidian community listing](https://community.obsidian.md/plugins/hangle-editor)

For a manual installation, download `main.js`, `manifest.json`, and `styles.css` from the same release. Place them in `.obsidian/plugins/hangle-editor/` inside your vault, reopen Obsidian, and enable the plugin. If you use a custom configuration folder, put the plugin under its `plugins` directory. [GitHub releases](https://github.com/visitor17564/hangle-editor/releases/latest)

## Open, edit, and save

Click an HWPX or HWP file in the vault, or use **한글 문서 열기** in the command palette to open your system file chooser. Files outside the vault open directly from their original location. **Ctrl+S** (macOS **Cmd+S**) writes back to the same file. When several tabs edit one document, the last save wins. If rhwp cannot preserve the original format, an external tab asks you to use **Save As**. For a vault document, the plugin creates a conversion copy and shows its path.

The ribbon button creates a document in the vault root by default. In **Settings → Hangle Editor**, choose another folder or toggle the ribbon icon. The separate attachment command uses **Files & Links → Default location for new attachments**, including locations relative to the current note.

## Double-click documents in Windows File Explorer

Enable Hangle Editor in the Obsidian vault you want to host the editor. Download and extract the optional Windows package, then open PowerShell in the extracted folder and run the following command with your vault name or full path. Registration applies to the current Windows user. [Windows Explorer package](https://github.com/visitor17564/hangle-editor/releases/download/0.3.0/HangleEditor-Windows.zip)

```powershell
.\Register-HangleEditor.ps1 -Vault "Your vault"
```

Right-click a `.hwpx` file, choose **Open with → Choose another app → Hangle Editor → Always**, and repeat for `.hwp` if desired. Double-clicking a document now opens its original disk file in an Obsidian editor tab. You can use **Open with** for individual files while keeping another default application. To remove the registration, run `.\Register-HangleEditor.ps1 -Unregister`.

## Command palette

Press **Ctrl+P** (**Cmd+P** on macOS), type `Hangle Editor`, and press **Enter** on a result. Commands currently appear in Korean. You can assign shortcuts under **Settings → Hotkeys**.

| Command shown in Obsidian | What it does |
| --- | --- |
| 새 한글 문서 만들기 (HWPX) | Creates a blank HWPX in your chosen default folder. |
| 첨부파일 위치에 새 HWPX 만들기 | Creates a blank HWPX at the current note’s attachment location. |
| 한글 문서 열기 | Opens the system file chooser for HWP and HWPX documents, inside or outside the vault. |
| 한글 문서 저장 | Saves the active document. |
| 한글 문서 다른 이름으로 저장 | Saves a copy as HWPX, HWP, PDF, or Markdown. |
| PDF 내보내기 | Exports the current layout to PDF, with each page rendered as an image. |
| Markdown 내보내기 | Exports editable text and tables to a Markdown note. |
| Markdown에서 HWPX 만들기 | Converts the active Markdown note, or opens the system file chooser. The HWPX is saved beside the source, including for external Markdown files. |

Save and export commands appear when the active HWP or HWPX editor is ready. The editor’s **File** menu also offers Save As, conversion, export, and print. Markdown conversion supports headings, emphasis, lists, tables, and local images. Complex page layouts may change during conversion. Editing and conversion work offline.

## Vault access

The system file chooser supplies the selected path. Vault documents use Obsidian’s file API. For an external document, the plugin reads and writes the chosen disk file directly. Save As and exports from an external tab use the system save dialog. External Markdown conversions can read linked images from the source folder and its subfolders. A restored external tab shows its path and offers to reopen it on the current computer. Obsidian’s directory calls this capability **Direct Filesystem Access**. Saving an external document writes to its directory and replaces the original once the write succeeds.

## Build and verify

Run `npm ci`, `npm run lint`, and `npm run build` with Node.js 22 or later and Git. The build fetches pinned HOP and rhwp revisions. Set `HWP_EDITOR_CACHE` to choose the checkout directory. It embeds the editor and document engine in `main.js` and checks that the finished file is under 5,000,000 bytes.

For plugin 0.3.1, GitHub Actions signs the files that Obsidian installs. For example, run `gh attestation verify main.js --repo visitor17564/hangle-editor --source-ref refs/tags/0.3.1` in the download folder. The optional Windows package has its own download above, signed under tag `0.3.0`. [Release workflow](.github/workflows/attest-release.yml)

## Credits and licenses

The plugin uses HOP 0.4.5 and rhwp 0.8.7 under the MIT license. It includes their notices and the notices for rhwp’s dependencies, including the WHATWG encoding tables used by `encoding_rs`. [Plugin license](LICENSE) · [HOP and rhwp notices](licenses/HOP-and-rhwp.txt) · [rhwp dependency notices](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/THIRD_PARTY_LICENSES.md) · [Encoding notices](licenses/encoding_rs-0.8.42.txt)

The toolbar uses Lucide icons under ISC and the applicable Feather MIT license. Marked parses Markdown, and fflate reads HWPX archives. The release bundle includes the applicable copyright and permission notices. [Icon licenses](licenses/lucide-1.70.0.txt)

본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
