import { describe, expect, it } from "vitest"
import demo from "src/test/demo-backup.json"
import type { Application } from "src/types/jobs"
import type { Resume } from "src/types/resume"
import {
  followUpDays,
  funnel,
  ghosted,
  rejectionStages,
  responseTime,
  missingSkills,
  responseByMatchScore,
  responseByRoleType,
  responseBySeniority,
  responseBySkill,
  responseBySource,
  skillImpact,
  strengths,
} from "src/utils/analytics"

// End-to-end sanity over the generated demo data (npm run demo-data): every
// analytics section has something to show, and the patterns baked into the
// generator come out the other end. Regenerating the data may shift exact
// counts, so these check shape and direction, not numbers.
const apps = demo.data["aa-applications"] as Application[]
const resume = demo.data["aa-resume"] as Resume
const now = new Date(demo.exportedAt).getTime()
const rateOf = (rows: { label: string; applied: number; responded: number }[], label: string) => {
  const row = rows.find((r) => r.label === label)!
  return row.responded / row.applied
}

describe("analytics over demo data", () => {
  it("ranks skill gaps, closes Docker, finds bundles", () => {
    const missing = missingSkills(apps, resume)
    expect(missing.skills[0].label).toBe("React")
    expect(missing.skills.some((s) => s.required > 0)).toBe(true)
    expect(missing.closed).toEqual(["Docker"])
    expect(missing.bundles.length).toBeGreaterThan(0)
    // React Native postings must not count toward React.
    const rnOnly = apps.filter((a) => a.jobTitle === "React Native Developer")
    expect(missingSkills(rnOnly, resume).skills.find((s) => s.label === "React")).toBeUndefined()
  })

  it("funnel only narrows", () => {
    const counts = funnel(apps).map((r) => r.count)
    expect(counts[0]).toBeGreaterThan(0)
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1])
  })

  it("fills every breakdown", () => {
    expect(strengths(apps, resume).rows[0].label).toBe("TypeScript")
    for (const rows of [
      responseByMatchScore(apps, resume),
      responseByRoleType(apps),
      responseBySkill(apps, resume),
      responseBySeniority(apps),
      responseBySource(apps),
    ])
      expect(rows.length).toBeGreaterThan(1)
    expect(ghosted(apps, now).length).toBeGreaterThan(0)
  })

  it("has response timing and rejection stages from history", () => {
    expect(responseTime(apps).median).toBeGreaterThan(0)
    const rejections = rejectionStages(apps)
    expect(rejections.rows.length).toBeGreaterThan(1)
    expect(rejections.unknown).toBeGreaterThan(0) // legacy jobs
    expect(followUpDays(apps)).toBe(responseTime(apps).median! * 2)
  })

  it("shows the baked-in patterns", () => {
    const tech = responseBySkill(apps, resume, 50)
    expect(rateOf(tech, "Vue")).toBeGreaterThan(rateOf(tech, "React"))
    const [docker] = skillImpact(apps, demo.data["aa-skill-added"])
    expect(docker.before.applied).toBeGreaterThan(0)
    expect(docker.after.applied).toBeGreaterThan(0)
  })
})
