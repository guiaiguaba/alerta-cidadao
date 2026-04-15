import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../infra/database/database.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  async findAll(tenantId: string) {
    return this.db.knex('users')
      .where({ tenant_id: tenantId, active: true })
      .select('id', 'email', 'name', 'avatar_url', 'role', 'last_login_at', 'created_at')
      .orderBy('created_at', 'desc');
  }

  async findOne(tenantId: string, userId: string) {
    const user = await this.db.knex('users')
      .where({ tenant_id: tenantId, id: userId, active: true })
      .select('id', 'email', 'name', 'avatar_url', 'role', 'last_login_at', 'created_at')
      .first();
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async updateRole(tenantId: string, userId: string, dto: UpdateUserRoleDto, actorRole: string) {
    if (actorRole !== 'admin') throw new ForbiddenException('Apenas admin pode alterar perfis');

    const user = await this.db.knex('users')
      .where({ tenant_id: tenantId, id: userId })
      .first();
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // CORREÇÃO AQUI: Passando os campos como um array para satisfazer o TypeScript/Knex
    const [updated] = await this.db.knex('users')
      .where({ id: userId, tenant_id: tenantId })
      .update({ role: dto.role })
      .returning(['id', 'email', 'name', 'role']);

    return updated;
  }

  async updateFcmToken(tenantId: string, userId: string, token: string) {
    await this.db.knex('users')
      .where({ id: userId, tenant_id: tenantId })
      .update({ fcm_token: token });
  }

  async deactivate(tenantId: string, userId: string, actorRole: string) {
    if (actorRole !== 'admin') throw new ForbiddenException('Apenas admin pode desativar usuários');
    await this.db.knex('users')
      .where({ id: userId, tenant_id: tenantId })
      .update({ active: false });
    return { success: true };
  }
}