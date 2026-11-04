<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()
const showNav = computed(() => route.path !== "/options-page/resume-preview")
</script>

<template>
  <UApp>
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header
        v-if="showNav"
        class="flex items-center gap-6 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
      >
        <RouterLink
          to="/options-page"
          class="flex items-center gap-2 rounded-md transition-opacity hover:opacity-80"
        >
          <div
            class="w-6 h-6 rounded-md bg-primary-600 flex items-center justify-center text-white font-bold text-[10px] select-none shadow-elevated"
          >
            AA
          </div>
          <span class="font-semibold text-sm text-gray-900 dark:text-white tracking-tight">
            Auto Applier
          </span>
        </RouterLink>

        <nav class="flex gap-1">
          <RouterLink
            to="/options-page"
            class="px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            active-class="!text-primary-700 dark:!text-primary-400 bg-primary-50 dark:bg-primary-950/60 hover:!bg-primary-50 dark:hover:!bg-primary-950/60"
          >
            Get Started
          </RouterLink>
          <RouterLink
            to="/options-page/resume"
            class="px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            active-class="!text-primary-700 dark:!text-primary-400 bg-primary-50 dark:bg-primary-950/60 hover:!bg-primary-50 dark:hover:!bg-primary-950/60"
          >
            Resume & Settings
          </RouterLink>
          <RouterLink
            to="/options-page/analytics"
            class="px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            active-class="!text-primary-700 dark:!text-primary-400 bg-primary-50 dark:bg-primary-950/60 hover:!bg-primary-50 dark:hover:!bg-primary-950/60"
          >
            Analytics
          </RouterLink>
          <RouterLink
            to="/options-page/usage"
            class="px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            active-class="!text-primary-700 dark:!text-primary-400 bg-primary-50 dark:bg-primary-950/60 hover:!bg-primary-50 dark:hover:!bg-primary-950/60"
          >
            Usage
          </RouterLink>
        </nav>
      </header>

      <RouterView />
    </div>
  </UApp>
</template>
