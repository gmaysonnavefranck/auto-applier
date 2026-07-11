// Deliberately excludes "aa-claude-key" — no reason to put a live API key
// into a file that might get shared/uploaded somewhere for help.
const BACKUP_KEYS = [
  "aa-sites",
  "aa-applications",
  "aa-resume",
  "aa-job-boards",
] as const

export interface BackupFile {
  version: 1
  exportedAt: string
  data: Partial<Record<(typeof BACKUP_KEYS)[number], unknown>>
}

export async function exportBackup(): Promise<void> {
  const stored = await chrome.storage.local.get([...BACKUP_KEYS])

  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: stored,
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `auto-applier-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<void> {
  const text = await file.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Not a valid JSON file.")
  }

  const data = (parsed as Partial<BackupFile>)?.data
  if (!data || typeof data !== "object") {
    throw new Error("This doesn't look like an Auto Applier backup file.")
  }

  const toRestore: Record<string, unknown> = {}
  for (const key of BACKUP_KEYS) {
    if (key in data) toRestore[key] = (data as Record<string, unknown>)[key]
  }

  if (Object.keys(toRestore).length === 0) {
    throw new Error("Backup file has no recognizable data.")
  }

  await chrome.storage.local.set(toRestore)
}
