import type { Resume } from "src/types/resume"
import type { TailoredResume } from "src/types/jobs"
import { sanitizeForAts } from "src/utils/text"

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
- If the candidate clearly uses it, or it is the exact same underlying technology under a different name (e.g. JD says "TypeScript" and the candidate's resume shows TypeScript usage, even if not listed as a standalone skill) → use the JD's exact term in highlights and skills
- If it is a specific named technology, framework, tool, or library the candidate's resume does NOT show them using — even if related or commonly paired with something they do use (e.g. JD says "React" and candidate only shows Vue experience) → do NOT add it, and record it in missingKeywords. Never substitute one specific tool/framework/library for a different one.
- General methodologies or practices clearly evidenced by their actual work (e.g. "agile", "CI/CD") may be added if genuinely reflected in their highlights
- If it is completely absent from their background → do NOT add it, and record it in missingKeywords

STEP 3 — REWRITE ONLY WHAT NEEDS IT
Summary: rewrite from scratch using the JD's role title, the candidate's real years of experience, and the top 4–6 matched keywords. Make it directly address what the JD asks for.
GROUNDING RULE (applies to every word of the summary): every technology, framework, or tool name you use in the summary must be either (a) already written somewhere in the candidate's resume above, verbatim, or (b) a keyword Step 2 explicitly approved adding. Do not reach for generic "senior [role]" boilerplate that name-drops common ecosystem tools the candidate never mentioned — e.g. if the candidate's resume shows Vue but not React, the summary must not say "Expert in React" and must not mention Next.js, Redux, or any other React-ecosystem tool, even though those are common industry pairings. If you're not certain a tool name came from the candidate's own resume text or Step 2, leave it out.

Work highlights: leave a bullet EXACTLY as it already appears (character-for-character, do not touch it) unless changing it actually adds a Step-2-approved keyword or materially sharpens the match to the JD. Do NOT rewrite a bullet just to rephrase it, swap in a synonym, or change its wording style — a bullet that already says the same thing in different words is not an improvement and wastes the candidate's time reviewing it. Every bullet you DO change must be changed because it now contains a keyword or phrase it didn't have before, not merely reworded.

Skills: add only the keywords Step 2 approved into the appropriate categories. Reorder items so the most JD-relevant appear first. Do not rewrite existing item text.

JOB DESCRIPTION:
"""
${truncatedDesc}
"""

CANDIDATE RESUME:
${buildResumeText(resume)}

CRITICAL: Use ONLY plain ASCII characters. No em dashes (use hyphen -), no smart/curly quotes (use straight " and '), no bullet characters (use plain text), no ellipsis character (use ...). ATS systems reject resumes with non-ASCII characters.

CRITICAL: Before writing the summary, re-check every technology/tool name against the candidate resume above. Never introduce a tool the candidate hasn't used, in the summary or anywhere else, even a common pairing with something they do use.

Respond with ONLY valid JSON — no markdown fences, no explanation, nothing else:
{
  "summary": "rewritten summary using JD language and matched keywords",
  "work": [
    {
      "id": "exact-id-shown-in-brackets-above",
      "highlights": ["bullet left untouched", "bullet changed only because it now includes an approved keyword"]
    }
  ],
  "skills": [
    {
      "id": "exact-id-shown-in-brackets-above",
      "items": ["Most JD-relevant skill first", "...all items including any added keywords"]
    }
  ],
  "missingKeywords": ["keyword from Step 1 that was NOT added to the resume, per Step 2 rules"]
}

Return ALL work entries and ALL skill groups, including every highlight and skill item — unchanged ones returned verbatim, not omitted.`

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
    missingKeywords?: string[]
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
    missingKeywords: Array.isArray(parsed.missingKeywords)
      ? parsed.missingKeywords.map(sanitizeForAts)
      : [],
    generatedAt: new Date().toISOString(),
  }
}
