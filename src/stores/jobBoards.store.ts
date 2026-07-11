import { defineStore } from "pinia"
import type { JobBoard } from "src/types/checklist"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"

// ponytail: local-calendar-day boundary, not UTC — good enough for a "did I
// check today" checklist, no need for timezone-aware date math here.
function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const useJobBoardsStore = defineStore("jobBoards", () => {
  const { data: boards } = useBrowserLocalStorage<JobBoard[]>(
    "aa-job-boards",
    [],
  )

  function addBoard(board: JobBoard) {
    boards.value = [...boards.value, board]
  }

  function updateBoard(id: string, updates: Partial<JobBoard>) {
    boards.value = boards.value.map((b) =>
      b.id === id ? { ...b, ...updates } : b,
    )
  }

  function removeBoard(id: string) {
    boards.value = boards.value.filter((b) => b.id !== id)
  }

  function isVisitedToday(board: JobBoard): boolean {
    return board.lastVisited === todayKey()
  }

  function toggleVisited(id: string) {
    const board = boards.value.find((b) => b.id === id)
    if (!board) return
    updateBoard(id, {
      lastVisited: isVisitedToday(board) ? undefined : todayKey(),
    })
  }

  const visitedTodayCount = computed(
    () => boards.value.filter(isVisitedToday).length,
  )

  const statusColor = computed<"success" | "warning" | "error">(() => {
    if (boards.value.length === 0) return "success"
    if (visitedTodayCount.value === boards.value.length) return "success"
    if (visitedTodayCount.value === 0) return "error"
    return "warning"
  })

  return {
    boards,
    addBoard,
    updateBoard,
    removeBoard,
    isVisitedToday,
    toggleVisited,
    visitedTodayCount,
    statusColor,
  }
})
