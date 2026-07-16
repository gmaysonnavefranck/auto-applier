import { defineStore } from "pinia"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"

export const useGoalsStore = defineStore("goals", () => {
  const { data: dailyTarget } = useBrowserLocalStorage<number>(
    "aa-daily-target",
    0,
  )
  return { dailyTarget }
})
