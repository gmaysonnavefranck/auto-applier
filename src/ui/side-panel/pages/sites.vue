<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { SiteConfig } from 'src/types/jobs'
import { FIELD_CONFIG } from 'src/types/jobs'
import { useSitesStore } from 'src/stores/sites.store'

const sitesStore = useSitesStore()
const router = useRouter()

function confirmDelete(site: SiteConfig) {
  if (confirm(`Remove "${site.name}"? Saved applications from this site will remain.`)) {
    sitesStore.removeSite(site.id)
  }
}
</script>

<template>
  <div class="p-3 flex flex-col gap-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          size="xs"
          @click="router.push('/side-panel')"
        />
        <h2 class="font-semibold text-sm text-gray-900 dark:text-white">Registered Sites</h2>
      </div>
      <UButton
        size="xs"
        icon="i-lucide-plus"
        @click="router.push('/side-panel/register-site')"
      >
        Add site
      </UButton>
    </div>

    <!-- Empty state -->
    <div
      v-if="sitesStore.sites.length === 0"
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <UIcon name="i-lucide-globe" class="text-4xl text-gray-300 mb-3" />
      <p class="text-sm text-gray-500">No sites registered yet.</p>
      <p class="text-xs text-gray-400 mt-1">Visit a job board and click "Add site" to get started.</p>
    </div>

    <!-- Site cards -->
    <div
      v-for="site in sitesStore.sites"
      :key="site.id"
      class="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden"
    >
      <!-- Site header -->
      <div class="flex items-center justify-between gap-2 px-3 py-2.5">
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ site.name }}</p>
          <p class="text-xs text-gray-500">{{ site.domain }}</p>
        </div>
        <div class="flex items-center gap-1">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-pencil"
            @click="router.push(`/side-panel/register-site?siteId=${site.id}`)"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="red"
            icon="i-lucide-trash-2"
            @click="confirmDelete(site)"
          />
        </div>
      </div>

      <!-- Mapped fields -->
      <div class="border-t border-gray-100 dark:border-gray-800 px-3 py-2 flex flex-wrap gap-1.5">
        <div
          v-for="mapping in site.mappings"
          :key="mapping.field"
          class="flex items-center gap-1 text-[10px] bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5"
        >
          <UIcon :name="FIELD_CONFIG[mapping.field].icon" class="text-gray-400 text-[11px]" />
          <span class="text-gray-600 dark:text-gray-400 font-medium">
            {{ FIELD_CONFIG[mapping.field].label }}
          </span>
        </div>
        <span
          v-if="site.mappings.length === 0"
          class="text-xs text-gray-400 italic"
        >
          No fields mapped
        </span>
      </div>
    </div>
  </div>
</template>
