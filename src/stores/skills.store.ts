import { defineStore } from "pinia"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"
import type { LearningPlan } from "src/utils/learningPlan"
import { skillKey } from "src/utils/analytics"

// Arrays, not Record maps: useBrowserLocalStorage's deep-merge only keeps keys
// present in the default object, so a `{}` default would drop every entry.
export const useSkillsStore = defineStore("skills", () => {
  const { data: learning } = useBrowserLocalStorage<
    { key: string; label: string; at: string }[]
  >("aa-skill-learning", [])
  // When each skill first landed on the base resume (see resume store).
  const { data: added } = useBrowserLocalStorage<{ key: string; at: string }[]>(
    "aa-skill-added",
    [],
  )
  const { data: plan } = useBrowserLocalStorage<LearningPlan | null>(
    "aa-learning-plan",
    null,
  )

  function isLearning(key: string) {
    return learning.value.some((l) => l.key === key)
  }

  function toggleLearning(label: string) {
    const key = skillKey(label)
    learning.value = isLearning(key)
      ? learning.value.filter((l) => l.key !== key)
      : [...learning.value, { key, label, at: new Date().toISOString() }]
  }

  function markAdded(labels: string[]) {
    const now = new Date().toISOString()
    const fresh = [...new Set(labels.map(skillKey))]
      .filter((key) => key && !added.value.some((a) => a.key === key))
      .map((key) => ({ key, at: now }))
    if (fresh.length) added.value = [...added.value, ...fresh]
  }

  return { learning, added, plan, isLearning, toggleLearning, markAdded }
})
