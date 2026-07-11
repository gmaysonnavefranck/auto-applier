<script setup lang="ts">
import { ref } from 'vue'
import { toRaw } from 'vue'
import { useResumeStore } from 'src/stores/resume.store'
import { autofillFrame } from 'src/content-script/autofill'

const resumeStore = useResumeStore()

const autofilling = ref(false)
const autofillMsg = ref('')

function openResumePage() {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/options-page/index.html') + '#/options-page/resume' })
}

function openResumePreview() {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/options-page/index.html') + '#/options-page/resume-preview' })
}

function openOptions() {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/options-page/index.html') })
}

async function autofillPage() {
  autofilling.value = true
  autofillMsg.value = ''

  let tabId: number | undefined
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId = tab?.id
  } catch { /* tabs API unavailable */ }

  if (!tabId) {
    autofilling.value = false
    return
  }

  const r = toRaw(resumeStore.resume)
  const data: Record<string, string> = {
    name:     r.basics.name,
    email:    r.basics.email,
    phone:    r.basics.phone    ?? '',
    linkedin: r.basics.linkedin ?? '',
    github:   r.basics.github   ?? '',
    website:  r.basics.website  ?? '',
    location: r.basics.location ?? '',
    title:    r.basics.title    ?? '',
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: autofillFrame,
      args: [data],
    })
    const filled = results.reduce((sum, r) => sum + (Number(r.result) || 0), 0)
    autofillMsg.value = filled > 0
      ? `Filled ${filled} field${filled === 1 ? '' : 's'}`
      : 'No matching fields found on this page.'
  } catch {
    autofillMsg.value = 'Could not reach page — reload the tab and try again.'
  } finally {
    autofilling.value = false
    setTimeout(() => { autofillMsg.value = '' }, 4000)
  }
}
</script>

<template>
  <UApp>
    <div class="flex flex-col h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">

      <header class="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <RouterLink to="/side-panel" class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs select-none">
            AA
          </div>
          <span class="font-semibold text-sm">Auto Applier</span>
        </RouterLink>

        <div class="flex gap-0.5">
          <UTooltip text="Configure resume">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-file-text" @click="openResumePage" />
          </UTooltip>
          <UTooltip text="Preview resume">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-eye" @click="openResumePreview" />
          </UTooltip>
          <UTooltip text="Options">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-settings" @click="openOptions" />
          </UTooltip>
          <UTooltip text="Autofill page">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-wand-2" :loading="autofilling" @click="autofillPage" />
          </UTooltip>
          <UTooltip text="Registered sites">
            <UButton to="/side-panel/sites" size="xs" variant="ghost" color="neutral" icon="i-lucide-globe" />
          </UTooltip>
        </div>
      </header>

      <div v-if="autofillMsg" class="px-3 py-1.5 bg-primary-50 dark:bg-primary-950 border-b border-primary-200 dark:border-primary-800 text-xs text-primary-700 dark:text-primary-300 shrink-0">
        {{ autofillMsg }}
      </div>

      <main class="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <RouterView />
      </main>

    </div>
  </UApp>
</template>
