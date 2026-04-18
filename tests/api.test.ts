import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Mock browser and pollution before importing routes that depend on them.
// Tests verify routing, validation, DB shapes, and status codes — not live browser work.
vi.mock('../src/services/browser.js', () => ({
  isBrowserActive: vi.fn().mockReturnValue(false),
  launchBrowser: vi.fn(),
  closeBrowser: vi.fn(),
}));

vi.mock('../src/services/pollution.js', () => ({
  runSession: vi.fn().mockResolvedValue(undefined),
  fireImmediate: vi.fn().mockResolvedValue(undefined),
  stopSession: vi.fn().mockReturnValue(true),
  isSessionActive: vi.fn().mockReturnValue(false),
  getActiveSessions: vi.fn().mockReturnValue([]),
}));

import apiRouter from '../src/api/index.js';
import { Session } from '../src/models/Session.js';
import { Category } from '../src/models/Category.js';

let mongod: MongoMemoryServer;
let app: express.Express;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use(apiRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns ok when DB is connected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
    expect(res.body).toHaveProperty('browserActive');
    expect(res.body).toHaveProperty('activeSessions');
  });
});

// ---------------------------------------------------------------------------

describe('GET /categories', () => {
  it('returns empty array when no categories are seeded', async () => {
    const res = await request(app).get('/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
  });

  it('returns seeded categories', async () => {
    await Category.create({ name: 'farm', icon: '🌾', queries: ['best tractor'] });
    const res = await request(app).get('/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].name).toBe('farm');
  });
});

// ---------------------------------------------------------------------------

describe('POST /sessions', () => {
  it('creates a session with valid body', async () => {
    const res = await request(app)
      .post('/sessions')
      .send({ intervalMin: 8, batchSize: 5, categories: [] });
    expect(res.status).toBe(201);
    expect(res.body.session).toMatchObject({
      status: 'running',
      config: { intervalMin: 8, batchSize: 5 },
    });
  });

  it('rejects batchSize out of range', async () => {
    const res = await request(app)
      .post('/sessions')
      .send({ batchSize: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/batchSize/);
  });

  it('rejects unknown categories', async () => {
    const res = await request(app)
      .post('/sessions')
      .send({ categories: ['nonexistent_category'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown categories/);
  });

  it('rejects an invalid cron expression', async () => {
    const res = await request(app)
      .post('/sessions')
      .send({ cronExpr: 'not-a-cron' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cron/i);
  });

  it('returns 409 when browser is already active', async () => {
    const { isBrowserActive } = await import('../src/services/browser.js');
    vi.mocked(isBrowserActive).mockReturnValueOnce(true);

    const res = await request(app).post('/sessions').send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Browser is already in use/);
  });
});

// ---------------------------------------------------------------------------

describe('GET /sessions', () => {
  it('returns empty list when no sessions exist', async () => {
    const res = await request(app).get('/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('paginates results', async () => {
    await Session.insertMany(
      Array.from({ length: 5 }, () => ({
        status: 'completed',
        config: { intervalMin: 5, batchSize: 3, categories: [] },
      }))
    );
    const res = await request(app).get('/sessions?limit=2&skip=0');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });

  it('filters by status', async () => {
    await Session.create({ status: 'running', config: { intervalMin: 5, batchSize: 3, categories: [] } });
    await Session.create({ status: 'completed', config: { intervalMin: 5, batchSize: 3, categories: [] } });

    const res = await request(app).get('/sessions?status=running');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0].status).toBe('running');
  });

  it('rejects an invalid status filter', async () => {
    const res = await request(app).get('/sessions?status=exploding');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe('GET /sessions/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await request(app).get(`/sessions/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });

  it('returns session and its queries', async () => {
    const session = await Session.create({
      status: 'completed',
      config: { intervalMin: 5, batchSize: 3, categories: [] },
    });
    const res = await request(app).get(`/sessions/${session.id}`);
    expect(res.status).toBe(200);
    expect(res.body.session._id).toBe(session.id);
    expect(Array.isArray(res.body.queries)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('POST /sessions/:id/stop', () => {
  it('returns 404 for unknown session', async () => {
    const res = await request(app).post(`/sessions/${new mongoose.Types.ObjectId()}/stop`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when session is not running', async () => {
    const session = await Session.create({
      status: 'completed',
      config: { intervalMin: 5, batchSize: 3, categories: [] },
    });
    const res = await request(app).post(`/sessions/${session.id}/stop`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already in status/);
  });

  it('stops a running session', async () => {
    const session = await Session.create({
      status: 'running',
      config: { intervalMin: 5, batchSize: 3, categories: [] },
    });
    const res = await request(app).post(`/sessions/${session.id}/stop`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('POST /fire', () => {
  it('returns 202 and a sessionId', async () => {
    const res = await request(app).post('/fire').send({ count: 2 });
    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.message).toMatch(/background/i);
  });

  it('rejects count out of range', async () => {
    const res = await request(app).post('/fire').send({ count: 99 });
    expect(res.status).toBe(400);
  });

  it('returns 409 when browser is active', async () => {
    const { isBrowserActive } = await import('../src/services/browser.js');
    vi.mocked(isBrowserActive).mockReturnValueOnce(true);

    const res = await request(app).post('/fire').send({ count: 2 });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------

describe('GET /stats', () => {
  it('returns zeroed stats when no data exists', async () => {
    const res = await request(app).get('/stats');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalQueries: 0,
      totalSessions: 0,
      uniqueQueries: 0,
      successRate: 0,
    });
    expect(Array.isArray(res.body.byDay)).toBe(true);
    expect(Array.isArray(res.body.byCategory)).toBe(true);
  });
});
