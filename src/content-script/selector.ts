// IDs with 3+ digit runs are almost always dynamic (job IDs, ember IDs, etc.)
function idLooksDynamic(value: string): boolean {
  return /\d{3,}/.test(value) || /^[a-z0-9]{12,}$/i.test(value)
}

// Data attribute VALUES that look like they contain job-specific data
function valueLooksDynamic(value: string): boolean {
  return (
    /\d{4,}/.test(value) ||          // long digit run → job ID
    /^[a-z0-9]{12,}$/i.test(value) || // random hash
    /urn:|uuid|token/i.test(value)    // URNs, UUIDs, tokens
  )
}

// Classes that are clearly auto-generated (CSS-in-JS hashes, utility with big numbers, etc.)
function classLooksDynamic(cls: string): boolean {
  return (
    /\d{5,}/.test(cls) ||             // 5+ consecutive digits
    /^[a-zA-Z0-9]{12,}$/.test(cls) || // pure hash (lower, upper, or mixed-case CSS-in-JS)
    /^(css-|sc-|_\w{4,})/.test(cls) ||  // CSS-in-JS prefixes
    looksLikeStateFlag(cls)          // transient interaction state, not identity
  )
}

// Attribute names / class names that flag transient UI state (focus, hover, open, etc.)
// rather than stable content identity — only true while the user is mid-interaction,
// so they're unique at pick time but match nothing (or the wrong element) later.
function looksLikeStateFlag(name: string): boolean {
  return /(^|[-_])(is|has)?[-_]?(focus(ed)?|hover(ed)?|active|press(ed)?|select(ed)?|current|expand(ed)?|open|editing|dragging|checked|highlight(ed)?)($|[-_])/i.test(name)
}

function stableClasses(el: Element): string[] {
  return Array.from(el.classList).filter(
    c => !classLooksDynamic(c) && c.length < 60,
  )
}

/**
 * Generate a CSS selector for `el` that works across all job listings on the
 * same site, not just the current page instance.
 *
 * Priority (most stable first):
 *   1. Stable class combination
 *   2. tag + stable classes
 *   3. Non-numeric id
 *   4. data-* attribute with a non-dynamic value
 *   5. Structural path (nth-of-type fallback)
 */
export function getStableSelector(el: Element): string {
  // 1 & 2 — class names are the most stable identifiers on job boards
  const cls = stableClasses(el)
  for (let n = 1; n <= cls.length; n++) {
    const classSel = cls.slice(0, n).map(c => `.${CSS.escape(c)}`).join('')
    try {
      if (document.querySelectorAll(classSel).length === 1) return classSel
      const tagSel = `${el.tagName.toLowerCase()}${classSel}`
      if (document.querySelectorAll(tagSel).length === 1) return tagSel
    } catch {
      /* skip invalid */
    }
  }

  // 3 — stable id (no digits that look like job/entity IDs)
  if (el.id && !idLooksDynamic(el.id)) {
    return `#${CSS.escape(el.id)}`
  }

  // 4 — data-* attribute whose value looks stable (non-numeric label/slug)
  for (const { name, value } of Array.from(el.attributes)) {
    if (name.startsWith('data-') && value && !valueLooksDynamic(value) && !looksLikeStateFlag(name)) {
      const sel = `[${name}="${CSS.escape(value)}"]`
      try {
        if (document.querySelectorAll(sel).length === 1) return sel
      } catch {
        /* skip invalid */
      }
    }
  }

  // 5 — structural path as last resort
  return buildPath(el)
}

function buildPath(el: Element, maxDepth = 6): string {
  const parts: string[] = []
  let node: Element | null = el
  let depth = 0

  while (node && node !== document.body && depth < maxDepth) {
    let part = node.tagName.toLowerCase()

    // Anchor to a stable id if we find one on an ancestor
    if (node.id && !idLooksDynamic(node.id)) {
      parts.unshift(`#${CSS.escape(node.id)}`)
      break
    }

    const cls = stableClasses(node)
    if (cls.length > 0) {
      part += cls.slice(0, 2).map(c => `.${CSS.escape(c)}`).join('')
    }

    // Add nth-of-type only when siblings of the same tag exist
    const parent = node.parentElement
    if (parent) {
      const sameTags = Array.from(parent.children).filter(
        c => c.tagName === node!.tagName,
      )
      if (sameTags.length > 1) {
        part += `:nth-of-type(${sameTags.indexOf(node) + 1})`
      }
    }

    parts.unshift(part)
    node = node.parentElement
    depth++
  }

  return parts.join(' > ')
}
