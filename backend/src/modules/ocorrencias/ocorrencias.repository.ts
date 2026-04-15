import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database/database.service';

@Injectable()
export class OcorrenciasRepository {
  constructor(private db: DatabaseService) {}

  baseQuery(tenantId: string) {
    return this.db.knex('ocorrencias').where('ocorrencias.tenant_id', tenantId);
  }

  async findById(tenantId: string, id: string) {
    return this.db.knex('ocorrencias as o')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .leftJoin('users as a', 'a.id', 'o.agent_id')
      .leftJoin('categorias as c', 'c.id', 'o.categoria_id')
      .where('o.tenant_id', tenantId)
      .where('o.id', id)
      .select(
        'o.*',
        'u.name as autor_nome', 'u.email as autor_email',
        'a.name as agente_nome',
        'c.nome as categoria_nome', 'c.icone as categoria_icone', 'c.cor as categoria_cor',
      )
      .first();
  }

  async findWithFilters(tenantId: string, filters: {
    userId?: string;
    status?: string;
    prioridade?: string;
    categoriaId?: string;
    page: number;
    limit: number;
  }) {
    const query = this.db.knex('ocorrencias as o')
      .leftJoin('categorias as c', 'c.id', 'o.categoria_id')
      .where('o.tenant_id', tenantId);

    if (filters.userId) query.where('o.user_id', filters.userId);
    if (filters.status) query.where('o.status', filters.status);
    if (filters.prioridade) query.where('o.prioridade', filters.prioridade);
    if (filters.categoriaId) query.where('o.categoria_id', filters.categoriaId);

    const offset = (filters.page - 1) * filters.limit;

    const [rows, [{ count }]] = await Promise.all([
      query.clone()
        .select('o.*', 'c.nome as categoria_nome', 'c.cor as categoria_cor')
        .orderBy('o.created_at', 'desc')
        .limit(filters.limit)
        .offset(offset),
      query.clone().count('o.id as count'),
    ]);

    return {
      data: rows,
      meta: {
        total: Number(count),
        page: filters.page,
        limit: filters.limit,
        pages: Math.ceil(Number(count) / filters.limit),
      },
    };
  }

  async create(payload: Record<string, any>) {
    const [row] = await this.db.knex('ocorrencias').insert(payload).returning('*');
    return row;
  }

  async update(tenantId: string, id: string, payload: Record<string, any>) {
    const [row] = await this.db.knex('ocorrencias')
      .where({ id, tenant_id: tenantId })
      .update({ ...payload, updated_at: this.db.knex.fn.now() })
      .returning('*');
    return row;
  }

  async addImagem(payload: Record<string, any>) {
    const [row] = await this.db.knex('ocorrencia_imagens').insert(payload).returning('*');
    return row;
  }

  async getImagens(tenantId: string, ocorrenciaId: string) {
    return this.db.knex('ocorrencia_imagens')
      .where({ ocorrencia_id: ocorrenciaId, tenant_id: tenantId })
      .orderBy('created_at', 'asc');
  }

  async findByClientId(tenantId: string, clientId: string) {
    return this.db.knex('ocorrencias')
      .where({ tenant_id: tenantId, client_id: clientId })
      .first();
  }
}
