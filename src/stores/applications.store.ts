import { defineStore } from "pinia"
import type { Application, ApplicationStatus } from "src/types/jobs"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"

export const useApplicationsStore = defineStore("applications", () => {
  const { data: applications } = useBrowserLocalStorage<Application[]>(
    "aa-applications",
    [],
  )

  function addApplication(app: Application) {
    applications.value = [app, ...applications.value]
  }

  function setStatus(id: string, status: ApplicationStatus) {
    applications.value = applications.value.map((a) =>
      a.id === id
        ? {
            ...a,
            status,
            ...(status === "applied" && !a.dateApplied
              ? { dateApplied: new Date().toISOString() }
              : {}),
          }
        : a,
    )
  }

  function updateApplication(id: string, updates: Partial<Application>) {
    applications.value = applications.value.map((a) =>
      a.id === id ? { ...a, ...updates } : a,
    )
  }

  function removeApplication(id: string) {
    applications.value = applications.value.filter((a) => a.id !== id)
  }

  const activeCount = computed(
    () =>
      applications.value.filter(
        (a) => !["rejected", "withdrawn", "offer"].includes(a.status),
      ).length,
  )

  return {
    applications,
    addApplication,
    setStatus,
    updateApplication,
    removeApplication,
    activeCount,
  }
})
