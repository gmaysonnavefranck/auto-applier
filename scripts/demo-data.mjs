// Deterministic fake data for eyeballing the analytics page.
// Run: npm run demo-data  ->  writes src/test/demo-backup.json
// Load it via options > Resume > Import backup. That OVERWRITES your real
// applications + resume, so Export backup first and re-import it after.
//
// Patterns are baked in so every analytics section has something to show:
// Vue roles respond more than React ones, tailored > untailored, Docker added
// to the resume on 2026-09-15 (before/after impact), old jobs lack
// statusHistory / requiredMissing like real legacy data.
import { writeFileSync } from "node:fs"

let seed = 42
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const int = (min, max) => min + Math.floor(rand() * (max - min + 1))

const TODAY = new Date("2026-11-03T12:00:00Z").getTime()
const DAY = 86_400_000
const iso = (ms) => new Date(Math.min(ms, TODAY)).toISOString()
const DOCKER_ADDED = "2026-09-15T00:00:00.000Z"

const BASE_SKILLS = ["Vue", "TypeScript", "JavaScript", "CSS", "Pinia"]
const resume = {
  basics: {
    name: "Demo Candidate",
    email: "demo@example.com",
    title: "Frontend Developer",
    phone: "",
    location: "Remote",
    summary: "Frontend developer with 4 years building Vue apps.",
    github: "",
    linkedin: "",
    website: "",
  },
  work: [
    {
      id: "w1",
      company: "Acme",
      position: "Frontend Developer",
      startDate: "2022-01",
      highlights: ["Built a Vue 3 dashboard used by 2k users", "Migrated the build from Webpack to Vite"],
    },
  ],
  education: [],
  skills: [
    { id: "s1", category: "Frontend", items: BASE_SKILLS },
    { id: "s2", category: "Backend & tools", items: ["Node.js", "PostgreSQL", "Git", "Docker"] },
  ],
  languages: [],
}
const ON_RESUME = new Set(resume.skills.flatMap((g) => g.items))

// Spelling variants Claude might return, to exercise skillKey merging.
const VARIANTS = { React: ["React", "React.js", "ReactJS"], "Next.js": ["Next.js", "NextJS"] }

const TEMPLATES = [
  { title: "Frontend Engineer", tech: ["Vue", "TypeScript", "Pinia", "Vitest"], required: ["Vue"], base: 0.45 },
  { title: "Senior Frontend Engineer", tech: ["React", "TypeScript", "Next.js", "GraphQL"], required: ["React"], base: 0.15 },
  { title: "Frontend Developer (React)", tech: ["React", "Redux", "TypeScript", "Jest"], required: ["React"], base: 0.2 },
  { title: "Full Stack Developer", tech: ["Vue", "Node.js", "PostgreSQL", "AWS", "Docker"], required: ["AWS"], base: 0.35 },
  { title: "Software Engineer", tech: ["TypeScript", "AWS", "Docker", "Kubernetes", "Terraform"], required: ["AWS", "Kubernetes"], base: 0.2 },
  { title: "Backend Engineer", tech: ["Golang", "PostgreSQL", "Kubernetes", "gRPC"], required: ["Golang"], base: 0.1 },
  { title: "Junior Web Developer", tech: ["JavaScript", "CSS", "Vue"], required: [], base: 0.55 },
  { title: "React Native Developer", tech: ["React Native", "TypeScript", "iOS"], required: ["React Native"], base: 0.05 },
  { title: "Staff Frontend Engineer", tech: ["React", "TypeScript", "AWS", "GraphQL"], required: ["React", "GraphQL"], base: 0.05 },
]
const COMPANIES = ["Northwind", "Globex", "Initech", "Umbrella", "Hooli", "Stark Labs", "Wayne Digital", "Pied Piper", "Vandelay", "Soylent"]
const BOARDS = [["LinkedIn", "linkedin.com"], ["LinkedIn", "linkedin.com"], ["Greenhouse", "boards.greenhouse.io"], ["Lever", "jobs.lever.co"], ["Ashby", "jobs.ashbyhq.com"], ["", "careers.example.com"]]
const EXTRA_ADDS = ["Vite", "Vitest", "REST APIs", "Tailwind CSS"]

const applications = []
for (let i = 0; i < 48; i++) {
  const t = pick(TEMPLATES)
  const company = pick(COMPANIES)
  const [jobBoard, domain] = pick(BOARDS)
  const added = TODAY - int(2, 110) * DAY
  const legacy = added < TODAY - 70 * DAY // predates statusHistory / requiredMissing
  const hadDocker = added >= new Date(DOCKER_ADDED).getTime()

  const nice = t.tech.filter((s) => !t.required.includes(s))
  const description = `${company} is hiring a ${t.title}. Requirements: ${(t.required.length ? t.required : t.tech.slice(0, 2)).join(", ")}. Our stack: ${t.tech.map((s) => pick(VARIANTS[s] ?? [s])).join(", ")}. Nice to have: ${nice.join(", ") || "curiosity"}.`

  const app = {
    id: `demo-${i}`,
    siteConfigId: "",
    domain,
    jobBoard,
    url: `https://${domain}/jobs/demo-${i}`,
    jobTitle: t.title,
    company,
    status: "saved",
    dateAdded: iso(added),
    description,
  }

  const tailored = rand() < 0.6
  if (tailored) {
    const missing = t.tech.filter((s) => !ON_RESUME.has(s) || (s === "Docker" && !hadDocker))
    const adds = EXTRA_ADDS.filter(() => rand() < 0.4)
    app.tailoredResume = {
      title: resume.basics.title,
      summary: `Frontend developer with 4 years of experience, ready for ${t.title} work.`,
      work: [{ id: "w1", title: "Frontend Developer", highlights: resume.work[0].highlights }],
      skills: [{ id: "s1", items: [...BASE_SKILLS, ...adds], inferred: [] }],
      missingKeywords: missing.map((s) => pick(VARIANTS[s] ?? [s])),
      ...(legacy ? {} : { requiredMissing: [] }),
      generatedAt: iso(added + DAY / 2),
    }
    if (!legacy) {
      const missingKeys = app.tailoredResume.missingKeywords
      app.tailoredResume.requiredMissing = missingKeys.filter((k) =>
        t.required.some((r) => (VARIANTS[r] ?? [r]).includes(k)),
      )
    }
    if (rand() < 0.6) {
      app.tailoredResume.review = {
        summaryAccepted: true,
        work: [],
        skills: [{ id: "s1", acceptedAdds: adds.filter(() => rand() < 0.8), acceptedRemoves: [] }],
      }
    }
  }

  if (rand() < 0.85) {
    let at = added + int(0, 2) * DAY
    app.dateApplied = iso(at)
    const history = [{ status: "applied", at: iso(at) }]
    const step = (status) => {
      at += int(3, 12) * DAY
      if (at > TODAY) return false
      history.push({ status, at: iso(at) })
      app.status = status
      return true
    }
    app.status = "applied"

    let p = t.base + (tailored ? 0.15 : 0) + (hadDocker && t.tech.includes("Docker") ? 0.25 : 0)
    if (rand() < p) {
      if (step("screening")) {
        if (rand() < 0.5 && step("interview")) {
          if (rand() < 0.3) step("offer")
          else if (rand() < 0.6) step("rejected")
        } else if (rand() < 0.5) step("rejected")
      }
    } else if (rand() < 0.55) step("rejected")
    else if (rand() < 0.1) step("withdrawn")

    if (!legacy) app.statusHistory = history
  }

  applications.push(app)
}
applications.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))

const backup = {
  version: 1,
  exportedAt: new Date(TODAY).toISOString(),
  data: {
    "aa-applications": applications,
    "aa-resume": resume,
    "aa-skill-added": [{ key: "docker", at: DOCKER_ADDED }],
    "aa-skill-learning": [{ key: "aws", label: "AWS", at: iso(TODAY - 10 * DAY) }],
  },
}

writeFileSync(new URL("../src/test/demo-backup.json", import.meta.url), JSON.stringify(backup, null, 2) + "\n")
console.info(`Wrote ${applications.length} demo applications to src/test/demo-backup.json`)
