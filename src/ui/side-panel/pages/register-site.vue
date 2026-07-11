<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { FieldType, SiteConfig } from 'src/types/jobs'
import { FIELD_ORDER, FIELD_CONFIG } from 'src/types/jobs'
import { useSitesStore } from 'src/stores/sites.store'

const sitesStore = useSitesStore()
const router = useRouter()
const route = useRoute()

const editingSiteId = ref<string | null>(null)
const domain = ref('')
const siteName = ref('')
const mappings = ref<Partial<Record<FieldType, string>>>({})
const pickingField = ref<FieldType | null>(null)
const editingField = ref<FieldType | null>(null)
const editValue = ref('')
const saving = ref(false)
const pickError = ref('')
const previews = ref<Partial<Record<FieldType, { count: number; text: string }>>>({})
const previewErrors = ref<Partial<Record<FieldType, string>>>({})

onMounted(async () => {
  const siteId = route.query.siteId as string | undefined

  if (siteId) {
    // Edit mode — load existing site
    const existing = sitesStore.sites.find(s => s.id === siteId)
    if (existing) {
      editingSiteId.value = siteId
      domain.value = existing.domain
      siteName.value = existing.name
      mappings.value = Object.fromEntries(existing.mappings.map(m => [m.field, m.selector]))
      for (const field of Object.keys(mappings.value) as FieldType[]) testSelector(field)
    }
  } else {
    // New site — infer domain from active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.url) {
      try {
        const url = new URL(tab.url)
        domain.value = url.hostname
        siteName.value = url.hostname
          .replace(/^www\./, '')
          .split('.')[0]
          .replace(/^\w/, c => c.toUpperCase())
      } catch {
        domain.value = ''
      }
    }
  }

  // Listen for captured selectors from content script
  chrome.runtime.onMessage.addListener(onMessage)
})

onUnmounted(async () => {
  chrome.runtime.onMessage.removeListener(onMessage)
  await cancelPicker()
})

function onMessage(msg: { type: string; selector?: string; field?: FieldType }) {
  if (msg.type === 'FIELD_CAPTURED' && msg.field && msg.selector) {
    mappings.value = { ...mappings.value, [msg.field]: msg.selector }
    pickingField.value = null
    testSelector(msg.field)
  }
  if (msg.type === 'PICKER_CANCELLED') {
    pickingField.value = null
  }
}

async function testSelector(field: FieldType) {
  const selector = mappings.value[field]
  if (!selector) return

  previewErrors.value = { ...previewErrors.value, [field]: undefined }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  chrome.tabs.sendMessage(
    tab.id,
    { type: 'TEST_SELECTOR', selector },
    (response: { ok: boolean; count: number; preview?: string } | undefined) => {
      if (chrome.runtime.lastError || !response?.ok) {
        previews.value = { ...previews.value, [field]: undefined }
        previewErrors.value = { ...previewErrors.value, [field]: 'Reload this tab first — content script not active yet.' }
        return
      }
      if (!response.count) {
        previews.value = { ...previews.value, [field]: undefined }
        previewErrors.value = { ...previewErrors.value, [field]: 'No matching element found on this page.' }
        return
      }
      previews.value = { ...previews.value, [field]: { count: response.count, text: response.preview ?? '' } }
    },
  )
}

async function startPicker(field: FieldType) {
  // Stop any running picker first
  await cancelPicker()

  pickError.value = ''
  pickingField.value = field

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  chrome.tabs.sendMessage(tab.id, { type: 'START_PICKER', field }, () => {
    if (chrome.runtime.lastError) {
      pickingField.value = null
      pickError.value = 'Reload this tab first — content script not active yet.'
    }
  })
}

async function cancelPicker() {
  if (!pickingField.value) return
  pickingField.value = null
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'STOP_PICKER' }, () => {})
}

function clearField(field: FieldType) {
  const updated = { ...mappings.value }
  delete updated[field]
  mappings.value = updated
  previews.value = { ...previews.value, [field]: undefined }
  previewErrors.value = { ...previewErrors.value, [field]: undefined }
}

function startEdit(field: FieldType) {
  editingField.value = field
  editValue.value = mappings.value[field] ?? ''
}

function confirmEdit(field: FieldType) {
  const val = editValue.value.trim()
  if (val) {
    mappings.value = { ...mappings.value, [field]: val }
    testSelector(field)
  }
  editingField.value = null
  editValue.value = ''
}

function cancelEdit() {
  editingField.value = null
  editValue.value = ''
}

const requiredFields: FieldType[] = ['jobTitle', 'company']
const canSave = computed(
  () => domain.value && requiredFields.every(f => mappings.value[f]),
)

async function save() {
  if (!canSave.value) return
  saving.value = true

  const mappingsList = (Object.entries(mappings.value) as [FieldType, string][]).map(([field, selector]) => ({ field, selector }))

  if (editingSiteId.value) {
    sitesStore.updateSite(editingSiteId.value, {
      name: siteName.value || domain.value,
      mappings: mappingsList,
    })
  } else {
    const config: SiteConfig = {
      id: crypto.randomUUID(),
      domain: domain.value,
      name: siteName.value || domain.value,
      mappings: mappingsList,
      createdAt: new Date().toISOString(),
    }
    sitesStore.addSite(config)
  }

  router.push('/side-panel/sites')
}
</script>

<template>
  <div class="p-3 flex flex-col gap-4">
    <!-- Title -->
    <div>
      <div class="flex items-center gap-2 mb-1">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          size="xs"
          @click="router.push('/side-panel/sites')"
        />
        <h2 class="font-semibold text-sm text-gray-900 dark:text-white">
          {{ editingSiteId ? 'Edit site' : 'Register new site' }}
        </h2>
      </div>
      <p class="text-xs text-gray-500 pl-7">
        Click "Pick" to select an element on the page, or use the pencil icon to type a CSS selector manually.
      </p>
      <p v-if="pickError" class="text-xs text-red-500 pl-7 mt-1">⚠ {{ pickError }}</p>
    </div>

    <!-- Site info -->
    <div class="flex flex-col gap-2">
      <div>
        <label class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Domain</label>
        <UInput
          v-model="domain"
          placeholder="e.g. jobs.example.com"
          size="sm"
          class="w-full"
          disabled
        />
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Display name</label>
        <UInput
          v-model="siteName"
          placeholder="e.g. Example Jobs"
          size="sm"
          class="w-full"
        />
      </div>
    </div>

    <USeparator />

    <!-- Field mapping list -->
    <div class="flex flex-col gap-2">
      <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        Field Mapping
      </p>

      <div
        v-for="field in FIELD_ORDER"
        :key="field"
        class="rounded-lg border bg-white dark:bg-gray-950 overflow-hidden"
        :class="
          pickingField === field
            ? 'border-primary-400 ring-2 ring-primary-200 dark:ring-primary-800'
            : mappings[field]
            ? 'border-green-300 dark:border-green-700'
            : 'border-gray-200 dark:border-gray-800'
        "
      >
        <!-- Field header -->
        <div class="flex items-center gap-2 px-2.5 py-2">
          <UIcon :name="FIELD_CONFIG[field].icon" class="text-gray-400 shrink-0 text-sm" />
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-gray-800 dark:text-gray-200">
              {{ FIELD_CONFIG[field].label }}
              <span v-if="FIELD_CONFIG[field].required" class="text-red-400 ml-0.5">*</span>
            </p>
            <p class="text-[10px] text-gray-400 leading-tight">{{ FIELD_CONFIG[field].hint }}</p>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-1 shrink-0">
            <UButton
              v-if="pickingField === field"
              size="xs"
              color="red"
              variant="soft"
              icon="i-lucide-x"
              @click="cancelPicker"
            >
              Cancel
            </UButton>
            <template v-else-if="editingField === field">
              <UButton size="xs" color="green" variant="soft" icon="i-lucide-check" @click="confirmEdit(field)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEdit" />
            </template>
            <template v-else>
              <UButton
                v-if="mappings[field]"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-refresh-cw"
                title="Re-check what this selector extracts on the current page"
                @click="testSelector(field)"
              />
              <UButton
                size="xs"
                :variant="mappings[field] ? 'soft' : 'solid'"
                :color="mappings[field] ? 'neutral' : 'primary'"
                icon="i-lucide-crosshair"
                :disabled="pickingField !== null"
                @click="startPicker(field)"
              >
                {{ mappings[field] ? 'Re-pick' : 'Pick' }}
              </UButton>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-pencil"
                title="Type selector manually"
                @click="startEdit(field)"
              />
              <UButton
                v-if="mappings[field]"
                size="xs"
                variant="ghost"
                color="red"
                icon="i-lucide-trash-2"
                @click="clearField(field)"
              />
            </template>
          </div>
        </div>

        <!-- Manual selector edit -->
        <div v-if="editingField === field" class="px-2.5 pb-2 -mt-0.5">
          <UInput
            v-model="editValue"
            placeholder="e.g. h1, .job-title, [aria-label*='Title']"
            size="xs"
            class="font-mono text-[10px] w-full"
            autofocus
            @keydown.enter="confirmEdit(field)"
            @keydown.esc="cancelEdit"
          />
        </div>

        <!-- Captured selector preview -->
        <div
          v-else-if="mappings[field]"
          class="px-2.5 pb-2 -mt-0.5 flex flex-col gap-1"
        >
          <code class="text-[10px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 px-1.5 py-0.5 rounded font-mono break-all">
            {{ mappings[field] }}
          </code>

          <p v-if="previewErrors[field]" class="text-[10px] text-red-500">
            ⚠ {{ previewErrors[field] }}
          </p>
          <div
            v-else-if="previews[field]"
            class="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded px-1.5 py-1"
          >
            <span class="font-medium">
              {{ previews[field]!.count }} match{{ previews[field]!.count === 1 ? '' : 'es' }}:
            </span>
            <span class="italic">"{{ previews[field]!.text || '(empty text)' }}"</span>
          </div>
        </div>

        <!-- Picking hint -->
        <div
          v-if="pickingField === field"
          class="px-2.5 pb-2 -mt-0.5"
        >
          <p class="text-[10px] text-primary-600 dark:text-primary-400 font-medium animate-pulse">
            ↑ Click the element on the page now…
          </p>
        </div>
      </div>
    </div>

    <!-- Save -->
    <UButton
      block
      :disabled="!canSave"
      :loading="saving"
      icon="i-lucide-save"
      @click="save"
    >
      {{ editingSiteId ? 'Update site' : 'Save site configuration' }}
    </UButton>

    <p class="text-[10px] text-gray-400 text-center -mt-2">
      * Required fields. All others are optional.
    </p>
  </div>
</template>
