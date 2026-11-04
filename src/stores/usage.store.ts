import { defineStore } from "pinia"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"
import type { UsageEntry } from "src/types/search"
import { USAGE_KEY } from "src/utils/usage"

// Written only by the background script (recordUsage); UI reads it.
export const useUsageStore = defineStore("usage", () => {
  const { data: entries } = useBrowserLocalStorage<UsageEntry[]>(USAGE_KEY, [])

  function clear() {
    entries.value = []
  }

  return { entries, clear }
})
