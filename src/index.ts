export { SequenceMatcher } from "./SequenceMatcher.js";
export type { MatchBlock, Opcode, OpTag, Equalizer } from "./SequenceMatcher.js";

export { getCloseMatches, stringSimilarity, bestMatch } from "./closeMatches.js";

export { unifiedDiff, diffText, diffLines } from "./unifiedDiff.js";
export type { UnifiedDiffOptions, LineDiff } from "./unifiedDiff.js";
