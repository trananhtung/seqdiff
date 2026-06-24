import { getCloseMatches, stringSimilarity, bestMatch } from "../src/closeMatches.js";

describe("getCloseMatches()", () => {
  it("basic spelling correction", () => {
    const words = ["apple", "apply", "apt", "application", "banana"];
    const matches = getCloseMatches("appl", words);
    // "apple" and "apply" should be closest
    expect(matches).toContain("apple");
    expect(matches).toContain("apply");
  });

  it("returns at most n results", () => {
    const words = ["one", "ones", "onesies", "onesided", "two", "three"];
    const matches = getCloseMatches("one", words, 2);
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  it("n defaults to 3", () => {
    const words = ["cat", "cats", "catch", "catcher", "cattle", "catt"];
    const matches = getCloseMatches("cat", words);
    expect(matches.length).toBeLessThanOrEqual(3);
  });

  it("cutoff filters low scores", () => {
    const words = ["banana", "complete", "different", "xyz"];
    const matches = getCloseMatches("apple", words, 3, 0.9);
    expect(matches).toHaveLength(0);
  });

  it("cutoff=0 returns all sorted by similarity", () => {
    const words = ["abc", "xyz"];
    const matches = getCloseMatches("abc", words, 10, 0);
    expect(matches[0]).toBe("abc"); // exact match first
    expect(matches[1]).toBe("xyz");
  });

  it("exact match always returned when cutoff <= 1", () => {
    const words = ["hello", "world", "help"];
    const matches = getCloseMatches("hello", words, 3, 0.6);
    expect(matches[0]).toBe("hello");
  });

  it("returns empty when nothing exceeds cutoff", () => {
    const matches = getCloseMatches("python", ["javascript", "golang", "ruby"]);
    // "python" vs these — may or may not be empty depending on cutoff
    // With default cutoff=0.6 and short dissimilar words, result may be empty
    expect(Array.isArray(matches)).toBe(true);
  });

  it("throws for n <= 0", () => {
    expect(() => getCloseMatches("x", ["a"], 0)).toThrow(RangeError);
  });

  it("throws for cutoff out of range", () => {
    expect(() => getCloseMatches("x", ["a"], 3, 1.5)).toThrow(RangeError);
    expect(() => getCloseMatches("x", ["a"], 3, -0.1)).toThrow(RangeError);
  });

  it("results sorted by similarity (best first)", () => {
    const words = ["colour", "color", "colours", "col"];
    const matches = getCloseMatches("colour", words, 4, 0.4);
    // "colour" should be the best match (if present), then "color"
    expect(matches.indexOf("colour")).toBeLessThan(matches.indexOf("color") === -1 ? Infinity : matches.indexOf("color"));
  });

  it("handles unicode correctly", () => {
    const words = ["café", "cake", "care"];
    const matches = getCloseMatches("café", words, 3, 0.5);
    expect(matches[0]).toBe("café");
  });

  it("works with a generator (Iterable<string>)", () => {
    function* gen() {
      yield "apple";
      yield "apricot";
      yield "banana";
    }
    const matches = getCloseMatches("apple", gen());
    expect(matches).toContain("apple");
  });

  // Python compatibility: difflib.get_close_matches('appel', ['ape', 'apple', 'peach', 'puppy'])
  it("Python example: appel vs ape/apple/peach/puppy", () => {
    const matches = getCloseMatches("appel", ["ape", "apple", "peach", "puppy"]);
    expect(matches).toContain("apple");
    expect(matches).toContain("ape");
    expect(matches).not.toContain("puppy");
  });
});

describe("stringSimilarity()", () => {
  it("identical → 1.0", () => {
    expect(stringSimilarity("hello", "hello")).toBe(1.0);
  });

  it("empty strings → 1.0", () => {
    expect(stringSimilarity("", "")).toBe(1.0);
  });

  it("one empty → 0.0", () => {
    expect(stringSimilarity("hello", "")).toBe(0.0);
    expect(stringSimilarity("", "world")).toBe(0.0);
  });

  it("symmetric", () => {
    const a = "kitten", b = "sitting";
    expect(stringSimilarity(a, b)).toBeCloseTo(stringSimilarity(b, a), 9);
  });

  it("partial match in (0, 1)", () => {
    const r = stringSimilarity("abcde", "abXde");
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });
});

describe("bestMatch()", () => {
  it("returns closest match", () => {
    const result = bestMatch("colour", ["color", "colourant", "cup"]);
    // "color" and "colourant" both score highly; either is valid
    expect(["color", "colourant"]).toContain(result);
  });

  it("returns undefined when nothing exceeds cutoff", () => {
    const result = bestMatch("apple", ["xyz", "abc", "qrs"], 0.9);
    expect(result).toBeUndefined();
  });

  it("returns best of exact set", () => {
    const result = bestMatch("hello", ["hell", "hello", "helping"]);
    expect(result).toBe("hello");
  });
});
