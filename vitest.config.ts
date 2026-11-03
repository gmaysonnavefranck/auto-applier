import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Separate from vite.config.ts on purpose: the crx/zip/ui plugins there only
// make sense for an extension build, and tests here only cover plain TS
// (utils + Pinia stores), so all that's needed is the path aliases.
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL(".", import.meta.url)),
      "@": fileURLToPath(new URL("src", import.meta.url)),
      src: fileURLToPath(new URL("src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
  },
})
