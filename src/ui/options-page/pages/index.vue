<script setup lang="ts">
import { computed } from "vue"
import { useResumeStore } from "src/stores/resume.store"
import { useAiStore } from "src/stores/ai.store"
import { useSitesStore } from "src/stores/sites.store"
import { useApplicationsStore } from "src/stores/applications.store"

const resumeStore = useResumeStore()
const aiStore = useAiStore()
const sitesStore = useSitesStore()
const appsStore = useApplicationsStore()

const hasApiKey = computed(() => aiStore.claudeApiKey.trim().length > 0)
const hasResume = computed(
  () =>
    resumeStore.resume.basics.name.trim().length > 0 &&
    resumeStore.resume.work.length > 0,
)
const isTracking = computed(
  () => sitesStore.sites.length > 0 || appsStore.applications.length > 0,
)

const steps = computed(() => [
  {
    label: "Add your Claude API key",
    body: "Auto Applier calls Claude directly from your browser to tailor your resume for each job. The key is stored locally on this device only.",
    done: hasApiKey.value,
    cta: "Add API key",
    to: "/options-page/resume",
  },
  {
    label: "Build your base resume",
    body: "Add your work history, education, and skills once. Claude rewrites the summary and bullet points per job — the source data stays the same.",
    done: hasResume.value,
    cta: "Edit resume",
    to: "/options-page/resume",
  },
  {
    label: "Start tracking jobs",
    body: "Open the side panel on a job posting and register the site so Auto Applier can read future listings, or add jobs by hand from the side panel.",
    done: isTracking.value,
    cta: null,
    to: null,
  },
])
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-10 space-y-8">
    <div class="flex items-center gap-3">
      <div
        class="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm select-none shrink-0 shadow-elevated"
      >
        AA
      </div>
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          Auto Applier
        </h1>
        <p class="text-sm text-gray-500">
          Tracks your job applications and uses Claude to tailor your resume
          for each one — all stored locally in this browser.
        </p>
      </div>
    </div>

    <div class="space-y-2.5">
      <div
        v-for="(step, i) in steps"
        :key="step.label"
        class="flex items-start gap-3 rounded-xl border px-4 py-3.5 bg-white dark:bg-gray-950 transition-colors"
        :class="
          step.done
            ? 'border-gray-200 dark:border-gray-800'
            : 'border-primary-200 dark:border-primary-900'
        "
      >
        <div
          class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
          :class="
            step.done
              ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
              : 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
          "
        >
          <UIcon
            v-if="step.done"
            name="i-lucide-check"
            class="w-3.5 h-3.5"
          />
          <template v-else>{{ i + 1 }}</template>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white">
            {{ step.label }}
          </p>
          <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">
            {{ step.body }}
          </p>
        </div>
        <UButton
          v-if="step.cta && step.to"
          size="xs"
          :variant="step.done ? 'soft' : 'solid'"
          :color="step.done ? 'neutral' : 'primary'"
          class="shrink-0"
          @click="$router.push(step.to)"
        >
          {{ step.cta }}
        </UButton>
      </div>
    </div>

    <p class="text-xs text-gray-400">
      Come back to this page anytime from the nav above.
    </p>
  </div>
</template>
