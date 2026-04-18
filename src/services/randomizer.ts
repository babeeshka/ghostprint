export function randomInt(min: number, max: number): number {
  if (min > max) throw new Error(`randomInt: min (${min}) > max (${max})`);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function pickRandom<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pickRandom: array is empty');
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Builds a sequence of {category, text} pairs where no two consecutive entries
 * share a category, making the search pattern look organic.
 */
export function buildRotatedQueryPlan(
  categories: string[],
  queryMap: Record<string, string[]>,
  count: number,
): Array<{ category: string; text: string }> {
  if (categories.length === 0) throw new Error('buildRotatedQueryPlan: categories is empty');

  const plan: Array<{ category: string; text: string }> = [];
  let lastCategory: string | null = null;

  for (let i = 0; i < count; i++) {
    const eligible = categories.filter(c => c !== lastCategory);
    const pool = eligible.length > 0 ? eligible : categories;
    const category = pickRandom(pool);
    const queries = queryMap[category] ?? [];
    if (queries.length === 0) continue;
    const text = pickRandom(queries);
    plan.push({ category, text });
    lastCategory = category;
  }

  return plan;
}

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

export function parseSince(since: string): Date {
  const match = /^(\d+)d$/.exec(since);
  if (!match) throw new Error(`Invalid --since value "${since}" — expected format like "7d"`);
  const days = parseInt(match[1], 10);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
