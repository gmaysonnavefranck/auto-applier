export type FieldType =
  | "jobTitle"
  | "company"
  | "location"
  | "salary"
  | "description"
  | "applyButton"

export interface FieldConfig {
  label: string
  required: boolean
  icon: string
  hint: string
}

export const FIELD_CONFIG: Record<FieldType, FieldConfig> = {
  jobTitle: {
    label: "Job Title",
    required: true,
    icon: "i-lucide-briefcase",
    hint: "The main heading with the role name",
  },
  company: {
    label: "Company",
    required: true,
    icon: "i-lucide-building-2",
    hint: "Company or organization name",
  },
  location: {
    label: "Location",
    required: false,
    icon: "i-lucide-map-pin",
    hint: "City, state, or remote indicator",
  },
  salary: {
    label: "Salary",
    required: false,
    icon: "i-lucide-circle-dollar-sign",
    hint: "Pay range or compensation info",
  },
  description: {
    label: "Description",
    required: false,
    icon: "i-lucide-file-text",
    hint: "Job responsibilities and requirements",
  },
  applyButton: {
    label: "Apply Button",
    required: false,
    icon: "i-lucide-mouse-pointer-click",
    hint: "The primary apply / submit button",
  },
}

export const FIELD_ORDER: FieldType[] = [
  "jobTitle",
  "company",
  "location",
  "salary",
  "description",
  "applyButton",
]

const KNOWN_BOARDS: Record<string, string> = {
  "linkedin.com": "LinkedIn",
  "indeed.com": "Indeed",
  "glassdoor.com": "Glassdoor",
  "monster.com": "Monster",
  "ziprecruiter.com": "ZipRecruiter",
  "wellfound.com": "Wellfound",
  "angellist.com": "AngelList",
  "greenhouse.io": "Greenhouse",
  "lever.co": "Lever",
  "workday.com": "Workday",
  "smartrecruiters.com": "SmartRecruiters",
  "jobvite.com": "Jobvite",
  "icims.com": "iCIMS",
  "taleo.net": "Taleo",
  "breezy.hr": "Breezy",
  "ashbyhq.com": "Ashby",
}

export function getBoardName(domain: string): string {
  const clean = domain.replace(/^www\./, "")
  for (const [key, name] of Object.entries(KNOWN_BOARDS)) {
    if (clean === key || clean.endsWith(`.${key}`)) return name
  }
  // Fallback: capitalize the second-level domain (e.g. "jobs.stripe.com" → "Stripe")
  const parts = clean.split(".")
  const sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
  return sld.charAt(0).toUpperCase() + sld.slice(1)
}

export interface FieldMapping {
  field: FieldType
  selector: string
}

export interface SiteConfig {
  id: string
  domain: string
  name: string
  mappings: FieldMapping[]
  createdAt: string
}

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn"

export const STATUS_CONFIG: Record<
  ApplicationStatus,
  {
    label: string
    color: "neutral" | "primary" | "violet" | "amber" | "green" | "red"
  }
> = {
  saved: { label: "Saved", color: "neutral" },
  applied: { label: "Applied", color: "primary" },
  screening: { label: "Screening", color: "violet" },
  interview: { label: "Interview", color: "amber" },
  offer: { label: "Offer", color: "green" },
  rejected: { label: "Rejected", color: "red" },
  withdrawn: { label: "Withdrawn", color: "neutral" },
}

export const STATUS_ORDER: ApplicationStatus[] = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
]

export interface TailoredResume {
  summary: string
  work: { id: string; highlights: string[] }[]
  skills?: { id: string; items: string[] }[]
  generatedAt: string
}

export interface Application {
  id: string
  siteConfigId: string
  domain: string
  jobBoard?: string
  url: string
  jobTitle: string
  company: string
  location?: string
  salary?: string
  description?: string
  status: ApplicationStatus
  dateAdded: string
  dateApplied?: string
  notes?: string
  resumeFileName?: string
  tailoredResume?: TailoredResume
}
