import { readable } from "svelte/store";

export const settings = readable(
  window.settings.getSettings(),
  function start(set) {
    let handler = (newSettings) => {
      set(newSettings);
    };

    window.settings.watch(handler);

    return function stop() {
      window.settings.unwatch(handler);
    };
  }
);

export function setSetting(key, value) {
  window.settings.setSetting(key, value);
}

export function minimalPrintShortcut(value) {
  let prefix = `${value.ctrlOrCmd ? `ctrl/cmd + ` : ``}${
    value.ctrl ? `ctrl + ` : ``
  }${value.shift ? `shift + ` : ``}${value.alt ? `alt + ` : ``}${
    value.meta ? `cmd + ` : ``
  }`;
  return `
${prefix}${value.code.replace("Key", "").replace("Digit", "").toLowerCase()}
`
    .replace(/\n/g, "")
    .trim();
}
