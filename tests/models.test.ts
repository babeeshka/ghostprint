import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Session } from '../src/models/Session';
import { Query } from '../src/models/Query';
import { Category } from '../src/models/Category';

describe('Session model', () => {
  it('rejects a session missing required config fields', async () => {
    const doc = new Session({ status: 'running' });
    await expect(doc.validate()).rejects.toThrow();
  });

  it('rejects an unrecognised status value', async () => {
    const doc = new Session({
      status: 'exploding',
      config: { intervalMin: 8, batchSize: 5, categories: [] },
    });
    await expect(doc.validate()).rejects.toThrow();
  });

  it('accepts a fully valid session', async () => {
    const doc = new Session({
      status: 'running',
      config: { intervalMin: 8, batchSize: 5, categories: ['farm', 'luxury'] },
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it('defaults queriesFired to 0', () => {
    const doc = new Session({
      status: 'running',
      config: { intervalMin: 5, batchSize: 3, categories: [] },
    });
    expect(doc.queriesFired).toBe(0);
  });
});

describe('Query model', () => {
  it('rejects a query with no fields', async () => {
    const doc = new Query({});
    await expect(doc.validate()).rejects.toThrow();
  });

  it('rejects when sessionId is missing', async () => {
    const doc = new Query({
      text: 'best tractor',
      category: 'farm',
      googleUrl: 'https://www.google.com/search?q=best+tractor',
      dwellMs: 5000,
      success: true,
    });
    await expect(doc.validate()).rejects.toThrow();
  });

  it('accepts a fully valid query', async () => {
    const doc = new Query({
      sessionId: new mongoose.Types.ObjectId(),
      text: 'best tractor brands 2024',
      category: 'farm',
      googleUrl: 'https://www.google.com/search?q=best+tractor+brands+2024',
      firedAt: new Date(),
      dwellMs: 7000,
      success: true,
      pageTitleAfter: 'Best Tractor Brands 2024 - Google Search',
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it('defaults success to true', () => {
    const doc = new Query({
      sessionId: new mongoose.Types.ObjectId(),
      text: 'test',
      category: 'farm',
      googleUrl: 'https://google.com',
      dwellMs: 1000,
    });
    expect(doc.success).toBe(true);
  });
});

describe('Category model', () => {
  it('rejects a category with no fields', async () => {
    const doc = new Category({});
    await expect(doc.validate()).rejects.toThrow();
  });

  it('rejects when name is missing', async () => {
    const doc = new Category({ icon: '🌾', queries: ['tractor'] });
    await expect(doc.validate()).rejects.toThrow();
  });

  it('accepts a fully valid category', async () => {
    const doc = new Category({
      name: 'farm',
      icon: '🌾',
      queries: ['best tractor brands', 'organic fertilizer'],
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });
});
