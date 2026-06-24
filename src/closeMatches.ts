import { SequenceMatcher } from "./SequenceMatcher.js";

/**
 * Return a list of the best "good enough" matches for `word` from a list of
 * `possibilities`. A direct port of Python's difflib.get_close_matches().
 *
 * @param word         The string to match against.
 * @param possibilities Iterable of strings to consider.
 * @param n            Maximum number of close matches to return (default 3).
 * @param cutoff       Results below this similarity ratio are excluded (default 0.6).
 * @returns            Closest matches, sorted by similarity (best first).
 */
export function getCloseMatches(
  word: string,
  possibilities: Iterable<string>,
  n = 3,
  cutoff = 0.6,
): string[] {
  if (n <= 0) throw new RangeError("n must be > 0");
  if (cutoff < 0 || cutoff > 1) throw new RangeError("cutoff must be in [0, 1]");

  const wordChars = [...word];
  const sm = new SequenceMatcher<string>(wordChars, []);
  const result: [number, string][] = [];

  for (const p of possibilities) {
    const pChars = [...p];
    sm.setSequences(wordChars, pChars);
    // Skip quickly if upper bound is too low
    if (sm.realQuickRatio() < cutoff) continue;
    if (sm.quickRatio() < cutoff) continue;
    const r = sm.ratio();
    if (r >= cutoff) result.push([r, p]);
  }

  // Sort by descending ratio, then by value for stability
  result.sort((a, b) => b[0] - a[0] || (b[1] < a[1] ? -1 : b[1] > a[1] ? 1 : 0));

  return result.slice(0, n).map(([, s]) => s);
}

/**
 * Compute the similarity ratio between two strings.
 * Equivalent to SequenceMatcher([...a], [...b]).ratio().
 */
export function stringSimilarity(a: string, b: string): number {
  return new SequenceMatcher([...a], [...b]).ratio();
}

/**
 * Find the best match for `word` from `possibilities`, or undefined if none
 * exceeds the cutoff.
 */
export function bestMatch(
  word: string,
  possibilities: Iterable<string>,
  cutoff = 0.6,
): string | undefined {
  return getCloseMatches(word, possibilities, 1, cutoff)[0];
}
