import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../infra/database/database.service';

export interface CreateTenantDto {
  slug: string;
  name: string;
  plan?: string;
}

@Injectable()
export class TenantsService {
  constructor(private db: DatabaseService) {}

  async create(dto: CreateTenantDto) {
    const existing = await this.db.knex('tenants').where({ slug: dto.slug }).first();
    if (existing) throw new ConflictException(`Tenant "${dto.slug}" já existe`);

    const [tenant] = await this.db.knex('tenants')
      .insert({ slug: dto.slug, name: dto.name, plan: dto.plan ?? 'free' })
      .returning('*');

    // Semente de categorias padrão
    await this.seedCategorias(tenant.id);

    return tenant;
  }

  async findAll() {
    return this.db.knex('tenants').select('id', 'slug', 'name', 'plan', 'active', 'created_at');
  }

  async findBySlug(slug: string) {
    const tenant = await this.db.knex('tenants').where({ slug }).first();
    if (!tenant) throw new NotFoundException(`Tenant "${slug}" não encontrado`);
    return tenant;
  }

  async stats(tenantId: string) {
    const [[ocorrencias], [users]] = await Promise.all([
      this.db.knex('ocorrencias')
        .where({ tenant_id: tenantId })
        .select(
          this.db.knex.raw('COUNT(*) as total'),
          this.db.knex.raw("COUNT(*) FILTER (WHERE status = 'aberta') as abertas"),
          this.db.knex.raw("COUNT(*) FILTER (WHERE status = 'em_andamento') as em_andamento"),
          this.db.knex.raw("COUNT(*) FILTER (WHERE status = 'resolvida') as resolvidas"),
        ),
      this.db.knex('users')
        .where({ tenant_id: tenantId, active: true })
        .select(
          this.db.knex.raw('COUNT(*) as total'),
          this.db.knex.raw("COUNT(*) FILTER (WHERE role = 'citizen') as cidadaos"),
          this.db.knex.raw("COUNT(*) FILTER (WHERE role = 'agent') as agentes"),
        ),
    ]);

    return { ocorrencias, users };
  }

  private async seedCategorias(tenantId: string) {
    const categorias = [
      { nome: 'Buraco na Via', icone: 'road', cor: '#F59E0B' },
      { nome: 'Iluminação', icone: 'lightbulb', cor: '#EAB308' },
      { nome: 'Enchente', icone: 'water', cor: '#3B82F6' },
      { nome: 'Incêndio', icone: 'fire', cor: '#EF4444' },
      { nome: 'Lixo/Entulho', icone: 'trash', cor: '#84CC16' },
      { nome: 'Deslizamento', icone: 'mountain', cor: '#78716C' },
      { nome: 'Outros', icone: 'alert', cor: '#6B7280' },
    ];

    await this.db.knex('categorias').insert(
      categorias.map((c) => ({ ...c, tenant_id: tenantId })),
    );
  }
}
