<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import type { Application, ApplicationStatus, SiteConfig } from "src/types/jobs"
import { STATUS_CONFIG, STATUS_ORDER, getBoardName } from "src/types/jobs"
import { useSitesStore } from "src/stores/sites.store"
import { useApplicationsStore } from "src/stores/applications.store"
import { useResumeStore } from "src/stores/resume.store"
import { useAiStore } from "src/stores/ai.store"
import type { TailoredResume } from "src/types/jobs"
import { openExtensionPage } from "src/utils/navigation"

const sitesStore = useSitesStore()
const appsStore = useApplicationsStore()
const resumeStore = useResumeStore()
const aiStore = useAiStore()
const router = useRouter()

const currentTab = ref<chrome.tabs.Tab | null>(null)
const currentDomain = ref("")
const siteConfig = ref<SiteConfig | null>(null)
const saving = ref(false)
const saveError = ref("")
const filterStatus = ref<ApplicationStatus | "all">("all")
const expandedId = ref<string | null>(null)
const expandedDescFull = ref<string | null>(null)
const tailoring = ref<Record<string, boolean>>({})
const tailorError = ref<Record<string, string>>({})

function toggleExpand(id: string) {
  if (expandedId.value === id) {
    expandedId.value = null
    expandedDescFull.value = null
  } else {
    expandedId.value = id
    expandedDescFull.value = null
  }
}

onMounted(() => {
  refreshTab()
  chrome.tabs.onActivated.addListener(handleTabActivated)
  chrome.tabs.onUpdated.addListener(handleTabUpdated)
})

onUnmounted(() => {
  chrome.tabs.onActivated.removeListener(handleTabActivated)
  chrome.tabs.onUpdated.removeListener(handleTabUpdated)
})

function handleTabActivated() {
  refreshTab()
}

function handleTabUpdated(
  _tabId: number,
  changeInfo: Parameters<Parameters<typeof chrome.tabs.onUpdated.addListener>[0]>[1],
) {
  if (changeInfo.status === "complete" || changeInfo.url) refreshTab()
}

async function refreshTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    currentTab.value = tab ?? null
    if (tab?.url) {
      currentDomain.value = new URL(tab.url).hostname
      siteConfig.value =
        sitesStore.getSiteForDomain(currentDomain.value) ?? null
    } else {
      currentDomain.value = ""
      siteConfig.value = null
    }
  } catch {
    // tabs API unavailable in this context
  }
}

async function saveJob(useJsonLdOnly = false) {
  await refreshTab()
  if (!currentTab.value?.id) return
  saving.value = true
  saveError.value = ""

  const mappings = useJsonLdOnly ? [] : (siteConfig.value?.mappings ?? [])

  let response: { ok: boolean; data?: Record<string, string> } | undefined
  try {
    response = await chrome.tabs.sendMessage(currentTab.value.id, {
      type: "EXTRACT_JOB",
      mappings,
    })
  } catch {
    saving.value = false
    saveError.value = "Reload this tab first — content script not active yet."
    return
  }
  saving.value = false

  if (!response?.ok) {
    saveError.value = "Could not extract job data from this page."
    return
  }

  const data = response.data as {
    url: string
    jobTitle?: string
    company?: string
    location?: string
    salary?: string
    description?: string
    source?: string
  }
  if (!data.jobTitle) {
    saveError.value = useJsonLdOnly
      ? "No structured job data found. Try registering this site instead."
      : "Could not read the job title. Check your field selectors."
    return
  }

  const url = data.url || currentTab.value?.url || ""
  const jobTitle = data.jobTitle || "Unknown Role"
  const company = data.company || "Unknown Company"

  const duplicate = appsStore.findDuplicate({ url, company, jobTitle })
  if (
    duplicate &&
    !confirm(
      `You already saved "${duplicate.jobTitle}" at ${duplicate.company} (${new Date(duplicate.dateAdded).toLocaleDateString()}). Save this as a duplicate anyway?`,
    )
  ) {
    return
  }

  appsStore.addApplication({
    id: crypto.randomUUID(),
    siteConfigId: siteConfig.value?.id ?? "",
    domain: currentDomain.value,
    jobBoard: getBoardName(currentDomain.value),
    url,
    jobTitle,
    company,
    location: data.location || undefined,
    salary: data.salary || undefined,
    description: data.description || undefined,
    status: "saved",
    dateAdded: new Date().toISOString(),
  })
}

const filteredApps = computed(() => {
  if (filterStatus.value === "all") return appsStore.applications
  return appsStore.applications.filter((a) => a.status === filterStatus.value)
})

const statusCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const app of appsStore.applications)
    counts[app.status] = (counts[app.status] ?? 0) + 1
  return counts
})

function nextStatus(current: ApplicationStatus): ApplicationStatus {
  const idx = STATUS_ORDER.indexOf(current)
  return STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)]
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days}d ago`
}

function openTailoredPreview(appId: string) {
  openExtensionPage(
    "#/options-page/resume-preview?appId=" + encodeURIComponent(appId),
  )
}

function openOptions() {
  openExtensionPage()
}

async function tailorResume(app: Application) {
  tailoring.value[app.id] = true
  tailorError.value[app.id] = ""

  try {
    const resume = JSON.parse(JSON.stringify(toRaw(resumeStore.resume)))
    if (!resume.basics?.name && !resume.work?.length) {
      throw new Error("Resume is empty — please configure your resume first.")
    }

    const response: { ok: boolean; result?: TailoredResume; error?: string } =
      await chrome.runtime.sendMessage({
        type: "TAILOR_RESUME",
        apiKey: aiStore.claudeApiKey,
        resume,
        jobDescription: app.description!,
      })

    if (!response.ok) throw new Error(response.error ?? "Unknown error")
    appsStore.updateApplication(app.id, { tailoredResume: response.result! })
  } catch (err) {
    tailorError.value[app.id] =
      err instanceof Error ? err.message : "Unknown error"
  } finally {
    tailoring.value[app.id] = false
  }
}
</script>

<template>
  <div class="flex flex-col min-h-full">
    <!-- Error toast -->
    <div
      v-if="saveError"
      class="px-3 py-2 bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 flex items-center gap-2"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="text-red-500 shrink-0 text-sm"
      />
      <p class="text-xs text-red-700 dark:text-red-300 flex-1">
        {{ saveError }}
      </p>
      <UButton
        size="xs"
        variant="ghost"
        color="red"
        icon="i-lucide-x"
        @click="saveError = ''"
      />
    </div>

    <!-- Current page banner -->
    <div
      class="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
    >
      <div
        v-if="siteConfig"
        class="flex items-center justify-between gap-2"
      >
        <div class="min-w-0">
          <p class="text-xs font-medium text-gray-500 truncate">
            {{ currentDomain }}
          </p>
          <p class="text-xs text-green-600 dark:text-green-400 font-medium">
            ✓ Site registered
          </p>
        </div>
        <UButton
          size="xs"
          :loading="saving"
          icon="i-lucide-bookmark-plus"
          @click="saveJob()"
        >
          Save job
        </UButton>
      </div>

      <div
        v-else
        class="flex items-center justify-between gap-2"
      >
        <div class="min-w-0">
          <p class="text-xs font-medium text-gray-500 truncate">
            {{ currentDomain || "—" }}
          </p>
          <p class="text-xs text-gray-400">Site not registered</p>
        </div>
        <div class="flex gap-1 shrink-0">
          <UTooltip text="Try auto-detect (works on LinkedIn, Indeed, etc.)">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-zap"
              :loading="saving"
              @click="saveJob(true)"
            >
              Auto
            </UButton>
          </UTooltip>
          <UButton
            size="xs"
            variant="soft"
            icon="i-lucide-plus-circle"
            @click="router.push('/side-panel/register-site')"
          >
            Register
          </UButton>
        </div>
      </div>
    </div>

    <!-- Status filter chips -->
    <div
      class="flex items-center gap-1 px-3 py-2 overflow-x-auto bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0"
    >
      <UButton
        size="xs"
        :variant="filterStatus === 'all' ? 'solid' : 'ghost'"
        color="neutral"
        @click="filterStatus = 'all'"
      >
        All
        <UBadge
          v-if="appsStore.applications.length"
          size="xs"
          variant="subtle"
          color="neutral"
          class="ml-1"
        >
          {{ appsStore.applications.length }}
        </UBadge>
      </UButton>
      <UButton
        v-for="s in STATUS_ORDER"
        :key="s"
        size="xs"
        :variant="filterStatus === s ? 'solid' : 'ghost'"
        :color="filterStatus === s ? STATUS_CONFIG[s].color : 'neutral'"
        @click="filterStatus = s"
      >
        {{ STATUS_CONFIG[s].label }}
        <UBadge
          v-if="statusCounts[s]"
          size="xs"
          variant="subtle"
          :color="STATUS_CONFIG[s].color"
          class="ml-1"
        >
          {{ statusCounts[s] }}
        </UBadge>
      </UButton>
      <UTooltip
        text="Add job manually"
        class="ml-auto shrink-0"
      >
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-plus"
          @click="router.push('/side-panel/add-job')"
        />
      </UTooltip>
    </div>

    <!-- Empty state -->
    <div
      v-if="filteredApps.length === 0"
      class="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center"
    >
      <UIcon
        name="i-lucide-clipboard-list"
        class="text-4xl text-gray-300 mb-3"
      />
      <p class="text-sm text-gray-500">
        {{
          appsStore.applications.length === 0
            ? 'No jobs saved yet. Register a site and click "Save job" on a listing.'
            : "No jobs match this filter."
        }}
      </p>
      <UButton
        v-if="appsStore.applications.length === 0"
        size="xs"
        variant="soft"
        class="mt-3"
        icon="i-lucide-plus-circle"
        @click="router.push('/side-panel/register-site')"
      >
        Register your first site
      </UButton>
    </div>

    <!-- Applications list -->
    <div
      v-else
      class="divide-y divide-gray-100 dark:divide-gray-800"
    >
      <div
        v-for="app in filteredApps"
        :key="app.id"
        class="bg-white dark:bg-gray-950"
      >
        <!-- Card header (always visible) -->
        <div
          class="px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900 group cursor-pointer select-none"
          @click="toggleExpand(app.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <p
                class="text-sm font-medium text-gray-900 dark:text-white truncate"
              >
                {{ app.jobTitle }}
              </p>
              <p class="text-xs text-gray-500 truncate">
                {{ app.company }}{{ app.location ? ` · ${app.location}` : "" }}
              </p>
              <p
                v-if="app.jobBoard"
                class="text-[10px] text-gray-400 truncate"
              >
                {{ app.jobBoard }}
              </p>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <UBadge
                :color="STATUS_CONFIG[app.status].color"
                variant="subtle"
                size="xs"
                class="cursor-pointer select-none"
                @click.stop="
                  appsStore.setStatus(app.id, nextStatus(app.status))
                "
              >
                {{ STATUS_CONFIG[app.status].label }}
              </UBadge>
              <div class="flex items-center gap-1">
                <UIcon
                  v-if="app.tailoredResume"
                  name="i-lucide-sparkles"
                  class="text-primary-400 text-xs shrink-0"
                  title="Resume tailored for this job"
                />
                <span class="text-[10px] text-gray-400">
                  {{ daysAgo(app.dateAdded) }}
                </span>
                <UIcon
                  :name="
                    expandedId === app.id
                      ? 'i-lucide-chevron-up'
                      : 'i-lucide-chevron-down'
                  "
                  class="text-gray-400 text-xs"
                />
              </div>
            </div>
          </div>

          <div
            class="flex items-center gap-2 mt-1.5"
            @click.stop
          >
            <a
              :href="app.url"
              target="_blank"
              class="text-xs text-primary-500 hover:underline"
            >
              View listing ↗
            </a>
            <UButton
              size="xs"
              variant="ghost"
              color="red"
              class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
              @click="appsStore.removeApplication(app.id)"
            >
              Remove
            </UButton>
          </div>
        </div>

        <!-- Expanded detail panel -->
        <div
          v-if="expandedId === app.id"
          class="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col gap-3"
        >
          <!-- Stage selector -->
          <div>
            <p
              class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"
            >
              Stage
            </p>
            <USelect
              :model-value="app.status"
              :items="
                STATUS_ORDER.map((s) => ({
                  label: STATUS_CONFIG[s].label,
                  value: s,
                }))
              "
              size="md"
              class="w-full"
              @update:model-value="
                appsStore.setStatus(app.id, $event as ApplicationStatus)
              "
            />
          </div>

          <!-- Editable fields -->
          <div>
            <p
              class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"
            >
              Job Title
            </p>
            <UInput
              :model-value="app.jobTitle"
              size="md"
              class="w-full"
              @change="
                appsStore.updateApplication(app.id, {
                  jobTitle: ($event.target as HTMLInputElement).value,
                })
              "
            />
          </div>

          <div>
            <p
              class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"
            >
              Company
            </p>
            <UInput
              :model-value="app.company"
              size="md"
              class="w-full"
              @change="
                appsStore.updateApplication(app.id, {
                  company: ($event.target as HTMLInputElement).value,
                })
              "
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <p
                class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"
              >
                Location
              </p>
              <UInput
                :model-value="app.location ?? ''"
                size="md"
                placeholder="—"
                class="w-full"
                @change="
                  appsStore.updateApplication(app.id, {
                    location:
                      ($event.target as HTMLInputElement).value || undefined,
                  })
                "
              />
            </div>
            <div>
              <p
                class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"
              >
                Salary
              </p>
              <UInput
                :model-value="app.salary ?? ''"
                size="md"
                placeholder="—"
                class="w-full"
                @change="
                  appsStore.updateApplication(app.id, {
                    salary:
                      ($event.target as HTMLInputElement).value || undefined,
                  })
                "
              />
            </div>
          </div>

          <!-- Notes -->
          <div>
            <p
              class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"
            >
              Notes
            </p>
            <UTextarea
              :model-value="app.notes ?? ''"
              size="md"
              placeholder="Add notes…"
              :rows="3"
              class="w-full"
              @change="
                appsStore.updateApplication(app.id, {
                  notes:
                    ($event.target as HTMLTextAreaElement).value || undefined,
                })
              "
            />
          </div>

          <!-- Description (read-only) -->
          <div>
            <p
              class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"
            >
              Description
            </p>
            <template v-if="app.description">
              <p
                class="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed"
                :class="expandedDescFull !== app.id ? 'line-clamp-5' : ''"
              >
                {{ app.description }}
              </p>
              <button
                v-if="app.description.length > 250"
                class="text-[10px] text-primary-500 hover:underline mt-0.5"
                @click="
                  expandedDescFull = expandedDescFull === app.id ? null : app.id
                "
              >
                {{ expandedDescFull === app.id ? "Show less" : "Show more" }}
              </button>
            </template>
            <p
              v-else
              class="text-xs text-gray-400 italic"
            >
              No description saved — re-save the job to capture it.
            </p>
          </div>

          <!-- AI Optimization -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-3">
            <p
              class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              AI Optimization
            </p>

            <p
              v-if="!app.description"
              class="text-xs text-amber-600 dark:text-amber-400 italic"
            >
              Re-save this job with a description to enable AI optimization.
            </p>

            <div
              v-else-if="!aiStore.claudeApiKey"
              class="text-xs text-gray-400"
            >
              <button
                class="text-primary-500 hover:underline"
                @click="openOptions"
              >
                Add your Claude API key
              </button>
              in Options to enable resume optimization.
            </div>

            <template v-else>
              <div
                v-if="app.tailoredResume"
                class="flex items-center gap-1.5 mb-2"
              >
                <UIcon
                  name="i-lucide-sparkles"
                  class="text-primary-500 text-xs shrink-0"
                />
                <span class="text-xs text-gray-500">
                  Tailored {{ daysAgo(app.tailoredResume.generatedAt) }}
                </span>
                <button
                  class="text-xs text-primary-500 hover:underline ml-auto"
                  @click="openTailoredPreview(app.id)"
                >
                  View ↗
                </button>
              </div>
              <UButton
                size="xs"
                :variant="app.tailoredResume ? 'ghost' : 'soft'"
                color="primary"
                icon="i-lucide-sparkles"
                :loading="tailoring[app.id]"
                block
                @click="tailorResume(app)"
              >
                {{
                  app.tailoredResume ? "Re-optimize" : "Optimize for this job"
                }}
              </UButton>
              <p
                v-if="tailorError[app.id]"
                class="text-xs text-red-500 mt-1.5"
              >
                {{ tailorError[app.id] }}
              </p>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
