// apps/api/src/modules/notifications/notifications.service.ts
// Serviço unificado de notificações: FCM + banco de dados

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType =
  | 'occurrence_update'
  | 'occurrence_assigned'
  | 'alert'
  | 'sla_breach'
  | 'new_occurrence';

export interface SendNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>; // FCM requer strings
  schemaName: string;
}

export interface BroadcastAlertDto {
  title: string;
  message: string;
  alertId: string;
  severity: string;
  targetUserIds?: string[];    // undefined = broadcast para todos
  targetRegions?: string[];
  schemaName: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly fcmProjectId: string;
  private readonly fcmAccessToken: string | null = null;
  private fcmTokenExpiry: number = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly db: TenantPrismaService,
  ) {
    this.fcmProjectId = config.get<string>('FCM_PROJECT_ID', '');
  }

  // ==========================================
  // NOTIFICAÇÃO INDIVIDUAL
  // ==========================================

  async sendToUser(dto: SendNotificationDto): Promise<void> {
    const prisma = await this.db.forTenant(dto.schemaName);

    // 1. Persistir no banco (feed de notificações)
    const notifId = uuidv4();
    await prisma.$executeRaw`
      INSERT INTO notifications (id, user_id, type, title, body, data, delivery_status)
      VALUES (
        ${notifId},
        ${dto.userId},
        ${dto.type},
        ${dto.title},
        ${dto.body},
        ${JSON.stringify(dto.data ?? {})}::jsonb,
        'pending'
      )
    `;

    // 2. Buscar tokens FCM do usuário
    const [user] = await prisma.$queryRaw<any[]>`
      SELECT fcm_tokens FROM users WHERE id = ${dto.userId} AND is_active = true LIMIT 1
    `;

    if (!user || !user.fcm_tokens?.length) {
      await prisma.$executeRaw`
        UPDATE notifications SET delivery_status = 'no_token' WHERE id = ${notifId}
      `;
      return;
    }

    // 3. Enviar via FCM
    const results = await this.sendFcmToTokens(
      user.fcm_tokens,
      dto.title,
      dto.body,
      dto.data,
    );

    // 4. Remover tokens inválidos
    const invalidTokens = results
      .filter(r => !r.success && r.shouldRemove)
      .map(r => r.token);

    if (invalidTokens.length > 0) {
      await prisma.$executeRaw`
        UPDATE users
        SET fcm_tokens = array(
          SELECT unnest(fcm_tokens) EXCEPT SELECT unnest(${invalidTokens}::text[])
        )
        WHERE id = ${dto.userId}
      `;
    }

    const delivered = results.some(r => r.success);
    await prisma.$executeRaw`
      UPDATE notifications
      SET delivery_status = ${delivered ? 'delivered' : 'failed'},
          fcm_message_id = ${results.find(r => r.success)?.messageId ?? null}
      WHERE id = ${notifId}
    `;
  }

  // ==========================================
  // BROADCAST DE ALERTA (MASSIVO)
  // ==========================================

  async broadcastAlert(dto: BroadcastAlertDto): Promise<number> {
    const prisma = await this.db.forTenant(dto.schemaName);

    // Buscar usuários-alvo
    let query: string;
    const params: any[] = [];

    if (dto.targetUserIds?.length) {
      query = `
        SELECT id, fcm_tokens FROM users
        WHERE id = ANY($1::uuid[]) AND is_active = true AND array_length(fcm_tokens, 1) > 0
      `;
      params.push(dto.targetUserIds);
    } else if (dto.targetRegions?.length) {
      // Usuários que estão nas regiões alvo (baseado em home_lat/home_lng)
      // Por simplicidade: todos os usuários do tenant por enquanto
      // Em produção: cruzar com polígonos das regiões via PostGIS
      query = `
        SELECT id, fcm_tokens FROM users
        WHERE is_active = true AND array_length(fcm_tokens, 1) > 0
      `;
    } else {
      // Broadcast total
      query = `
        SELECT id, fcm_tokens FROM users
        WHERE is_active = true AND array_length(fcm_tokens, 1) > 0
      `;
    }

    const users = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    if (users.length === 0) return 0;

    // Enviar em lotes de 500 (limite FCM multicast)
    const BATCH_SIZE = 500;
    let totalSent = 0;

    const allTokens = users.flatMap(u => u.fcm_tokens as string[]);

    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
      const batch = allTokens.slice(i, i + BATCH_SIZE);
      try {
        await this.sendFcmMulticast(batch, dto.title, dto.message, {
          type: 'alert',
          alertId: dto.alertId,
          severity: dto.severity,
        });
        totalSent += batch.length;
      } catch (err) {
        this.logger.error(`Erro no lote FCM ${i}: ${err.message}`);
      }
    }

    this.logger.log(`Alerta ${dto.alertId} enviado para ${totalSent} dispositivos`);
    return totalSent;
  }

  // ==========================================
  // MÉTODOS ESPECÍFICOS (convenências)
  // ==========================================

  async notifyOccurrenceUpdate(
    userId: string,
    occurrenceId: string,
    protocol: string,
    newStatus: string,
    schemaName: string,
  ) {
    const statusLabels: Record<string, string> = {
      assigned:    'Em atendimento',
      in_progress: 'Em andamento',
      resolved:    'Resolvido ✅',
      rejected:    'Rejeitado',
    };

    await this.sendToUser({
      userId,
      type: 'occurrence_update',
      title: `Ocorrência ${protocol}`,
      body: `Status atualizado para: ${statusLabels[newStatus] ?? newStatus}`,
      data: { occurrenceId, status: newStatus, screen: 'occurrence_detail' },
      schemaName,
    });
  }

  async notifyAgentAssignment(
    agentId: string,
    occurrenceId: string,
    protocol: string,
    priority: string,
    schemaName: string,
  ) {
    const priorityEmoji: Record<string, string> = {
      critical: '🚨',
      high:     '🔴',
      medium:   '🟡',
      low:      '🟢',
    };

    await this.sendToUser({
      userId: agentId,
      type: 'occurrence_assigned',
      title: `${priorityEmoji[priority] ?? ''} Nova ocorrência atribuída`,
      body: `Protocolo ${protocol} — prioridade ${priority.toUpperCase()}`,
      data: {
        occurrenceId,
        priority,
        screen: 'agent_occurrence_detail',
      },
      schemaName,
    });
  }

  async notifySlaBreached(
    supervisorId: string,
    occurrenceId: string,
    protocol: string,
    priority: string,
    schemaName: string,
  ) {
    await this.sendToUser({
      userId: supervisorId,
      type: 'sla_breach',
      title: '⚠️ SLA Violado',
      body: `Ocorrência ${protocol} (${priority}) ultrapassou o prazo de atendimento`,
      data: { occurrenceId, screen: 'occurrence_detail' },
      schemaName,
    });
  }

  // ==========================================
  // FCM HTTP V1 API
  // ==========================================

  private async sendFcmToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ token: string; success: boolean; messageId?: string; shouldRemove?: boolean }[]> {
    const accessToken = await this.getFcmAccessToken();
    const results = [];

    // FCM V1 não suporta multicast nativo — enviar individualmente ou via batch
    // Para volume: usar /v1/projects/{id}/messages:send com loop
    for (const token of tokens) {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${this.fcmProjectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data: data ?? {},
                android: {
                  priority: 'high',
                  notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' },
                },
                apns: {
                  payload: { aps: { sound: 'default', badge: 1 } },
                },
              },
            }),
          },
        );

        const json = await res.json();

        if (res.ok) {
          results.push({ token, success: true, messageId: json.name });
        } else {
          const shouldRemove =
            json.error?.status === 'UNREGISTERED' ||
            json.error?.status === 'INVALID_ARGUMENT';
          results.push({ token, success: false, shouldRemove });
          if (!shouldRemove) {
            this.logger.warn(`FCM erro para token ${token.slice(-8)}: ${json.error?.message}`);
          }
        }
      } catch (err) {
        this.logger.error(`FCM exception: ${err.message}`);
        results.push({ token, success: false, shouldRemove: false });
      }
    }

    return results;
  }

  private async sendFcmMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    // FCM V1 não tem endpoint de multicast; usar Legacy HTTP ou enviar individualmente
    // Para simplicidade: reutilizar sendFcmToTokens
    await this.sendFcmToTokens(tokens, title, body, data);
  }

  /**
   * Obtém access token OAuth2 para FCM V1
   * Cache de 55 minutos (tokens duram 60min)
   */
  private async getFcmAccessToken(): Promise<string> {
    if (this.fcmAccessToken && Date.now() < this.fcmTokenExpiry) {
      return this.fcmAccessToken;
    }

    const privateKey = this.config.get<string>('FCM_PRIVATE_KEY', '')
      .replace(/\\n/g, '\n');
    const clientEmail = this.config.get<string>('FCM_CLIENT_EMAIL', '');

    if (!privateKey || !clientEmail) {
      this.logger.warn('FCM não configurado — notificações push desabilitadas');
      return 'dev_token';
    }

    // JWT para Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    // Em produção: usar googleapis ou google-auth-library
    // Aqui usando implementação manual do JWT para evitar dependência extra
    const jwt = await this.signJwt(payload, privateKey);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(`Falha OAuth2 FCM: ${json.error_description}`);
    }

    // Cache por 55 minutos
    (this as any).fcmAccessToken = json.access_token;
    this.fcmTokenExpiry = Date.now() + 55 * 60 * 1000;

    return json.access_token;
  }

  private async signJwt(payload: object, privateKey: string): Promise<string> {
    const { createSign } = await import('crypto');

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${header}.${body}`;

    const sign = createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = sign.sign(privateKey, 'base64url');

    return `${signingInput}.${signature}`;
  }
}
