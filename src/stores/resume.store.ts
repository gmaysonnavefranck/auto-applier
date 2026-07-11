import { defineStore } from "pinia"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"
import type {
  Resume,
  ResumeWork,
  ResumeEducation,
  ResumeSkillGroup,
  ResumeLanguage,
} from "src/types/resume"
import { EMPTY_RESUME } from "src/types/resume"

export const useResumeStore = defineStore("resume", () => {
  const { data: resume } = useBrowserLocalStorage<Resume>(
    "aa-resume",
    EMPTY_RESUME,
  )

  // Returns a fully plain deep copy of the current resume so we never mutate
  // reactive proxies or let stale proxy references slip into chrome.storage.
  function snapshot(): Resume {
    const raw = structuredClone(toRaw(resume.value)) as Resume
    // Guarantee arrays always exist (guards against old stored data missing languages)
    raw.work = raw.work ?? []
    raw.education = raw.education ?? []
    raw.skills = raw.skills ?? []
    raw.languages = raw.languages ?? []
    return raw
  }

  function updateBasics(
    patch: Partial<Record<keyof Resume["basics"], string>>,
  ) {
    const cur = snapshot()
    cur.basics = { ...cur.basics, ...patch }
    resume.value = cur
  }

  function upsertWork(entry: ResumeWork) {
    const cur = snapshot()
    const plain = structuredClone(toRaw(entry))
    const idx = cur.work.findIndex((w) => w.id === plain.id)
    if (idx >= 0) cur.work[idx] = plain
    else cur.work.push(plain)
    resume.value = cur
  }

  function removeWork(id: string) {
    const cur = snapshot()
    cur.work = cur.work.filter((w) => w.id !== id)
    resume.value = cur
  }

  function upsertEducation(entry: ResumeEducation) {
    const cur = snapshot()
    const plain = structuredClone(toRaw(entry))
    const idx = cur.education.findIndex((e) => e.id === plain.id)
    if (idx >= 0) cur.education[idx] = plain
    else cur.education.push(plain)
    resume.value = cur
  }

  function removeEducation(id: string) {
    const cur = snapshot()
    cur.education = cur.education.filter((e) => e.id !== id)
    resume.value = cur
  }

  function upsertSkillGroup(entry: ResumeSkillGroup) {
    const cur = snapshot()
    const plain = structuredClone(toRaw(entry))
    const idx = cur.skills.findIndex((s) => s.id === plain.id)
    if (idx >= 0) cur.skills[idx] = plain
    else cur.skills.push(plain)
    resume.value = cur
  }

  function removeSkillGroup(id: string) {
    const cur = snapshot()
    cur.skills = cur.skills.filter((s) => s.id !== id)
    resume.value = cur
  }

  function upsertLanguage(entry: ResumeLanguage) {
    const cur = snapshot()
    const plain = structuredClone(toRaw(entry))
    const idx = cur.languages.findIndex((l) => l.id === plain.id)
    if (idx >= 0) cur.languages[idx] = plain
    else cur.languages.push(plain)
    resume.value = cur
  }

  function removeLanguage(id: string) {
    const cur = snapshot()
    cur.languages = cur.languages.filter((l) => l.id !== id)
    resume.value = cur
  }

  function importResume(data: Resume) {
    const clone = structuredClone(data)
    clone.work = clone.work ?? []
    clone.education = clone.education ?? []
    clone.skills = clone.skills ?? []
    clone.languages = clone.languages ?? []
    resume.value = clone
  }

  return {
    resume,
    updateBasics,
    upsertWork,
    removeWork,
    upsertEducation,
    removeEducation,
    upsertSkillGroup,
    removeSkillGroup,
    upsertLanguage,
    removeLanguage,
    importResume,
  }
})
