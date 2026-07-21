import { pathToFileURL } from "node:url"

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

// ponytail: manual self-check (no test runner in this repo) — run with
// `node --experimental-strip-types src/utils/diff.ts`
// (uses pathToFileURL, not a plain string join, so it also works on Windows)
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const assertEqual = (actual: unknown, expected: unknown, label: string) => {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`)
    console.info(`ok - ${label}`)
  }

  assertEqual(diffLines([], []), [], "empty arrays")

  assertEqual(
    diffLines(["a", "b"], ["a", "b"]),
    [
      { type: "unchanged", value: "a" },
      { type: "unchanged", value: "b" },
    ],
    "identical arrays",
  )

  assertEqual(
    diffLines(["a", "b", "c"], ["a", "x", "c"]),
    [
      { type: "unchanged", value: "a" },
      { type: "removed", value: "b" },
      { type: "added", value: "x" },
      { type: "unchanged", value: "c" },
    ],
    "single replacement",
  )

  assertEqual(
    diffLines(["a"], ["a", "b"]),
    [
      { type: "unchanged", value: "a" },
      { type: "added", value: "b" },
    ],
    "pure addition",
  )

  assertEqual(
    diffLines(["a", "b"], ["a"]),
    [
      { type: "unchanged", value: "a" },
      { type: "removed", value: "b" },
    ],
    "pure removal",
  )

  console.info("diffLines self-check passed")
}
