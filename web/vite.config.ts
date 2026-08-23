import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    // Firmware .bin files live in public/ and are copied verbatim; nothing here
    // should ever try to inline or transform them.
    assetsInlineLimit: 0,
  },
});
