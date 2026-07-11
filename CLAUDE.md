# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome (Manifest V3) extension for tracking job applications, called **Auto Applier**. Built on the `vite-vue3-browser-extension-v3` template (Vue 3 + Vite, multi-context, file-based routing).

> **Status**: this repo was reset to a clean copy of the template to get organized. The domain code described below (job scraping, applications, resume tailoring) existed in a previous working version and is being rebuilt from another local branch — treat the "Domain architecture" section as the target architecture, not a guarantee that every file listed already exists in `src/`. Update that note once the rebuild lands.

## Commands

```bash
npm run dev         # Development for Chrome
npm run build       # Production build
npm run lint        # ESLint with auto-fix
npm run typecheck   # TypeScript type checking
npm run format      # Format with Prettier
```

Before committing: `npm run lint` and `npm run typecheck` must be clean.

## Code style

- TypeScript strict mode. Avoid `any`.
- Vue: `<script setup lang="ts">`.
- No semicolons, double quotes, trailing commas, 2-space indent (Prettier config).
- Logging: `console.info` / `console.warn` / `console.error`, never `console.log`.

## Extension architecture

### Contexts (`src/`)

- `background/` — service worker (extension lifecycle). No action popup — clicking the toolbar icon opens the side panel directly (`chrome.sidePanel.setPanelBehavior`); install/update opens the options page (`chrome.runtime.openOptionsPage()`).
- `content-script/` — DOM injection, page interaction
- `ui/side-panel/` — main UI (jobs list, site registration)
- `ui/options-page/` — settings (Claude API key, base resume)
- `ui/content-script-iframe/` — Vue UI injectable into the page DOM; unused today, kept for a possible future element-picker overlay

There's no action-popup, devtools-panel, setup wizard, or offscreen context — trimmed since this extension only uses the side panel + options page.

### Shared code

- `components/` — reusable Vue components (PascalCase filenames), built with shadcn-vue + Tailwind CSS 4
- `composables/` — Vue composables, prefixed `use` (`useTheme.ts`, `useBrowserStorage.ts`), named exports
- `stores/` — Pinia stores, suffixed `.store.ts`, Composition API style
- `utils/`, `types/`

### File-based routing

UI pages auto-register from `src/ui/<context>/pages/*.vue` via Vue Router — adding a route is just adding the file.

### Imports

Auto-imports enabled for Vue functions, stores, components. Use `~/` for project-root imports, `src/` for src-relative.

### Browser APIs & messaging

- Use `chrome.*` APIs directly (types from `chrome-types`).
- Default cross-context messaging is `webext-bridge`, coordinated through the background script — except the site-registration flow below, which intentionally uses raw `chrome.runtime`/`chrome.tabs` messaging instead (see why in that section).

## Domain architecture

### 1. Site registration → scraping pipeline

Users register a job board domain (`src/ui/side-panel/pages/register-site.vue`) by picking DOM elements for each `FieldType` (`jobTitle`, `company`, `location`, `salary`, `description`, `applyButton` — defined in [src/types/jobs.ts](src/types/jobs.ts)). The flow crosses three layers:

- **Picker** ([src/content-script/picker.ts](src/content-script/picker.ts)) — `ElementPicker` overlays a highlight box + tooltip on hover, and on click computes a selector via `getStableSelector`.
- **Selector generation** ([src/content-script/selector.ts](src/content-script/selector.ts)) — builds a CSS selector that survives across job postings on the same site, not just the current DOM instance. It deliberately avoids anything that "looks dynamic" (job IDs, CSS-in-JS hashes, UUIDs) and prefers stable class combos → non-dynamic id → stable data-\* attr → structural nth-of-type path, in that priority order.
- **Extractor** ([src/content-script/extractor.ts](src/content-script/extractor.ts)) — `extractJob()` resolves fields with a fallback chain: JSON-LD `JobPosting` schema first (most reliable, used by LinkedIn/Indeed/Greenhouse/etc.) → user-configured CSS selectors → heuristic DOM search (known selectors → heading-proximity → largest text block) → Open Graph/meta tags as last resort.

Messaging: side panel ↔ content script uses raw `chrome.runtime`/`chrome.tabs` messaging (`START_PICKER`, `STOP_PICKER`, `TEST_SELECTOR`, `EXTRACT_JOB`), registered in [src/content-script/index.ts](src/content-script/index.ts) — not `webext-bridge` for this particular flow.

Saved site configs live in `useSitesStore` ([src/stores/sites.store.ts](src/stores/sites.store.ts)), keyed by domain; `getSiteForDomain` handles `www.` stripping and subdomain matching.

### 2. Applications

`useApplicationsStore` ([src/stores/applications.store.ts](src/stores/applications.store.ts)) holds the tracked job list (`Application` in [src/types/jobs.ts](src/types/jobs.ts)), with a status pipeline (`STATUS_ORDER`: saved → applied → screening → interview → offer/rejected/withdrawn). The background script ([src/background/index.ts](src/background/index.ts)) watches `chrome.storage.local` for `aa-applications` changes and updates the toolbar badge with the active (non-terminal) count. Jobs can be captured via the scraping pipeline above or added manually ([src/ui/side-panel/pages/add-job.vue](src/ui/side-panel/pages/add-job.vue)).

### 3. Resume + AI tailoring

- Base resume is edited in `src/ui/options-page/pages/resume.vue` and stored via `useResumeStore` ([src/stores/resume.store.ts](src/stores/resume.store.ts)). All mutators go through `snapshot()`, which `structuredClone`s the raw (non-reactive) value before mutating — never mutate `resume.value` fields directly, follow the existing `upsertX`/`removeX` pattern.
- Tailoring calls the Anthropic Messages API directly from the browser (`x-api-key` + `anthropic-dangerous-direct-browser-access` header) in [src/utils/claude.ts](src/utils/claude.ts). The user's API key lives in `useAiStore` ([src/stores/ai.store.ts](src/stores/ai.store.ts), key `aa-claude-key`). The prompt asks Claude to return strict JSON matching `TailoredResume` (summary + per-work-entry highlights + per-skill-group items, matched back by `id`), and output is sanitized to plain ASCII (`sanitizeForAts`) since ATS systems choke on smart quotes/em-dashes/bullets.
- The actual API call is proxied through the background script (`TAILOR_RESUME` message in [src/background/index.ts](src/background/index.ts)) rather than called directly from UI contexts.
- Resume PDF export is `window.print()` (see [src/ui/options-page/pages/resume-preview.vue](src/ui/options-page/pages/resume-preview.vue)), styled via `@media print` / `.no-print` — there is no PDF-generation library in play.

## Storage

All persistence is `chrome.storage.local` via `useBrowserLocalStorage` ([src/composables/useBrowserStorage.ts](src/composables/useBrowserStorage.ts)), keyed with an `aa-` prefix: `aa-sites`, `aa-applications`, `aa-resume`, `aa-claude-key`. That composable deep-merges stored objects onto the passed default (so new fields added to a type get backfilled for existing users) and syncs both directions (`chrome.storage.onChanged` → ref, ref `watch` → `chrome.storage.set`).
