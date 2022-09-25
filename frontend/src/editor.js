import "./styles/editor.css";
import App from "./screens/Editor.svelte";

const app = new App({
  target: document.getElementById("app"),
});

export default app;

let tooltipDebounce = false;
let tooltipClickDebounce = false;

function generateTipHandler(action) {
  return (e) => {
    if (tooltipDebounce) return;
    if (!e.target.matches) return;

    let tooltip = e.target;
    if (!e.target.matches("[data-tooltip]")) return;

    if (tooltip.dataset.tooltipAction) {
      if (tooltip.dataset.tooltipAction === "click") {
        if (action == "hover") return;
      }
    } else {
      if (action == "click") return;
    }

    if (action == "click") {
      tooltipClickDebounce = true;
      setTimeout(() => {
        tooltipClickDebounce = false;
      }, 100);
    }

    let existingTooltip = document.querySelector(".tooltip");
    if (existingTooltip) {
      existingTooltip.remove();
      if (action == "click") return;
    }

    let tooltipBox = document.createElement("div");
    tooltipBox.className = "tooltip";
    tooltipBox.innerHTML = tooltip.dataset.tooltip.replace(
      /\[([^\]])\]/g,
      "<b>$1</b>"
    );
    document.body.append(tooltipBox);

    let coords = tooltip.getBoundingClientRect();

    let left = coords.left + (tooltip.offsetWidth - tooltipBox.offsetWidth) / 2;
    if (left < 0) left = 0;

    let top = coords.top - tooltipBox.offsetHeight - 5;
    if (top < 0) {
      tooltipBox.classList.add("tooltip-bottom");
      top = coords.top + tooltip.offsetHeight + 5;
    }

    tooltipBox.style.left = left + "px";
    tooltipBox.style.top = top + "px";
    console.log("Create tooltip");
  };
}

document.addEventListener("mouseenter", generateTipHandler("hover"), true);

document.addEventListener("click", generateTipHandler("click"), true);

document.addEventListener(
  "mouseleave",
  (e) => {
    if (!e.target.matches) return;
    let tooltip = e.target.matches("[data-tooltip]");
    if (!tooltip) return;

    document.querySelector(".tooltip")?.remove();
  },
  true
);

document.addEventListener(
  "click",
  (e) => {
    if (tooltipClickDebounce) return;
    tooltipDebounce = true;
    setTimeout(() => (tooltipDebounce = false), 1);
    console.log(document.querySelector(".tooltip"));
    document.querySelector(".tooltip")?.remove();
  },
  true
);

document.addEventListener("keydown", (e) => {
  if ((e.code == "Minus" || e.code == "Equal") && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
  }

  if (e.ctrlKey || e.metaKey || e.altKey) return;

  let shorcuts = document.querySelectorAll("[data-shortcut]");
  for (let shortcut of shorcuts) {
    let parsed = JSON.parse(shortcut.dataset.shortcut);

    if (parsed.code === e.code) {
      if (parsed.ctrl && !e.ctrlKey) continue;
      if (parsed.alt && !e.altKey) continue;
      if (parsed.shift && !e.shiftKey) continue;
      if (parsed.meta && !e.metaKey) continue;

      shortcut.click();
    }
  }
});
