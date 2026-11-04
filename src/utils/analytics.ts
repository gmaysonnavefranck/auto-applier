import type { Application, ApplicationStatus } from "src/types/jobs"
import type { Resume } from "src/types/resume"
import { computeMatchScore } from "src/utils/matchScore"

// Rates computed from fewer applications than this get a "low data" tag.
export const LOW_DATA = 10

// Collapses spelling variants into one key: "React.js" / "ReactJS" / "react"
// -> "react", "CI/CD" -> "cicd". Keeps + and # so C++ / C# stay distinct.
// ponytail: no synonym table (K8s != Kubernetes), add an alias map if it matters.
export function skillKey(skill: string): string {
  const key = skill.toLowerCase().replace(/[^a-z0-9+#]/g, "")
  return key.length > 4 && key.endsWith("js") ? key.slice(0, -2) : key
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Whole-word, case-insensitive. "React" matches "React." but not "Reactive".
// `others` = every other tracked skill label: a longer one that extends this
// label ("React Native" for "React") is excluded, so a mobile posting doesn't
// count as asking for React.
// ponytail: short generic names ("Go", "R") also match plain English words.
function skillPattern(label: string, others: string[] = []): RegExp {
  const prefix = label.toLowerCase() + " "
  const suffixes = others
    .filter((o) => o.toLowerCase().startsWith(prefix))
    .map((o) => escapeRegExp(o.slice(prefix.length).trim()))
  const notLonger = suffixes.length ? `(?!\\s+(?:${suffixes.join("|")})(?![a-z0-9]))` : ""
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(label)}(?![a-z0-9])${notLonger}`, "i")
}

function allLabels(vocab: Map<string, string[]>, resume?: Resume): string[] {
  return [...[...vocab.values()].flat(), ...(resume?.skills.flatMap((g) => g.items) ?? [])]
}

const STAGE_RANK: Partial<Record<ApplicationStatus, number>> = {
  applied: 1,
  screening: 2,
  interview: 3,
  offer: 4,
}

export const FUNNEL_STAGES = ["applied", "screening", "interview", "offer"] as const

// 0 = never applied, 1 = applied, 2 = screening, 3 = interview, 4 = offer.
// A job rejected after an interview only remembers that via statusHistory, so
// older jobs (no history) undercount: rejected = applied, nothing more.
export function furthestStage(app: Application): number {
  const statuses = [app.status, ...(app.statusHistory ?? []).map((h) => h.status)]
  const rank = Math.max(...statuses.map((s) => STAGE_RANK[s] ?? 0))
  const applied = app.dateApplied || app.status === "rejected" ? 1 : 0
  return Math.max(rank, applied)
}

export function funnel(apps: Application[]) {
  return FUNNEL_STAGES.map((stage, i) => ({
    stage,
    count: apps.filter((a) => furthestStage(a) >= i + 1).length,
  }))
}

export interface RateRow {
  label: string
  applied: number
  responded: number // reached screening or further
}

function rateBy(apps: Application[], labelOf: (a: Application) => string): RateRow[] {
  const rows = new Map<string, RateRow>()
  for (const a of apps) {
    const stage = furthestStage(a)
    if (stage < 1) continue
    const label = labelOf(a)
    const row = rows.get(label) ?? { label, applied: 0, responded: 0 }
    row.applied++
    if (stage >= 2) row.responded++
    rows.set(label, row)
  }
  return [...rows.values()]
}

function inOrder(rows: RateRow[], order: string[]): RateRow[] {
  return rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
}

export function responseBySource(apps: Application[]): RateRow[] {
  return rateBy(apps, (a) => a.jobBoard || "Manual").sort((a, b) => b.applied - a.applied)
}

// Scored against the *current* base resume, same as the side panel badge, so
// a resume edited since tailoring shifts old scores a bit.
export function responseByMatchScore(apps: Application[], resume: Resume): RateRow[] {
  const rows = rateBy(apps, (a) => {
    if (!a.tailoredResume) return "Not tailored"
    const score = computeMatchScore(a.tailoredResume, resume).current
    return score >= 80 ? "80-100%" : score >= 50 ? "50-79%" : "0-49%"
  })
  return inOrder(rows, ["80-100%", "50-79%", "0-49%", "Not tailored"])
}

// ponytail: keyword match on the title, misses levels written only in the
// description ("5+ years") or as numbers ("Engineer II").
export function seniorityOf(jobTitle: string): string {
  const t = jobTitle.toLowerCase()
  if (/\b(intern|internship|junior|jr|entry|graduate|trainee)\b/.test(t)) return "Junior"
  if (/\b(lead|staff|principal|head|architect|manager)\b/.test(t)) return "Lead+"
  if (/\b(senior|sr)\b/.test(t)) return "Senior"
  return "Mid / unspecified"
}

export function responseBySeniority(apps: Application[]): RateRow[] {
  return inOrder(rateBy(apps, (a) => seniorityOf(a.jobTitle)), [
    "Junior",
    "Mid / unspecified",
    "Senior",
    "Lead+",
  ])
}

// First match wins: mobile before frontend ("React Native"), full stack
// before frontend/backend.
// ponytail: title keywords only; generic "Software Engineer" lands in Other,
// responseBySkill covers that gap from the description.
const ROLE_PATTERNS: [string, RegExp][] = [
  ["Mobile", /\b(mobile|ios|android|react native|flutter)\b/],
  ["Full stack", /\bfull[\s-]?stack\b/],
  ["Frontend", /\b(front[\s-]?end|ui|web developer|react|vue|angular)\b/],
  ["Backend", /\b(back[\s-]?end|api|server)\b/],
  ["Data / ML", /\b(data|machine learning|ml|ai|analytics)\b/],
  ["DevOps / Infra", /\b(devops|sre|reliability|infrastructure|platform|cloud)\b/],
]

export function roleTypeOf(jobTitle: string): string {
  const t = jobTitle.toLowerCase()
  return ROLE_PATTERNS.find(([, re]) => re.test(t))?.[0] ?? "Other"
}

export function responseByRoleType(apps: Application[]): RateRow[] {
  return inOrder(rateBy(apps, (a) => roleTypeOf(a.jobTitle)), [
    ...ROLE_PATTERNS.map(([label]) => label),
    "Other",
  ])
}

// Response rate on postings that ask for each skill (yours or a gap), most
// applied-to first. A posting counts toward every skill it mentions.
export function responseBySkill(apps: Application[], resume: Resume, limit = 10): RateRow[] {
  const vocab = missingVocabulary(apps)
  for (const label of resume.skills.flatMap((g) => g.items)) {
    const key = skillKey(label)
    if (!key) continue
    const list = vocab.get(key) ?? []
    if (!list.includes(label.trim())) list.push(label.trim())
    vocab.set(key, list)
  }
  const postings = apps.filter((a) => a.description || a.tailoredResume)
  const others = allLabels(vocab)
  return [...vocab]
    .flatMap(([key, labels]) =>
      rateBy(postingsAsking(postings, key, labels, others), () => labels[0]),
    )
    .sort((a, b) => b.applied - a.applied)
    .slice(0, limit)
}

const DAY_MS = 86_400_000

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Days from applying to first reaching screening or further. Needs
// statusHistory, so jobs from before it existed don't count.
export function responseTime(apps: Application[]) {
  const days = apps.flatMap((a) => {
    const reply = a.statusHistory?.find((h) => (STAGE_RANK[h.status] ?? 0) >= 2)
    const applied = a.dateApplied ?? a.statusHistory?.find((h) => h.status === "applied")?.at
    if (!reply || !applied) return []
    return [Math.max(0, (new Date(reply.at).getTime() - new Date(applied).getTime()) / DAY_MS)]
  })
  return { median: days.length ? Math.round(median(days)) : null, count: days.length }
}

// Follow-up cutoff: twice your typical wait once there's enough timing data,
// a flat 14 days until then.
export function followUpDays(apps: Application[]): number {
  const { median, count } = responseTime(apps)
  return median !== null && count >= LOW_DATA ? Math.max(7, median * 2) : 14
}

const REJECTED_AFTER: Partial<Record<ApplicationStatus, string>> = {
  saved: "Before applying",
  applied: "After applying",
  screening: "After screening",
  interview: "After interview",
  offer: "After offer",
}

// Stage a job was at right before it was rejected. Jobs without
// statusHistory are counted in `unknown` instead of guessed.
export function rejectionStages(apps: Application[]) {
  const counts = new Map<string, number>()
  let unknown = 0
  for (const a of apps) {
    if (a.status !== "rejected") continue
    const h = a.statusHistory ?? []
    const at = h.findLastIndex((e) => e.status === "rejected")
    // at === 0: first recorded change was the rejection. Never applied means it
    // came straight from saved; otherwise it predates history and is unknown.
    const label =
      at > 0
        ? REJECTED_AFTER[h[at - 1].status]
        : at === 0 && !a.dateApplied
          ? REJECTED_AFTER.saved
          : undefined
    if (!label) {
      unknown++
      continue
    }
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const order = Object.values(REJECTED_AFTER)
  const rows = [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
  return { rows, unknown, total: rows.reduce((n, r) => n + r.count, 0) }
}

// Still on "applied" with no movement for `days`, oldest first.
export function ghosted(apps: Application[], now = Date.now(), days = 14) {
  return apps
    .filter((a) => a.status === "applied")
    .map((a) => {
      const since = a.statusHistory?.at(-1)?.at ?? a.dateApplied ?? a.dateAdded
      return { app: a, days: Math.floor((now - new Date(since).getTime()) / DAY_MS) }
    })
    .filter((g) => g.days >= days)
    .sort((a, b) => b.days - a.days)
}

export interface MissingSkill {
  key: string
  label: string
  postings: number // how many saved postings ask for it
  required: number // ...of which listed it as a must-have
  rejected: number // ...of which ended up rejected
}

// Postings that ask for a skill: a tailoring run flagged it missing there, or
// its description mentions one of the skill's spellings.
function postingsAsking(
  postings: Application[],
  key: string,
  labels: string[],
  others: string[],
) {
  const patterns = labels.map((l) => skillPattern(l, others))
  return postings.filter(
    (a) =>
      a.tailoredResume?.missingKeywords.some((k) => skillKey(k) === key) ||
      patterns.some((p) => p.test(a.description ?? "")),
  )
}

// Every keyword a tailoring run ever flagged as missing, grouped by skillKey
// with each spelling seen.
function missingVocabulary(apps: Application[]): Map<string, string[]> {
  const variants = new Map<string, string[]>()
  for (const raw of apps.flatMap((a) => a.tailoredResume?.missingKeywords ?? [])) {
    const label = raw.trim()
    const key = skillKey(label)
    if (!key) continue
    const list = variants.get(key) ?? []
    if (!list.includes(label)) list.push(label)
    variants.set(key, list)
  }
  return variants
}

// Vocabulary comes from tailoring runs; each skill is then counted across *all*
// saved postings (tailored or not), and moved to `closed` once the base resume
// lists it. Bundles = pairs of missing skills asked for together in 2+ postings.
// ponytail: only skills some tailoring run flagged can show up; a skill no run
// ever surfaced stays invisible until one does. Pairs only, no 3+ clusters.
export function missingSkills(apps: Application[], resume: Resume) {
  const have = new Set(resume.skills.flatMap((g) => g.items).map(skillKey))
  const postings = apps.filter((a) => a.description || a.tailoredResume)
  const skills: MissingSkill[] = []
  const closed: string[] = []
  const askedBy = new Map<string, Set<string>>() // skill key -> posting ids
  const vocab = missingVocabulary(apps)
  const others = allLabels(vocab, resume)

  for (const [key, labels] of vocab) {
    if (have.has(key)) {
      closed.push(labels[0])
      continue
    }
    const hits = postingsAsking(postings, key, labels, others)
    askedBy.set(key, new Set(hits.map((a) => a.id)))
    skills.push({
      key,
      label: labels[0],
      postings: hits.length,
      required: hits.filter((a) =>
        a.tailoredResume?.requiredMissing?.some((k) => skillKey(k) === key),
      ).length,
      rejected: hits.filter((a) => a.status === "rejected").length,
    })
  }

  // A must-have weighs double: missing it can sink an application outright.
  skills.sort((a, b) => b.postings + b.required - (a.postings + a.required))

  const bundles: { skills: [string, string]; postings: number }[] = []
  const top = skills.slice(0, 15)
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const a = askedBy.get(top[i].key)!
      const b = askedBy.get(top[j].key)!
      const together = [...a].filter((id) => b.has(id)).length
      if (together >= 2) bundles.push({ skills: [top[i].label, top[j].label], postings: together })
    }
  }
  bundles.sort((a, b) => b.postings - a.postings)

  return { skills, closed, bundles: bundles.slice(0, 5), total: postings.length }
}

// Skills you already have, by how many saved descriptions ask for them.
export function strengths(apps: Application[], resume: Resume) {
  const postings = apps.filter((a) => a.description)
  const others = allLabels(missingVocabulary(apps), resume)
  const seen = new Set<string>()
  const rows: { label: string; postings: number }[] = []
  for (const label of resume.skills.flatMap((g) => g.items)) {
    const key = skillKey(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const pattern = skillPattern(label.trim(), others)
    const count = postings.filter((a) => pattern.test(a.description!)).length
    if (count) rows.push({ label: label.trim(), postings: count })
  }
  return { rows: rows.sort((a, b) => b.postings - a.postings), total: postings.length }
}

// For skills added to the base resume after a tailoring run flagged them
// missing: response rate on postings asking for that skill, applied before vs
// after the date it was added.
export function skillImpact(apps: Application[], added: { key: string; at: string }[]) {
  const vocab = missingVocabulary(apps)
  const others = allLabels(vocab)
  const postings = apps.filter((a) => a.description || a.tailoredResume)
  return added.flatMap(({ key, at }) => {
    const labels = vocab.get(key)
    if (!labels) return []
    const hits = postingsAsking(postings, key, labels, others).filter((a) => a.dateApplied)
    const split = rateBy(hits, (a) => (a.dateApplied! < at ? "before" : "after"))
    const pick = (label: string) => split.find((r) => r.label === label) ?? { label, applied: 0, responded: 0 }
    return [{ label: labels[0], at, before: pick("before"), after: pick("after") }]
  })
}
