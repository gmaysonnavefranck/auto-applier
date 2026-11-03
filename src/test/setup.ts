import * as vue from "vue"
import { beforeEach } from "vitest"

// Stores rely on Vite auto-imports (computed, toRaw, ...) that only exist in
// the real build, so expose Vue's exports as globals the same way.
Object.assign(globalThis, vue)

type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => void

// In-memory chrome.storage.local. `set` JSON-serializes values like the real
// API does (undefined keys dropped, proxies read through), so tests see what
// the browser would actually persist.
export const storage = {
  data: {} as Record<string, unknown>,
  listeners: [] as Listener[],
}

const local = {
  get(key: string, cb: (result: Record<string, unknown>) => void) {
    cb({ [key]: storage.data[key] })
  },
  set(items: Record<string, unknown>) {
    const changes: Parameters<Listener>[0] = {}
    for (const [key, value] of Object.entries(items)) {
      const newValue: unknown = JSON.parse(JSON.stringify(value))
      changes[key] = { oldValue: storage.data[key], newValue }
      storage.data[key] = newValue
    }
    for (const listener of storage.listeners) listener(changes)
    return Promise.resolve()
  },
  onChanged: {
    addListener(listener: Listener) {
      storage.listeners.push(listener)
    },
  },
}

Object.assign(globalThis, { chrome: { storage: { local } } })

beforeEach(() => {
  storage.data = {}
  storage.listeners = []
})
