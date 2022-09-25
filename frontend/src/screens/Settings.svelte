<script>
  import { settings, setSetting } from "../stores/settings.js";
  import ShortcutInput from "../components/ShortcutInput.svelte";

  import PenIcon from "@/assets/pen.svg?raw";
  import HighlighterIcon from "@/assets/highlighter.svg?raw";
  import EraserIcon from "@/assets/eraser.svg?raw";
  import RedactIcon from "@/assets/redact.svg?raw";
  import ArrowIcon from "@/assets/arrow.svg?raw";
  import RectIcon from "@/assets/rect.svg?raw";

  let settingsMap = {};

  let options = [
    { key: "autocopy", type: "checkbox", label: "Autocopy After Snip" },
    {
      key: "playSnipAnimation",
      type: "checkbox",
      label: "Play Snip Animation",
    },

    { section: "Global Shortcuts" },
    { key: "shortcut.snipRegion", type: "shortcut", label: "Snip Region" },
    { key: "shortcut.lockSnips", type: "shortcut", label: "Lock Snip Windows" },
    { key: "shortcut.colorPicker", type: "shortcut", label: "Color Picker" },
    {
      key: "shortcut.imageSearchRegion",
      type: "shortcut",
      label: "Image Search Region",
    },

    { section: "Pen", icon: PenIcon },
    { key: "shortcut.pen", type: "shortcut", label: "Pen Shortcut" },
    { key: "tool.pen.color", type: "color", label: "Pen Color" },
    {
      key: "tool.pen.size",
      type: "select",
      label: "Pen Size",
      number: true,
      options: [10, 20, 30, 40, 50],
    },

    { section: "Highlighter", icon: HighlighterIcon },
    {
      key: "shortcut.highlighter",
      type: "shortcut",
      label: "Highlighter Shortcut",
    },
    {
      key: "tool.highlighter.color",
      type: "color",
      label: "Highlighter Color",
    },
    {
      key: "tool.highlighter.size",
      type: "select",
      label: "Highlighter Size",
      number: true,
      options: [10, 20, 30, 40, 50],
    },

    { section: "Eraser", icon: EraserIcon },
    { key: "shortcut.eraser", type: "shortcut", label: "Eraser Shortcut" },
    {
      key: "tool.eraser.size",
      type: "select",
      label: "Eraser Size",
      number: true,
      options: [10, 20, 30, 40, 50],
    },

    { section: "Redact", icon: RedactIcon },
    { key: "shortcut.redact", type: "shortcut", label: "Redact Shortcut" },
    {
      key: "tool.redact.size",
      type: "select",
      label: "Redact Size",
      number: true,
      options: [10, 20, 30],
    },

    { section: "Arrow", icon: ArrowIcon },
    { key: "shortcut.arrow", type: "shortcut", label: "Arrow Shortcut" },
    { key: "tool.arrow.color", type: "color", label: "Arrow Color" },
    {
      key: "tool.arrow.size",
      type: "select",
      label: "Arrow Size",
      number: true,
      options: [10, 20, 30],
    },

    { section: "Box", icon: RectIcon },
    { key: "shortcut.box", type: "shortcut", label: "Box Shortcut" },
    { key: "tool.box.color", type: "color", label: "Box Color" },
    {
      key: "tool.box.size",
      type: "select",
      label: "Box Size",
      number: true,
      options: [10, 20, 30],
    },

    { section: "Image Search" },
    { key: "shortcut.search", type: "shortcut", label: "Image Search" },
    {
      key: "imageSearch.quality",
      type: "select",
      label: "Upload Quality",
      options: ["low", "medium", "high", "ultra", "full"],
      labels: [
        "Low (360px, fastest)",
        "Medium (720px)",
        "High (1024px)",
        "Ultra (2048px)",
        "Full (slowest)",
      ],
    },

    { section: "Misc Tools" },

    { key: "shortcut.palette", type: "shortcut", label: "Show Palette" },
    { key: "shortcut.scan", type: "shortcut", label: "Scan Text" },
    { key: "shortcut.imgur", type: "shortcut", label: "Upload to Imgur" },

    { key: "shortcut.settings", type: "shortcut", label: "Show settings" },
  ];

  settings.subscribe((settings) => {
    console.log(settings);
    settingsMap = settings;
  });

  function handleChange(key, val) {
    console.log(key, val);
    setSetting(key, val);
  }
</script>

<h2
  style="font-weight: 100; opacity: 0.5; color: white; margin: 24px; margin-top: 24px; margin-bottom: 0px;"
>
  Settings
</h2>
<span
  style="position: absolute; top: 28px; right: 24px; opacity: 0.5; color: white;"
  >v1.0.0</span
>
<div class="settings">
  {#each options as option}
    {#if option.section}
      <div class="setting setting--section">
        {#if option.icon}
          <div class="setting__icon">
            {@html option.icon}
          </div>
        {/if}
        {option.section}
      </div>
    {:else if settingsMap[option.key] !== undefined}
      <div class="setting">
        <div class="setting__label">
          <span>{option.label}</span>
        </div>
        <div class="setting__input">
          {#if option.type == "shortcut"}
            <ShortcutInput
              value={settingsMap[option.key]}
              on:change={(e) => {
                handleChange(option.key, e.detail);
              }}
            />
          {:else if option.type == "color"}
            <input
              type="color"
              value={settingsMap[option.key]}
              on:change={(e) => {
                handleChange(option.key, e.target.value);
              }}
            />
          {:else if option.type == "select"}
            <select
              value={settingsMap[option.key]}
              on:change={(e) => {
                handleChange(
                  option.key,
                  option.number ? parseInt(e.target.value) : e.target.value
                );
              }}
            >
              {#each option.options as opt, i}
                <option value={opt}
                  >{option.labels ? option.labels[i] : opt}</option
                >
              {/each}
            </select>
          {:else if option.type == "checkbox"}
            <input
              type="checkbox"
              checked={settingsMap[option.key]}
              on:change={(e) => {
                handleChange(option.key, e.target.checked);
              }}
            />
          {/if}
        </div>
      </div>
    {/if}
  {/each}
</div>
