export interface ResumeBasics {
  name: string
  email: string
  title?: string
  phone?: string
  location?: string
  summary?: string
  github?: string
  linkedin?: string
  website?: string
}

export interface ResumeWork {
  id: string
  company: string
  position: string
  companyDescription?: string
  location?: string
  startDate: string
  endDate?: string
  highlights: string[]
}

export interface ResumeEducation {
  id: string
  institution: string
  degree: string
  field?: string
  startDate: string
  endDate?: string
  gpa?: string
}

export interface ResumeSkillGroup {
  id: string
  category: string
  items: string[]
}

export interface ResumeLanguage {
  id: string
  name: string
  proficiency: string
}

export interface Resume {
  basics: ResumeBasics
  work: ResumeWork[]
  education: ResumeEducation[]
  skills: ResumeSkillGroup[]
  languages: ResumeLanguage[]
}

export const EMPTY_RESUME: Resume = {
  basics: {
    name: "",
    email: "",
    title: "",
    phone: "",
    location: "",
    summary: "",
    github: "",
    linkedin: "",
    website: "",
  },
  work: [],
  education: [],
  skills: [],
  languages: [],
}

export function emptyWork(): ResumeWork {
  return {
    id: crypto.randomUUID(),
    company: "",
    position: "",
    startDate: "",
    highlights: [],
  }
}

export function emptyEducation(): ResumeEducation {
  return { id: crypto.randomUUID(), institution: "", degree: "", startDate: "" }
}

export function emptySkillGroup(): ResumeSkillGroup {
  return { id: crypto.randomUUID(), category: "", items: [] }
}

export function emptyLanguage(): ResumeLanguage {
  return { id: crypto.randomUUID(), name: "", proficiency: "Fluent" }
}

export const PROFICIENCY_OPTIONS = [
  "Native",
  "Fluent",
  "Professional",
  "Conversational",
  "Basic",
]
