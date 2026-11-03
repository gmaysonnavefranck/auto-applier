export type DiffOp =
  | { type: "unchanged"; value: string }
  | { type: "added"; value: string }
  | { type: "removed"; value: string }

// LCS-based line diff (same idea as `git diff`), O(n*m) — fine for resume-sized lists.
export function diffLines(oldLines: string[], newLines: string[]): DiffOp[] {
  const oldLen = oldLines.length
  const newLen = newLines.length
  const lcsLength: number[][] = Array.from({ length: oldLen + 1 }, () =>
    new Array<number>(newLen + 1).fill(0),
  )
  for (let i = oldLen - 1; i >= 0; i--) {
    for (let j = newLen - 1; j >= 0; j--) {
      lcsLength[i][j] =
        oldLines[i] === newLines[j]
          ? lcsLength[i + 1][j + 1] + 1
          : Math.max(lcsLength[i + 1][j], lcsLength[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < oldLen && j < newLen) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: "unchanged", value: oldLines[i] })
      i++
      j++
    } else if (lcsLength[i + 1][j] >= lcsLength[i][j + 1]) {
      ops.push({ type: "removed", value: oldLines[i] })
      i++
    } else {
      ops.push({ type: "added", value: newLines[j] })
      j++
    }
  }
  while (i < oldLen) ops.push({ type: "removed", value: oldLines[i++] })
  while (j < newLen) ops.push({ type: "added", value: newLines[j++] })
  return ops
}

// Membership-based diff (order-independent) — for lists like skill tags where
// Claude is explicitly asked to reorder items, so a plain sequence diff (like
// diffLines) would misreport every reordered-but-identical item as a
// remove+add pair. Order in the result: newItems' order first (so an
// accepted reorder is preserved), then any dropped old items at the end.
export function diffSet(oldItems: string[], newItems: string[]): DiffOp[] {
  const oldSet = new Set(oldItems)
  const newSet = new Set(newItems)
  const ops: DiffOp[] = newItems.map((value) => ({
    type: oldSet.has(value) ? "unchanged" : "added",
    value,
  }))
  for (const value of oldItems) {
    if (!newSet.has(value)) ops.push({ type: "removed", value })
  }
  return ops
}

// Applies an accept/reject decision to a diff: unchanged lines always stay,
// removed lines stay unless their removal was accepted, added lines are
// included only if explicitly accepted — using the user's edited text in
// place of Claude's suggestion when one was saved for that line.
export function resolveReviewedLines(
  ops: DiffOp[],
  acceptedAdds: string[],
  acceptedRemoves: string[],
  edits?: Record<string, string>,
): string[] {
  const addSet = new Set(acceptedAdds)
  const removeSet = new Set(acceptedRemoves)
  const out: string[] = []
  for (const op of ops) {
    if (op.type === "unchanged") out.push(op.value)
    else if (op.type === "added" && addSet.has(op.value))
      out.push(edits?.[op.value] ?? op.value)
    else if (op.type === "removed" && !removeSet.has(op.value)) out.push(op.value)
  }
  return out
}
