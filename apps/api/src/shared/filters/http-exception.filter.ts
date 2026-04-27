// apps/api/src/shared/filters/http-exception.filter.ts
// Formata todos os erros em um padrão consistente

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno do servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message ?? exception.message;
        error = resp.error ?? exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;

      // Erros do Prisma/PostgreSQL
      if (exception.message.includes('unique constraint')) {
        statusCode = HttpStatus.CONFLICT;
        error = 'Conflict';
        message = 'Registro duplicado';
      } else if (exception.message.includes('foreign key')) {
        statusCode = HttpStatus.BAD_REQUEST;
        error = 'Bad Request';
        message = 'Referência inválida';
      }
    }

    // Log de erros 5xx
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} — ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponse = {
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }
}
