import { fileCommands as upstream } from "@upstream/command/commands/file";
import { openPrintDialog } from "@hop/ui/print-dialog";

const actions = [
  ["file:new-doc", "새 문서", "new"], ["file:new-window", "새 탭", "new"],
  ["file:open", "열기", "open"], ["file:open-recent", "최근 문서", "recent"],
  ["file:save", "저장", "save"], ["file:save-as", "다른 이름으로 저장", "save-as"],
  ["file:export-pdf", "PDF 내보내기", "pdf"], ["file:export-md", "Markdown 내보내기", "md"],
  ["file:import-md", "Markdown에서 HWPX 만들기", "import-md"]
];

// Extend the pinned HOP file menu before MenuBar binds click handlers.
export function addConversionMenuItems() {
  document.querySelector('[data-menu="file"] [data-cmd="file:print"] .md-shortcut')?.remove();
  const anchor = document.querySelector('[data-menu="file"] [data-cmd="file:export-pdf"]');
  let previous = anchor;
  for (const [id, label] of actions.filter(([id]) => id === "file:export-md" || id === "file:import-md")) {
    const item = anchor.cloneNode(true);
    item.dataset.cmd = id;
    item.querySelector(".md-label").textContent = label;
    previous.after(item);
    previous = item;
  }
}

export const fileCommands = [
  ...upstream.filter(command => command.id === "file:page-setup" || command.id === "file:about"),
  ...actions.map(([id, label, action]) => ({
    id, label, execute: ({ eventBus }) => eventBus.emit("vault-action", action)
  })),
  { id: "file:print", label: "인쇄", execute: ({ wasm, eventBus }) =>
    openPrintDialog(wasm).catch(error => eventBus.emit("vault-error", String(error))) }
];
