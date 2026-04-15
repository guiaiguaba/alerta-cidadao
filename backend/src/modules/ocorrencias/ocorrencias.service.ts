import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OcorrenciasRepository } from './ocorrencias.repository';
import { PrioridadeService } from './prioridade.service';
import { StorageService } from '../../infra/storage/storage.service';
import { DatabaseService } from '../../infra/database/database.service';
import { CreateOcorrenciaDto } from './dto/create-ocorrencia.dto';
import { UpdateOcorrenciaDto } from './dto/update-ocorrencia.dto';
import { ListOcorrenciasDto } from './dto/list-ocorrencias.dto';

@Injectable()
export class OcorrenciasService {
  private readonly logger = new Logger(OcorrenciasService.name);

  constructor(
    private repo: OcorrenciasRepository,
    private prioridadeService: PrioridadeService,
    private storage: StorageService,
    private db: DatabaseService,
    @InjectQueue('notificacoes') private notifQueue: Queue,
  ) {}

  async create(dto: CreateOcorrenciaDto, user: any, tenant: any) {
    // Deduplicação offline: client_id já existente = idempotente
    if (dto.client_id) {
      const existing = await this.repo.findByClientId(tenant.id, dto.client_id);
      if (existing) return existing;
    }

    const prioridade = this.prioridadeService.calcular(dto.descricao);

    const ocorrencia = await this.repo.create({
      tenant_id: tenant.id,
      user_id: user.id,
      descricao: dto.descricao,
      categoria_id: dto.categoria_id ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      endereco: dto.endereco ?? null,
      prioridade,
      client_id: dto.client_id ?? null,
      synced_at: new Date(),
    });

    // Enfileira notificação assíncrona
    await this.notifQueue.add('nova-ocorrencia', {
      ocorrenciaId: ocorrencia.id,
      tenantId: tenant.id,
      prioridade,
    });

    await this.audit(tenant.id, user.id, 'criar_ocorrencia', ocorrencia.id, dto);

    return ocorrencia;
  }

  async findAll(dto: ListOcorrenciasDto, user: any, tenant: any) {
    const filters: any = {
      page: dto.page ?? 1,
      limit: Math.min(dto.limit ?? 20, 100),
    };

    if (dto.status) filters.status = dto.status;
    if (dto.prioridade) filters.prioridade = dto.prioridade;
    if (dto.categoria_id) filters.categoriaId = dto.categoria_id;

    // citizen só vê as próprias
    if (user.role === 'citizen') filters.userId = user.id;

    return this.repo.findWithFilters(tenant.id, filters);
  }

  async findOne(id: string, user: any, tenant: any) {
    const ocorrencia = await this.repo.findById(tenant.id, id);
    if (!ocorrencia) throw new NotFoundException('Ocorrência não encontrada');

    if (user.role === 'citizen' && ocorrencia.user_id !== user.id) {
      throw new ForbiddenException('Acesso negado');
    }

    const imagens = await this.repo.getImagens(tenant.id, id);
    return { ...ocorrencia, imagens };
  }

  async update(id: string, dto: UpdateOcorrenciaDto, user: any, tenant: any) {
    const ocorrencia = await this.repo.findById(tenant.id, id);
    if (!ocorrencia) throw new NotFoundException('Ocorrência não encontrada');

    if (user.role === 'citizen') throw new ForbiddenException('Apenas agentes/admin podem atualizar');

    const payload: any = {};
    if (dto.status) {
      payload.status = dto.status;
      if (dto.status === 'resolvida') {
        payload.resolvida_at = new Date();
        payload.resolucao_nota = dto.resolucao_nota ?? null;
      }
    }
    if (dto.prioridade) payload.prioridade = dto.prioridade;
    if (dto.agent_id !== undefined) payload.agent_id = dto.agent_id;

    const updated = await this.repo.update(tenant.id, id, payload);
    await this.audit(tenant.id, user.id, 'atualizar_ocorrencia', id, dto);

    // Notifica autor
    await this.notifQueue.add('status-atualizado', {
      ocorrenciaId: id,
      tenantId: tenant.id,
      autorId: ocorrencia.user_id,
      novoStatus: dto.status,
    });

    return updated;
  }

  async addImagens(
    id: string,
    files: Express.Multer.File[],
    tipo: string,
    user: any,
    tenant: any,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('Nenhum arquivo enviado');
    if (files.length > 5) throw new BadRequestException('Máximo 5 imagens por envio');

    const ocorrencia = await this.repo.findById(tenant.id, id);
    if (!ocorrencia) throw new NotFoundException('Ocorrência não encontrada');

    if (user.role === 'citizen' && ocorrencia.user_id !== user.id) {
      throw new ForbiddenException('Acesso negado');
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const { key, url } = await this.storage.upload(
          file.buffer,
          file.mimetype,
          `${tenant.slug}/ocorrencias/${id}`,
        );

        return this.repo.addImagem({
          tenant_id: tenant.id,
          ocorrencia_id: id,
          uploader_id: user.id,
          url,
          storage_key: key,
          tipo: tipo ?? 'registro',
          tamanho_bytes: file.size,
          mime_type: file.mimetype,
        });
      }),
    );

    return results;
  }

  private async audit(
    tenantId: string,
    userId: string,
    acao: string,
    entidadeId: string,
    payload: any,
  ) {
    await this.db.knex('auditoria_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      acao,
      entidade: 'ocorrencias',
      entidade_id: entidadeId,
      payload: JSON.stringify(payload),
    });
  }
}
