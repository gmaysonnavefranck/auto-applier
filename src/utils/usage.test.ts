import { describe, expect, it } from "vitest"
import { claudeCost, recordUsage, summarizeUsage, USAGE_KEY } from "src/utils/usage"
import { storage } from "src/test/setup"
import type { UsageEntry } from "src/types/search"

describe("claudeCost", () => {
  it("prices Haiku 4.5 per million tokens", () => {
    // 3k in * $1/M + 500 out * $5/M
    expect(claudeCost("claude-haiku-4-5-20251001", 3000, 500)).toBeCloseTo(0.0055)
  })

  it("is 0 for an unknown model", () => {
    expect(claudeCost("some-future-model", 1000, 1000)).toBe(0)
  })
})

describe("recordUsage", () => {
  it("keeps every entry when calls finish at the same time", async () => {
    await Promise.all([
      recordUsage({ provider: "brave", feature: "discover", costUsd: 0.005 }),
      recordUsage({ provider: "anthropic", feature: "discover", costUsd: 0.01 }),
      recordUsage({ provider: "anthropic", feature: "tailor", costUsd: 0.02 }),
    ])
    const list = storage.data[USAGE_KEY] as UsageEntry[]
    expect(list.map((e) => e.costUsd)).toEqual([0.005, 0.01, 0.02])
    expect(list.every((e) => typeof e.at === "string")).toBe(true)
  })
})

describe("summarizeUsage", () => {
  const entries: UsageEntry[] = [
    { at: "2026-10-31T12:00:00Z", provider: "anthropic", feature: "tailor", costUsd: 1 },
    { at: "2026-11-02T12:00:00Z", provider: "brave", feature: "discover", costUsd: 0.005 },
    { at: "2026-11-02T12:00:01Z", provider: "anthropic", feature: "discover", costUsd: 0.01 },
  ]

  it("totals by provider and feature", () => {
    const s = summarizeUsage(entries)
    expect(s.totalUsd).toBeCloseTo(1.015)
    expect(s.byFeature.tailor).toBe(1)
    expect(s.braveQueries).toBe(1)
    expect(s.claudeCalls).toBe(2)
  })

  it("only counts entries since the given date", () => {
    const s = summarizeUsage(entries, new Date("2026-11-01T00:00:00Z"))
    expect(s.totalUsd).toBeCloseTo(0.015)
    expect(s.byProvider.anthropic).toBe(0.01)
  })
})
