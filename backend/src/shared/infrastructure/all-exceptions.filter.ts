import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

export interface ErrorEnvelope {
  statusCode: number;
  message: string | string[];
  error?: string;
  path?: string;
  timestamp?: string;
}

interface ResolvedError {
  statusCode: number;
  message: string | string[];
  error?: string;
  unexpected: boolean;
}

/**
 * Single entry point for every exception thrown in the API.
 * Normalises the response body, maps known Prisma error codes to HTTP
 * statuses and logs unexpected failures without leaking stack traces.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error, unexpected } = this.resolve(exception);

    if (unexpected) {
      const detail =
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception);
      this.logger.error(`Unhandled error on ${request.method} ${request.url}: ${detail}`);
    }

    const envelope: ErrorEnvelope = {
      statusCode,
      message,
      ...(error !== undefined ? { error } : {}),
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(envelope);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaKnownError(exception);
    }
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Service temporarily unavailable',
        error: 'Service Unavailable',
        unexpected: true,
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
      unexpected: true,
    };
  }

  private fromHttpException(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { statusCode, message: payload, unexpected: false };
    }

    const record = payload as Record<string, unknown>;
    const message =
      typeof record.message === 'string' || Array.isArray(record.message)
        ? (record.message as string | string[])
        : exception.message;

    return {
      statusCode,
      message,
      ...(typeof record.error === 'string' ? { error: record.error } : {}),
      unexpected: false,
    };
  }

  private fromPrismaKnownError(exception: Prisma.PrismaClientKnownRequestError): ResolvedError {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Resource already exists',
          error: 'Conflict',
          unexpected: false,
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Related resource does not exist',
          error: 'Conflict',
          unexpected: false,
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
          error: 'Not Found',
          unexpected: false,
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'Internal Server Error',
          unexpected: true,
        };
    }
  }
}
