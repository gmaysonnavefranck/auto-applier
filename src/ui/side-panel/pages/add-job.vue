<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApplicationsStore } from 'src/stores/applications.store'
import { STATUS_ORDER, STATUS_CONFIG } from 'src/types/jobs'
import type { ApplicationStatus } from 'src/types/jobs'

const router = useRouter()
const appsStore = useApplicationsStore()

const jobTitle    = ref('')
const company     = ref('')
const location    = ref('')
const salary      = ref('')
const url         = ref('')
const description = ref('')
const status      = ref<ApplicationStatus>('applied')
const error       = ref('')

const statusOptions = STATUS_ORDER.map(s => ({ label: STATUS_CONFIG[s].label, value: s }))

function submit() {
  error.value = ''
  if (!jobTitle.value.trim()) { error.value = 'Job title is required.'; return }
  if (!company.value.trim())  { error.value = 'Company is required.'; return }

  let domain = ''
  if (url.value) {
    try { domain = new URL(url.value).hostname } catch { /* invalid url */ }
  }

  const duplicate = appsStore.findDuplicate({
    url: url.value.trim(),
    company: company.value.trim(),
    jobTitle: jobTitle.value.trim(),
  })
  if (
    duplicate &&
    !confirm(
      `You already saved "${duplicate.jobTitle}" at ${duplicate.company} (${new Date(duplicate.dateAdded).toLocaleDateString()}). Save this as a duplicate anyway?`,
    )
  ) {
    return
  }

  appsStore.addApplication({
    id:           crypto.randomUUID(),
    siteConfigId: '',
    domain,
    jobBoard:     '',
    url:          url.value.trim(),
    jobTitle:     jobTitle.value.trim(),
    company:      company.value.trim(),
    location:     location.value.trim()    || undefined,
    salary:       salary.value.trim()      || undefined,
    description:  description.value.trim() || undefined,
    status:       status.value,
    dateAdded:    new Date().toISOString(),
  })

  router.back()
}
</script>

<template>
  <div class="flex flex-col min-h-full">

    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
      <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-left" @click="router.back()" />
      <span class="text-sm font-medium">Add job manually</span>
    </div>

    <!-- Form -->
    <div class="flex-1 overflow-y-auto px-3 py-4">
      <div class="flex flex-col gap-3">

        <UFormField label="Job title" required>
          <UInput
            v-model="jobTitle"
            placeholder="Software Engineer"
            class="w-full"
            autofocus
          />
        </UFormField>

        <UFormField label="Company" required>
          <UInput
            v-model="company"
            placeholder="Acme Corp"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Location">
            <UInput
              v-model="location"
              placeholder="Remote"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Salary">
            <UInput
              v-model="salary"
              placeholder="$120k"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Status">
          <USelect
            v-model="status"
            :items="statusOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Job URL">
          <UInput
            v-model="url"
            placeholder="https://..."
            type="url"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Job description">
          <UTextarea
            v-model="description"
            placeholder="Paste the job description here to enable AI tailoring later…"
            :rows="6"
            class="w-full"
          />
        </UFormField>

        <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

        <div class="flex gap-2 pt-1">
          <UButton variant="ghost" color="neutral" class="flex-1" @click="router.back()">Cancel</UButton>
          <UButton class="flex-1" @click="submit">Save job</UButton>
        </div>

      </div>
    </div>

  </div>
</template>
