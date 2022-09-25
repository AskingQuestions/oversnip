<!--
  Floating dropdown currenlty only used for the size bubbles
-->
<script>
  import { onDestroy, onMount } from "svelte";

  export let options = [];
  export let value = null;
  let open = false;
  export let size = false;

  function handleClick() {
    open = !open;
  }

  let handleOutsideClick = (event) => {
    if (!event.target.closest(".dropdown")) {
      open = false;
    }
  };
  onMount(() => {
    document.addEventListener("click", handleOutsideClick);
  });
  onDestroy(() => {
    document.removeEventListener("click", handleOutsideClick);
  });
</script>

<div class="dropdown" class:dropdown--sizer={size} on:click={handleClick}>
  <div class="dropdown__button" style={`--dropdown-option: ${value};`}>
    {#if !size}
      {#if value}
        {value}
      {:else}
        {options[0]}
      {/if}
    {/if}
  </div>
  {#if open}
    <div class="dropdown__options">
      {#each options as option, i}
        <div
          class={`dropdown__option dropdown__option--${option}`}
          style={`--dropdown-option: ${option};`}
          on:click={() => (value = option)}
          data-tooltip={i == 0
            ? "Small [1]"
            : i == options.length - 1
            ? "Large [3]"
            : options.length == 5
            ? i == 2
              ? "Medium [2]"
              : null
            : i == 1
            ? "Medium [2]"
            : null}
        >
          {#if !size}
            {option}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown {
    position: relative;
    width: 60px;
    height: 60px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .dropdown__options {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--col);
    border-radius: 8px;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
    z-index: 100000;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    padding: 10px 0px;
    animation: fade 0.2s ease-in-out forwards;
  }

  @keyframes fade {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0px);
    }
  }

  .dropdown__options::before {
    content: "";
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 20px solid transparent;
    border-right: 20px solid transparent;
    border-top: 20px solid var(--col);
    z-index: 1000;
  }

  .dropdown__option {
    margin: 2px;
  }

  .dropdown--sizer .dropdown__button {
    width: calc(var(--dropdown-option) * 0.5px);
    height: calc(var(--dropdown-option) * 0.5px);
    background: white;
    border-radius: 500px;
    transition: 0.2s ease-in-out;
    box-shadow: 0px 3px 6px rgba(0, 0, 0, 0.4);
    border: 1px solid black;
  }

  .dropdown--sizer .dropdown__option {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    transition: 0.2s ease-in-out;
  }

  .dropdown--sizer .dropdown__option::after {
    content: "";
    width: calc(var(--dropdown-option) * 0.5px);
    height: calc(var(--dropdown-option) * 0.5px);
    background: white;
    border-radius: 500px;
    transition: 0.2s ease-in-out;
  }

  .dropdown--sizer .dropdown__option:hover {
    background-color: rgba(0, 0, 0, 0.2);
  }

  .dropdown--sizer .dropdown__option:hover::after,
  .dropdown--sizer .dropdown__button:hover {
    transform: scale(1.1);
  }
</style>
