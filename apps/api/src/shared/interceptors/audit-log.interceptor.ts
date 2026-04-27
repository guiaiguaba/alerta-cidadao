// apps/api/src/shared/interceptors/audit-log.interceptor.ts
// Registra automaticamente todas as operações de escrita (POST/PATCH/DELETE)

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { TenantPrismaService } from '../database/tenant-prisma.service';

const AUDITED_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

// Rotas excluídas do audit (muito verbosas ou sem relevância)
const EXCLUDED_PATHS = [
  '/auth/refresh',
  '/auth/me',
  '/occurrences/sync', // O próprio sync já registra na timeline
  '/notifications',
  '/health',
];

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly db: TenantPrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    const shouldAudit =
      AUDITED_METHODS.includes(req.method) &&
      !EXCLUDED_PATHS.some(p => req.path.includes(p)) &&
      req.schemaName; // Só audita requests com tenant resolvido

    if (!shouldAudit) return next.handle();

    const startedAt = Date.now();

    return next.handle().pipe(
      tap(async (responseBody) => {
        await this.writeLog(req, responseBody, null, Date.now() - startedAt);
      }),
      catchError(async (err) => {
        await this.writeLog(req, null, err, Date.now() - startedAt);
        return throwError(() => err);
      }),
    );
  }

  private async writeLog(
    req: any,
    responseBody: any,
    error: any,
    durationMs: number,
  ): Promise<void> {
    try {
      const prisma = await this.db.forTenant(req.schemaName);

      // Extrair recurso e ID da URL
      const [, resource, resourceId] = req.path.split('/').filter(Boolean);

      // Sanitizar body (remover senhas e tokens)
      const sanitizedBody = this.sanitizeBody(req.body);

      await prisma.$executeRaw`
        INSERT INTO audit_logs (
          user_id, user_email, action, resource, resource_id,
          ip_address, user_agent, changes, metadata
        ) VALUES (
          ${req.user?.id ?? null},
          ${req.user?.email ?? null},
          ${req.method},
          ${resource ?? 'unknown'},
          ${resourceId ?? null},
          ${req.ip ?? null}::inet,
          ${req.headers['user-agent']?.slice(0, 500) ?? null},
          ${JSON.stringify({ body: sanitizedBody })}::jsonb,
          ${JSON.stringify({
            path: req.path,
            statusCode: error ? error.status ?? 500 : 200,
            durationMs,
            error: error?.message ?? null,
          })}::jsonb
        )
      `;
    } catch (err) {
      // Nunca deixar o audit log quebrar a requisição principal
      this.logger.error(`Falha ao registrar audit log: ${err.message}`);
    }
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = [
      'password', 'password_hash', 'refreshToken', 'idToken',
      'token', 'secret', 'apiKey', 'fcm_tokens',
    ];

    const sanitized = { ...body };
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    }

    return sanitized;
  }
}
