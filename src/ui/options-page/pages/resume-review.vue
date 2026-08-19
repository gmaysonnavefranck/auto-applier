<script setup lang="ts">
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import { useResumeStore } from "src/stores/resume.store"
import { useApplicationsStore } from "src/stores/applications.store"
import { diffLines, diffSet, type DiffOp } from "src/utils/diff"
import type { TailoredResumeReview } from "src/types/jobs"

type Section = "work" | "skills"

const route = useRoute()
const resumeStore = useResumeStore()
const appsStore = useApplicationsStore()

const appId = computed(() => route.query.appId as string | undefined)
const app = computed(() =>
  appsStore.applications.find((a) => a.id === appId.value),
)
const tailored = computed(() => app.value?.tailoredResume)

function emptyReview(): TailoredResumeReview {
  return { summaryAccepted: false, work: [], skills: [] }
}

const review = computed<TailoredResumeReview>(
  () => tailored.value?.review ?? emptyReview(),
)

function saveReview(next: TailoredResumeReview) {
  if (!app.value || !tailored.value) return
  appsStore.updateApplication(app.value.id, {
    tailoredResume: { ...tailored.value, review: next },
  })
}

function toggleSummary(value: boolean) {
  saveReview({ ...review.value, summaryAccepted: value })
}

function sectionEntry(section: Section, id: string) {
  return (
    review.value[section].find((e) => e.id === id) ?? {
      id,
      acceptedAdds: [],
      acceptedRemoves: [],
    }
  )
}

function isAccepted(
  section: Section,
  id: string,
  line: string,
  kind: "add" | "remove",
) {
  const entry = sectionEntry(section, id)
  return kind === "add"
    ? entry.acceptedAdds.includes(line)
    : entry.acceptedRemoves.includes(line)
}

function toggleLine(
  section: Section,
  id: string,
  line: string,
  kind: "add" | "remove",
  checked: boolean,
) {
  const entry = sectionEntry(section, id)
  const key = kind === "add" ? "acceptedAdds" : "acceptedRemoves"
  const updated = {
    ...entry,
    [key]: checked
      ? [...entry[key], line]
      : entry[key].filter((l) => l !== line),
  }
  saveReview({
    ...review.value,
    [section]: [...review.value[section].filter((e) => e.id !== id), updated],
  })
}

function acceptAllSection(section: Section, id: string, ops: DiffOp[]) {
  const acceptedAdds = ops.filter((o) => o.type === "added").map((o) => o.value)
  const acceptedRemoves = ops
    .filter((o) => o.type === "removed")
    .map((o) => o.value)
  saveReview({
    ...review.value,
    [section]: [
      ...review.value[section].filter((e) => e.id !== id),
      { id, acceptedAdds, acceptedRemoves },
    ],
  })
}

function clearSection(section: Section, id: string) {
  saveReview({
    ...review.value,
    [section]: review.value[section].filter((e) => e.id !== id),
  })
}

// ── Summary (full-text side by side, single accept/reject) ──────────────
const baseSummary = computed(() => resumeStore.resume.basics.summary ?? "")
const summaryChanged = computed(
  () => !!tailored.value && tailored.value.summary.trim() !== baseSummary.value.trim(),
)

// ── Work highlights (line-level diff per entry, order matters) ──────────
const workDiffs = computed(() => {
  if (!tailored.value) return []
  return resumeStore.resume.work
    .map((job) => {
      const tw = tailored.value!.work.find((w) => w.id === job.id)
      if (!tw) return null
      const ops = diffLines(job.highlights, tw.highlights)
      return { job, ops }
    })
    .filter((x): x is { job: (typeof resumeStore.resume.work)[number]; ops: DiffOp[] } =>
      x !== null && x.ops.some((op) => op.type !== "unchanged"),
    )
})

// ── Skills (membership diff per category — order is allowed to change) ──
const skillDiffs = computed(() => {
  if (!tailored.value?.skills) return []
  return resumeStore.resume.skills
    .map((group) => {
      const ts = tailored.value!.skills!.find((s) => s.id === group.id)
      if (!ts) return null
      const ops = diffSet(group.items, ts.items)
      return { group, ops }
    })
    .filter(
      (
        x,
      ): x is { group: (typeof resumeStore.resume.skills)[number]; ops: DiffOp[] } =>
        x !== null && x.ops.some((op) => op.type !== "unchanged"),
    )
})

const hasAnyDiff = computed(
  () =>
    summaryChanged.value ||
    workDiffs.value.length > 0 ||
    skillDiffs.value.length > 0,
)

function countOf(ops: DiffOp[], type: DiffOp["type"]) {
  return ops.filter((op) => op.type === type).length
}

// Mirrors the count shown in the side panel, so the "not reviewed yet" /
// "N changes accepted" language matches on both ends of the flow.
const acceptedCount = computed(() => {
  const r = review.value
  let count = r.summaryAccepted ? 1 : 0
  for (const w of r.work) count += w.acceptedAdds.length + w.acceptedRemoves.length
  for (const s of r.skills) count += s.acceptedAdds.length + s.acceptedRemoves.length
  return count
})

const showOnlyChanges = ref(true)

function visibleOps(ops: DiffOp[]): DiffOp[] {
  return showOnlyChanges.value ? ops.filter((op) => op.type !== "unchanged") : ops
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-8 space-y-8">
    <div v-if="!app || !tailored">
      <p class="text-sm text-gray-500">
        No tailored resume found for this application. Go back to the side
        panel and click "Optimize for this job" first.
      </p>
    </div>

    <template v-else>
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          Review suggested changes
        </h1>
        <p class="text-sm text-gray-500">
          Tailored for {{ app.jobTitle }} @ {{ app.company }}. Nothing is
          applied until you check it off below —
          <span
            class="font-semibold"
            :class="
              acceptedCount > 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-amber-600 dark:text-amber-400'
            "
          >{{
            acceptedCount > 0
              ? `${acceptedCount} change${acceptedCount === 1 ? "" : "s"} accepted so far`
              : "nothing accepted yet"
          }}</span>.
        </p>
        <p
          v-if="hasAnyDiff"
          class="text-xs text-gray-400 mt-1"
        >
          Showing {{ workDiffs.length }} of {{ resumeStore.resume.work.length }}
          role{{ resumeStore.resume.work.length === 1 ? "" : "s" }} and
          {{ skillDiffs.length }} of {{ resumeStore.resume.skills.length }}
          skill categor{{ resumeStore.resume.skills.length === 1 ? "y" : "ies" }}
          with suggested changes — entries with nothing to review aren't
          listed below.
        </p>
      </div>

      <div
        v-if="tailored.missingKeywords?.length"
        class="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-3"
      >
        <p class="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
          <UIcon
            name="i-lucide-triangle-alert"
            class="shrink-0"
          />
          Not in your resume — the job asked for these but nothing in your
          background backs them up
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="kw in tailored.missingKeywords"
            :key="kw"
            class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"
          >{{ kw }}</span>
        </div>
      </div>

      <p
        v-if="!hasAnyDiff"
        class="text-sm text-gray-500"
      >
        Claude didn't suggest any changes to your base resume for this job.
      </p>

      <!-- ── Column labels + view toggle ──────────────────────────────── -->
      <div
        v-if="hasAnyDiff"
        class="flex items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-gray-800"
      >
        <div
          class="grid grid-cols-2 gap-x-6 text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1"
        >
          <span>Current</span>
          <span>Suggested</span>
        </div>
        <USwitch
          v-model="showOnlyChanges"
          label="Changes only"
          class="shrink-0"
        />
      </div>

      <!-- ── Summary ─────────────────────────────────────────────────── -->
      <section
        v-if="summaryChanged"
        class="space-y-2"
      >
        <div class="flex items-center justify-between">
          <h2
            class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight"
          >
            Summary
          </h2>
          <UCheckbox
            :model-value="review.summaryAccepted"
            label="Use suggested summary"
            @update:model-value="toggleSummary($event === true)"
          />
        </div>
        <div class="grid grid-cols-2 gap-x-6 text-sm leading-relaxed">
          <p class="text-gray-500">{{ baseSummary || "(empty)" }}</p>
          <p class="text-emerald-600 dark:text-emerald-400">
            {{ tailored.summary }}
          </p>
        </div>
      </section>

      <!-- ── Work highlights ─────────────────────────────────────────── -->
      <section
        v-for="{ job, ops } in workDiffs"
        :key="job.id"
        class="space-y-2"
      >
        <div class="flex items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-medium text-gray-900 dark:text-white">
              {{ job.position }} · {{ job.company }}
            </h2>
            <p class="text-xs text-gray-400">
              {{ countOf(ops, "added") }} addition{{
                countOf(ops, "added") === 1 ? "" : "s"
              }}
              · {{ countOf(ops, "removed") }} removal{{
                countOf(ops, "removed") === 1 ? "" : "s"
              }}
            </p>
          </div>
          <div class="flex gap-1 shrink-0">
            <button
              type="button"
              class="text-xs text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
              @click="clearSection('work', job.id)"
            >
              Reset
            </button>
            <button
              type="button"
              class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline underline-offset-2"
              @click="acceptAllSection('work', job.id, ops)"
            >
              Accept all
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <template
            v-for="(op, i) in visibleOps(ops)"
            :key="i"
          >
            <template v-if="op.type === 'unchanged'">
              <span class="text-gray-500">{{ op.value }}</span>
              <span class="text-gray-500">{{ op.value }}</span>
            </template>
            <template v-else-if="op.type === 'removed'">
              <span class="flex items-start gap-2">
                <UCheckbox
                  :model-value="isAccepted('work', job.id, op.value, 'remove')"
                  class="mt-0.5 shrink-0"
                  @update:model-value="
                    toggleLine('work', job.id, op.value, 'remove', $event === true)
                  "
                />
                <span class="text-rose-500/80 line-through">{{ op.value }}</span>
              </span>
              <span />
            </template>
            <template v-else>
              <span />
              <span class="flex items-start gap-2">
                <UCheckbox
                  :model-value="isAccepted('work', job.id, op.value, 'add')"
                  class="mt-0.5 shrink-0"
                  @update:model-value="
                    toggleLine('work', job.id, op.value, 'add', $event === true)
                  "
                />
                <span class="text-emerald-600 dark:text-emerald-400">{{
                  op.value
                }}</span>
              </span>
            </template>
          </template>
        </div>
      </section>

      <!-- ── Skills ───────────────────────────────────────────────────── -->
      <section
        v-for="{ group, ops } in skillDiffs"
        :key="group.id"
        class="space-y-2"
      >
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-medium text-gray-900 dark:text-white">
            {{ group.category }}
          </h2>
          <div class="flex gap-1 shrink-0">
            <button
              type="button"
              class="text-xs text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
              @click="clearSection('skills', group.id)"
            >
              Reset
            </button>
            <button
              type="button"
              class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline underline-offset-2"
              @click="acceptAllSection('skills', group.id, ops)"
            >
              Accept all
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <label
            v-for="(op, i) in visibleOps(ops)"
            :key="i"
            class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
            :class="{
              'bg-gray-50 dark:bg-gray-900 text-gray-500': op.type === 'unchanged',
              'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400':
                op.type === 'removed',
              'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400':
                op.type === 'added',
            }"
          >
            <UCheckbox
              v-if="op.type !== 'unchanged'"
              :model-value="
                isAccepted(
                  'skills',
                  group.id,
                  op.value,
                  op.type === 'added' ? 'add' : 'remove',
                )
              "
              size="sm"
              @update:model-value="
                toggleLine(
                  'skills',
                  group.id,
                  op.value,
                  op.type === 'added' ? 'add' : 'remove',
                  $event === true,
                )
              "
            />
            <span :class="{ 'line-through': op.type === 'removed' }">{{
              op.value
            }}</span>
          </label>
        </div>
      </section>

      <div class="pt-2 border-t border-gray-100 dark:border-gray-800">
        <UButton
          icon="i-lucide-eye"
          @click="$router.push('/options-page/resume-preview?appId=' + app.id)"
        >
          View resume with accepted changes
        </UButton>
      </div>
    </template>
  </div>
</template>
