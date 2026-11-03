import { describe, expect, it } from "vitest"
import { computeMatchScore } from "src/utils/matchScore"
import { EMPTY_RESUME, type Resume } from "src/types/resume"
import type { TailoredResume } from "src/types/jobs"

const resume: Resume = {
  ...EMPTY_RESUME,
  basics: { ...EMPTY_RESUME.basics, summary: "Old summary" },
  work: [
    { id: "w1", company: "Acme", position: "Dev", startDate: "2020", highlights: ["a"] },
  ],
  skills: [{ id: "s1", category: "Frontend", items: ["Vue"] }],
}

function tailored(overrides: Partial<TailoredResume> = {}): TailoredResume {
  return {
    summary: "New summary",
    work: [{ id: "w1", highlights: ["a", "b"] }],
    skills: [{ id: "s1", items: ["Vue", "Pinia"] }],
    missingKeywords: ["Rust"],
    generatedAt: "2026-01-01",
    ...overrides,
  }
}

describe("computeMatchScore", () => {
  // addressable: summary + highlight "b" + skill "Pinia" = 3; unaddressable: Rust = 1
  it("counts nothing accepted before review", () => {
    expect(computeMatchScore(tailored(), resume)).toEqual({
      current: 0,
      potential: 75,
      total: 4,
    })
  })

  it("rises as suggestions get accepted", () => {
    const score = computeMatchScore(
      tailored({
        review: {
          summaryAccepted: true,
          work: [{ id: "w1", acceptedAdds: ["b"], acceptedRemoves: [] }],
          skills: [{ id: "s1", acceptedAdds: ["Pinia"], acceptedRemoves: [] }],
        },
      }),
      resume,
    )
    expect(score.current).toBe(75)
    expect(score.potential).toBe(75)
  })

  it("is 100 when there is nothing to flag", () => {
    const score = computeMatchScore(
      tailored({
        summary: "Old summary",
        work: [{ id: "w1", highlights: ["a"] }],
        skills: [{ id: "s1", items: ["Vue"] }],
        missingKeywords: [],
      }),
      resume,
    )
    expect(score).toEqual({ current: 100, potential: 100, total: 0 })
  })
})
