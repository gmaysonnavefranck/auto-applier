import type { Resume } from "src/types/resume"
import { buildResumeText, callClaudeForJson } from "src/utils/claude"

export type Closeness = "close" | "moderate" | "far"

export interface LearningPlanItem {
  skill: string
  closeness: Closeness
  why: string
  firstStep: string
}

export interface LearningPlan {
  items: LearningPlanItem[] // in suggested learning order
  generatedAt: string
}

export interface SkillGap {
  skill: string
  postings: number
  required: number
}

const CLOSENESS: Closeness[] = ["close", "moderate", "far"]

export async function planLearning(
  apiKey: string,
  resume: Resume,
  gaps: SkillGap[],
  totalPostings: number,
): Promise<LearningPlan> {
  const gapLines = gaps
    .map((g) => `- ${g.skill}: asked in ${g.postings} of ${totalPostings} postings (${g.required} as must-have)`)
    .join("\n")

  const prompt = `A job seeker wants to know which missing skills to learn first. Below are the skills their saved job postings ask for that their resume doesn't show, with how often each is asked for, followed by their resume.

For each skill, judge how close it is to what the candidate already knows:
- "close": a sibling of something they already use (e.g. React for a Vue developer, PostgreSQL for a MySQL user) - days to weeks
- "moderate": same domain, new concepts (e.g. Docker for a backend dev who has never containerized)
- "far": a different discipline or language family

Then order the skills by value for the time spent: demand (especially must-have counts) weighed against closeness. A close, often-required skill goes first; a far, rarely asked one goes last.

MISSING SKILLS:
${gapLines}

CANDIDATE RESUME:
${buildResumeText(resume)}

Respond with ONLY valid JSON, no markdown:
{
  "items": [
    {
      "skill": "exact skill name from the list above",
      "closeness": "close | moderate | far",
      "why": "one sentence: what they already know that relates, and why it's worth it",
      "firstStep": "one concrete, small first step (a specific thing to build or read), not a generic 'take a course'"
    }
  ]
}

Include every skill from the list exactly once, in your recommended learning order.`

  const jsonStr = await callClaudeForJson(apiKey, "learning", {
    max_tokens: 2048,
    system:
      "You are a pragmatic career coach. You ALWAYS respond with a single valid JSON object and nothing else.",
    prompt,
  })

  let parsed: { items?: Partial<LearningPlanItem>[] }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error("Claude returned invalid JSON. Please try again.")
  }

  const asked = new Set(gaps.map((g) => g.skill))
  return {
    items: (parsed.items ?? [])
      .filter((i) => typeof i.skill === "string" && asked.has(i.skill))
      .map((i) => ({
        skill: i.skill!,
        closeness: CLOSENESS.includes(i.closeness as Closeness)
          ? (i.closeness as Closeness)
          : "moderate",
        why: typeof i.why === "string" ? i.why : "",
        firstStep: typeof i.firstStep === "string" ? i.firstStep : "",
      })),
    generatedAt: new Date().toISOString(),
  }
}
