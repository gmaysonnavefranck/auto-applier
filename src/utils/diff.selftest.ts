import { pathToFileURL } from "node:url"
import { diffLines } from "./diff"

// ponytail: manual self-check (no test runner in this repo) — run with
// `node --experimental-strip-types src/utils/diff.selftest.ts`
// (uses pathToFileURL, not a plain string join, so it also works on Windows)
// Kept out of diff.ts so that browser-bundled code never pulls in "node:url".
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
