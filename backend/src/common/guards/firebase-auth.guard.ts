import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseService } from '../../infra/firebase/firebase.service';
import { DatabaseService } from '../../infra/database/database.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private firebase: FirebaseService,
    private db: DatabaseService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const authHeader: string = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }

    const token = authHeader.slice(7);

    let decoded: any;
    try {
      decoded = await this.firebase.auth.verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    const tenant = req.tenant;
    if (!tenant) throw new UnauthorizedException('Tenant não identificado');

    const user = await this.db.knex('users')
      .where({ tenant_id: tenant.id, firebase_uid: decoded.uid, active: true })
      .first();

    if (!user) throw new UnauthorizedException('Usuário não autorizado neste tenant');

    req.user = user;
    return true;
  }
}
