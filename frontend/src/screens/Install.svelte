<script>
  import { settings, setSetting } from "../stores/settings.js";
  import ShortcutInput from "../components/ShortcutInput.svelte";
  import Logo from "../assets/logo.png";

  let settingsMap = {};

  let options = [
    { section: "Global Shortcuts" },
    { key: "shortcut.snipRegion", type: "shortcut", label: "Snip Region" },
    { key: "shortcut.colorPicker", type: "shortcut", label: "Color Picker" },
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

<div
  style="display: flex; flex-direction: column; align-items: center; padding-top: 46px"
>
  <img style="max-width: 50%" src={Logo} alt="Logo" />
  <h2
    style="font-weight: 100; opacity: 0.75; color: white; margin: 24px; margin-top: 24px; margin-bottom: 0px; text-align: center;"
  >
    Thanks for installing Oversnip!
  </h2>
  <p
    style="opacity: 0.5; color: white; margin: 24px; margin-top: 24px; margin-bottom: 0px; text-align: center;"
  >
    Get started by using one of the shortcuts below.
  </p>
</div>
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
