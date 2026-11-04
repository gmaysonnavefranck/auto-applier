<script setup lang="ts">
import { computed } from "vue"
import { useUsageStore } from "src/stores/usage.store"
import { summarizeUsage } from "src/utils/usage"

const usageStore = useUsageStore()

const monthStart = computed(() => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
})
const month = computed(() => summarizeUsage(usageStore.entries, monthStart.value))
const allTime = computed(() => summarizeUsage(usageStore.entries))
const recent = computed(() => [...usageStore.entries].reverse().slice(0, 50))

const FEATURE_LABEL = {
  tailor: "Resume tailoring",
  discover: "Find a job",
  learning: "Learning plan",
}
const PROVIDER_LABEL = { anthropic: "Anthropic (Claude)", brave: "Brave Search" }

function usd(value: number): string {
  return value < 0.01 && value > 0 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`
}

function clearHistory() {
  if (confirm("Delete all recorded usage? This only clears the history here, not your bills.")) {
    usageStore.clear()
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-10 space-y-8">
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
        Usage
      </h1>
      <p class="text-sm text-gray-500">
        What this extension has spent on your API keys. Estimated from list
        prices: Claude from the token counts each response reports, Brave
        per successful query. Your provider dashboards are the source of
        truth for billing.
      </p>
    </div>

    <section class="grid grid-cols-2 gap-3">
      <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
        <p class="text-xs text-gray-400">This month</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {{ usd(month.totalUsd) }}
        </p>
        <p class="text-xs text-gray-400">
          {{ month.claudeCalls }} Claude call{{ month.claudeCalls === 1 ? "" : "s" }} ·
          {{ month.braveQueries }} search{{ month.braveQueries === 1 ? "" : "es" }}
        </p>
      </div>
      <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
        <p class="text-xs text-gray-400">All time</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {{ usd(allTime.totalUsd) }}
        </p>
        <p class="text-xs text-gray-400">
          {{ allTime.claudeCalls }} Claude call{{ allTime.claudeCalls === 1 ? "" : "s" }} ·
          {{ allTime.braveQueries }} search{{ allTime.braveQueries === 1 ? "" : "es" }}
        </p>
      </div>
    </section>

    <section class="grid grid-cols-2 gap-6 text-sm">
      <div class="space-y-1.5">
        <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
          This month by provider
        </h2>
        <div
          v-for="(label, key) in PROVIDER_LABEL"
          :key="key"
          class="flex justify-between text-gray-600 dark:text-gray-400"
        >
          <span>{{ label }}</span>
          <span class="font-medium">{{ usd(month.byProvider[key]) }}</span>
        </div>
      </div>
      <div class="space-y-1.5">
        <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
          This month by feature
        </h2>
        <div
          v-for="(label, key) in FEATURE_LABEL"
          :key="key"
          class="flex justify-between text-gray-600 dark:text-gray-400"
        >
          <span>{{ label }}</span>
          <span class="font-medium">{{ usd(month.byFeature[key]) }}</span>
        </div>
      </div>
    </section>

    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
          Recent calls
        </h2>
        <button
          v-if="usageStore.entries.length"
          type="button"
          class="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          @click="clearHistory"
        >
          Clear history
        </button>
      </div>
      <p
        v-if="!recent.length"
        class="text-sm text-gray-500"
      >
        Nothing recorded yet. Usage shows up here after you optimize a
        resume or run "Find a job".
      </p>
      <table
        v-else
        class="w-full text-xs"
      >
        <thead class="text-left text-gray-400">
          <tr>
            <th class="font-medium py-1">When</th>
            <th class="font-medium py-1">Feature</th>
            <th class="font-medium py-1">Provider</th>
            <th class="font-medium py-1 text-right">Tokens in / out</th>
            <th class="font-medium py-1 text-right">Cost</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800 text-gray-600 dark:text-gray-400">
          <tr
            v-for="(e, i) in recent"
            :key="i"
          >
            <td class="py-1.5">{{ new Date(e.at).toLocaleString() }}</td>
            <td class="py-1.5">{{ FEATURE_LABEL[e.feature] }}</td>
            <td class="py-1.5">{{ PROVIDER_LABEL[e.provider] }}</td>
            <td class="py-1.5 text-right">
              {{ e.provider === "anthropic" ? `${e.inputTokens} / ${e.outputTokens}` : "—" }}
            </td>
            <td class="py-1.5 text-right font-medium">{{ usd(e.costUsd) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
