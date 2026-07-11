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

  function findDuplicate(candidate: {
    url: string
    company: string
    jobTitle: string
  }): Application | undefined {
    const company = candidate.company.trim().toLowerCase()
    const jobTitle = candidate.jobTitle.trim().toLowerCase()

    return applications.value.find((a) => {
      if (candidate.url && a.url === candidate.url) return true
      return (
        a.company.trim().toLowerCase() === company &&
        a.jobTitle.trim().toLowerCase() === jobTitle
      )
    })
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
    findDuplicate,
    activeCount,
  }
})
