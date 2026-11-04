import type { UsageEntry, UsageFeature, UsageProvider } from "src/types/search"

// Neither API returns a dollar amount (Anthropic returns token counts, Brave
// only quota headers), so cost is computed from these list prices.
// ponytail: hardcoded prices, update by hand when Anthropic/Brave change them.
export const CLAUDE_PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
}
export const BRAVE_COST_PER_QUERY = 0.005

export const USAGE_KEY = "aa-usage"

export function claudeCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = CLAUDE_PRICES_PER_MTOK[model]
  if (!price) {
    console.warn(`No price configured for ${model}, recording usage as $0`)
    return 0
  }
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

// Background-only: writes straight to chrome.storage. Chained so two API
// calls finishing at the same time can't both read the old list and drop
// one entry.
let queue: Promise<void> = Promise.resolve()

export function recordUsage(entry: Omit<UsageEntry, "at">): Promise<void> {
  queue = queue
    .then(async () => {
      const result = await chrome.storage.local.get(USAGE_KEY)
      const list = (result[USAGE_KEY] as UsageEntry[] | undefined) ?? []
      await chrome.storage.local.set({
        [USAGE_KEY]: [...list, { ...entry, at: new Date().toISOString() }],
      })
    })
    .catch((err) => console.error("Failed to record usage", err))
  return queue
}

export interface UsageSummary {
  totalUsd: number
  byProvider: Record<UsageProvider, number>
  byFeature: Record<UsageFeature, number>
  braveQueries: number
  claudeCalls: number
}

export function summarizeUsage(entries: UsageEntry[], since?: Date): UsageSummary {
  const summary: UsageSummary = {
    totalUsd: 0,
    byProvider: { anthropic: 0, brave: 0 },
    byFeature: { tailor: 0, discover: 0, learning: 0 },
    braveQueries: 0,
    claudeCalls: 0,
  }
  for (const e of entries) {
    if (since && new Date(e.at) < since) continue
    summary.totalUsd += e.costUsd
    summary.byProvider[e.provider] += e.costUsd
    summary.byFeature[e.feature] += e.costUsd
    if (e.provider === "brave") summary.braveQueries++
    else summary.claudeCalls++
  }
  return summary
}
