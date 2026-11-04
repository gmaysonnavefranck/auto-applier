<script setup lang="ts">
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import { useResumeStore } from "src/stores/resume.store"
import { useApplicationsStore } from "src/stores/applications.store"
import { diffLines, diffSet, type DiffOp } from "src/utils/diff"
import { computeMatchScore } from "src/utils/matchScore"
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

function toggleTitle(value: boolean) {
  saveReview({ ...review.value, titleAccepted: value })
}

function isWorkTitleAccepted(id: string): boolean {
  return review.value.work.find((e) => e.id === id)?.titleAccepted ?? false
}

function toggleWorkTitle(id: string, value: boolean) {
  const existing = review.value.work.find((e) => e.id === id)
  saveReview({
    ...review.value,
    work: [
      ...review.value.work.filter((e) => e.id !== id),
      {
        id,
        acceptedAdds: existing?.acceptedAdds ?? [],
        acceptedRemoves: existing?.acceptedRemoves ?? [],
        edits: existing?.edits,
        titleEdit: existing?.titleEdit,
        titleAccepted: value,
      },
    ],
  })
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

// excludeAdds skips specific "added" values from the bulk accept — used to
// keep unconfirmed inferred skill guesses out of "Accept all", which must
// stay an individual, deliberate action (see isInferred below).
function acceptAllSection(
  section: Section,
  id: string,
  ops: DiffOp[],
  excludeAdds: string[] = [],
) {
  const excludeSet = new Set(excludeAdds)
  const existing = sectionEntry(section, id)
  const acceptedAdds = ops
    .filter((o) => o.type === "added" && !excludeSet.has(o.value))
    .map((o) => o.value)
  const acceptedRemoves = ops
    .filter((o) => o.type === "removed")
    .map((o) => o.value)
  saveReview({
    ...review.value,
    [section]: [
      ...review.value[section].filter((e) => e.id !== id),
      { ...existing, id, acceptedAdds, acceptedRemoves },
    ],
  })
}

function clearSection(section: Section, id: string) {
  saveReview({
    ...review.value,
    [section]: review.value[section].filter((e) => e.id !== id),
  })
}

// ── Inline editing of Claude's suggestions ───────────────────────────────
// Lets the candidate correct a suggestion before accepting it (e.g. fix an
// inferred companion-tool guess, or reword a bullet) instead of only being
// able to accept Claude's exact wording or reject it outright.
const editingKeys = ref(new Set<string>())

function isEditing(key: string): boolean {
  return editingKeys.value.has(key)
}

function startEdit(key: string) {
  editingKeys.value.add(key)
}

function stopEdit(key: string) {
  editingKeys.value.delete(key)
}

function summaryDraft(): string {
  return review.value.summaryEdit ?? tailored.value?.summary ?? ""
}

function setSummaryEdit(value: string) {
  if (!tailored.value) return
  const edit = value.trim()
  saveReview({
    ...review.value,
    summaryEdit: edit && edit !== tailored.value.summary.trim() ? edit : undefined,
  })
}

function titleDraft(): string {
  return review.value.titleEdit ?? tailored.value?.title ?? ""
}

function setTitleEdit(value: string) {
  if (!tailored.value) return
  const edit = value.trim()
  saveReview({
    ...review.value,
    titleEdit: edit && edit !== tailored.value.title?.trim() ? edit : undefined,
  })
}

function workTitleDraft(id: string, suggested: string): string {
  return review.value.work.find((e) => e.id === id)?.titleEdit ?? suggested
}

function setWorkTitleEdit(id: string, suggested: string, value: string) {
  const existing = review.value.work.find((e) => e.id === id)
  const edit = value.trim()
  saveReview({
    ...review.value,
    work: [
      ...review.value.work.filter((e) => e.id !== id),
      {
        id,
        acceptedAdds: existing?.acceptedAdds ?? [],
        acceptedRemoves: existing?.acceptedRemoves ?? [],
        titleAccepted: existing?.titleAccepted ?? false,
        edits: existing?.edits,
        titleEdit: edit && edit !== suggested ? edit : undefined,
      },
    ],
  })
}

function editedLine(section: Section, id: string, original: string): string {
  return sectionEntry(section, id).edits?.[original] ?? original
}

function setLineEdit(section: Section, id: string, original: string, value: string) {
  const entry = sectionEntry(section, id)
  const edit = value.trim()
  const edits = { ...entry.edits }
  if (edit && edit !== original) edits[original] = edit
  else delete edits[original]
  saveReview({
    ...review.value,
    [section]: [
      ...review.value[section].filter((e) => e.id !== id),
      { ...entry, edits },
    ],
  })
}

// ── Summary (full-text side by side, single accept/reject) ──────────────
const baseSummary = computed(() => resumeStore.resume.basics.summary ?? "")
const summaryChanged = computed(
  () => !!tailored.value && tailored.value.summary.trim() !== baseSummary.value.trim(),
)

// ── Current title (single accept/reject, same shape as Summary) ─────────
const baseTitle = computed(() => resumeStore.resume.basics.title ?? "")
const titleChanged = computed(
  () =>
    !!tailored.value?.title?.trim() &&
    tailored.value.title.trim() !== baseTitle.value.trim(),
)

// ── Work highlights (line-level diff per entry, order matters) ──────────
// Each entry also carries an optional suggested job-title rewrite (Step 4
// of the tailoring prompt) — an entry can show up here purely for a title
// change even with zero highlight diffs.
const workDiffs = computed(() => {
  if (!tailored.value) return []
  return resumeStore.resume.work
    .map((job) => {
      const tw = tailored.value!.work.find((w) => w.id === job.id)
      if (!tw) return null
      const ops = diffLines(job.highlights, tw.highlights)
      const suggestedTitle =
        tw.title?.trim() && tw.title.trim() !== job.position.trim() ? tw.title : null
      return { job, ops, suggestedTitle }
    })
    .filter(
      (
        x,
      ): x is {
        job: (typeof resumeStore.resume.work)[number]
        ops: DiffOp[]
        suggestedTitle: string | null
      } =>
        x !== null &&
        (x.ops.some((op) => op.type !== "unchanged") || x.suggestedTitle !== null),
    )
})

// ── Skills (membership diff per category — order is allowed to change) ──
// `inferred` carries Claude's companion-tool guesses (Step 2 of the prompt)
// for this group — a subset of the "added" ops that must never be swept up
// by "Accept all" and get a distinct look in the template (see isInferred).
const skillDiffs = computed(() => {
  if (!tailored.value?.skills) return []
  return resumeStore.resume.skills
    .map((group) => {
      const ts = tailored.value!.skills!.find((s) => s.id === group.id)
      if (!ts) return null
      const ops = diffSet(group.items, ts.items)
      return { group, ops, inferred: ts.inferred ?? [] }
    })
    .filter(
      (
        x,
      ): x is {
        group: (typeof resumeStore.resume.skills)[number]
        ops: DiffOp[]
        inferred: string[]
      } => x !== null && x.ops.some((op) => op.type !== "unchanged"),
    )
})

function isInferred(inferred: string[], value: string): boolean {
  return inferred.includes(value)
}

const hasAnyDiff = computed(
  () =>
    titleChanged.value ||
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
  if (r.titleAccepted) count++
  for (const w of r.work) {
    count += w.acceptedAdds.length + w.acceptedRemoves.length
    if (w.titleAccepted) count++
  }
  for (const s of r.skills) count += s.acceptedAdds.length + s.acceptedRemoves.length
  return count
})

// Live JD-coverage score — recomputed from the same diffs/review state the
// checkboxes above already use, so it moves as you accept things.
const matchScore = computed(() =>
  tailored.value ? computeMatchScore(tailored.value, resumeStore.resume) : null,
)

const showOnlyChanges = ref(true)

function visibleOps(ops: DiffOp[]): DiffOp[] {
  return showOnlyChanges.value ? ops.filter((op) => op.type !== "unchanged") : ops
}

// ── Skills gap: not-covered vs still-pending ─────────────────────────────
// Reuses the same skillDiffs/isAccepted computeds the checkboxes below are
// bound to, so this list shrinks live as items get accepted — no separate
// diffing pass and no separate "covered" list (once accepted, an item just
// drops out of here).
const pendingSkillAdds = computed(() => {
  const items: string[] = []
  for (const { group, ops } of skillDiffs.value) {
    for (const op of ops) {
      if (
        op.type === "added" &&
        !isAccepted("skills", group.id, op.value, "add") &&
        !items.includes(op.value)
      ) {
        items.push(op.value)
      }
    }
  }
  return items
})

// requiredMissing is undefined on resumes tailored before the flag existed;
// those get one unlabeled list instead of a must-have / nice-to-have split.
const missingGroups = computed(() => {
  const t = tailored.value
  if (!t?.missingKeywords?.length) return []
  if (!t.requiredMissing) return [{ label: "", items: t.missingKeywords, mustHave: false }]
  const req = new Set(t.requiredMissing)
  return [
    { label: "Must-have", items: t.missingKeywords.filter((k) => req.has(k)), mustHave: true },
    { label: "Nice to have", items: t.missingKeywords.filter((k) => !req.has(k)), mustHave: false },
  ].filter((g) => g.items.length)
})

const hasSkillsGap = computed(
  () => !!tailored.value?.missingKeywords?.length || pendingSkillAdds.value.length > 0,
)
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-8 space-y-8">
    <div v-if="!app || !tailored">
      <p class="text-sm text-gray-500">
        <template v-if="!appId">
          No application selected. Open this page from the side panel by
          clicking "Review" on a tailored application.
        </template>
        <template v-else-if="!app">
          This application could not be found — it may have been removed.
        </template>
        <template v-else>
          This application doesn't have a tailored resume yet. Go back to
          the side panel and click "Optimize for this job" first.
        </template>
      </p>
    </div>

    <template v-else>
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          Review suggested changes
        </h1>
        <p class="text-sm text-gray-500">
          Tailored for {{ app.jobTitle }} @ {{ app.company }}. This review
          applies only to this application — your base resume and other
          jobs stay untouched, and re-optimizing a different job starts
          independently. Every checkbox below saves immediately, so there's
          no separate save step —
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

      <!-- ── Match score ──────────────────────────────────────────────── -->
      <div
        v-if="matchScore && matchScore.total > 0"
        class="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3"
      >
        <div class="flex items-center gap-4">
          <div class="shrink-0">
            <p class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {{ matchScore.current }}%
            </p>
            <p class="text-xs text-gray-400">JD match right now</p>
          </div>
          <div class="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
            <div
              class="absolute inset-y-0 left-0 h-full rounded-full bg-gray-300 dark:bg-gray-700"
              :style="{ width: matchScore.potential + '%' }"
            />
            <div
              class="absolute inset-y-0 left-0 h-full rounded-full bg-primary-500"
              :style="{ width: matchScore.current + '%' }"
            />
          </div>
          <div class="shrink-0 text-right">
            <p class="text-sm font-medium text-gray-500">{{ matchScore.potential }}%</p>
            <p class="text-xs text-gray-400">if you accept everything</p>
          </div>
        </div>
        <p class="text-xs text-gray-400 mt-2">
          Counts everything this pass flagged — skills, bullets, title,
          education — weighted equally. Not an ATS guarantee, just how much
          of what Claude found you've actually taken.
        </p>
      </div>

      <!-- ── Education match (informational only — never edited/accepted) ── -->
      <div
        v-if="tailored.educationMatch"
        class="rounded-xl border px-3.5 py-3 flex items-start gap-2.5"
        :class="
          tailored.educationMatch.met
            ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40'
            : 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40'
        "
      >
        <UIcon
          name="i-lucide-graduation-cap"
          class="shrink-0 mt-0.5"
          :class="
            tailored.educationMatch.met
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          "
        />
        <div class="text-xs">
          <p
            class="font-semibold"
            :class="
              tailored.educationMatch.met
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            "
          >
            Education — {{ tailored.educationMatch.met ? "Matches" : "Doesn't match" }}: {{
              tailored.educationMatch.requirement
            }}
          </p>
          <p
            v-if="tailored.educationMatch.note"
            class="text-gray-500 mt-0.5"
          >
            {{ tailored.educationMatch.note }}
          </p>
          <p class="text-gray-400 mt-0.5">
            Informational only — this isn't something we can change on your
            resume, just a check against what the posting asks for.
          </p>
        </div>
      </div>

      <div
        v-if="hasSkillsGap"
        class="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800 overflow-hidden"
      >
        <div
          v-if="tailored.missingKeywords?.length"
          class="px-3.5 py-3 bg-amber-50 dark:bg-amber-950/40"
        >
          <p class="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
            <UIcon
              name="i-lucide-triangle-alert"
              class="shrink-0"
            />
            Not covered — not in your background, nothing to accept here
          </p>
          <div class="space-y-1.5">
            <div
              v-for="group in missingGroups"
              :key="group.label"
              class="flex flex-wrap items-center gap-1.5"
            >
              <span
                v-if="group.label"
                class="text-[11px] font-semibold uppercase tracking-wide w-24 shrink-0"
                :class="group.mustHave ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'"
              >{{ group.label }}</span>
              <span
                v-for="kw in group.items"
                :key="kw"
                class="text-xs font-medium px-2 py-0.5 rounded-full"
                :class="group.mustHave
                  ? 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'"
              >{{ kw }}</span>
            </div>
          </div>
        </div>

        <div
          v-if="pendingSkillAdds.length"
          class="px-3.5 py-3 bg-primary-50 dark:bg-primary-950/40"
        >
          <p class="text-xs font-semibold text-primary-700 dark:text-primary-400 mb-1.5 flex items-center gap-1.5">
            <UIcon
              name="i-lucide-circle-dashed"
              class="shrink-0"
            />
            You can still cover these — accept the matching skill below to
            add it
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="kw in pendingSkillAdds"
              :key="kw"
              class="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-800 dark:text-primary-300"
            >{{ kw }}</span>
          </div>
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

      <!-- ── Current title ───────────────────────────────────────────── -->
      <section
        v-if="titleChanged"
        class="space-y-2"
      >
        <div class="flex items-center justify-between">
          <h2
            class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight"
          >
            Title
          </h2>
          <UCheckbox
            :model-value="review.titleAccepted ?? false"
            label="Use suggested title"
            @update:model-value="toggleTitle($event === true)"
          />
        </div>
        <div class="grid grid-cols-2 gap-x-6 text-sm leading-relaxed">
          <p class="text-gray-500">{{ baseTitle || "(empty)" }}</p>
          <div
            v-if="isEditing('title')"
            class="flex items-start gap-1.5"
          >
            <UInput
              :model-value="titleDraft()"
              size="sm"
              class="flex-1"
              autofocus
              @update:model-value="setTitleEdit(String($event))"
              @blur="stopEdit('title')"
              @keyup.enter="stopEdit('title')"
            />
          </div>
          <div
            v-else
            class="group flex items-start gap-1.5"
          >
            <p class="text-emerald-600 dark:text-emerald-400 flex-1">
              {{ titleDraft() }}
            </p>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
              title="Edit suggestion"
              @click="startEdit('title')"
            >
              <UIcon name="i-lucide-pencil" />
            </button>
          </div>
        </div>
      </section>

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
          <div
            v-if="isEditing('summary')"
            class="flex items-start gap-1.5"
          >
            <UTextarea
              :model-value="summaryDraft()"
              size="sm"
              class="flex-1"
              autofocus
              :rows="3"
              @update:model-value="setSummaryEdit(String($event))"
              @blur="stopEdit('summary')"
            />
          </div>
          <div
            v-else
            class="group flex items-start gap-1.5"
          >
            <p class="text-emerald-600 dark:text-emerald-400 flex-1">
              {{ summaryDraft() }}
            </p>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
              title="Edit suggestion"
              @click="startEdit('summary')"
            >
              <UIcon name="i-lucide-pencil" />
            </button>
          </div>
        </div>
      </section>

      <!-- ── Work highlights ─────────────────────────────────────────── -->
      <section
        v-for="{ job, ops, suggestedTitle } in workDiffs"
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
              @click="
                acceptAllSection('work', job.id, ops);
                suggestedTitle && toggleWorkTitle(job.id, true)
              "
            >
              Accept all
            </button>
          </div>
        </div>

        <div
          v-if="suggestedTitle"
          class="flex items-center gap-2 text-xs bg-primary-50 dark:bg-primary-950/40 rounded-md px-2.5 py-1.5"
        >
          <UCheckbox
            :model-value="isWorkTitleAccepted(job.id)"
            size="sm"
            @update:model-value="toggleWorkTitle(job.id, $event === true)"
          />
          <span class="text-gray-400 line-through shrink-0">{{ job.position }}</span>
          <UIcon
            name="i-lucide-arrow-right"
            class="shrink-0 text-gray-400"
          />
          <UInput
            v-if="isEditing('work-title:' + job.id)"
            :model-value="workTitleDraft(job.id, suggestedTitle)"
            size="xs"
            class="flex-1"
            autofocus
            @update:model-value="
              setWorkTitleEdit(job.id, suggestedTitle, String($event))
            "
            @blur="stopEdit('work-title:' + job.id)"
            @keyup.enter="stopEdit('work-title:' + job.id)"
          />
          <template v-else>
            <span class="text-primary-700 dark:text-primary-400 font-medium flex-1">{{
              workTitleDraft(job.id, suggestedTitle)
            }}</span>
            <button
              type="button"
              class="text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 shrink-0"
              title="Edit suggestion"
              @click="startEdit('work-title:' + job.id)"
            >
              <UIcon name="i-lucide-pencil" />
            </button>
          </template>
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
                <UTextarea
                  v-if="isEditing('work-line:' + job.id + ':' + op.value)"
                  :model-value="editedLine('work', job.id, op.value)"
                  size="xs"
                  class="flex-1"
                  autofocus
                  :rows="2"
                  @update:model-value="
                    setLineEdit('work', job.id, op.value, String($event))
                  "
                  @blur="stopEdit('work-line:' + job.id + ':' + op.value)"
                />
                <span
                  v-else
                  class="group flex items-start gap-1.5 flex-1"
                >
                  <span class="text-emerald-600 dark:text-emerald-400">{{
                    editedLine("work", job.id, op.value)
                  }}</span>
                  <button
                    type="button"
                    class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
                    title="Edit suggestion"
                    @click="startEdit('work-line:' + job.id + ':' + op.value)"
                  >
                    <UIcon name="i-lucide-pencil" />
                  </button>
                </span>
              </span>
            </template>
          </template>
        </div>
      </section>

      <!-- ── Skills ───────────────────────────────────────────────────── -->
      <section
        v-for="{ group, ops, inferred } in skillDiffs"
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
              title="Confirmed matches only — items marked 'guess' need an individual accept"
              @click="acceptAllSection('skills', group.id, ops, inferred)"
            >
              Accept all confirmed
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <div
            v-for="(op, i) in visibleOps(ops)"
            :key="i"
            class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
            :class="{
              'bg-gray-50 dark:bg-gray-900 text-gray-500': op.type === 'unchanged',
              'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400':
                op.type === 'removed',
              'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400':
                op.type === 'added' && !isInferred(inferred, op.value),
              'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-dashed border-amber-300 dark:border-amber-700':
                op.type === 'added' && isInferred(inferred, op.value),
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

            <template v-if="op.type === 'added' && isEditing('skill:' + group.id + ':' + op.value)">
              <UInput
                :model-value="editedLine('skills', group.id, op.value)"
                size="xs"
                autofocus
                @update:model-value="
                  setLineEdit('skills', group.id, op.value, String($event))
                "
                @blur="stopEdit('skill:' + group.id + ':' + op.value)"
                @keyup.enter="stopEdit('skill:' + group.id + ':' + op.value)"
              />
            </template>
            <template v-else>
              <span :class="{ 'line-through': op.type === 'removed' }">{{
                op.type === "added" ? editedLine("skills", group.id, op.value) : op.value
              }}</span>
              <UIcon
                v-if="op.type === 'added' && isInferred(inferred, op.value)"
                name="i-lucide-circle-help"
                class="shrink-0"
                title="Guess — Claude inferred this from a related skill, not a confirmed match. Confirm or correct it before accepting."
              />
              <button
                v-if="op.type === 'added'"
                type="button"
                class="text-current opacity-50 hover:opacity-100 shrink-0"
                title="Edit suggestion"
                @click="startEdit('skill:' + group.id + ':' + op.value)"
              >
                <UIcon name="i-lucide-pencil" />
              </button>
            </template>
          </div>
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
