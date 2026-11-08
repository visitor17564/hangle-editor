import { fileCommands as upstream } from "@upstream/command/commands/file";
import { openPrintDialog } from "@hop/ui/print-dialog";

const actions = [
  ["file:new-doc", "새 문서", "new"], ["file:new-window", "새 탭", "new"],
  ["file:open", "열기", "open"], ["file:open-recent", "최근 문서", "recent"],
  ["file:save", "저장", "save"], ["file:save-as", "다른 이름으로 저장", "save-as"],
  ["file:export-pdf", "PDF 내보내기", "pdf"]
];

export const fileCommands = [
  ...upstream.filter(command => command.id === "file:page-setup" || command.id === "file:about"),
  ...actions.map(([id, label, action]) => ({
    id, label, execute: ({ eventBus }) => eventBus.emit("vault-action", action)
  })),
  { id: "file:print", label: "인쇄", execute: ({ wasm, eventBus }) =>
    openPrintDialog(wasm).catch(error => eventBus.emit("vault-error", String(error))) }
];
