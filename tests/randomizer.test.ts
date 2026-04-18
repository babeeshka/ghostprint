import { describe, it, expect } from 'vitest';
import {
  randomInt,
  sleep,
  pickRandom,
  shuffle,
  buildRotatedQueryPlan,
  parseSince,
} from '../src/services/randomizer';

describe('randomInt', () => {
  it('returns a value within [min, max]', () => {
    for (let i = 0; i < 200; i++) {
      const result = randomInt(5, 10);
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(10);
    }
  });

  it('returns an integer', () => {
    expect(Number.isInteger(randomInt(1, 100))).toBe(true);
  });

  it('returns min when min === max', () => {
    expect(randomInt(7, 7)).toBe(7);
  });

  it('throws when min > max', () => {
    expect(() => randomInt(10, 5)).toThrow('randomInt');
  });
});

describe('sleep', () => {
  it('resolves after approximately the given duration', async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe('pickRandom', () => {
  it('always returns an element from the array', () => {
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(pickRandom(arr));
    }
  });

  it('works for single-element arrays', () => {
    expect(pickRandom([42])).toBe(42);
  });

  it('throws on empty array', () => {
    expect(() => pickRandom([])).toThrow('empty');
  });
});

describe('shuffle', () => {
  it('returns an array with the same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffle(arr);
    expect(arr).toEqual(copy);
  });

  it('returns a new array reference', () => {
    const arr = [1, 2, 3];
    expect(shuffle(arr)).not.toBe(arr);
  });
});

describe('buildRotatedQueryPlan', () => {
  const queryMap = {
    farm: ['tractor', 'soil', 'crops'],
    baby: ['formula', 'diaper', 'crib'],
    luxury: ['rolex', 'ferrari', 'yacht'],
  };
  const categories = Object.keys(queryMap);

  it('returns exactly the requested count of items', () => {
    expect(buildRotatedQueryPlan(categories, queryMap, 9)).toHaveLength(9);
    expect(buildRotatedQueryPlan(categories, queryMap, 1)).toHaveLength(1);
  });

  it('never places two consecutive items from the same category', () => {
    for (let trial = 0; trial < 30; trial++) {
      const plan = buildRotatedQueryPlan(categories, queryMap, 15);
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i].category, `trial ${trial}, index ${i}`).not.toBe(plan[i - 1].category);
      }
    }
  });

  it('only uses queries that exist in the queryMap for the selected category', () => {
    const plan = buildRotatedQueryPlan(categories, queryMap, 20);
    for (const { category, text } of plan) {
      expect(queryMap[category]).toContain(text);
    }
  });

  it('throws when categories array is empty', () => {
    expect(() => buildRotatedQueryPlan([], queryMap, 5)).toThrow('empty');
  });
});

describe('parseSince', () => {
  it('returns a date N days in the past', () => {
    const result = parseSince('7d');
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('throws on invalid format', () => {
    expect(() => parseSince('7')).toThrow('Invalid');
    expect(() => parseSince('7days')).toThrow('Invalid');
    expect(() => parseSince('')).toThrow('Invalid');
  });
});
