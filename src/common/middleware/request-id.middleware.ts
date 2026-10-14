import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';
const MAX_REQUEST_ID_LENGTH = 128;

export type RequestWithId = Request & { id?: string };

/**
 * Assigns `req.id` (caller-provided `X-Request-Id` or a new UUID) and echoes it in the response.
 *
 * Registered as the very first Express middleware so that even errors raised by the body
 * parser — which runs before Nest's middleware, including the pino logger — carry a request id.
 */
export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && incoming.length <= MAX_REQUEST_ID_LENGTH ? incoming : randomUUID();

  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
