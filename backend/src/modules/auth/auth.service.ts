import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { FirebaseService } from '../../infra/firebase/firebase.service';
import { DatabaseService } from '../../infra/database/database.service';
import { SyncUserDto } from './dto/sync-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private firebase: FirebaseService,
    private db: DatabaseService,
  ) {}

  async syncUser(dto: SyncUserDto, tenant: any) {
    let decoded: any;
    try {
      decoded = await this.firebase.auth.verifyIdToken(dto.id_token);
    } catch {
      throw new UnauthorizedException('ID Token inválido');
    }

    const existing = await this.db.knex('users')
      .where({ tenant_id: tenant.id, firebase_uid: decoded.uid })
      .first();

    if (existing) {
      const [updated] = await this.db.knex('users')
        .where({ id: existing.id })
        .update({
          email: decoded.email ?? existing.email,
          name: decoded.name ?? existing.name,
          avatar_url: decoded.picture ?? existing.avatar_url,
          fcm_token: dto.fcm_token ?? existing.fcm_token,
          last_login_at: this.db.knex.fn.now(),
        })
        .returning('*');
      return this.sanitize(updated);
    }

    const [created] = await this.db.knex('users').insert({
      tenant_id: tenant.id,
      firebase_uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      avatar_url: decoded.picture,
      fcm_token: dto.fcm_token,
      role: 'citizen',
      last_login_at: this.db.knex.fn.now(),
    }).returning('*');

    this.logger.log(`Novo usuário sincronizado: ${created.id} tenant=${tenant.slug}`);
    return this.sanitize(created);
  }

  private sanitize(user: any) {
    const { fcm_token, ...safe } = user;
    return safe;
  }
}
