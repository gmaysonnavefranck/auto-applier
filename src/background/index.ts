import type { Application } from "src/types/jobs"
import { tailorResumeForJob } from "src/utils/claude"
import type { Resume } from "src/types/resume"

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error))

chrome.runtime.onInstalled.addListener((opt) => {
  if (opt.reason === "install" || opt.reason === "update") {
    chrome.runtime.openOptionsPage()
  }
})

// Update badge with active application count when storage changes
chrome.storage.local.onChanged.addListener((changes) => {
  if (!changes["aa-applications"]) return

  const apps: Application[] = changes["aa-applications"].newValue ?? []
  const active = apps.filter(
    (a) => !["rejected", "withdrawn", "offer"].includes(a.status),
  ).length

  chrome.action.setBadgeText({ text: active > 0 ? String(active) : "" })
  chrome.action.setBadgeBackgroundColor({ color: "#2563eb" })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "TAILOR_RESUME") return false

  const { apiKey, resume, jobDescription } = message as {
    apiKey: string
    resume: Resume
    jobDescription: string
  }

  tailorResumeForJob(apiKey, resume, jobDescription)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) =>
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    )

  return true // keep channel open for async response
})

self.onerror = function (message, source, lineno, colno, error) {
  console.info("Error: " + message)
  console.info("Source: " + source)
  console.info("Line: " + lineno)
  console.info("Column: " + colno)
  console.info("Error object: " + error)
}

export {}
