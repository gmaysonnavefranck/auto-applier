<script setup lang="ts">
import { computed } from "vue"
import { useApplicationsStore } from "src/stores/applications.store"

const appsStore = useApplicationsStore()

interface SkillCount {
  label: string
  count: number
}

const MAX_ROWS = 15

// Only applications that were ever tailored carry any skill signal —
// everything else has nothing to contribute to either ranking.
const tailoredApps = computed(() =>
  appsStore.applications.filter((a) => a.tailoredResume),
)

// Case-insensitive dedupe (keeps the first-seen casing as the display label),
// counted and sorted most-frequent first.
function rankByFrequency(values: string[]): SkillCount[] {
  const counts = new Map<string, SkillCount>()
  for (const raw of values) {
    const label = raw.trim()
    if (!label) continue
    const key = label.toLowerCase()
    const existing = counts.get(key)
    if (existing) existing.count++
    else counts.set(key, { label, count: 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}

function barWidth(count: number, list: SkillCount[]): number {
  const max = list[0]?.count ?? 1
  return Math.max(6, Math.round((count / max) * 100))
}

// Postings ask for these skills, but the base resume doesn't back them up.
const topMissingSkills = computed(() =>
  rankByFrequency(
    tailoredApps.value.flatMap((a) => a.tailoredResume?.missingKeywords ?? []),
  ).slice(0, MAX_ROWS),
)

// Only counts adds the user actually accepted in review — a deliberate
// signal, not just whatever Claude happened to suggest.
const topAcceptedSkills = computed(() =>
  rankByFrequency(
    tailoredApps.value.flatMap(
      (a) => a.tailoredResume?.review?.skills.flatMap((s) => s.acceptedAdds) ?? [],
    ),
  ).slice(0, MAX_ROWS),
)
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8 space-y-8">
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
        Skills Analytics
      </h1>
      <p class="text-sm text-gray-500">
        Trends across every job you've tailored a resume for.
      </p>
    </div>

    <p class="flex items-center gap-1.5 text-[11px] text-gray-400">
      <UIcon
        name="i-lucide-shield-check"
        class="shrink-0"
      />
      Computed from applications already stored on this device. No AI call,
      no network request.
    </p>

    <!-- Overall empty state -->
    <div
      v-if="tailoredApps.length === 0"
      class="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
    >
      <div
        class="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-950 flex items-center justify-center mb-3"
      >
        <UIcon
          name="i-lucide-bar-chart-3"
          class="text-2xl text-primary-500 dark:text-primary-400"
        />
      </div>
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-64">
        No tailored resumes yet
      </p>
      <p class="text-xs text-gray-400 mt-1 max-w-72">
        Optimize a job from the side panel to start seeing skill trends here.
      </p>
    </div>

    <template v-else>
      <!-- Top missing skills -->
      <section class="space-y-3">
        <div>
          <h2
            class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight"
          >
            Top missing skills
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Skills job postings ask for that your resume doesn't back up,
            most common first.
          </p>
        </div>

        <div
          v-if="topMissingSkills.length"
          class="space-y-2.5"
        >
          <div
            v-for="(item, i) in topMissingSkills"
            :key="item.label"
            class="flex items-center gap-3"
          >
            <span class="text-xs text-gray-400 w-4 text-right shrink-0">
              {{ i + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2 mb-1">
                <span class="text-sm text-gray-900 dark:text-white truncate">
                  {{ item.label }}
                </span>
                <span class="text-xs text-gray-400 shrink-0">
                  {{ item.count }}
                </span>
              </div>
              <div
                class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
              >
                <div
                  class="h-full rounded-full bg-amber-500 transition-all duration-300"
                  :style="{ width: `${barWidth(item.count, topMissingSkills)}%` }"
                />
              </div>
            </div>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-gray-400 italic"
        >
          No missing skills recorded across your tailored resumes.
        </p>
      </section>

      <USeparator />

      <!-- Top skills you actually apply -->
      <section class="space-y-3">
        <div>
          <h2
            class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight"
          >
            Skills you actually add
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Skills you've accepted adding to your resume most often, across
            reviewed tailoring sessions.
          </p>
        </div>

        <div
          v-if="topAcceptedSkills.length"
          class="space-y-2.5"
        >
          <div
            v-for="(item, i) in topAcceptedSkills"
            :key="item.label"
            class="flex items-center gap-3"
          >
            <span class="text-xs text-gray-400 w-4 text-right shrink-0">
              {{ i + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2 mb-1">
                <span class="text-sm text-gray-900 dark:text-white truncate">
                  {{ item.label }}
                </span>
                <span class="text-xs text-gray-400 shrink-0">
                  {{ item.count }}
                </span>
              </div>
              <div
                class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
              >
                <div
                  class="h-full rounded-full bg-green-500 transition-all duration-300"
                  :style="{ width: `${barWidth(item.count, topAcceptedSkills)}%` }"
                />
              </div>
            </div>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-gray-400 italic"
        >
          No accepted skill additions yet — review a tailored resume from the
          side panel to start tracking this.
        </p>
      </section>
    </template>
  </div>
</template>
