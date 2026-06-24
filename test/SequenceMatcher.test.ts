import { SequenceMatcher } from "../src/SequenceMatcher.js";

describe("SequenceMatcher", () => {
  describe("ratio()", () => {
    it("identical sequences → 1.0", () => {
      const sm = new SequenceMatcher([..."abcde"], [..."abcde"]);
      expect(sm.ratio()).toBe(1.0);
    });

    it("completely different → 0.0", () => {
      const sm = new SequenceMatcher([..."abc"], [..."xyz"]);
      expect(sm.ratio()).toBe(0.0);
    });

    it("both empty → 1.0", () => {
      const sm = new SequenceMatcher([], []);
      expect(sm.ratio()).toBe(1.0);
    });

    it("one empty → 0.0", () => {
      const sm = new SequenceMatcher([..."abc"], []);
      expect(sm.ratio()).toBe(0.0);
    });

    // Python: difflib.SequenceMatcher(None, "abcde", "abcXe").ratio() == 0.8
    it("one substitution in 5 chars → 0.8", () => {
      const sm = new SequenceMatcher([..."abcde"], [..."abcXe"]);
      expect(sm.ratio()).toBeCloseTo(0.8, 5);
    });

    // Python: SequenceMatcher(None, "kitten", "sitting").ratio() ≈ 0.615
    it("kitten vs sitting", () => {
      const sm = new SequenceMatcher([..."kitten"], [..."sitting"]);
      const r = sm.ratio();
      expect(r).toBeGreaterThan(0.5);
      expect(r).toBeLessThan(0.75);
    });

    // Python: SequenceMatcher(None, "GCATGCU", "GATTACA").ratio() ≈ 0.571
    it("DNA sequences", () => {
      const sm = new SequenceMatcher([..."GCATGCU"], [..."GATTACA"]);
      const r = sm.ratio();
      expect(r).toBeGreaterThan(0.4);
      expect(r).toBeLessThan(0.75);
    });

    it("numbers array", () => {
      const sm = new SequenceMatcher([1, 2, 3, 4], [1, 2, 3, 4]);
      expect(sm.ratio()).toBe(1.0);
    });
  });

  describe("quickRatio()", () => {
    it("is >= ratio()", () => {
      const pairs = [
        [[..."abcde"], [..."abcXe"]],
        [[..."kitten"], [..."sitting"]],
        [[..."hello world"], [..."world hello"]],
      ];
      for (const [a, b] of pairs as [string[], string[]][]) {
        const sm = new SequenceMatcher(a, b);
        expect(sm.quickRatio()).toBeGreaterThanOrEqual(sm.ratio() - 1e-9);
      }
    });

    it("identical → 1.0", () => {
      const sm = new SequenceMatcher([..."abc"], [..."abc"]);
      expect(sm.quickRatio()).toBe(1.0);
    });
  });

  describe("realQuickRatio()", () => {
    it("is >= quickRatio()", () => {
      const sm = new SequenceMatcher([..."kitten"], [..."sitting"]);
      expect(sm.realQuickRatio()).toBeGreaterThanOrEqual(sm.quickRatio() - 1e-9);
    });
  });

  describe("findLongestMatch()", () => {
    it("finds longest common block", () => {
      const a = [..."abcdxyz"];
      const b = [..."xyzabcd"];
      const sm = new SequenceMatcher(a, b);
      const m = sm.findLongestMatch(0, a.length, 0, b.length);
      // "abcd" (len 4) or "xyz" (len 3); longest is "abcd"
      expect(m.size).toBe(4);
    });

    it("no match returns size 0", () => {
      const sm = new SequenceMatcher([..."abc"], [..."xyz"]);
      const m = sm.findLongestMatch(0, 3, 0, 3);
      expect(m.size).toBe(0);
    });

    it("single element match", () => {
      const a = [..."abc"];
      const sm = new SequenceMatcher(a, [..."xbz"]);
      const m = sm.findLongestMatch(0, 3, 0, 3);
      expect(m.size).toBe(1);
      expect(a[m.a]).toBe("b");
    });
  });

  describe("getMatchingBlocks()", () => {
    it("identical sequences → one block + sentinel", () => {
      const sm = new SequenceMatcher([..."abc"], [..."abc"]);
      const blocks = sm.getMatchingBlocks();
      expect(blocks).toHaveLength(2); // one match + sentinel
      expect(blocks[0]).toEqual({ a: 0, b: 0, size: 3 });
      expect(blocks[1]).toEqual({ a: 3, b: 3, size: 0 }); // sentinel
    });

    it("disjoint → only sentinel", () => {
      const sm = new SequenceMatcher([..."abc"], [..."xyz"]);
      const blocks = sm.getMatchingBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].size).toBe(0);
    });

    it("multiple blocks sorted by position", () => {
      const sm = new SequenceMatcher([..."abXcd"], [..."abYcd"]);
      const blocks = sm.getMatchingBlocks().slice(0, -1); // drop sentinel
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      // "ab" at 0,0 and "cd" later
      const totalMatched = blocks.reduce((s, b) => s + b.size, 0);
      expect(totalMatched).toBe(4);
    });

    it("sentinel always last with size 0", () => {
      const sm = new SequenceMatcher([..."hello"], [..."world"]);
      const blocks = sm.getMatchingBlocks();
      const sentinel = blocks[blocks.length - 1];
      expect(sentinel.size).toBe(0);
    });

    it("result is sorted by a-position", () => {
      const a = [..."abcdeXYZ"];
      const b = [..."XYZabcde"];
      const sm = new SequenceMatcher(a, b);
      const blocks = sm.getMatchingBlocks().slice(0, -1);
      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i].a).toBeGreaterThan(blocks[i - 1].a);
      }
    });
  });

  describe("getOpcodes()", () => {
    it("identical → single equal opcode", () => {
      const sm = new SequenceMatcher([..."abc"], [..."abc"]);
      const ops = sm.getOpcodes();
      expect(ops).toHaveLength(1);
      expect(ops[0].tag).toBe("equal");
      expect(ops[0]).toMatchObject({ i1: 0, i2: 3, j1: 0, j2: 3 });
    });

    it("delete all → single delete", () => {
      const sm = new SequenceMatcher([..."abc"], []);
      const ops = sm.getOpcodes();
      expect(ops).toHaveLength(1);
      expect(ops[0].tag).toBe("delete");
    });

    it("insert all → single insert", () => {
      const sm = new SequenceMatcher([], [..."abc"]);
      const ops = sm.getOpcodes();
      expect(ops).toHaveLength(1);
      expect(ops[0].tag).toBe("insert");
    });

    it("substitution produces replace", () => {
      const sm = new SequenceMatcher([..."abc"], [..."axc"]);
      const ops = sm.getOpcodes();
      const tags = ops.map((o) => o.tag);
      expect(tags).toContain("equal");
      expect(tags).toContain("replace");
    });

    it("opcodes reconstruct b from a", () => {
      const a = [..."abcXXXde"];
      const b = [..."abcYde"];
      const sm = new SequenceMatcher(a, b);
      const result: string[] = [];
      for (const op of sm.getOpcodes()) {
        if (op.tag === "equal") result.push(...a.slice(op.i1, op.i2));
        else if (op.tag === "insert" || op.tag === "replace") result.push(...b.slice(op.j1, op.j2));
      }
      expect(result.join("")).toBe("abcYde");
    });

    it("result covers entire a and b without gaps", () => {
      const a = [..."hello world"];
      const b = [..."world hello"];
      const sm = new SequenceMatcher(a, b);
      const ops = sm.getOpcodes();
      // Check a coverage
      let prevI = 0, prevJ = 0;
      for (const op of ops) {
        expect(op.i1).toBe(prevI);
        expect(op.j1).toBe(prevJ);
        prevI = op.i2;
        prevJ = op.j2;
      }
      expect(prevI).toBe(a.length);
      expect(prevJ).toBe(b.length);
    });
  });

  describe("setSequences()", () => {
    it("clears cache and recomputes", () => {
      const sm = new SequenceMatcher([..."abc"], [..."abc"]);
      expect(sm.ratio()).toBe(1.0);
      sm.setSequences([..."abc"], [..."xyz"]);
      expect(sm.ratio()).toBe(0.0);
    });
  });

  describe("custom equalizer", () => {
    it("case-insensitive matching", () => {
      const sm = new SequenceMatcher(
        [..."HELLO"],
        [..."hello"],
        (a, b) => a.toLowerCase() === b.toLowerCase(),
      );
      expect(sm.ratio()).toBe(1.0);
    });

    it("object arrays by id", () => {
      const a = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const b = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const sm = new SequenceMatcher(a, b, (x, y) => x.id === y.id);
      expect(sm.ratio()).toBe(1.0);
    });
  });
});
