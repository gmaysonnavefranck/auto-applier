export type WorkMode = "any" | "remote" | "hybrid" | "onsite"
export type Freshness = "pd" | "pw" | "pm" | "py" // Brave's past day/week/month/year

export interface SearchParams {
  keywords: string // role + core tech, e.g. "frontend engineer vue"
  location: string
  workMode: WorkMode
  freshness: Freshness
  // One hard requirement per line ("salary >= 100k", "visa sponsorship").
  // Claude must find evidence for each in the posting before recommending it.
  criteria: string
}

export interface CriterionCheck {
  criterion: string
  met: boolean | null // null = posting doesn't say either way
  evidence: string
}

export interface FoundJob {
  id: string
  url: string
  jobTitle: string
  company: string
  location?: string
  fitScore: number // 0-100, Claude's estimate of resume fit
  reason: string
  criteria: CriterionCheck[]
  description?: string // posting text used for the analysis, reused by "Optimize"
  foundAt: string
}

export type UsageProvider = "anthropic" | "brave"
export type UsageFeature = "tailor" | "discover" | "learning"

export interface UsageEntry {
  at: string
  provider: UsageProvider
  feature: UsageFeature
  model?: string
  inputTokens?: number
  outputTokens?: number
  costUsd: number
}
