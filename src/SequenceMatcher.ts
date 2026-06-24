export type Equalizer<T> = (a: T, b: T) => boolean;

export interface MatchBlock {
  /** Index in sequence a. */
  a: number;
  /** Index in sequence b. */
  b: number;
  /** Length of the matching block. */
  size: number;
}

export type OpTag = "replace" | "delete" | "insert" | "equal";

export interface Opcode {
  tag: OpTag;
  /** Start index in a. */
  i1: number;
  /** End index in a (exclusive). */
  i2: number;
  /** Start index in b. */
  j1: number;
  /** End index in b (exclusive). */
  j2: number;
}

/**
 * Generic sequence matcher — port of Python's difflib.SequenceMatcher.
 *
 * Works on arrays of any type T (strings, numbers, objects, lines of text).
 * Uses the Ratcliff/Obershelp algorithm to find the longest common subsequence.
 */
export class SequenceMatcher<T> {
  private _a: T[];
  private _b: T[];
  private _eq: Equalizer<T>;
  private _matchingBlocks: MatchBlock[] | null = null;
  private _opcodes: Opcode[] | null = null;

  constructor(a: T[], b: T[], equalizer?: Equalizer<T>) {
    this._a = a;
    this._b = b;
    this._eq = equalizer ?? ((x, y) => x === y);
  }

  /** Replace the sequences. Clears cached results. */
  setSequences(a: T[], b: T[]): void {
    this._a = a;
    this._b = b;
    this._matchingBlocks = null;
    this._opcodes = null;
  }

  /**
   * Find the longest matching block in a[alo:ahi] and b[blo:bhi].
   * Returns a MatchBlock with size=0 if no match.
   */
  findLongestMatch(alo: number, ahi: number, blo: number, bhi: number): MatchBlock {
    const a = this._a, b = this._b, eq = this._eq;
    let bestA = alo, bestB = blo, bestSize = 0;

    // j2len[j] = length of longest match ending at b[j] with the previous a element
    const j2len = new Map<number, number>();

    for (let i = alo; i < ahi; i++) {
      const newJ2len = new Map<number, number>();
      for (let j = blo; j < bhi; j++) {
        if (eq(a[i], b[j])) {
          const k = (j2len.get(j - 1) ?? 0) + 1;
          newJ2len.set(j, k);
          if (k > bestSize) {
            bestA = i - k + 1;
            bestB = j - k + 1;
            bestSize = k;
          }
        }
      }
      j2len.clear();
      for (const [k, v] of newJ2len) j2len.set(k, v);
    }

    return { a: bestA, b: bestB, size: bestSize };
  }

  /**
   * Return all non-overlapping matching blocks in a and b, in order.
   * The last element is always a sentinel: { a: a.length, b: b.length, size: 0 }.
   */
  getMatchingBlocks(): MatchBlock[] {
    if (this._matchingBlocks) return this._matchingBlocks;

    const a = this._a, b = this._b;
    const queue: [number, number, number, number][] = [[0, a.length, 0, b.length]];
    const matching: MatchBlock[] = [];

    while (queue.length > 0) {
      const [alo, ahi, blo, bhi] = queue.pop()!;
      const m = this.findLongestMatch(alo, ahi, blo, bhi);
      if (m.size > 0) {
        matching.push(m);
        if (alo < m.a && blo < m.b) queue.push([alo, m.a, blo, m.b]);
        if (m.a + m.size < ahi && m.b + m.size < bhi) {
          queue.push([m.a + m.size, ahi, m.b + m.size, bhi]);
        }
      }
    }

    // Sort by position in a (then b for stability)
    matching.sort((x, y) => x.a - y.a || x.b - y.b);

    // Coalesce adjacent blocks
    const coalesced: MatchBlock[] = [];
    let [ia, ib, isize] = [-1, -1, -1];
    for (const { a: ja, b: jb, size: jsize } of matching) {
      if (ia + isize === ja && ib + isize === jb) {
        isize += jsize;
      } else {
        if (isize > 0) coalesced.push({ a: ia, b: ib, size: isize });
        [ia, ib, isize] = [ja, jb, jsize];
      }
    }
    if (isize > 0) coalesced.push({ a: ia, b: ib, size: isize });
    coalesced.push({ a: a.length, b: b.length, size: 0 }); // sentinel

    this._matchingBlocks = coalesced;
    return this._matchingBlocks;
  }

  /**
   * Return a sequence of Opcode objects describing how to transform a into b.
   * Tags: "equal", "replace", "delete", "insert".
   */
  getOpcodes(): Opcode[] {
    if (this._opcodes) return this._opcodes;

    const opcodes: Opcode[] = [];
    let i = 0, j = 0;

    for (const { a: ai, b: bj, size: n } of this.getMatchingBlocks()) {
      let tag: OpTag | null = null;
      if (i < ai && j < bj) tag = "replace";
      else if (i < ai) tag = "delete";
      else if (j < bj) tag = "insert";
      if (tag) opcodes.push({ tag, i1: i, i2: ai, j1: j, j2: bj });
      i = ai + n;
      j = bj + n;
      if (n > 0) opcodes.push({ tag: "equal", i1: ai, i2: i, j1: bj, j2: j });
    }

    this._opcodes = opcodes;
    return this._opcodes;
  }

  /**
   * Similarity ratio in [0, 1]:  2 * matched / (|a| + |b|).
   * Returns 1.0 for identical sequences, 0.0 if either is empty.
   */
  ratio(): number {
    const la = this._a.length, lb = this._b.length;
    if (la + lb === 0) return 1.0;
    const matched = this.getMatchingBlocks()
      .slice(0, -1) // exclude sentinel
      .reduce((s, m) => s + m.size, 0);
    return (2 * matched) / (la + lb);
  }

  /**
   * Upper bound for ratio() — fast but may overestimate.
   * Does NOT recurse into matching blocks.
   */
  quickRatio(): number {
    const la = this._a.length, lb = this._b.length;
    if (la + lb === 0) return 1.0;
    // Union of element multisets; intersection size is an upper bound on matches
    const avail = new Map<string, number>();
    for (const x of this._b) {
      const key = String(x);
      avail.set(key, (avail.get(key) ?? 0) + 1);
    }
    let matched = 0;
    for (const x of this._a) {
      const key = String(x);
      const n = avail.get(key) ?? 0;
      if (n > 0) {
        avail.set(key, n - 1);
        matched++;
      }
    }
    return (2 * matched) / (la + lb);
  }

  /**
   * Very fast, rough upper bound on ratio. Useful for pre-filtering.
   * realQuickRatio() >= quickRatio() >= ratio().
   */
  realQuickRatio(): number {
    const la = this._a.length, lb = this._b.length;
    if (la + lb === 0) return 1.0;
    return (2 * Math.min(la, lb)) / (la + lb);
  }
}
