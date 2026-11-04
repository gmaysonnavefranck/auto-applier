<script setup lang="ts">
defineProps<{
  label: string
  value: string
  // 0-100
  pct: number
  barClass: string
  // Too few data points for the % to mean much — dims the bar and says so.
  lowData?: boolean
}>()
</script>

<template>
  <div
    class="min-w-0 flex-1"
    :class="{ 'opacity-60': lowData }"
  >
    <div class="flex items-baseline justify-between gap-2 mb-1">
      <span class="text-sm text-gray-900 dark:text-white truncate">
        {{ label }}
      </span>
      <span class="text-xs text-gray-400 shrink-0">
        <span
          v-if="lowData"
          class="mr-1.5 italic"
        >low data</span>{{ value }}
      </span>
    </div>
    <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-300"
        :class="barClass"
        :style="{ width: `${Math.max(4, Math.round(pct))}%` }"
      />
    </div>
  </div>
</template>
