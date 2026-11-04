import { describe, expect, it } from "vitest"
import {
  followUpDays,
  funnel,
  rejectionStages,
  responseTime,
  furthestStage,
  ghosted,
  missingSkills,
  responseBySkill,
  roleTypeOf,
  seniorityOf,
  skillImpact,
  skillKey,
  strengths,
} from "src/utils/analytics"
import { EMPTY_RESUME, type Resume } from "src/types/resume"
import type { Application, TailoredResume } from "src/types/jobs"

let n = 0
function app(overrides: Partial<Application> = {}): Application {
  return {
    id: `app-${n++}`,
    siteConfigId: "",
    domain: "example.com",
    url: "",
    jobTitle: "Dev",
    company: "Acme",
    status: "saved",
    dateAdded: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function tailored(missingKeywords: string[]): TailoredResume {
  return { summary: "", work: [], missingKeywords, generatedAt: "2026-01-01" }
}

describe("skillKey", () => {
  it("merges spelling variants", () => {
    expect(skillKey("React.js")).toBe(skillKey("ReactJS"))
    expect(skillKey("React.js")).toBe(skillKey("react"))
    expect(skillKey("CI/CD")).toBe(skillKey("CICD"))
    expect(skillKey("C++")).not.toBe(skillKey("C#"))
    expect(skillKey("JS")).toBe("js")
  })
})

describe("furthestStage / funnel", () => {
  it("uses history so a post-interview rejection still counts as interview", () => {
    const a = app({
      status: "rejected",
      dateApplied: "2026-01-02",
      statusHistory: [
        { status: "applied", at: "2026-01-02" },
        { status: "interview", at: "2026-01-05" },
        { status: "rejected", at: "2026-01-09" },
      ],
    })
    expect(furthestStage(a)).toBe(3)
    expect(furthestStage(app())).toBe(0)
    expect(funnel([a, app(), app({ status: "applied", dateApplied: "x" })])).toEqual([
      { stage: "applied", count: 2 },
      { stage: "screening", count: 1 },
      { stage: "interview", count: 1 },
      { stage: "offer", count: 0 },
    ])
  })
})

describe("responseTime / followUpDays", () => {
  it("takes the median days from applied to first reply", () => {
    const replied = (days: number) =>
      app({
        status: "screening",
        dateApplied: "2026-01-01T00:00:00.000Z",
        statusHistory: [
          { status: "applied", at: "2026-01-01T00:00:00.000Z" },
          { status: "screening", at: new Date(Date.UTC(2026, 0, 1 + days)).toISOString() },
        ],
      })
    const apps = [2, 4, 6].map(replied)
    expect(responseTime(apps)).toEqual({ median: 4, count: 3 })
    expect(followUpDays(apps)).toBe(14) // too few to trust
    expect(followUpDays(Array.from({ length: 10 }, () => replied(5)))).toBe(10)
  })
})

describe("rejectionStages", () => {
  it("reads the stage before the rejection from history", () => {
    const rejectedAfter = (prev: Application["status"][]) =>
      app({
        status: "rejected",
        dateApplied: "x",
        statusHistory: [...prev, "rejected" as const].map((status) => ({ status, at: "x" })),
      })
    const result = rejectionStages([
      rejectedAfter(["applied"]),
      rejectedAfter(["applied", "screening", "interview"]),
      rejectedAfter(["applied"]),
      app({ status: "rejected", dateApplied: "x" }), // legacy, no history
    ])
    expect(result).toEqual({
      rows: [
        { label: "After applying", count: 2 },
        { label: "After interview", count: 1 },
      ],
      unknown: 1,
      total: 3,
    })
  })
})

describe("ghosted", () => {
  it("lists applied jobs idle past the threshold", () => {
    const now = new Date("2026-02-01").getTime()
    const old = app({ status: "applied", dateApplied: "2026-01-01" })
    const fresh = app({ status: "applied", dateApplied: "2026-01-30" })
    expect(ghosted([old, fresh], now).map((g) => g.app.id)).toEqual([old.id])
  })
})

describe("missingSkills", () => {
  const resume: Resume = {
    ...EMPTY_RESUME,
    skills: [{ id: "s1", category: "Ops", items: ["Docker"] }],
  }

  it("counts untailored descriptions, merges variants, closes gaps the resume now has", () => {
    const apps = [
      app({ tailoredResume: tailored(["React.js", "Docker"]), status: "rejected" }),
      app({ tailoredResume: tailored(["ReactJS"]) }),
      app({ description: "We use React.js and Go daily." }),
      app({ description: "Reactive systems, nothing else." }),
    ]
    const result = missingSkills(apps, resume)
    expect(result.total).toBe(4)
    expect(result.closed).toEqual(["Docker"])
    expect(result.skills).toEqual([
      { key: "react", label: "React.js", postings: 3, required: 0, rejected: 1 },
    ])
  })

  it("doesn't count a longer tracked skill as the shorter one", () => {
    const apps = [
      app({ tailoredResume: tailored(["React", "React Native"]) }),
      app({ description: "React Native and iOS" }),
      app({ description: "React and React Native" }),
    ]
    const bySkill = Object.fromEntries(
      missingSkills(apps, resume).skills.map((s) => [s.label, s.postings]),
    )
    expect(bySkill).toEqual({ React: 2, "React Native": 3 })
  })

  it("ranks must-haves higher and finds skills asked for together", () => {
    const apps = [
      app({ tailoredResume: { ...tailored(["AWS", "Terraform", "Rust"]), requiredMissing: ["Rust"] } }),
      app({ tailoredResume: tailored(["AWS", "Terraform"]) }),
      app({ description: "Rust only" }),
    ]
    const result = missingSkills(apps, resume)
    // Rust: 2 postings + 1 required = 3 > AWS / Terraform: 2 + 0
    expect(result.skills[0]).toMatchObject({ label: "Rust", postings: 2, required: 1 })
    expect(result.bundles).toEqual([{ skills: ["AWS", "Terraform"], postings: 2 }])
  })
})

describe("seniorityOf", () => {
  it("buckets by title keywords", () => {
    expect(seniorityOf("Sr. Frontend Engineer")).toBe("Senior")
    expect(seniorityOf("Staff Engineer")).toBe("Lead+")
    expect(seniorityOf("Junior Developer")).toBe("Junior")
    expect(seniorityOf("Software Engineer")).toBe("Mid / unspecified")
  })
})

describe("roleTypeOf", () => {
  it("buckets by title, most specific first", () => {
    expect(roleTypeOf("Senior React Native Developer")).toBe("Mobile")
    expect(roleTypeOf("Full-Stack Engineer")).toBe("Full stack")
    expect(roleTypeOf("Frontend Engineer (Vue)")).toBe("Frontend")
    expect(roleTypeOf("Backend Developer")).toBe("Backend")
    expect(roleTypeOf("Software Engineer")).toBe("Other")
  })
})

describe("responseBySkill", () => {
  it("counts a posting toward every skill it mentions", () => {
    const resume: Resume = {
      ...EMPTY_RESUME,
      skills: [{ id: "s1", category: "Web", items: ["Vue"] }],
    }
    const apps = [
      app({ description: "Vue and React", status: "interview", dateApplied: "x" }),
      app({ description: "Vue", status: "applied", dateApplied: "x" }),
      app({ tailoredResume: tailored(["React"]), status: "rejected" }),
    ]
    expect(responseBySkill(apps, resume)).toEqual([
      { label: "React", applied: 2, responded: 1 },
      { label: "Vue", applied: 2, responded: 1 },
    ])
  })
})

describe("strengths", () => {
  it("ranks resume skills by how many descriptions mention them", () => {
    const resume: Resume = {
      ...EMPTY_RESUME,
      skills: [{ id: "s1", category: "Web", items: ["Vue", "TypeScript", "Elm"] }],
    }
    const apps = [
      app({ description: "Vue and TypeScript" }),
      app({ description: "TypeScript, Node" }),
    ]
    expect(strengths(apps, resume)).toEqual({
      rows: [
        { label: "TypeScript", postings: 2 },
        { label: "Vue", postings: 1 },
      ],
      total: 2,
    })
  })
})

describe("skillImpact", () => {
  it("splits response rate on postings asking for a skill at the date it was added", () => {
    const apps = [
      app({ tailoredResume: tailored(["Docker"]), status: "rejected", dateApplied: "2026-01-01" }),
      app({ description: "Docker", status: "interview", dateApplied: "2026-03-01" }),
    ]
    expect(skillImpact(apps, [{ key: "docker", at: "2026-02-01" }])).toEqual([
      {
        label: "Docker",
        at: "2026-02-01",
        before: { label: "before", applied: 1, responded: 0 },
        after: { label: "after", applied: 1, responded: 1 },
      },
    ])
  })
})
