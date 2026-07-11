# Auto Applier

A Chrome extension (Manifest V3) for tracking job applications and tailoring resumes with AI. Register any job board's DOM once, then capture job postings, track application status, and generate an ATS-friendly tailored resume per job.

Built on the [vite-vue3-browser-extension-v3](https://github.com/mubaidr/vite-vue3-browser-extension-v3) template.

## Features

- **Site registration**: pick DOM elements on any job board once; reused across postings on that domain
- **Job scraping**: JSON-LD `JobPosting` schema, configured selectors, DOM heuristics, and Open Graph fallback
- **Application tracking**: status pipeline (saved → applied → screening → interview → offer/rejected/withdrawn) with a toolbar badge count
- **AI resume tailoring**: calls the Anthropic API to tailor your base resume per job, output sanitized for ATS
- **Local-only storage**: everything lives in `chrome.storage.local`, no backend

## Quick Start

```bash
npm install
npm run dev
```

## Commands

| Command             | Description                    |
| -------------------- | ------------------------------- |
| `npm run dev`       | Start development for Chrome   |
| `npm run build`     | Build extension for Chrome     |
| `npm run lint`      | Run ESLint with auto-fix       |
| `npm run typecheck` | Run TypeScript type checking   |
| `npm run format`    | Format code with Prettier      |

## Loading the Extension

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `dist/chrome` folder

## Documentation

- [CLAUDE.md](CLAUDE.md) — commands, code style, extension architecture, and app-specific domain (scraping pipeline, applications, AI resume tailoring)

## License

MIT
