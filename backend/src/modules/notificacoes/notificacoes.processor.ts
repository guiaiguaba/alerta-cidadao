import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NotificacoesService } from './notificacoes.service';

@Processor('notificacoes')
export class NotificacoesProcessor {
  private readonly logger = new Logger(NotificacoesProcessor.name);

  constructor(private svc: NotificacoesService) {}

  @Process('nova-ocorrencia')
  async handleNovaOcorrencia(job: Job<{ ocorrenciaId: string; tenantId: string; prioridade: string }>) {
    const { ocorrenciaId, tenantId, prioridade } = job.data;
    await this.svc.notificarAgentesNovaOcorrencia(tenantId, ocorrenciaId, prioridade);
  }

  @Process('status-atualizado')
  async handleStatusAtualizado(job: Job<{
    ocorrenciaId: string;
    tenantId: string;
    autorId: string;
    novoStatus: string;
  }>) {
    const { ocorrenciaId, tenantId, autorId, novoStatus } = job.data;
    await this.svc.notificarAutorStatusAtualizado(tenantId, autorId, ocorrenciaId, novoStatus);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.name} #${job.id} falhou: ${error.message}`);
  }
}
