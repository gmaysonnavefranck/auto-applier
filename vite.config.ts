import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, relative, resolve } from "node:path"
import { defineConfig, type PluginOption } from "vite"
import { crx } from "@crxjs/vite-plugin"
import vue from "@vitejs/plugin-vue"
import vueDevTools from "vite-plugin-vue-devtools"
import VueRouter from "vue-router/vite"
import TurboConsole from "unplugin-turbo-console/vite"
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite"
import ui from "@nuxt/ui/vite"
import zipPack from "vite-plugin-zip-pack"
import chalk from "chalk"
import "dotenv/config"

// @ts-expect-error commonjs module
import { define, raw } from "./define.config.mjs"
import manifest from "./manifest.config"
import packageJson from "./package.json" with { type: "json" }

const IS_DEV = process.env.NODE_ENV === "development"
const outDir = "dist"
const browserOutDir = `${outDir}/chrome`
const outFileName = `chrome-${packageJson.version}.zip`

const getImmediateDirectories = (path: string) =>
  fs
    .readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

const printMessage = (isDev: boolean): void => {
  setTimeout(() => {
    console.info("\n")
    console.info(chalk.greenBright("✅ Successfully built for chrome."))
    if (isDev) {
      console.info(
        chalk.greenBright(
          `🚀 Load the extension via chrome://extensions/, enable "Developer mode", click "Load unpacked", and select the directory:`,
        ),
      )
      console.info(chalk.greenBright(`📂 ${browserOutDir}`))
    } else {
      console.info(
        chalk.greenBright(
          `📦 Zip File: ${outDir}/${outFileName} (Upload to the store)`,
        ),
      )
      console.info(chalk.greenBright(`🚀 Load manually from ${browserOutDir}`))
    }
    console.info("\n")
  }, 50)
}

const buildMessagePlugin: PluginOption = {
  name: "vite-plugin-build-message",
  enforce: "post",
  ...(IS_DEV
    ? {
        configureServer(server) {
          server.httpServer?.once("listening", () => printMessage(true))
        },
      }
    : {}),
  closeBundle: { sequential: true, handler: () => printMessage(IS_DEV) },
}

export default defineConfig({
  base: IS_DEV ? `/` : "",

  build: {
    outDir: browserOutDir,
    watch: IS_DEV ? {} : undefined,
    sourcemap: IS_DEV ? "inline" : false,
    rollupOptions: {
      input: {
        iframe: resolve(__dirname, "src/ui/content-script-iframe/index.html"),
      },
    },
    terserOptions: {
      mangle: false,
    },
  },

  define,

  // legacy: {
  //   // ⚠️ SECURITY RISK: Allows WebSockets to connect to the vite server without a token check ⚠️
  //   // See https://github.com/crxjs/chrome-extension-tools/issues/971 for more info
  //   // The linked issue gives a potential fix that @crxjs/vite-plugin could implement
  //   skipWebSocketTokenCheck: true,
  // },

  optimizeDeps: {
    include: ["vue", "@vueuse/core", "webextension-polyfill"],
    exclude: ["vue-demi"],
  },

  plugins: [
    {
      name: "ensure-output-dir",
      buildStart() {
        if (!fs.existsSync(browserOutDir))
          fs.mkdirSync(browserOutDir, { recursive: true })
      },
    },

    vueDevTools(),

    VueI18nPlugin({
      include: "src/locales/**",
      globalSFCScope: true,
      compositionOnly: true,
    }),

    VueRouter({
      dts: "src/types/typed-router.d.ts",
      routesFolder: getImmediateDirectories("src/ui").map((dir) => ({
        src: `src/ui/${dir}/pages`,
        path: `${dir}/`,
      })),
    }),

    vue(),

    ui({
      autoImport: {
        imports: [
          "vue",
          "vue-router",
          "pinia",
          "@vueuse/core",
          { "vue-router/auto": ["definePage"] },
          { "vue-i18n": ["useI18n", "t"] },
          {
            "webextension-polyfill": [["=", "browser"]],
          },
        ],
        dts: "src/types/auto-imports.d.ts",
        dirs: ["src/composables/**", "src/stores/**", "src/utils/**"],
        vueTemplate: true,
        viteOptimizeDeps: true,
        eslintrc: {
          enabled: true,
          filepath: "src/types/.eslintrc-auto-import.json",
        },
      },
      components: {
        dirs: ["src/components"],
        dts: "src/types/components.d.ts",
        directoryAsNamespace: true,
        globalNamespaces: ["account", "state"],
      },
      ui: {
        colors: {
          primary: "green",
          neutral: "slate",
        },
      },
    }),

    TurboConsole(),

    {
      name: "html-define-plugin",
      enforce: "post",
      transformIndexHtml(html) {
        return html.replace(
          /%+\s*(\w+)\s*%+/g,
          (_, key) => raw[key] ?? `%${key}%`,
        )
      },
    },

    // rewrite assets to use relative path
    {
      name: "assets-rewrite",
      enforce: "post",
      apply: "build",
      transformIndexHtml(html, { path }) {
        return html.replace(
          /"\/assets\//g,
          `"${relative(dirname(path), "/assets")}/`,
        )
      },
    },

    crx({
      manifest,
      browser: "chrome",
      contentScripts: { injectCss: true },
    }),

    buildMessagePlugin,

    ...(IS_DEV
      ? []
      : [
          zipPack({
            inDir: browserOutDir,
            outDir,
            outFileName,
            filter: (_, filePath, isDirectory) =>
              !(isDirectory && filePath.includes(".vite")),
          }) as PluginOption,
        ]),
  ],

  resolve: {
    alias: {
      "~": fileURLToPath(new URL(".", import.meta.url)),
      "@": fileURLToPath(new URL("src", import.meta.url)),
      src: fileURLToPath(new URL("src", import.meta.url)),
      "@assets": fileURLToPath(new URL("src/assets", import.meta.url)),
    },
  },

  // server: {
  //   port: PORT,
  //   hmr: {
  //     host: "localhost",
  //     overlay: false,
  //   },
  //   origin: `http://localhost:${PORT}`,
  //   cors: {
  //     origin: [
  //       // ⚠️ SECURITY RISK: Allows any chrome-extension to access the vite server ⚠️
  //       // See https://github.com/crxjs/chrome-extension-tools/issues/971 for more info
  //       // I don't believe that the linked issue mentions a potential solution
  //       "chrome-extension://",
  //     ],
  //   },
  // },
})
