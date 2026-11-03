import { beforeEach, describe, expect, it } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { useApplicationsStore } from "src/stores/applications.store"
import { storage } from "src/test/setup"
import type { Application } from "src/types/jobs"

// Lets useBrowserStorage finish its initial get + nextTick, and the
// flush: "post" watcher write the change through to chrome.storage.
const flush = () => new Promise((resolve) => setTimeout(resolve))

function makeApp(): Application {
  return {
    id: "app-1",
    siteConfigId: "site-1",
    domain: "example.com",
    url: "https://example.com/job/1",
    jobTitle: "Frontend Engineer",
    company: "Acme",
    notes: "call recruiter",
    status: "saved",
    dateAdded: "2026-01-01T00:00:00.000Z",
    tailoredResume: {
      summary: "Tailored summary",
      work: [{ id: "w1", highlights: ["Built things"] }],
      skills: [{ id: "s1", items: ["Vue", "Pinia"] }],
      missingKeywords: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
    },
  }
}

function stored(): Application[] {
  return storage.data["aa-applications"] as Application[]
}

describe("applications store: updateApplication", () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    useApplicationsStore().addApplication(makeApp())
    await flush()
  })

  // Regression: resume-review.vue saves `{ ...tailored.value, review }`, which
  // carries nested reactive proxies (work/skills). structuredClone(toRaw(...))
  // threw DataCloneError on them, so every accept checkbox silently did nothing.
  it("accepts updates that contain nested reactive values from the store", async () => {
    const store = useApplicationsStore()
    const tailored = store.applications[0].tailoredResume!

    expect(() =>
      store.updateApplication("app-1", {
        tailoredResume: {
          ...tailored,
          review: {
            summaryAccepted: true,
            work: [],
            skills: [{ id: "s1", acceptedAdds: ["Vue"], acceptedRemoves: [] }],
          },
        },
      }),
    ).not.toThrow()
    await flush()

    const saved = stored()[0].tailoredResume!
    expect(saved.review?.summaryAccepted).toBe(true)
    expect(saved.review?.skills[0].acceptedAdds).toEqual(["Vue"])
    expect(saved.work).toEqual([{ id: "w1", highlights: ["Built things"] }])
  })

  it("clears a field when updated with undefined", async () => {
    useApplicationsStore().updateApplication("app-1", { notes: undefined })
    await flush()

    expect(stored()[0].notes).toBeUndefined()
    expect(stored()[0].jobTitle).toBe("Frontend Engineer")
  })

  it("only touches the matching application", async () => {
    const store = useApplicationsStore()
    store.addApplication({ ...makeApp(), id: "app-2", company: "Other" })
    store.updateApplication("app-1", { company: "Renamed" })
    await flush()

    expect(stored().find((a) => a.id === "app-1")?.company).toBe("Renamed")
    expect(stored().find((a) => a.id === "app-2")?.company).toBe("Other")
  })
})
