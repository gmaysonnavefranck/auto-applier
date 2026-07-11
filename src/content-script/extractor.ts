import type { FieldMapping } from '../types/jobs'

export interface ExtractedJob {
  url: string
  jobTitle?: string
  company?: string
  location?: string
  salary?: string
  description?: string
  source: 'json-ld' | 'selectors' | 'meta'
}

/**
 * Try to extract job data from JSON-LD structured data first.
 * Most major job boards (LinkedIn, Indeed, Glassdoor, Greenhouse, etc.)
 * inject a JobPosting schema for SEO — this is far more stable than CSS selectors.
 */
export function extractFromJsonLd(): Partial<ExtractedJob> | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  console.log('[AutoApplier] JSON-LD scripts found:', scripts.length)

  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent ?? '')
      const posting = findJobPosting(data)
      console.log('[AutoApplier] JSON-LD script:', data)
      if (!posting) { console.log('[AutoApplier] → no JobPosting in this script'); continue }
      console.log('[AutoApplier] → JobPosting:', posting)

      return {
        jobTitle: posting.title ?? posting.name,
        company:
          posting.hiringOrganization?.name ??
          posting.employer?.name,
        location:
          formatLocation(posting.jobLocation) ??
          posting.jobLocationType,
        salary: formatSalary(posting.baseSalary ?? posting.estimatedSalary),
        description: posting.description
          ? stripHtml(posting.description).slice(0, 5000)
          : undefined,
        source: 'json-ld',
      }
    } catch {
      /* malformed JSON, skip */
    }
  }

  return null
}

/**
 * Extract from Open Graph / meta tags — LinkedIn and others set these.
 * LinkedIn formats og:title as "Job Title | Company | LinkedIn", so we parse
 * the parts out of the pipe-separated string.
 */
export function extractFromMeta(): Partial<ExtractedJob> {
  const get = (name: string) =>
    (
      document.querySelector(`meta[property="${name}"]`) ??
      document.querySelector(`meta[name="${name}"]`)
    )?.getAttribute('content') ?? undefined

  const rawTitle = get('og:title') ?? get('title') ?? document.title ?? ''

  // Many job sites format the title as "Role | Company | Site" or "Role - Company"
  const knownSiteNames = /^(linkedin|indeed|glassdoor|monster|ziprecruiter|workday|lever|greenhouse|wellfound|angellist)$/i
  const parts = rawTitle.split(/\s*[|–-]\s*/).map(p => p.trim()).filter(Boolean)

  const jobTitle = parts[0] ?? rawTitle
  // Second segment is company only if it doesn't look like the site's own name
  const company = parts.length >= 2 && !knownSiteNames.test(parts[1])
    ? parts[1]
    : undefined

  return {
    jobTitle,
    company,
    description: get('og:description') ?? get('description'),
    source: 'meta',
  }
}

/**
 * Read whatever a CSS selector currently matches on the page. This is the
 * single source of truth for "what does this selector extract" — used both
 * by the register-site preview and by the real save-job extraction below,
 * so they can never drift apart.
 */
export function readSelector(selector: string): { count: number; text?: string } {
  const els = document.querySelectorAll(selector)
  return { count: els.length, text: els[0]?.textContent?.trim() || undefined }
}

/**
 * Extract using saved CSS selectors (user-configured per site).
 */
export function extractFromSelectors(
  mappings: FieldMapping[],
): Partial<ExtractedJob> {
  const result: Partial<ExtractedJob> = { source: 'selectors' }

  for (const { field, selector } of mappings) {
    try {
      const { count, text } = readSelector(selector)
      console.log(`[AutoApplier] selector [${field}] "${selector}" →`, count ? `found, text="${text}"` : 'NOT FOUND')
      if (text) (result as Record<string, string>)[field] = text
    } catch (err) {
      console.log(`[AutoApplier] selector [${field}] "${selector}" → INVALID SELECTOR`, err)
    }
  }

  return result
}

/**
 * Main extraction. Two independent paths:
 *  - Registered site (mappings configured): use ONLY the saved selectors,
 *    field for field. No JSON-LD, no meta, no heuristics mixed in — what
 *    you picked is what you get.
 *  - No selectors configured (unregistered site / "Auto" detect): fall back
 *    to JSON-LD, then a DOM heading/description guess, then meta tags.
 */
export function extractJob(mappings: FieldMapping[]): ExtractedJob {
  const url = window.location.href

  if (mappings.length > 0) {
    const fromSelectors = extractFromSelectors(mappings)
    return { url, ...fromSelectors, source: 'selectors' }
  }

  const jsonLd = extractFromJsonLd()
  if (jsonLd?.jobTitle) {
    return { url, ...jsonLd, description: jsonLd.description ?? extractDescriptionFromDom() } as ExtractedJob
  }

  const domTitle = extractTitleFromDom()
  if (domTitle) {
    return { url, jobTitle: domTitle, description: extractDescriptionFromDom(), source: 'selectors' }
  }

  const meta = extractFromMeta()
  return { url, ...meta, description: meta.description ?? extractDescriptionFromDom() } as ExtractedJob
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Heuristic DOM search for a job description block.
 * Three-pass strategy: stable selectors → heading proximity → largest text block.
 */
function extractDescriptionFromDom(): string | undefined {
  // Pass 1: stable IDs, data-attrs, and known class names across major boards
  const stableSelectors = [
    '#job-description',                          // LinkedIn (old), Lever
    '#jobDescriptionText',                       // Indeed
    '[data-automation="jobAdDetails"]',          // Seek
    '[data-testid="job-description"]',
    '[data-testid="jobDescriptionText"]',
    '[data-test="description"]',                 // Glassdoor
    '[data-qa="job-description"]',               // Lever
    '.jobsearch-jobDescriptionText',             // Indeed
    // LinkedIn — current selectors (2024-2025)
    '.jobs-description__content',
    '.jobs-description-content__text',
    '.jobs-box__html-content',
    '.jobs-description__details',
    '[class*="jobs-description__content"]',
    '[class*="jobs-box__html-content"]',
    // LinkedIn unified job card (search results panel)
    '.jobs-unified-top-card ~ div .jobs-description',
    '[class*="job-view-layout"] [class*="description"]',
    // Older LinkedIn
    '.description__text--rich',
    // Generic
    '.job-description',
    '.jobDescription',
    '[id*="job-description"]',
    '[id*="jobDescription"]',
    '[class*="jobDescription"]',
  ]

  for (const sel of stableSelectors) {
    try {
      const el = document.querySelector(sel)
      if (!el) continue
      const text = getText(el)
      if (text.length > 100) return text.slice(0, 5000)
    } catch { /* invalid selector */ }
  }

  // Pass 2: look for a heading that labels the description, then take the
  // following sibling/parent-sibling container (works on LinkedIn "About the job")
  const headingPhrases = ['about the job', 'job description', 'about this role', 'about the role', 'the role', 'position overview', 'what you', 'responsibilities', 'about this position', 'what we']
  for (const h of Array.from(document.querySelectorAll('h1,h2,h3,h4'))) {
    const label = h.textContent?.toLowerCase().trim() ?? ''
    if (!headingPhrases.some(p => label.startsWith(p))) continue
    const container =
      h.nextElementSibling ??
      h.parentElement?.nextElementSibling ??
      h.closest('section, article, div[class]')?.querySelector('div, p')
    if (!container) continue
    const text = getText(container)
    if (text.length > 100) return text.slice(0, 5000)
  }

  // Pass 3: ARIA labels — LinkedIn uses aria-label="Job description" on the section
  const ariaSelectors = [
    '[aria-label="Job description"]',
    '[aria-label="job description"]',
    '[aria-label*="About the job" i]',
    '[aria-label*="Job details" i]',
    '[aria-label*="job description" i]',
    '[aria-label*="about this role" i]',
    '[aria-labelledby*="description" i]',
  ]

  for (const sel of ariaSelectors) {
    try {
      const el = document.querySelector(sel)
      if (!el) continue
      const text = getText(el)
      if (text.length > 100) return text.slice(0, 5000)
    } catch { /* invalid selector */ }
  }

  // Pass 4: largest text-dense block not inside navigation/sidebar
  return findLargestTextBlock()
}

function getText(el: Element): string {
  const clone = el.cloneNode(true) as Element
  // Remove interactive elements whose text pollutes the description
  clone.querySelectorAll('button, [role="button"], a').forEach(b => b.remove())
  // Insert newlines before block elements so paragraph/bullet structure is preserved
  clone.querySelectorAll('p, div, br, li, h1, h2, h3, h4, h5, h6').forEach(b => b.before('\n'))
  return (clone.textContent ?? '')
    .replace(/[^\S\n]+/g, ' ')   // collapse horizontal whitespace, keep newlines
    .replace(/\n{3,}/g, '\n\n')  // max two consecutive blank lines
    .trim()
}

function findLargestTextBlock(): string | undefined {
  let best = ''

  // Search within main content areas
  const scope = document.querySelector('main, [role="main"], #main, .main, body') ?? document.body
  const blocks = scope.querySelectorAll('article, section, div')

  for (const el of Array.from(blocks)) {
    // Skip navigation / header / footer / sidebar
    if (el.closest('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"]')) continue
    // Skip obvious UI containers (many children = structural, not content)
    if (el.children.length > 15) continue

    const text = getText(el)
    // Must be a meaningful chunk and shorter than a full-page dump
    if (text.length > best.length && text.length > 300 && text.length < 15000) {
      best = text
    }
  }

  return best.length > 300 ? best.slice(0, 5000) : undefined
}

/**
 * Fallback: find the first prominent heading in the main content area.
 * On SPA job boards (LinkedIn search results, etc.) JSON-LD is absent and
 * og:title reflects the page/search state, not the specific job. The real
 * job title is usually an h1 or h2 inside the content panel.
 */
function extractTitleFromDom(): string | undefined {
  const scope = document.querySelector('main, [role="main"], #main') ?? document.body
  for (const tag of ['h1', 'h2'] as const) {
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>(tag))) {
      if (el.closest('nav, header, footer, aside, [role="navigation"], [role="banner"]')) continue
      const text = el.textContent?.trim()
      // Job titles are typically 3-100 chars; skip search/section headings that are too long or generic
      if (text && text.length >= 3 && text.length <= 100) return text
    }
  }
  return undefined
}

function findJobPosting(data: unknown): Record<string, any> | null {
  if (!data || typeof data !== 'object') return null

  const obj = data as Record<string, any>

  if (obj['@type'] === 'JobPosting') return obj

  // @graph array
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const found = findJobPosting(item)
      if (found) return found
    }
  }

  // Wrapped in another object
  for (const val of Object.values(obj)) {
    if (typeof val === 'object') {
      const found = findJobPosting(val)
      if (found) return found
    }
  }

  return null
}

function formatLocation(jobLocation: unknown): string | undefined {
  if (!jobLocation) return undefined
  if (typeof jobLocation === 'string') return jobLocation

  const loc = (Array.isArray(jobLocation) ? jobLocation[0] : jobLocation) as Record<string, any>
  const addr = loc?.address
  if (!addr) return undefined

  const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
    .filter(Boolean)
  return parts.join(', ') || undefined
}

function formatSalary(salary: unknown): string | undefined {
  if (!salary || typeof salary !== 'object') return undefined
  const s = salary as Record<string, any>
  const value = s.value

  if (!value) return undefined
  if (typeof value === 'number') return `${s.currency ?? ''} ${value}`.trim()

  if (typeof value === 'object') {
    const { minValue, maxValue, unitText } = value as Record<string, any>
    if (minValue && maxValue) {
      return `${s.currency ?? ''} ${minValue}–${maxValue} ${unitText ?? ''}`.trim()
    }
  }

  return undefined
}

function stripHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    // Insert newlines before block elements so paragraphs/bullets survive as line breaks
    doc.querySelectorAll('p, div, br, li, h1, h2, h3, h4, h5, h6').forEach(el => el.before('\n'))
    return (doc.body.textContent ?? '')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  } catch {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}
