import type { Response } from 'express';
import { RequestWithId, requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  const run = (incoming?: string) => {
    const req = { header: () => incoming } as unknown as RequestWithId;
    const setHeader = jest.fn();
    const next = jest.fn();
    requestIdMiddleware(req, { setHeader } as unknown as Response, next);
    return { req, setHeader, next };
  };

  it('reuses the caller-provided id and echoes it back', () => {
    const { req, setHeader, next } = run('trace-123');

    expect(req.id).toBe('trace-123');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'trace-123');
    expect(next).toHaveBeenCalled();
  });

  it('generates a UUID when none is provided', () => {
    expect(run().req.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('ignores absurdly long ids instead of logging attacker-controlled blobs', () => {
    expect(run('x'.repeat(500)).req.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
