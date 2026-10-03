import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      `req_${crypto.randomBytes(8).toString('hex')}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected server error occurred.';
    let code = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;

      if (typeof res === 'object' && res !== null) {
        title = res.title || exception.name || 'API Error';
        detail = res.detail || res.message || exception.message;
        code = res.code || this.inferCodeFromStatus(status);
      } else if (typeof res === 'string') {
        detail = res;
        code = this.inferCodeFromStatus(status);
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
      this.logger.error(`Unhandled API exception [Correlation: ${correlationId}]: ${exception.stack}`);
    }

    response.setHeader('Content-Type', 'application/problem+json');
    response.setHeader('X-Correlation-ID', correlationId);

    const problemDetails = {
      type: `https://taxflow.ai/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      detail,
      instance: request.url,
      code,
      timestamp: new Date().toISOString(),
      correlationId,
    };

    response.status(status).json(problemDetails);
  }

  private inferCodeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'UNPROCESSABLE_ENTITY';
      case 429:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
