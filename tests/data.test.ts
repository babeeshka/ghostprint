import { describe, it, expect } from 'vitest';
import { CATEGORIES, QUERY_MAP, CATEGORY_NAMES } from '../src/data/queries';

describe('CATEGORIES', () => {
  it('has exactly 10 categories', () => {
    expect(CATEGORIES).toHaveLength(10);
  });

  it('each category has at least 12 queries', () => {
    for (const cat of CATEGORIES) {
      expect(cat.queries.length, `${cat.name} should have ≥12 queries`).toBeGreaterThanOrEqual(12);
    }
  });

  it('each category has a non-empty name, icon, and queries array', () => {
    for (const cat of CATEGORIES) {
      expect(typeof cat.name).toBe('string');
      expect(cat.name.length).toBeGreaterThan(0);
      expect(typeof cat.icon).toBe('string');
      expect(cat.icon.length).toBeGreaterThan(0);
      expect(Array.isArray(cat.queries)).toBe(true);
    }
  });

  it('all query strings are non-empty', () => {
    for (const cat of CATEGORIES) {
      for (const q of cat.queries) {
        expect(typeof q).toBe('string');
        expect(q.trim().length, `empty query in ${cat.name}`).toBeGreaterThan(0);
      }
    }
  });

  it('includes all required categories', () => {
    const names = CATEGORIES.map(c => c.name);
    for (const required of ['farm', 'baby', 'luxury', 'b2b', 'diy', 'niche_hobbies', 'medical', 'auto', 'real_estate', 'pet']) {
      expect(names).toContain(required);
    }
  });
});

describe('QUERY_MAP', () => {
  it('has an entry for every category', () => {
    for (const cat of CATEGORIES) {
      expect(QUERY_MAP[cat.name]).toBeDefined();
      expect(QUERY_MAP[cat.name]).toEqual(cat.queries);
    }
  });
});

describe('CATEGORY_NAMES', () => {
  it('matches the names from CATEGORIES in order', () => {
    expect(CATEGORY_NAMES).toEqual(CATEGORIES.map(c => c.name));
  });

  it('has no duplicates', () => {
    expect(new Set(CATEGORY_NAMES).size).toBe(CATEGORY_NAMES.length);
  });
});
