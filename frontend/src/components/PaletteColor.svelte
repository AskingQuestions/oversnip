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
    width: 60px;
    height: 60px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-transform: uppercase;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 700;
  }

  @media (max-height: 400px) {
    .palette-color {
      font-size: 10px;
      height: 30px;
      width: 60px;
      border-radius: 8px;
    }
  }

  @media (max-height: 300px) {
    .palette-color {
      font-size: 10px;
      height: 14px;
      width: 60px;
      border-radius: 8px;
    }
  }
</style>
