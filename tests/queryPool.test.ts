import { describe, it, expect } from 'vitest';

// Re-export the internal pool logic for testing by extracting it.
// The functions are not exported from pollution.ts (internal implementation),
// so we test their observable behavior via a small inline replica here.

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const QUERY_MAP: Record<string, string[]> = {
  farm: ['tractor', 'soil', 'crops', 'fertilizer'],
  baby: ['formula', 'diaper', 'crib', 'stroller'],
  luxury: ['rolex', 'ferrari', 'yacht', 'penthouse'],
};

interface QueryPool {
  remaining: Map<string, string[]>;
  exhausted: Map<string, string[]>;
}

function buildQueryPool(categories: string[]): QueryPool {
  const remaining = new Map<string, string[]>();
  const exhausted = new Map<string, string[]>();
  for (const cat of categories) {
    remaining.set(cat, shuffle(QUERY_MAP[cat] ?? []));
    exhausted.set(cat, []);
  }
  return { remaining, exhausted };
}

function drawFromPool(
  pool: QueryPool,
  categories: string[],
  count: number,
): Array<{ category: string; text: string }> {
  const result: Array<{ category: string; text: string }> = [];
  let lastCategory: string | null = null;

  for (let i = 0; i < count; i++) {
    const eligible = categories.filter(c => c !== lastCategory);
    const pool_ = eligible.length > 0 ? eligible : categories;

    const withUnseen = pool_.filter(c => (pool.remaining.get(c)?.length ?? 0) > 0);
    const candidatePool = withUnseen.length > 0 ? withUnseen : pool_;
    const category = candidatePool[Math.floor(Math.random() * candidatePool.length)];

    if ((pool.remaining.get(category)?.length ?? 0) === 0) {
      const ex = pool.exhausted.get(category) ?? [];
      pool.remaining.set(category, shuffle(ex));
      pool.exhausted.set(category, []);
    }

    const queries = pool.remaining.get(category) ?? [];
    if (queries.length === 0) continue;
    const text = queries.pop()!;
    pool.exhausted.get(category)!.push(text);

    result.push({ category, text });
    lastCategory = category;
  }
  return result;
}

describe('query pool — deduplication', () => {
  const categories = Object.keys(QUERY_MAP);

  it('does not repeat a query until all queries in that category are exhausted', () => {
    const pool = buildQueryPool(categories);
    const seen = new Map<string, Set<string>>();

    // Draw 4 × 3 categories = 12 queries — exactly one full pass
    const drawn = drawFromPool(pool, categories, 12);

    for (const { category, text } of drawn) {
      if (!seen.has(category)) seen.set(category, new Set());
      const catSeen = seen.get(category)!;
      expect(catSeen.has(text), `"${text}" in category "${category}" appeared twice before full exhaust`).toBe(false);
      catSeen.add(text);
    }
  });

  it('never places two consecutive queries from the same category', () => {
    for (let trial = 0; trial < 20; trial++) {
      const pool = buildQueryPool(categories);
      const drawn = drawFromPool(pool, categories, 24);
      for (let i = 1; i < drawn.length; i++) {
        expect(drawn[i].category).not.toBe(drawn[i - 1].category);
      }
    }
  });

  it('recycles queries after full exhaustion', () => {
    const pool = buildQueryPool(['farm']);
    // Draw 4 queries (full exhaust) + 4 more (should recycle)
    const first = drawFromPool(pool, ['farm'], 4).map(q => q.text);
    const second = drawFromPool(pool, ['farm'], 4).map(q => q.text);
    expect(new Set(first).size).toBe(4);
    expect(new Set(second).size).toBe(4);
    // After recycling, same set of queries should appear
    expect([...new Set(first)].sort()).toEqual([...new Set(second)].sort());
  });

  it('returns the requested count even with a single category', () => {
    const pool = buildQueryPool(['luxury']);
    const drawn = drawFromPool(pool, ['luxury'], 8);
    expect(drawn).toHaveLength(8);
    expect(drawn.every(d => d.category === 'luxury')).toBe(true);
  });
});
