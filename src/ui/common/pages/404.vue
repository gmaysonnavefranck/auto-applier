<script setup lang="ts">
import RouterLinkUp from "src/components/RouterLinkUp.vue"
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-4 px-6 py-16 text-center bg-gray-50 dark:bg-gray-950">
    <p class="text-5xl font-extrabold text-primary-600 dark:text-primary-500 tracking-tight">
      404
    </p>
    <div class="space-y-1">
      <p class="text-sm font-medium text-gray-900 dark:text-white">Page not found</p>
      <p class="text-xs text-gray-500">
        Sorry, the page you are looking for does not exist.
      </p>
    </div>
    <RouterLinkUp label="Go back" />
  </div>
</template>
