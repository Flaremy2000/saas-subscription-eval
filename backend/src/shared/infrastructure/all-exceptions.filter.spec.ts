import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

const buildHost = (): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, json }),
      getRequest: () => ({ method: 'GET', url: '/api/v1/usage' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps HttpExceptions with path and timestamp', () => {
    const { host, status, json } = buildHost();

    filter.catch(new NotFoundException('Company not found'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Company not found',
        error: 'Not Found',
        path: '/api/v1/usage',
        timestamp: expect.any(String),
      }),
    );
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('preserves validation message arrays', () => {
    const { host, status, json } = buildHost();

    filter.catch(new BadRequestException(['userId must be a UUID']), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['userId must be a UUID'],
        error: 'Bad Request',
      }),
    );
  });

  it('supports exceptions created with a plain string payload', () => {
    const { host, status, json } = buildHost();

    filter.catch(new HttpException('I am a teapot', HttpStatus.I_AM_A_TEAPOT), host);

    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 418, message: 'I am a teapot' }),
    );
    const body = json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('error');
  });

  it('falls back to the exception message when the payload has none', () => {
    const { host, json } = buildHost();

    filter.catch(new HttpException({ statusCode: 400, error: 'Bad Request' }, 400), host);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    const body = json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof body.message).toBe('string');
  });

  it('falls back to the error message when no stack is available', () => {
    const { host, status } = buildHost();
    const error = new Error('no stack here');
    delete error.stack;

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('no stack here'));
  });

  it('maps unique constraint violations to 409', () => {
    const { host, status, json } = buildHost();
    const exception = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, message: 'Resource already exists' }),
    );
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('maps foreign key violations to 409', () => {
    const { host, status, json } = buildHost();
    const exception = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: '7.10.0',
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, message: 'Related resource does not exist' }),
    );
  });

  it('maps missing records to 404', () => {
    const { host, status, json } = buildHost();
    const exception = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.10.0',
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Resource not found' }),
    );
  });

  it('logs unexpected Prisma failures as 500', () => {
    const { host, status, json } = buildHost();
    const exception = new Prisma.PrismaClientKnownRequestError('Query timeout', {
      code: 'P1001',
      clientVersion: '7.10.0',
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Database error' }),
    );
    expect(errorLog).toHaveBeenCalled();
  });

  it('answers 503 when the database is unreachable', () => {
    const { host, status, json } = buildHost();
    const exception = new Prisma.PrismaClientInitializationError(
      'connect ECONNREFUSED 127.0.0.1:5432',
      '7.10.0',
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        message: 'Service temporarily unavailable',
      }),
    );
    expect(errorLog).toHaveBeenCalled();
  });

  it('hides unknown errors behind a generic 500 without leaking details', () => {
    const { host, status, json } = buildHost();

    filter.catch(new Error('secret internal detail'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
    const body = json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('stack');
    expect(JSON.stringify(body)).not.toContain('secret internal detail');
    expect(errorLog).toHaveBeenCalled();
  });
});
