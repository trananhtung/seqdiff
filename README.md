# seqdiff

TypeScript-first port of Python's `difflib` — `SequenceMatcher`, `getCloseMatches`, and `unifiedDiff` for any sequence type. Zero dependencies, ESM + CJS dual build.

[![npm](https://img.shields.io/npm/v/seqdiff)](https://www.npmjs.com/package/seqdiff)
[![npm downloads](https://img.shields.io/npm/dw/seqdiff)](https://www.npmjs.com/package/seqdiff)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Why seqdiff?

The [difflib](https://www.npmjs.com/package/difflib) package is downloaded 570,000+ times per week but hasn't been published since **2012** — no TypeScript types, open bugs including Jest incompatibility, and no active maintainer. `seqdiff` is the modern, typed replacement.

## Install

```bash
npm install seqdiff
```

## Quick start

```ts
import { getCloseMatches, SequenceMatcher, unifiedDiff } from "seqdiff";

// "Did you mean?" — like Python's difflib.get_close_matches
getCloseMatches("appel", ["ape", "apple", "peach", "puppy"]);
// → ["apple", "ape"]

// Similarity ratio between two strings
const sm = new SequenceMatcher([..."kitten"], [..."sitting"]);
sm.ratio(); // → 0.615...

// Unified diff between two arrays of lines
const diff = unifiedDiff(
  ["one", "two", "three"],
  ["one", "TWO", "three"],
  { fromFile: "old.txt", toFile: "new.txt" },
);
// → ["--- old.txt\n", "+++ new.txt\n", "@@ -1,3 +1,3 @@\n", ...]
```

## API

### `SequenceMatcher<T>`

Generic sequence matcher that works on arrays of any type.

```ts
const sm = new SequenceMatcher(a: T[], b: T[], equalizer?: (a: T, b: T) => boolean);
```

| Method | Returns | Description |
|--------|---------|-------------|
| `ratio()` | `number` | Similarity ratio in `[0, 1]`. `1.0` = identical, `0.0` = nothing in common |
| `quickRatio()` | `number` | Fast upper bound on `ratio()`. Use to pre-filter candidates |
| `realQuickRatio()` | `number` | Even faster upper bound (`2 * min(|a|, |b|) / (|a| + |b|)`) |
| `getMatchingBlocks()` | `MatchBlock[]` | All non-overlapping matching blocks, sorted by position. Includes a sentinel `{size: 0}` at end |
| `getOpcodes()` | `Opcode[]` | Sequence of `{tag, i1, i2, j1, j2}` operations to transform `a` into `b` |
| `findLongestMatch(alo, ahi, blo, bhi)` | `MatchBlock` | Find the longest matching block in `a[alo:ahi]` and `b[blo:bhi]` |
| `setSequences(a, b)` | `void` | Replace sequences and clear cache |

**Opcode tags:** `"equal"`, `"replace"`, `"delete"`, `"insert"`

```ts
// Works on arrays of numbers, objects, or any custom type
const sm = new SequenceMatcher([1, 2, 3], [1, 9, 3]);
sm.ratio(); // → 0.666...

// Custom equalizer (case-insensitive)
const sm2 = new SequenceMatcher(
  [..."Hello"],
  [..."hello"],
  (a, b) => a.toLowerCase() === b.toLowerCase(),
);
sm2.ratio(); // → 1.0

// Reconstruct b from a using opcodes
for (const op of sm.getOpcodes()) {
  if (op.tag === "equal") result.push(...a.slice(op.i1, op.i2));
  else if (op.tag === "insert" || op.tag === "replace") result.push(...b.slice(op.j1, op.j2));
}
```

### `getCloseMatches(word, possibilities, n?, cutoff?)`

Return the best matches for `word` from `possibilities`.

```ts
getCloseMatches(
  word: string,
  possibilities: Iterable<string>,
  n?: number,      // max results (default: 3)
  cutoff?: number, // min similarity ratio (default: 0.6)
): string[]
```

Sorted by similarity, best first. Accepts any `Iterable<string>` (arrays, generators, sets).

```ts
// Spell correction / "did you mean?"
getCloseMatches("colour", ["color", "colours", "colourant"]);
// → ["colour", "colourant", "color"] (if "colour" is in the list)

// Tighter cutoff — only very close matches
getCloseMatches("python", ["pytorch", "python3", "pyton"], 5, 0.8);
```

### `stringSimilarity(a, b)`

Convenience wrapper: `SequenceMatcher([...a], [...b]).ratio()`.

```ts
stringSimilarity("hello", "helo"); // → 0.888...
stringSimilarity("cat", "dog");    // → 0.0
```

### `bestMatch(word, possibilities, cutoff?)`

Like `getCloseMatches` but returns the single best match or `undefined`.

```ts
bestMatch("colour", ["color", "colourant", "cup"]); // → "color"
bestMatch("xyz", ["apple", "banana"], 0.9);          // → undefined
```

### `unifiedDiff(a, b, opts?)`

Produce a unified diff between two arrays of strings (lines).

```ts
unifiedDiff(a: string[], b: string[], opts?: {
  fromFile?: string;   // default: "a"
  toFile?: string;     // default: "b"
  context?: number;    // lines of context (default: 3)
  lineTerminator?: string; // default: "\n"
}): string[]
```

```ts
const before = ["def hello():\n", '    print("Hello")\n'];
const after  = ["def hello():\n", '    print("Hi!")\n'];

console.log(unifiedDiff(before, after, { fromFile: "old.py", toFile: "new.py" }).join(""));
// --- old.py
// +++ new.py
// @@ -1,2 +1,2 @@
//  def hello():
// -    print("Hello")
// +    print("Hi!")
```

### `diffText(a, b, opts?)`

Shorthand: splits strings by `"\n"` then calls `unifiedDiff`, returns the result joined as a string.

### `diffLines(a, b)`

Structured line diff — returns `LineDiff[]` objects instead of raw text. Useful for building diff UIs.

```ts
const result = diffLines(["a", "b", "c"], ["a", "X", "c"]);
// [
//   { type: "equal",   aLines: ["a"], bLines: ["a"] },
//   { type: "replace", aLines: ["b"], bLines: ["X"] },
//   { type: "equal",   aLines: ["c"], bLines: ["c"] },
// ]
```

## Migration from `difflib@0.2.4`

| Old (difflib) | New (seqdiff) |
|---------------|---------------|
| `new difflib.SequenceMatcher(null, a, b)` | `new SequenceMatcher([...a], [...b])` |
| `.ratio()` | `.ratio()` (same) |
| `.get_matching_blocks()` | `.getMatchingBlocks()` (camelCase, object shape) |
| `.get_opcodes()` | `.getOpcodes()` (camelCase, object shape) |
| `difflib.get_close_matches(w, ps)` | `getCloseMatches(w, ps)` (same args) |
| `difflib.unified_diff(a, b)` | `unifiedDiff(a, b)` |

The main difference: `seqdiff` takes `T[]` arrays where `difflib` took raw strings. Use `[...str]` to split a string into characters.

## License

MIT
