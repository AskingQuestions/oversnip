<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /**
   * Raw object with shortcut props
   *
   * See: settings.js default structure for example input
   */
  export let value;

  let currentValue = {};

  let editing = false;

  function prettyPrintShortcut(value) {
    let prefix = `${value.ctrlOrCmd ? `Ctrl/Cmd + ` : ``}${
      value.ctrl ? `Ctrl + ` : ``
    }${value.shift ? `Shift + ` : ``}${value.alt ? `Alt + ` : ``}${
      value.meta ? `Cmd + ` : ``
    }`;
    return `
	${prefix}${
      value.code
        ? value.code.replace("Key", "").replace("Digit", "")
        : prefix.length > 0
        ? ``
        : `Press any key`
    }
  `
      .replace(/\n/g, "")
      .trim();
  }

  $: pretty = prettyPrintShortcut(value);
  $: prettyCurrent = prettyPrintShortcut(currentValue);
</script>

<input
  class="shortcut-input"
  type="text"
  value={editing ? prettyCurrent : pretty}
  style="width: {(editing ? prettyCurrent : pretty).length + 4}ch"
  placeholder="Press a key"
  on:focus={() => {
    editing = true;
    currentValue = {};
  }}
  on:blur={() => (editing = false)}
  on:keydown={(e) => {
    e.preventDefault();
    let code = e.code;
    if (
      code === "ControlLeft" ||
      code === "ControlRight" ||
      code === "MetaLeft" ||
      code === "MetaRight" ||
      code === "ShiftLeft" ||
      code === "ShiftRight" ||
      code === "AltLeft" ||
      code === "AltRight"
    ) {
      code = "";
    }
    currentValue = {
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
      meta: e.metaKey,
      code: code,
    };

    if (code != "") {
      e.target.blur();
      value = currentValue;
      dispatch("change", value);
    }
  }}
/>

<style>
  .shortcut-input {
    user-select: none;
    caret-color: transparent;
    cursor: pointer;
    text-align: center;
  }

  .shortcut-input:focus {
    color: var(--primary);
  }
</style>
