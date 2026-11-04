<script setup lang="ts">
import { computed, ref, toRaw } from "vue"
import StatBar from "src/components/StatBar.vue"
import { useAiStore } from "src/stores/ai.store"
import { useApplicationsStore } from "src/stores/applications.store"
import { useResumeStore } from "src/stores/resume.store"
import { useSkillsStore } from "src/stores/skills.store"
import { STATUS_CONFIG } from "src/types/jobs"
import {
  LOW_DATA,
  followUpDays,
  funnel,
  ghosted,
  rejectionStages,
  responseTime,
  missingSkills,
  responseByMatchScore,
  responseByRoleType,
  responseBySeniority,
  responseBySkill,
  responseBySource,
  skillImpact,
  skillKey,
  strengths,
} from "src/utils/analytics"
import type { Closeness, LearningPlan } from "src/utils/learningPlan"

const aiStore = useAiStore()
const appsStore = useApplicationsStore()
const resumeStore = useResumeStore()
const skillsStore = useSkillsStore()

const MAX_ROWS = 15
// Gaps sent to the learning-plan call — top of the missing list only.
const PLAN_GAPS = 8

const apps = computed(() => appsStore.applications)
const haveKeys = computed(
  () => new Set(resumeStore.resume.skills.flatMap((g) => g.items).map(skillKey)),
)

const missing = computed(() => missingSkills(apps.value, resumeStore.resume))
const topMissing = computed(() => missing.value.skills.slice(0, MAX_ROWS))
const strong = computed(() => strengths(apps.value, resumeStore.resume))
const impact = computed(() =>
  skillImpact(apps.value, skillsStore.added).filter(
    (r) => r.before.applied + r.after.applied > 0,
  ),
)

const funnelRows = computed(() => funnel(apps.value))
const rateSections = computed(() => [
  {
    title: "Does tailoring pay off?",
    hint: "Response rate (reached screening or further) by match score.",
    rows: responseByMatchScore(apps.value, resumeStore.resume),
    bar: "bg-sky-500",
  },
  {
    title: "Response rate by role type",
    hint: "From the job title. Generic titles land in Other — see by tech below.",
    rows: responseByRoleType(apps.value),
    bar: "bg-indigo-500",
  },
  {
    title: "Response rate by tech",
    hint: "Postings mentioning each skill, most applied-to first. A posting counts toward every skill it mentions.",
    rows: responseBySkill(apps.value, resumeStore.resume),
    bar: "bg-cyan-500",
  },
  {
    title: "Response rate by seniority",
    hint: "From the job title. A low rate on one level can mean you're aiming too high or too low.",
    rows: responseBySeniority(apps.value),
    bar: "bg-teal-500",
  },
  {
    title: "Response rate by source",
    hint: "",
    rows: responseBySource(apps.value),
    bar: "bg-violet-500",
  },
])
const timing = computed(() => responseTime(apps.value))
const followUp = computed(() => followUpDays(apps.value))
const ghostedRows = computed(() => ghosted(apps.value, Date.now(), followUp.value))
const rejections = computed(() => rejectionStages(apps.value))

// Only counts adds the user actually accepted in review — a deliberate
// signal, not just whatever Claude happened to suggest. Variants merged via
// skillKey, first-seen spelling shown.
const topAcceptedSkills = computed(() => {
  const counts = new Map<string, { label: string; count: number }>()
  for (const raw of apps.value.flatMap(
    (a) => a.tailoredResume?.review?.skills.flatMap((s) => s.acceptedAdds) ?? [],
  )) {
    const key = skillKey(raw)
    if (!key) continue
    const row = counts.get(key) ?? { label: raw.trim(), count: 0 }
    row.count++
    counts.set(key, row)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, MAX_ROWS)
})

const CLOSENESS_COLOR: Record<Closeness, "success" | "warning" | "error"> = {
  close: "success",
  moderate: "warning",
  far: "error",
}

const planning = ref(false)
const planError = ref("")

async function buildPlan() {
  planning.value = true
  planError.value = ""
  try {
    const response: { ok: boolean; result?: LearningPlan; error?: string } =
      await chrome.runtime.sendMessage({
        type: "LEARNING_PLAN",
        apiKey: aiStore.claudeApiKey,
        resume: JSON.parse(JSON.stringify(toRaw(resumeStore.resume))),
        gaps: missing.value.skills.slice(0, PLAN_GAPS).map((s) => ({
          skill: s.label,
          postings: s.postings,
          required: s.required,
        })),
        totalPostings: missing.value.total,
      })
    if (!response.ok) throw new Error(response.error ?? "Unknown error")
    skillsStore.plan = response.result!
  } catch (err) {
    planError.value = err instanceof Error ? err.message : String(err)
  } finally {
    planning.value = false
  }
}

const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0)
const rate = (part: number, whole: number) => `${Math.round(pct(part, whole))}%`
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString()
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8 space-y-8">
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
        Analytics
      </h1>
      <p class="text-sm text-gray-500">
        Skill gaps and outcomes across every job you've saved.
      </p>
    </div>

    <p class="flex items-center gap-1.5 text-[11px] text-gray-400">
      <UIcon
        name="i-lucide-shield-check"
        class="shrink-0"
      />
      Computed from applications already stored on this device. Only the
      learning plan calls the AI, and only when you click it. Rates from fewer
      than {{ LOW_DATA }} applications are marked "low data".
    </p>

    <!-- Overall empty state -->
    <div
      v-if="apps.length === 0"
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
        No saved jobs yet
      </p>
      <p class="text-xs text-gray-400 mt-1 max-w-72">
        Save jobs from the side panel to start seeing trends here.
      </p>
    </div>

    <template v-else>
      <!-- Top missing skills -->
      <section class="space-y-3">
        <div>
          <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
            Top missing skills
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Skills postings ask for that your base resume doesn't list, out of
            {{ missing.total }} saved postings. Must-haves rank higher. Tap the
            cap to mark one you're learning.
          </p>
        </div>

        <div
          v-if="topMissing.length"
          class="space-y-2.5"
        >
          <div
            v-for="(item, i) in topMissing"
            :key="item.key"
            class="flex items-center gap-3"
          >
            <span class="text-xs text-gray-400 w-4 text-right shrink-0">
              {{ i + 1 }}
            </span>
            <StatBar
              :label="item.label"
              :value="[
                `${item.postings} of ${missing.total} (${rate(item.postings, missing.total)})`,
                item.required ? `${item.required} must-have` : '',
                item.rejected ? `${item.rejected} rejected` : '',
              ].filter(Boolean).join(' · ')"
              :pct="pct(item.postings, missing.total)"
              bar-class="bg-amber-500"
            />
            <UButton
              size="xs"
              variant="ghost"
              :color="skillsStore.isLearning(item.key) ? 'primary' : 'neutral'"
              icon="i-lucide-graduation-cap"
              :aria-label="skillsStore.isLearning(item.key) ? `Stop learning ${item.label}` : `Mark ${item.label} as learning`"
              :aria-pressed="skillsStore.isLearning(item.key)"
              @click="skillsStore.toggleLearning(item.label)"
            />
          </div>
        </div>
        <p
          v-else
          class="text-sm text-gray-400 italic"
        >
          No missing skills yet. Optimize a job from the side panel to start
          tracking gaps.
        </p>

        <div
          v-if="missing.bundles.length"
          class="text-xs text-gray-500 space-y-1"
        >
          <p class="font-medium text-gray-700 dark:text-gray-300">
            Often asked together
          </p>
          <p
            v-for="b in missing.bundles"
            :key="b.skills.join('+')"
          >
            {{ b.skills[0] }} + {{ b.skills[1] }}
            <span class="text-gray-400">· {{ b.postings }} postings</span>
          </p>
        </div>

        <p
          v-if="missing.closed.length"
          class="flex items-start gap-1.5 text-xs text-green-600 dark:text-green-400"
        >
          <UIcon
            name="i-lucide-check-circle-2"
            class="shrink-0 mt-0.5"
          />
          Gaps closed (now on your resume): {{ missing.closed.join(", ") }}
        </p>
      </section>

      <USeparator />

      <!-- Learning plan (AI) -->
      <section
        v-if="missing.skills.length"
        class="space-y-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
              What to learn first
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">
              One AI call ranks your top {{ PLAN_GAPS }} gaps by demand vs how
              close each is to what you already know.
            </p>
          </div>
          <UButton
            size="xs"
            :loading="planning"
            :disabled="!aiStore.claudeApiKey"
            icon="i-lucide-sparkles"
            @click="buildPlan"
          >
            {{ skillsStore.plan ? "Rebuild" : "Build plan" }}
          </UButton>
        </div>
        <p
          v-if="!aiStore.claudeApiKey"
          class="text-xs text-gray-400"
        >
          Add a Claude API key in settings to use this.
        </p>
        <p
          v-if="planError"
          class="text-xs text-red-500"
        >
          {{ planError }}
        </p>

        <ol
          v-if="skillsStore.plan"
          class="space-y-3"
        >
          <li
            v-for="(item, i) in skillsStore.plan.items"
            :key="item.skill"
            class="flex gap-3"
          >
            <span class="text-xs text-gray-400 w-4 text-right shrink-0 mt-0.5">
              {{ i + 1 }}
            </span>
            <div class="min-w-0 space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ item.skill }}
                </span>
                <UBadge
                  size="sm"
                  variant="subtle"
                  :color="CLOSENESS_COLOR[item.closeness]"
                >
                  {{ item.closeness }}
                </UBadge>
                <UIcon
                  v-if="haveKeys.has(skillKey(item.skill))"
                  name="i-lucide-check-circle-2"
                  class="text-green-500"
                  aria-label="On your resume now"
                />
              </div>
              <p class="text-xs text-gray-500">
                {{ item.why }}
              </p>
              <p class="text-xs text-gray-700 dark:text-gray-300">
                <span class="font-medium">First step:</span> {{ item.firstStep }}
              </p>
            </div>
          </li>
        </ol>
        <p
          v-if="skillsStore.plan"
          class="text-[11px] text-gray-400"
        >
          Built {{ fmtDate(skillsStore.plan.generatedAt) }}
        </p>
      </section>

      <!-- Learning tracker -->
      <section
        v-if="skillsStore.learning.length || impact.length"
        class="space-y-3"
      >
        <div>
          <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
            Learning tracker
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Once you add a skill to your base resume, compare response rates on
            postings asking for it, applied before vs after.
          </p>
        </div>

        <ul
          v-if="skillsStore.learning.length"
          class="divide-y divide-gray-100 dark:divide-gray-800"
        >
          <li
            v-for="l in skillsStore.learning"
            :key="l.key"
            class="flex items-baseline justify-between gap-3 py-1.5"
          >
            <span class="text-sm text-gray-900 dark:text-white truncate">
              {{ l.label }}
            </span>
            <span class="text-xs shrink-0">
              <span
                v-if="haveKeys.has(l.key)"
                class="text-green-600 dark:text-green-400"
              >on resume</span>
              <span
                v-else
                class="text-gray-400"
              >learning since {{ fmtDate(l.at) }}</span>
            </span>
          </li>
        </ul>

        <div
          v-for="row in impact"
          :key="row.label"
          class="space-y-1.5"
        >
          <p class="text-xs font-medium text-gray-700 dark:text-gray-300">
            {{ row.label }} <span class="text-gray-400 font-normal">· added {{ fmtDate(row.at) }}</span>
          </p>
          <StatBar
            v-for="side in [row.before, row.after]"
            :key="side.label"
            :label="side.label === 'before' ? 'Before' : 'After'"
            :value="`${side.responded} of ${side.applied} (${rate(side.responded, side.applied)})`"
            :pct="pct(side.responded, side.applied)"
            :low-data="side.applied < LOW_DATA"
            :bar-class="side.label === 'before' ? 'bg-gray-400' : 'bg-green-500'"
          />
        </div>
      </section>

      <USeparator />

      <!-- Strengths -->
      <section class="space-y-3">
        <div>
          <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
            Your strengths
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Skills on your resume that postings ask for most, out of
            {{ strong.total }} saved descriptions. Lead with these.
          </p>
        </div>
        <div
          v-if="strong.rows.length"
          class="space-y-2.5"
        >
          <StatBar
            v-for="row in strong.rows.slice(0, MAX_ROWS)"
            :key="row.label"
            :label="row.label"
            :value="`${row.postings} of ${strong.total} (${rate(row.postings, strong.total)})`"
            :pct="pct(row.postings, strong.total)"
            bar-class="bg-green-500"
          />
        </div>
        <p
          v-else
          class="text-sm text-gray-400 italic"
        >
          None of your resume skills appear in saved descriptions yet.
        </p>
      </section>

      <USeparator />

      <!-- Funnel -->
      <section class="space-y-3">
        <div>
          <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
            Application funnel
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            How far applications get. % is conversion from the stage above.
          </p>
        </div>
        <div class="space-y-2.5">
          <StatBar
            v-for="(row, i) in funnelRows"
            :key="row.stage"
            :label="STATUS_CONFIG[row.stage].label"
            :value="i === 0 ? `${row.count}` : `${row.count} (${rate(row.count, funnelRows[i - 1].count)})`"
            :pct="pct(row.count, funnelRows[0].count)"
            :low-data="i > 0 && funnelRows[i - 1].count < LOW_DATA"
            bar-class="bg-primary-500"
          />
        </div>
        <p
          v-if="timing.median !== null"
          class="text-xs text-gray-500"
          :class="{ 'opacity-60': timing.count < LOW_DATA }"
        >
          Typical time to first response:
          <span class="font-medium text-gray-900 dark:text-white">{{ timing.median }} days</span>
          <span class="text-gray-400">
            (median of {{ timing.count }}<template v-if="timing.count < LOW_DATA">, low data</template>)
          </span>
        </p>
      </section>

      <USeparator />

      <!-- Rejection stage -->
      <section class="space-y-3">
        <div>
          <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
            Where rejections happen
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Mostly right after applying points at the resume; after interviews
            points at interview prep.
          </p>
        </div>
        <div
          v-if="rejections.rows.length"
          class="space-y-2.5"
        >
          <StatBar
            v-for="row in rejections.rows"
            :key="row.label"
            :label="row.label"
            :value="`${row.count} (${rate(row.count, rejections.total)})`"
            :pct="pct(row.count, rejections.total)"
            :low-data="rejections.total < LOW_DATA"
            bar-class="bg-red-500"
          />
        </div>
        <p
          v-else
          class="text-sm text-gray-400 italic"
        >
          No rejections with a recorded stage yet.
        </p>
        <p
          v-if="rejections.unknown"
          class="text-[11px] text-gray-400"
        >
          {{ rejections.unknown }} older rejection{{ rejections.unknown === 1 ? "" : "s" }}
          not counted: no stage history.
        </p>
      </section>

      <!-- Response-rate breakdowns -->
      <template
        v-for="section in rateSections"
        :key="section.title"
      >
        <USeparator />
        <section class="space-y-3">
          <div>
            <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
              {{ section.title }}
            </h2>
            <p
              v-if="section.hint"
              class="text-xs text-gray-500 mt-0.5"
            >
              {{ section.hint }}
            </p>
          </div>
          <div
            v-if="section.rows.length"
            class="space-y-2.5"
          >
            <StatBar
              v-for="row in section.rows"
              :key="row.label"
              :label="row.label"
              :value="`${row.responded} of ${row.applied} (${rate(row.responded, row.applied)})`"
              :pct="pct(row.responded, row.applied)"
              :low-data="row.applied < LOW_DATA"
              :bar-class="section.bar"
            />
          </div>
          <p
            v-else
            class="text-sm text-gray-400 italic"
          >
            Mark jobs as applied to compare outcomes.
          </p>
        </section>
      </template>

      <USeparator />

      <!-- Ghosted -->
      <section class="space-y-3">
        <div>
          <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
            Follow up
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Applied {{ followUp }}+ days ago with no movement{{
              timing.count >= LOW_DATA ? " (twice your typical response time)" : ""
            }}.
          </p>
        </div>
        <ul
          v-if="ghostedRows.length"
          class="divide-y divide-gray-100 dark:divide-gray-800"
        >
          <li
            v-for="g in ghostedRows"
            :key="g.app.id"
            class="flex items-baseline justify-between gap-3 py-1.5"
          >
            <a
              :href="g.app.url || undefined"
              target="_blank"
              class="text-sm text-gray-900 dark:text-white truncate hover:underline"
            >
              {{ g.app.jobTitle }} · {{ g.app.company }}
            </a>
            <span class="text-xs text-gray-400 shrink-0">{{ g.days }}d</span>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-gray-400 italic"
        >
          Nothing stale. Nice.
        </p>
      </section>

      <USeparator />

      <!-- Top skills you actually apply -->
      <section class="space-y-3">
        <div>
          <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
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
            <StatBar
              :label="item.label"
              :value="`${item.count}`"
              :pct="pct(item.count, topAcceptedSkills[0].count)"
              bar-class="bg-green-500"
            />
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
