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

  if (resume.education.length) {
    lines.push("\nEducation:")
    for (const edu of resume.education) {
      const field = edu.field ? ` in ${edu.field}` : ""
      lines.push(
        `  ${edu.degree}${field} — ${edu.institution} (${edu.startDate} – ${edu.endDate || "Present"})`,
      )
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
Do NOT extract degree/education requirements here (e.g. "Bachelor's degree", "Master's in Computer Science") — those are handled separately in the Education Check step below and must never appear in missingKeywords.

STEP 2 — APPLY KEYWORDS HONESTLY
For each keyword from Step 1:
- If the candidate clearly uses it, or it is the exact same underlying technology, library, or spec under a different name or version label (e.g. JD says "TypeScript" and the resume shows TypeScript usage; JD says "CSS3" and the resume says "CSS"; JD says "Vue.js" or "Vue 3" and the resume says "Vue"; JD says "JavaScript" and the resume says "JS" or "ES6") → use the JD's exact term in highlights and skills. This is renaming a fact the candidate already demonstrates, not adding a new claim.
- If it is a companion tool that is near-universally paired with a technology the candidate demonstrably uses — the kind of pairing where using one all but implies the other (e.g. a Vue codebase almost always uses Pinia or Vuex for state management; a REST API almost always involves some HTTP client/testing tool) → you may add it to that skill group's "items", but you MUST also list it in that group's "inferred" array in the JSON response (see schema below). This is a guess, not a confirmed fact — it must never be silently bulk-accepted, only added if the candidate explicitly confirms it in review. Do NOT use this for genuinely different, competing technologies: React and Vue are different frameworks, not a pairing — if the JD wants React and the candidate only shows Vue, that is still a hard no, straight to missingKeywords, same as any other unrelated tool.
- If it is a specific named technology, framework, tool, or library the candidate's resume does NOT show them using, and it isn't a companion-tool pairing per the rule above → do NOT add it, and record it in missingKeywords. Never substitute one specific tool/framework/library for a different one.
- General methodologies or practices clearly evidenced by their actual work (e.g. "agile", "CI/CD") may be added if genuinely reflected in their highlights
- If it is completely absent from their background → do NOT add it, and record it in missingKeywords

STEP 3 — REWRITE ONLY WHAT NEEDS IT
Summary: rewrite from scratch using the JD's role title, the candidate's real years of experience, and the top 4–6 matched keywords. Make it directly address what the JD asks for.
GROUNDING RULE (applies to every word of the summary): every technology, framework, or tool name you use in the summary must be either (a) already written somewhere in the candidate's resume above, verbatim, or (b) a keyword Step 2 explicitly approved as a confirmed match. Never use a Step 2 "inferred" companion-tool guess in the summary — those are unconfirmed until the candidate accepts them in review, so asserting one as fact in prose would be exactly the fabrication this task exists to avoid. Do not reach for generic "senior [role]" boilerplate that name-drops common ecosystem tools the candidate never mentioned. If you're not certain a tool name came from the candidate's own resume text or a confirmed Step 2 match, leave it out.

Work highlights: leave a bullet EXACTLY as it already appears (character-for-character, do not touch it) unless (a) changing it actually adds a Step-2-approved keyword or materially sharpens the match to the JD, or (b) it has a genuine quality problem per the BULLET QUALITY rule below. Do NOT rewrite a bullet just to rephrase it, swap in a synonym, or change its wording style for no reason — a bullet that already says the same thing in different words is not an improvement and wastes the candidate's time reviewing it. Every bullet you DO change must have a concrete reason: a new keyword, a sharper JD match, or a specific quality fix, never a stylistic reword with no purpose.

BULLET QUALITY (applies regardless of JD match): fix a bullet only if it has an objective weakness — starts with a weak/passive opener ("Responsible for...", "Worked on...", "Helped with...", "Involved in...", "Assisted with...", "Tasked with...", "Duties included...") or has no action verb at all. Replace the weak opener with a strong action verb that describes the EXACT SAME action, scope, and outcome already stated — never invent a metric, number, outcome, or scope the bullet didn't already claim. "Responsible for maintaining the codebase" becoming "Maintained the codebase" is fine (same claim, stronger verb); "Maintained the codebase" becoming "Maintained the codebase, improving reliability by 30%" is NOT fine (a fabricated, unearned metric). A bullet with a strong opener and no other issue should be left untouched even if it's short or plain — quality fixes are for genuinely weak phrasing, not a general rewrite pass.

Skills: add only the keywords Step 2 approved (confirmed matches and inferred companion tools alike) into the appropriate categories. Reorder items so the most JD-relevant appear first. Do not rewrite existing item text.

STEP 4 — TITLE ALIGNMENT (mandatory comparison — do not skip this)
ATS systems often score a title match between the resume and the job posting, and unlike a specific tool or library, job titles are loosely standardized industry-wide — the same role gets called different things at different companies. For the Current Title AND separately for each individual work entry, you MUST actively compare it against the JD's title and decide whether to align it — do not default to "leave it unchanged" just to play it safe. The strict caution from Steps 2-3 about not fabricating content does NOT carry over to this step: choosing which true, already-earned label to display is not adding a new claim, so lean toward aligning whenever the discipline genuinely matches, rather than leaning toward no change.
- Titles describing the same core discipline and scope are the same job under different names industry-wide, and should align to the JD's exact wording: "Frontend Developer" / "Front-End Engineer" / "Web Developer" / "UI Developer" are the same role when an entry's highlights show client-side/UI work. "Full Stack Developer" / "Full Stack Engineer" / "Web Application Developer" / "Application Developer" are the same role when an entry's highlights show both frontend and backend work. "Software Engineer" vs "Software Developer" is the same distinction.
- WORKED EXAMPLE: JD title is "Web Application Developer". A work entry's title is "Full Stack Developer" and its highlights show both frontend and backend work → align that entry's title to "Web Application Developer" (same scope, different label — do this). A different work entry's title is "Frontend Developer" and its highlights show only client-side work → leave that one's title unchanged (aligning it would silently imply backend scope that entry never had — do NOT do this one).
- Do NOT turn a frontend-only entry into "Full Stack Engineer" or "Web Application Developer" unless that entry's own highlights actually show backend work — that is a scope change, not a wording synonym.
- Do NOT add seniority words ("Senior", "Staff", "Lead", "Principal") that aren't already implied by the candidate's own experience.
- Do NOT change discipline entirely (e.g. never turn a "Designer" into an "Engineer").
A proposed title only ever applies to this tailored version; it never edits the candidate's saved resume unless they explicitly accept it.

STEP 5 — EDUCATION CHECK (informational only, never rewritten)
Check whether the job description states a degree/education requirement (e.g. "Bachelor's degree in Computer Science or related field", "Master's preferred", "BS/MS in a technical field"). This is a factual comparison against the candidate's Education section above — you are never rewriting or adding to the candidate's education, only reporting a match.
- If the JD states no education requirement at all, omit "educationMatch" from the response entirely — do not include the key.
- If the JD does state one, compare it to the candidate's Education entries: the candidate's degree (or a higher one, e.g. a Master's satisfies a Bachelor's requirement) in the same or a closely related field satisfies it → "met": true. A degree in an unrelated field, a lower degree than required, or no education entries at all → "met": false.
- "requirement" is the degree/field the JD asks for, in your own concise words (e.g. "Bachelor's degree in Computer Science or related field").
- "note" is one short factual sentence explaining the verdict (e.g. "Candidate holds a B.S. in Computer Science, matching the requirement" or "JD requires a Master's degree; resume shows a Bachelor's only").

JOB DESCRIPTION:
"""
${truncatedDesc}
"""

CANDIDATE RESUME:
${buildResumeText(resume)}

CRITICAL: Use ONLY plain ASCII characters. No em dashes (use hyphen -), no smart/curly quotes (use straight " and '), no bullet characters (use plain text), no ellipsis character (use ...). ATS systems reject resumes with non-ASCII characters.

CRITICAL: Before writing the summary, re-check every technology/tool name against the candidate resume above. Never introduce a tool the candidate hasn't used in the summary — not even a Step 2 inferred companion-tool guess, since that's unconfirmed until the candidate accepts it.

Respond with ONLY valid JSON — no markdown fences, no explanation, nothing else:
{
  "title": "candidate's Current Title, rewritten ONLY per Step 4; otherwise return it unchanged exactly as shown above",
  "summary": "rewritten summary using JD language and matched keywords",
  "work": [
    {
      "id": "exact-id-shown-in-brackets-above",
      "title": "this entry's job title, rewritten ONLY per Step 4 for this specific entry; otherwise return it unchanged exactly as shown above",
      "highlights": ["bullet left untouched", "bullet changed only because it now includes an approved keyword"]
    }
  ],
  "skills": [
    {
      "id": "exact-id-shown-in-brackets-above",
      "items": ["Most JD-relevant skill first", "...all items including any added keywords"],
      "inferred": ["any item above that is a Step 2 companion-tool guess, not a confirmed match — omit or leave empty if none"]
    }
  ],
  "missingKeywords": ["keyword from Step 1 that was NOT added to the resume, per Step 2 rules"],
  "educationMatch": {
    "requirement": "the degree/field the JD asks for, per Step 5 — omit this whole educationMatch object if the JD states no education requirement",
    "met": true,
    "note": "one short factual sentence explaining the verdict"
  }
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
    title?: string
    summary?: string
    work?: { id: string; title?: string; highlights: string[] }[]
    skills?: { id: string; items: string[]; inferred?: string[] }[]
    missingKeywords?: string[]
    educationMatch?: { requirement?: string; met?: boolean; note?: string }
  }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error("Claude returned invalid JSON. Please try again.")
  }

  return {
    title: sanitizeForAts(
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title
        : (resume.basics.title ?? ""),
    ),
    summary: sanitizeForAts(typeof parsed.summary === "string" ? parsed.summary : ""),
    work: Array.isArray(parsed.work)
      ? parsed.work.map((w) => ({
          id: w.id,
          title: sanitizeForAts(
            typeof w.title === "string" && w.title.trim()
              ? w.title
              : (resume.work.find((job) => job.id === w.id)?.position ?? ""),
          ),
          highlights: Array.isArray(w.highlights)
            ? w.highlights.map(sanitizeForAts)
            : [],
        }))
      : [],
    skills: Array.isArray(parsed.skills)
      ? parsed.skills.map((s) => {
          const items = Array.isArray(s.items) ? s.items.map(sanitizeForAts) : []
          const itemSet = new Set(items)
          const inferred = Array.isArray(s.inferred)
            ? s.inferred.map(sanitizeForAts).filter((v) => itemSet.has(v))
            : []
          return { id: s.id, items, inferred }
        })
      : [],
    missingKeywords: Array.isArray(parsed.missingKeywords)
      ? parsed.missingKeywords.map(sanitizeForAts)
      : [],
    educationMatch:
      parsed.educationMatch && typeof parsed.educationMatch.requirement === "string" &&
      parsed.educationMatch.requirement.trim()
        ? {
            requirement: sanitizeForAts(parsed.educationMatch.requirement),
            met: parsed.educationMatch.met === true,
            note: sanitizeForAts(
              typeof parsed.educationMatch.note === "string" ? parsed.educationMatch.note : "",
            ),
          }
        : undefined,
    generatedAt: new Date().toISOString(),
  }
}
