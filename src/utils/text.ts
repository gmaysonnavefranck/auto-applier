export function sanitizeForAts(text: string): string {
  return text
    .replace(/[‘’]/g, "'") // smart single quotes
    .replace(/[“”]/g, '"') // smart double quotes
    .replace(/[–—]/g, "-") // en-dash / em-dash
    .replace(/…/g, "...") // ellipsis
    .replace(/ /g, " ") // non-breaking space
    .replace(/[•●▪‣⁃·]/g, "-") // bullets / middle dots
    .replace(/®/g, "(R)")
    .replace(/™/g, "TM")
    .trim()
}
