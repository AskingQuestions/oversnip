import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import InlineSvg from "rollup-plugin-inline-svg";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), InlineSvg()],
});
