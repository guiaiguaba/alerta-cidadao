import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../infra/firebase/firebase.service';
import { DatabaseService } from '../../infra/database/database.service';

const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  resolvida: 'Resolvida ✅',
  cancelada: 'Cancelada',
};

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(
    private firebase: FirebaseService,
    private db: DatabaseService,
  ) {}

  async notificarAgentesNovaOcorrencia(tenantId: string, ocorrenciaId: string, prioridade: string) {
    const agentes = await this.db.knex('users')
      .where({ tenant_id: tenantId, active: true })
      .whereIn('role', ['agent', 'admin'])
      .whereNotNull('fcm_token')
      .select('fcm_token');

    const tokens = agentes.map((a: any) => a.fcm_token).filter(Boolean);
    if (!tokens.length) return;

    const titulo = prioridade === 'critica' ? '🚨 Ocorrência CRÍTICA!' : '📍 Nova Ocorrência';
    const corpo = `Prioridade: ${prioridade.toUpperCase()} — verifique o painel`;

    await this.sendBatch(tokens, titulo, corpo, {
      type: 'nova_ocorrencia',
      ocorrencia_id: ocorrenciaId,
    });

    await this.registrar(tenantId, ocorrenciaId, titulo, corpo);
  }

  async notificarAutorStatusAtualizado(
    tenantId: string,
    userId: string,
    ocorrenciaId: string,
    novoStatus: string,
  ) {
    const user = await this.db.knex('users')
      .where({ id: userId, tenant_id: tenantId })
      .first();

    if (!user?.fcm_token) return;

    const titulo = 'Sua ocorrência foi atualizada';
    const corpo = `Status: ${STATUS_LABELS[novoStatus] ?? novoStatus}`;

    await this.firebase.sendToToken(user.fcm_token, titulo, corpo, {
      type: 'status_atualizado',
      ocorrencia_id: ocorrenciaId,
      status: novoStatus,
    });
  }

  private async sendBatch(tokens: string[], title: string, body: string, data?: Record<string, string>) {
    // FCM suporta até 500 tokens por lote
    const CHUNK = 500;
    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      try {
        await this.firebase.messaging.sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data,
          android: { priority: 'high' },
        });
      } catch (err) {
        this.logger.error('Erro ao enviar FCM batch', err);
      }
    }
  }

  private async registrar(tenantId: string, ocorrenciaId: string, titulo: string, corpo: string) {
    await this.db.knex('notificacoes').insert({
      tenant_id: tenantId,
      ocorrencia_id: ocorrenciaId,
      titulo,
      corpo,
      enviada: true,
      enviada_at: new Date(),
    });
  }
}
