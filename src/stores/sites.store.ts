import { defineStore } from "pinia"
import type { SiteConfig } from "src/types/jobs"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"

export const useSitesStore = defineStore("sites", () => {
  const { data: sites } = useBrowserLocalStorage<SiteConfig[]>("aa-sites", [])

  function addSite(site: SiteConfig) {
    sites.value = [site, ...sites.value]
  }

  function updateSite(id: string, updates: Partial<SiteConfig>) {
    sites.value = sites.value.map((s) =>
      s.id === id ? { ...s, ...updates } : s,
    )
  }

  function removeSite(id: string) {
    sites.value = sites.value.filter((s) => s.id !== id)
  }

  function getSiteForDomain(hostname: string): SiteConfig | undefined {
    const clean = hostname.replace(/^www\./, "")
    return sites.value.find(
      (s) =>
        s.domain === hostname ||
        s.domain === clean ||
        hostname.endsWith(`.${s.domain}`),
    )
  }

  return { sites, addSite, updateSite, removeSite, getSiteForDomain }
})
