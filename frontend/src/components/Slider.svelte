<!--
  Simple range slider component with vertical and horizontal modes
-->
<script>
  import { onMount, onDestroy } from "svelte";

  export let value = 0;
  export let min = 0;
  export let max = 1;
  export let direction = "horizontal";

  let sliderEl;

  let isDown = false;

  function handleEnd() {
    isDown = false;
  }

  function handleTouchStart(e) {
    isDown = true;
    handleTouchMove(e);
  }

  function handleMouseDown(e) {
    isDown = true;
    handleMouseMove(e);
  }

  function handleMove(x, y) {
    let myRect = sliderEl.getBoundingClientRect();
    let myX = x - myRect.left;
    let myY = y - myRect.top;
    let myWidth = myRect.width;
    let myHeight = myRect.height;
    let myValue = 0;
    if (direction == "horizontal") {
      myValue = (myX / myWidth) * (max - min) + min;
    } else {
      myValue = (myY / myHeight) * (max - min) + min;
    }
    value = Math.min(max, Math.max(min, myValue));
  }

  function handleMouseMove(e) {
    if (isDown) {
      handleMove(e.clientX, e.clientY);
    }
  }

  function handleTouchMove(e) {
    if (isDown) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  onMount(() => {
    document.addEventListener("touchend", handleEnd);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchmove", handleMouseMove);
  });

  onDestroy(() => {
    document.removeEventListener("touchend", handleEnd);
    document.removeEventListener("mouseup", handleEnd);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("touchmove", handleMouseMove);
  });
</script>

<div
  bind:this={sliderEl}
  class="slider"
  class:slider--horizontal={direction == "horizontal"}
  on:touchstart={handleTouchStart}
  on:mousedown={handleMouseDown}
>
  <div
    style="--value: {(value - min) / max}"
    on:touchstart={handleTouchStart}
    on:mousedown={handleMouseDown}
  />
</div>

<style>
  .slider {
    position: relative;
    height: 100%;
    width: 5px;
    background-color: rgb(20, 20, 20);
    border-radius: 100px;
    border: 1px solid rgb(77, 77, 77);
  }

  .slider--horizontal {
    height: 10px;
    width: 100%;
  }

  .slider > div {
    position: absolute;
    top: calc(var(--value) * 100% - 15px / 2);
    left: calc(-5px);
    height: 15px;
    width: 15px;
    background-color: var(--primary);
    border-radius: 100px;
  }

  .slider--horizontal > div {
    top: calc(-35px / 2);
    left: calc(var(--value) * 100%);
  }
</style>
