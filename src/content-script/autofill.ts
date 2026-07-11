// Must be a plain module-level function so chrome.scripting can serialize it
export function autofillFrame(data: Record<string, string>): number {
  const FIELD_MAP = [
    { key: "firstName", pattern: /first.?name|fname|forename|given.?name/i },
    { key: "lastName", pattern: /last.?name|lname|surname|family.?name/i },
    { key: "name", pattern: /^(full.?name|your.?name|name)$/i },
    { key: "email", pattern: /e.?mail/i },
    { key: "phone", pattern: /phone|mobile|tel(?:ephone)?|cell/i },
    { key: "linkedin", pattern: /linked.?in/i },
    { key: "github", pattern: /github/i },
    { key: "website", pattern: /website|portfolio|personal.?url|site/i },
    {
      key: "location",
      pattern: /location|city|address|country|region|state|province/i,
    },
    { key: "title", pattern: /job.?title|current.?title|position|role|headline/i },
  ]
  const locationPattern = FIELD_MAP.find((f) => f.key === "location")!.pattern

  const nameParts = (data.name ?? "").trim().split(/\s+/)
  const payload: Record<string, string> = {
    ...data,
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" "),
  }

  function getAttrs(
    el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ): string {
    const parts = [
      el.name,
      el.id,
      (el as HTMLInputElement).placeholder ?? "",
      el.getAttribute("aria-label") ?? "",
    ]
    if (el.id) {
      const label = document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`)
      if (label) parts.push(label.innerText)
    }
    const wrapping = el.closest("label")
    if (wrapping) parts.push((wrapping as HTMLElement).innerText)
    return parts.filter(Boolean).join(" ")
  }

  function setNativeValue(
    el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    value: string,
  ) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
    if (setter) setter.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }

  // Briefly outline a field so the user can see at a glance what got filled.
  function flashFilled(el: HTMLElement) {
    const prevOutline = el.style.outline
    const prevBg = el.style.backgroundColor
    const prevTransition = el.style.transition
    el.style.transition = "outline-color 0.3s ease, background-color 0.3s ease"
    el.style.outline = "2px solid #2563eb"
    el.style.backgroundColor = "rgba(37, 99, 235, 0.08)"
    setTimeout(() => {
      el.style.outline = prevOutline
      el.style.backgroundColor = prevBg
      setTimeout(() => {
        el.style.transition = prevTransition
      }, 300)
    }, 1200)
  }

  // Best-effort option match for <select> fields — only attempted for
  // location-like fields, since "country/state/city name" is the one shape
  // of resume data that realistically lines up with dropdown option text.
  // ponytail: exact case-insensitive text match only, no fuzzy/partial
  // matching — good enough for common "Country"/"State" selects, upgrade to
  // fuzzy matching if real-world forms need it.
  function matchSelectOption(el: HTMLSelectElement, rawValue: string): string | null {
    const tokens = rawValue
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length) // longer/more specific tokens first

    for (const token of tokens) {
      const match = Array.from(el.options).find(
        (o) => o.textContent?.trim().toLowerCase() === token.toLowerCase(),
      )
      if (match) return match.value
    }
    return null
  }

  const fillable = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    ),
  ).filter((el) => {
    if ((el as HTMLInputElement).type === "hidden") return false
    if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  })

  let filled = 0
  for (const el of fillable) {
    if (el instanceof HTMLSelectElement) {
      // selectedIndex 0 is almost always the "Select..." placeholder option
      if (el.selectedIndex > 0) continue
      if (!locationPattern.test(getAttrs(el))) continue

      const optionValue = matchSelectOption(el, payload.location ?? "")
      if (optionValue !== null) {
        setNativeValue(el, optionValue)
        flashFilled(el)
        filled++
      }
      continue
    }

    if (el.value) continue
    const attrs = getAttrs(el)
    for (const { key, pattern } of FIELD_MAP) {
      if (pattern.test(attrs) && payload[key]) {
        setNativeValue(el, payload[key])
        flashFilled(el)
        filled++
        break
      }
    }
  }
  return filled
}
