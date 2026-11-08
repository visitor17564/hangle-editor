import { initIconToolbarScroller } from "@upstream/ui/icon-toolbar-scroller";

export function fitMenus(menu) {
  const gutter = 3;
  function place(panel) {
    const anchor = panel.parentElement;
    const sub = anchor.classList.contains("md-sub");
    const rect = (sub ? anchor : anchor.querySelector(".menu-title")).getBoundingClientRect();
    const top = sub ? gutter : rect.bottom;
    panel.style.maxHeight = Math.max(1, window.innerHeight - top - gutter) + "px";
    const { width, height } = panel.getBoundingClientRect();
    let left = rect.left;
    if (sub) left = rect.right + width <= window.innerWidth - gutter ? rect.right : rect.left - width;
    panel.style.left = Math.max(gutter, Math.min(left, window.innerWidth - gutter - width)) + "px";
    panel.style.top = (sub ? Math.max(gutter, Math.min(rect.top, window.innerHeight - height - gutter)) : top) + "px";
  }
  function fitOpen() {
    for (const panel of menu.querySelectorAll(".menu-item.open > .menu-dropdown, .md-sub:hover > .md-sub-panel")) {
      if (panel.getClientRects().length) place(panel);
    }
  }
  menu.addEventListener("mousedown", fitOpen);
  for (const item of menu.querySelectorAll(".menu-title, .md-sub")) item.addEventListener("mouseenter", fitOpen);
  menu.addEventListener("scroll", fitOpen, true);
  window.addEventListener("resize", fitOpen);
}

// HOP's toolbar groups predate rhwp's scroll viewport. Keep the group nodes and
// their handlers when installing the upstream scroller in a narrow Obsidian tab.
export function enableToolbarScroll(toolbar) {
  const track = document.createElement("div");
  track.className = "tb-scroll-track";
  track.append(...toolbar.childNodes);
  const viewport = document.createElement("div");
  viewport.className = "tb-scroll-viewport";
  viewport.id = "icon-toolbar-viewport";
  viewport.tabIndex = 0;
  viewport.setAttribute("aria-label", "기본 도구 상자");
  viewport.append(track);
  function arrow(id, label, symbol) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "icon-toolbar-" + id;
    button.className = "tb-scroll-nav";
    button.hidden = true;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-controls", viewport.id);
    const icon = document.createElement("span");
    icon.className = "tb-scroll-nav-icon";
    icon.textContent = symbol;
    button.append(icon);
    return button;
  }
  toolbar.append(arrow("prev", "이전 도구 그룹", "«"), viewport, arrow("next", "다음 도구 그룹", "»"));
  initIconToolbarScroller(toolbar);
}
