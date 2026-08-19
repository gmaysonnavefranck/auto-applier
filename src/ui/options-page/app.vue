<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()
const showNav = computed(() => route.path !== "/options-page/resume-preview")
</script>

<template>
  <UApp>
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header
        v-if="showNav"
        class="flex items-center gap-6 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
      >
        <RouterLink
          to="/options-page"
          class="flex items-center gap-2"
        >
          <div
            class="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-[10px] select-none"
          >
            AA
          </div>
          <span class="font-semibold text-sm text-gray-900 dark:text-white">
            Auto Applier
          </span>
        </RouterLink>

        <nav class="flex gap-1">
          <RouterLink
            to="/options-page"
            class="px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white"
            active-class="!text-gray-900 dark:!text-white bg-gray-100 dark:bg-gray-800"
          >
            Get Started
          </RouterLink>
          <RouterLink
            to="/options-page/resume"
            class="px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white"
            active-class="!text-gray-900 dark:!text-white bg-gray-100 dark:bg-gray-800"
          >
            Resume & Settings
          </RouterLink>
        </nav>
      </header>

      <RouterView />
    </div>
  </UApp>
</template>
