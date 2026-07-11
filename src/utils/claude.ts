import type { Resume } from "src/types/resume"
import type { TailoredResume } from "src/types/jobs"

export function sanitizeForAts(text: string): string {
  return text
    .replace(/[‘’]/g, "'")                          // smart single quotes
    .replace(/[“”]/g, '"')                          // smart double quotes
    .replace(/[–—]/g, '-')                          // en-dash / em-dash
    .replace(/…/g, '...')                                // ellipsis
    .replace(/ /g, ' ')                                  // non-breaking space
    .replace(/[•●▪‣⁃·]/g, '-') // bullets / middle dots
    .replace(/®/g, '(R)')
    .replace(/™/g, 'TM')
    .trim()
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === "\\" && inString) {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (c === "{") depth++
    else if (c === "}") {
      if (--depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function buildResumeText(resume: Resume): string {
  const b = resume.basics
  const lines: string[] = []

  if (b.name) lines.push(`Name: ${b.name}`)
  if (b.title) lines.push(`Current Title: ${b.title}`)
  if (b.summary) lines.push(`\nSummary:\n${b.summary}`)

  if (resume.work.length) {
    lines.push("\nWork Experience:")
    for (const job of resume.work) {
      lines.push(
        `  [id:${job.id}] ${job.company} | ${job.position} (${job.startDate} – ${job.endDate || "Present"})`,
      )
      for (const h of job.highlights) lines.push(`    • ${h}`)
    }
  }

  if (resume.skills.length) {
    lines.push("\nSkills:")
    for (const g of resume.skills)
      lines.push(`  [id:${g.id}] ${g.category}: ${g.items.join(", ")}`)
  }

  if (resume.languages.length) {
    const langs = resume.languages
      .map((l) => `${l.name} (${l.proficiency})`)
      .join(", ")
    lines.push(`\nLanguages: ${langs}`)
  }

  return lines.join("\n")
}

export async function tailorResumeForJob(
  apiKey: string,
  resume: Resume,
  jobDescription: string,
): Promise<TailoredResume> {
  const truncatedDesc =
    jobDescription.length > 4000
      ? jobDescription.slice(0, 4000) + "\n[truncated]"
      : jobDescription

  const prompt = `You are an ATS keyword optimization specialist. Your job is to maximize keyword alignment between a candidate's resume and a job description, without fabricating anything.

STEP 1 — KEYWORD ANALYSIS
Read the job description and extract:
- Required and preferred technologies/tools (e.g. "React", "Kubernetes", "Jira")
- Methodologies and practices (e.g. "agile", "TDD", "CI/CD", "code review")
- Role-specific language (e.g. "cross-functional teams", "stakeholder management", "scalable systems")

STEP 2 — APPLY KEYWORDS HONESTLY
For each keyword from Step 1:
- If the candidate clearly uses it (same thing, different name) → use the JD's exact term in highlights and skills
- If it is strongly implied by their tech stack or role (e.g. JD says "TypeScript" and candidate builds Vue 3 apps) → add it to skills
- If it is completely absent from their background → do NOT add it

STEP 3 — REWRITE
Summary: rewrite from scratch using the JD's role title, the candidate's real years of experience, and the top 4–6 matched keywords. Make it directly address what the JD asks for.

Work highlights: rewrite each bullet to mirror the JD's language. Replace generic phrases with the JD's specific terminology. Keep all facts (companies, dates, technologies actually mentioned) accurate. Lead each bullet with a strong action verb.

Skills: add any clearly implied keywords from Step 2 into the appropriate categories. Reorder items so the most JD-relevant appear first.

JOB DESCRIPTION:
"""
${truncatedDesc}
"""

CANDIDATE RESUME:
${buildResumeText(resume)}

CRITICAL: Use ONLY plain ASCII characters. No em dashes (use hyphen -), no smart/curly quotes (use straight " and '), no bullet characters (use plain text), no ellipsis character (use ...). ATS systems reject resumes with non-ASCII characters.

Respond with ONLY valid JSON — no markdown fences, no explanation, nothing else:
{
  "summary": "rewritten summary using JD language and matched keywords",
  "work": [
    {
      "id": "exact-id-shown-in-brackets-above",
      "highlights": ["bullet mirroring JD terminology", "another rewritten bullet"]
    }
  ],
  "skills": [
    {
      "id": "exact-id-shown-in-brackets-above",
      "items": ["Most JD-relevant skill first", "...all items including any added keywords"]
    }
  ]
}

Return ALL work entries and ALL skill groups. Every highlight must use the JD's language where applicable.`

  const requestBody = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system:
      "You are a resume optimization assistant. You ALWAYS respond with a single valid JSON object and absolutely nothing else — no markdown, no code fences, no explanation before or after.",
    messages: [{ role: "user", content: prompt }],
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    throw new Error(err.error?.message ?? `Claude API error ${response.status}`)
  }

  const data = (await response.json()) as {
    content?: { text?: string }[]
    stop_reason?: string
  }
  const raw = data.content?.[0]?.text ?? ""

  const jsonStr = extractJsonObject(raw)
  if (!jsonStr)
    throw new Error(
      `Claude returned no JSON. stop_reason=${data.stop_reason ?? "unknown"}, preview: "${raw.slice(0, 120)}"`,
    )

  let parsed: {
    summary?: string
    work?: { id: string; highlights: string[] }[]
    skills?: { id: string; items: string[] }[]
  }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error("Claude returned invalid JSON. Please try again.")
  }

  return {
    summary: sanitizeForAts(typeof parsed.summary === "string" ? parsed.summary : ""),
    work: Array.isArray(parsed.work)
      ? parsed.work.map((w) => ({
          id: w.id,
          highlights: Array.isArray(w.highlights)
            ? w.highlights.map(sanitizeForAts)
            : [],
        }))
      : [],
    skills: Array.isArray(parsed.skills)
      ? parsed.skills.map((s) => ({
          id: s.id,
          items: Array.isArray(s.items) ? s.items.map(sanitizeForAts) : [],
        }))
      : [],
    generatedAt: new Date().toISOString(),
  }
}
