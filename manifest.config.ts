import { defineManifest } from "@crxjs/vite-plugin"
import { env as processEnv } from "node:process"
import packageJson from "./package.json" with { type: "json" }

const { version, name, description, displayName } = packageJson
// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch, label = "0"] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, "")
  // split into version parts
  .split(/[.-]/)

// @ts-expect-error manifest provides all required fields
export default defineManifest((env) => ({
  key: env["CHROME_ADDON_KEY"],
  author: {
    email: "gmaysonnavefranck@gmail.com",
  },
  name: processEnv.mode === "staging" ? `[INTERNAL] ${name}` : displayName || name,
  description,
  // up to four numbers separated by dots
  version: `${major}.${minor}.${patch}.${label}`,
  // semver is OK in "version_name"
  version_name: version,
  manifest_version: 3,
  action: {},
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      all_frames: false,
      js: ["src/content-script/index.ts"],
      matches: ["*://*/*"],
      run_at: "document_end",
    },
  ],
  side_panel: {
    default_path: "src/ui/side-panel/index.html",
  },
  options_page: "src/ui/options-page/index.html",
  offline_enabled: true,
  host_permissions: ["<all_urls>"],
  permissions: ["storage", "tabs", "background", "sidePanel"],
  icons: {
    16: "src/assets/logo.png",
    24: "src/assets/logo.png",
    32: "src/assets/logo.png",
    128: "src/assets/logo.png",
  },
}))
