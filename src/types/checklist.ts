export interface JobBoard {
  id: string
  name: string
  url: string
  lastVisited?: string
}

export function emptyJobBoard(): JobBoard {
  return { id: crypto.randomUUID(), name: "", url: "" }
}
