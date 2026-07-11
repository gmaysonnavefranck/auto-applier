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
    { key: "location", pattern: /location|city|address|country|region/i },
    { key: "title", pattern: /job.?title|current.?title|position|role|headline/i },
  ]

  const nameParts = (data.name ?? "").trim().split(/\s+/)
  const payload: Record<string, string> = {
    ...data,
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" "),
  }

  function getAttrs(el: HTMLInputElement | HTMLTextAreaElement): string {
    const parts = [el.name, el.id, el.placeholder, el.getAttribute("aria-label") ?? ""]
    if (el.id) {
      const label = document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`)
      if (label) parts.push(label.innerText)
    }
    const wrapping = el.closest("label")
    if (wrapping) parts.push((wrapping as HTMLElement).innerText)
    return parts.filter(Boolean).join(" ")
  }

  function setNative(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
    setter ? setter.call(el, value) : (el.value = value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }

  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"),
  ).filter((el) => {
    if ((el as HTMLInputElement).type === "hidden") return false
    if (el.disabled || (el as HTMLInputElement).readOnly) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  })

  let filled = 0
  for (const el of inputs) {
    if (el.value) continue
    const attrs = getAttrs(el)
    for (const { key, pattern } of FIELD_MAP) {
      if (pattern.test(attrs) && payload[key]) {
        setNative(el, payload[key])
        filled++
        break
      }
    }
  }
  return filled
}
