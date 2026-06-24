import { unifiedDiff, diffText, diffLines } from "../src/unifiedDiff.js";

const A = ["one\n", "two\n", "three\n", "four\n", "five\n"];
const B = ["one\n", "two\n", "THREE\n", "four\n", "five\n"];

describe("unifiedDiff()", () => {
  it("identical sequences → empty output", () => {
    expect(unifiedDiff(A, A)).toHaveLength(0);
  });

  it("outputs --- and +++ headers", () => {
    const lines = unifiedDiff(A, B);
    expect(lines[0]).toMatch(/^--- /);
    expect(lines[1]).toMatch(/^\+\+\+ /);
  });

  it("outputs @@ hunk header", () => {
    const lines = unifiedDiff(A, B);
    const hunk = lines.find((l) => l.startsWith("@@"));
    expect(hunk).toBeDefined();
  });

  it("marks deleted lines with -", () => {
    const lines = unifiedDiff(A, B);
    const deleted = lines.filter((l) => l.startsWith("-") && !l.startsWith("---"));
    expect(deleted.length).toBeGreaterThan(0);
    expect(deleted[0]).toContain("three");
  });

  it("marks added lines with +", () => {
    const lines = unifiedDiff(A, B);
    const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++"));
    expect(added.length).toBeGreaterThan(0);
    expect(added[0]).toContain("THREE");
  });

  it("context lines start with space", () => {
    const lines = unifiedDiff(A, B);
    const context = lines.filter((l) => l.startsWith(" "));
    expect(context.length).toBeGreaterThan(0);
  });

  it("respects custom fromFile/toFile", () => {
    const lines = unifiedDiff(A, B, { fromFile: "old.txt", toFile: "new.txt" });
    expect(lines[0]).toBe("--- old.txt\n");
    expect(lines[1]).toBe("+++ new.txt\n");
  });

  it("context=0 produces no context lines", () => {
    const lines = unifiedDiff(A, B, { context: 0 });
    const context = lines.filter((l) => l.startsWith(" "));
    expect(context).toHaveLength(0);
  });

  it("large equal block is collapsed with context=1", () => {
    const large = Array.from({ length: 20 }, (_, i) => `line${i}\n`);
    const changed = [...large];
    changed[10] = "CHANGED\n";
    const lines = unifiedDiff(large, changed, { context: 1 });
    // Should have exactly one hunk with 3 lines: context + changed + context
    const hunks = lines.filter((l) => l.startsWith("@@"));
    expect(hunks).toHaveLength(1);
  });

  it("handles insert-only changes", () => {
    const lines = unifiedDiff(["a\n"], ["a\n", "b\n"]);
    const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++"));
    expect(added).toHaveLength(1);
    expect(added[0]).toContain("b");
  });

  it("handles delete-only changes", () => {
    const lines = unifiedDiff(["a\n", "b\n"], ["a\n"]);
    const deleted = lines.filter((l) => l.startsWith("-") && !l.startsWith("---"));
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toContain("b");
  });
});

describe("diffText()", () => {
  it("returns empty string for identical text", () => {
    expect(diffText("hello\nworld", "hello\nworld")).toBe("");
  });

  it("returns non-empty for changed text", () => {
    const result = diffText("hello\nworld", "hello\nearth");
    expect(result).toBeTruthy();
    expect(result).toContain("world");
    expect(result).toContain("earth");
  });
});

describe("diffLines()", () => {
  it("identical → all equal blocks", () => {
    const result = diffLines(["a", "b", "c"], ["a", "b", "c"]);
    expect(result.every((d) => d.type === "equal")).toBe(true);
  });

  it("delete produces delete block", () => {
    const result = diffLines(["a", "b", "c"], ["a", "c"]);
    const deletes = result.filter((d) => d.type === "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].aLines).toEqual(["b"]);
  });

  it("insert produces insert block", () => {
    const result = diffLines(["a", "c"], ["a", "b", "c"]);
    const inserts = result.filter((d) => d.type === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].bLines).toEqual(["b"]);
  });

  it("replace produces replace block", () => {
    const result = diffLines(["a", "b", "c"], ["a", "X", "c"]);
    const replaces = result.filter((d) => d.type === "replace");
    expect(replaces).toHaveLength(1);
    expect(replaces[0].aLines).toEqual(["b"]);
    expect(replaces[0].bLines).toEqual(["X"]);
  });

  it("aLines/bLines are empty for non-relevant side", () => {
    const result = diffLines(["a", "b"], ["a", "b", "c"]);
    const inserts = result.filter((d) => d.type === "insert");
    expect(inserts[0].aLines).toEqual([]);
  });

  it("coverage: all a lines accounted for", () => {
    const a = ["one", "two", "three"];
    const b = ["one", "TWO", "three", "four"];
    const result = diffLines(a, b);
    const aAll = result.flatMap((d) => d.aLines);
    expect(aAll.sort()).toEqual([...a].sort());
  });
});
