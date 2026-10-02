function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Returns the closest candidate to `name`, if one is reasonably similar. */
export function closest(name: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestScore = Infinity;
  const lower = name.toLowerCase();
  for (const candidate of candidates) {
    if (candidate === name) continue;
    const score = candidate.toLowerCase() === lower ? 0 : distance(name, candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  const limit = Math.max(1, Math.floor(name.length / 3));
  return bestScore <= limit ? best : undefined;
}

export const didYouMean = (name: string, candidates: Iterable<string>): string | undefined => {
  const match = closest(name, candidates);
  return match ? `Did you mean '${match}'?` : undefined;
};
