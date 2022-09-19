<script>
  import colorContrast from "color-contrast";
  export let hex = "";
  let divEl;
  let contrast = colorContrast(hex, "#000") >= 7 ? "#000" : "#fff";
</script>

<div
  bind:this={divEl}
  class="palette-color"
  style={`background-color: ${hex}; color: ${contrast}`}
  on:click={() => {
    window.getSelection().selectAllChildren(divEl);
    navigator.clipboard.writeText(hex);
  }}
>
  {hex}
</div>

<style>
  .palette-color {
    user-select: all;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
