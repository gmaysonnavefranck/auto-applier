import { defineStore } from "pinia"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"

export const useAiStore = defineStore("ai", () => {
  const { data: claudeApiKey } = useBrowserLocalStorage<string>(
    "aa-claude-key",
    "",
  )
  return { claudeApiKey }
})
