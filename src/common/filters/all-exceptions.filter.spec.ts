import { ArgumentsHost, HttpException, Logger, NotFoundException } from '@nestjs/common';
import { DomainError, ErrorCode, ValidationError } from '../errors';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createHost(requestId = 'req-1') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: requestId, method: 'GET', url: '/x' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());

  it('maps a DomainError to its status and includes details + requestId', () => {
    const { host, status, json } = createHost('abc');
    const error = new ValidationError('Request validation failed', [
      { field: 'sets', issue: 'sets must contain at least 1 elements' },
    ]);

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: [{ field: 'sets', issue: 'sets must contain at least 1 elements' }],
      },
      requestId: 'abc',
    });
  });

  it('omits the details key when there are none', () => {
    const { host, json } = createHost();

    filter.catch(new DomainError(ErrorCode.INVALID_CURSOR, 'Cursor is invalid'), host);

    expect(json.mock.calls[0][0].error).not.toHaveProperty('details');
  });

  it('maps Nest HttpExceptions (e.g. unknown route) to a known code', () => {
    const { host, status, json } = createHost();

    filter.catch(new NotFoundException('Cannot GET /nope'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0][0].error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('maps unlisted client errors (e.g. 405) to BAD_REQUEST, never INTERNAL_ERROR', () => {
    const { host, status, json } = createHost();

    filter.catch(new HttpException('Method Not Allowed', 405), host);

    expect(status).toHaveBeenCalledWith(405);
    expect(json.mock.calls[0][0].error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it('hides internals of unexpected errors behind an opaque 500 and logs them', () => {
    const { host, status, json } = createHost();

    filter.catch(new Error('connection string postgres://secret leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].error).toEqual({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    });
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
