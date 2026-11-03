import { describe, expect, it } from "vitest"
import { diffLines, diffSet, resolveReviewedLines } from "src/utils/diff"

describe("diffLines", () => {
  it("marks kept, removed and added lines in order", () => {
    expect(diffLines(["a", "b", "c"], ["a", "x", "c"])).toEqual([
      { type: "unchanged", value: "a" },
      { type: "removed", value: "b" },
      { type: "added", value: "x" },
      { type: "unchanged", value: "c" },
    ])
  })

  it("handles empty sides", () => {
    expect(diffLines([], ["a"])).toEqual([{ type: "added", value: "a" }])
    expect(diffLines(["a"], [])).toEqual([{ type: "removed", value: "a" }])
  })
})

describe("diffSet", () => {
  it("treats a reorder as unchanged, not remove+add", () => {
    expect(diffSet(["Vue", "TS"], ["TS", "Vue"])).toEqual([
      { type: "unchanged", value: "TS" },
      { type: "unchanged", value: "Vue" },
    ])
  })

  it("lists new items in new order, then dropped items", () => {
    expect(diffSet(["Vue", "jQuery"], ["Pinia", "Vue"])).toEqual([
      { type: "added", value: "Pinia" },
      { type: "unchanged", value: "Vue" },
      { type: "removed", value: "jQuery" },
    ])
  })
})

describe("resolveReviewedLines", () => {
  const ops = diffLines(["keep", "old"], ["keep", "new"])

  it("keeps the original when nothing is accepted", () => {
    expect(resolveReviewedLines(ops, [], [])).toEqual(["keep", "old"])
  })

  it("applies accepted adds and removes", () => {
    expect(resolveReviewedLines(ops, ["new"], ["old"])).toEqual(["keep", "new"])
  })

  it("uses the edited text for an accepted add", () => {
    expect(resolveReviewedLines(ops, ["new"], ["old"], { new: "edited" })).toEqual([
      "keep",
      "edited",
    ])
  })
})
