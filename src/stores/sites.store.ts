import { computed } from "vue"
import { defineStore } from "pinia"
import type { SiteConfig } from "src/types/jobs"
import { FIELD_CONFIG } from "src/types/jobs"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"

export const useSitesStore = defineStore("sites", () => {
  const { data: rawSites } = useBrowserLocalStorage<SiteConfig[]>("aa-sites", [])

  // Drop mappings for field types no longer defined (e.g. sites registered
  // before a FieldType was removed) so stale storage can't crash consumers.
  const sites = computed(() =>
    rawSites.value.map((s) => ({
      ...s,
      mappings: s.mappings.filter((m) => m.field in FIELD_CONFIG),
    })),
  )

  function addSite(site: SiteConfig) {
    rawSites.value = [site, ...rawSites.value]
  }

  function updateSite(id: string, updates: Partial<SiteConfig>) {
    rawSites.value = rawSites.value.map((s) =>
      s.id === id ? { ...s, ...updates } : s,
    )
  }

  function removeSite(id: string) {
    rawSites.value = rawSites.value.filter((s) => s.id !== id)
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
