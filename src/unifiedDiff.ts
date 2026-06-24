import { SequenceMatcher, Opcode } from "./SequenceMatcher.js";

export interface UnifiedDiffOptions {
  /** Label for the "from" file. Default: "a". */
  fromFile?: string;
  /** Label for the "to" file. Default: "b". */
  toFile?: string;
  /** Lines of context around each change. Default: 3. */
  context?: number;
  /** Line ending. Default: "\n". */
  lineTerminator?: string;
}

/**
 * Compare two sequences of strings (lines) and produce a unified diff.
 * Returns an array of diff lines including headers.
 */
export function unifiedDiff(
  a: string[],
  b: string[],
  opts: UnifiedDiffOptions = {},
): string[] {
  const {
    fromFile = "a",
    toFile = "b",
    context = 3,
    lineTerminator = "\n",
  } = opts;

  const sm = new SequenceMatcher(a, b);
  const groups = groupOpcodes(sm.getOpcodes(), context);

  if (groups.length === 0) return [];

  const out: string[] = [
    `--- ${fromFile}${lineTerminator}`,
    `+++ ${toFile}${lineTerminator}`,
  ];

  for (const group of groups) {
    const first = group[0];
    const last = group[group.length - 1];
    const i1 = first.i1, i2 = last.i2;
    const j1 = first.j1, j2 = last.j2;

    const fromRange = rangeStr(i1, i2);
    const toRange = rangeStr(j1, j2);
    out.push(`@@ -${fromRange} +${toRange} @@${lineTerminator}`);

    for (const op of group) {
      if (op.tag === "equal") {
        for (let i = op.i1; i < op.i2; i++) out.push(` ${a[i]}`);
      } else if (op.tag === "replace") {
        for (let i = op.i1; i < op.i2; i++) out.push(`-${a[i]}`);
        for (let j = op.j1; j < op.j2; j++) out.push(`+${b[j]}`);
      } else if (op.tag === "delete") {
        for (let i = op.i1; i < op.i2; i++) out.push(`-${a[i]}`);
      } else if (op.tag === "insert") {
        for (let j = op.j1; j < op.j2; j++) out.push(`+${b[j]}`);
      }
    }
  }

  return out;
}

function rangeStr(start: number, end: number): string {
  const length = end - start;
  if (length === 1) return String(start + 1);
  return `${start + 1},${length}`;
}

function groupOpcodes(opcodes: Opcode[], context: number): Opcode[][] {
  if (opcodes.length === 0) return [];

  // Pre-trim leading and trailing equal blocks (like Python's get_grouped_opcodes)
  const codes = opcodes.map((op) => ({ ...op }));
  if (codes[0].tag === "equal" && codes[0].i2 - codes[0].i1 > context) {
    const op = codes[0];
    const trim = op.i2 - context;
    const jtrim = op.j2 - context;
    codes[0] = { ...op, i1: Math.max(op.i1, trim), j1: Math.max(op.j1, jtrim) };
  }
  if (codes[codes.length - 1].tag === "equal") {
    const op = codes[codes.length - 1];
    if (op.i2 - op.i1 > context) {
      codes[codes.length - 1] = { ...op, i2: Math.min(op.i2, op.i1 + context), j2: Math.min(op.j2, op.j1 + context) };
    }
  }

  const groups: Opcode[][] = [];
  let group: Opcode[] = [];

  for (const op of codes) {
    if (op.tag === "equal" && op.i2 - op.i1 > 2 * context) {
      // Append leading context of this gap, flush current group
      group.push({ ...op, i2: op.i1 + context, j2: op.j1 + context });
      groups.push(group);
      group = [];
      // Start new group with trailing context of this gap
      group.push({ ...op, i1: op.i2 - context, j1: op.j2 - context });
      continue;
    }
    group.push(op);
  }
  if (group.length > 0 && !(group.length === 1 && group[0].tag === "equal")) {
    groups.push(group);
  }
  return groups;
}

/** Compare two strings line-by-line. Alias for unifiedDiff with splitLines. */
export function diffText(a: string, b: string, opts?: UnifiedDiffOptions): string {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  return unifiedDiff(aLines, bLines, opts).join("\n");
}

export interface LineDiff {
  type: "equal" | "delete" | "insert" | "replace";
  /** Lines from a (present for delete/equal/replace). */
  aLines: string[];
  /** Lines from b (present for insert/equal/replace). */
  bLines: string[];
}

/**
 * Produce a structured line-by-line diff.
 * Useful for building diff UIs without parsing the unified format.
 */
export function diffLines(a: string[], b: string[]): LineDiff[] {
  const sm = new SequenceMatcher(a, b);
  return sm.getOpcodes().map((op) => ({
    type: op.tag,
    aLines: a.slice(op.i1, op.i2),
    bLines: b.slice(op.j1, op.j2),
  }));
}
