export function fuzzyScore(query: string, target: string): number {
  if (!query) return 0;
  if (target === query) return 1000;
  if (target.startsWith(query)) return 500 + query.length;
  const idx = target.indexOf(query);
  if (idx >= 0) return 200 + query.length - idx;

  let qi = 0;
  let lastMatch = -1;
  let consecutive = 0;
  let bestConsecutive = 0;
  let score = 0;

  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i] === query[qi]) {
      score += 1;
      if (lastMatch >= 0 && i === lastMatch + 1) {
        consecutive += 1;
        bestConsecutive = Math.max(bestConsecutive, consecutive);
      } else {
        consecutive = 1;
      }
      lastMatch = i;
      qi += 1;
    }
  }

  if (qi < query.length) return 0;

  return score + bestConsecutive * 2;
}
