import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from '../utils/test-app';

describe('App foundation (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('reports the API and database as up', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .expect(200, { status: 'ok', database: 'up' });
    });
  });

  describe('request id', () => {
    it('echoes a caller-provided X-Request-Id', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', 'trace-123');

      expect(res.headers['x-request-id']).toBe('trace-123');
    });

    it('generates one when the caller does not send it', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('error contract', () => {
    it('returns the structured error body for unknown routes', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);

      expect(res.body).toEqual({
        error: { code: 'NOT_FOUND', message: expect.any(String) },
        requestId: res.headers['x-request-id'],
      });
    });

    it('returns MALFORMED_JSON for an unparsable body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/anything')
        .set('Content-Type', 'application/json')
        .send('{"broken": ')
        .expect(400);

      expect(res.body.error.code).toBe('MALFORMED_JSON');
      // Body-parser errors happen before Nest middleware; the id must still be present.
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
      expect(res.body.requestId).toBeDefined();
    });

    it('returns PAYLOAD_TOO_LARGE for bodies over the 1mb limit', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/anything')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ blob: 'x'.repeat(1024 * 1024 + 1) }))
        .expect(413);

      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });
});
