// apps/api/src/modules/users/users.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, MinLength, MaxLength, Matches } from 'class-validator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, Role, CurrentUser } from '../../shared/decorators/index';
import { TenantRequest } from '../tenants/tenant.middleware';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { FilesService } from '../files/files.service';

class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString()
  avatarUrl?: string;

  @IsOptional()
  @Matches(/^-?[0-9]{1,3}\.[0-9]+$/)
  homeLat?: string;

  @IsOptional()
  @Matches(/^-?[0-9]{1,3}\.[0-9]+$/)
  homeLng?: string;
}

class UpdateFcmTokenDto {
  @IsString() @MinLength(10)
  token: string;

  @IsIn(['add', 'remove'])
  action: 'add' | 'remove';
}

class UpdateUserRoleDto {
  @IsIn(['citizen', 'agent', 'supervisor', 'admin'])
  role: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly filesService: FilesService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  async getProfile(@CurrentUser() user: any, @Req() req: TenantRequest) {
    const prisma = await this.db.forTenant(req.schemaName);
    const [profile] = await prisma.$queryRaw<any[]>`
      SELECT
        u.id, u.name, u.email, u.phone, u.avatar_url, u.role,
        u.home_lat, u.home_lng, u.phone_verified, u.email_verified,
        u.last_login_at, u.created_at,
        COUNT(o.id) AS total_occurrences,
        COUNT(o.id) FILTER (WHERE o.status = 'resolved') AS resolved_occurrences
      FROM users u
      LEFT JOIN occurrences o ON o.reporter_id = u.id
      WHERE u.id = ${user.id}
      GROUP BY u.id
    `;
    return profile;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar perfil' })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser('id') userId: string,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);

    const updates: string[] = [];
    if (dto.name) updates.push(`name = '${dto.name.replace(/'/g, "''")}'`);
    if (dto.avatarUrl) updates.push(`avatar_url = '${dto.avatarUrl}'`);
    if (dto.homeLat) updates.push(`home_lat = ${dto.homeLat}`);
    if (dto.homeLng) updates.push(`home_lng = ${dto.homeLng}`);

    if (updates.length) {
      await prisma.$executeRawUnsafe(`
        UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = '${userId}'
      `);
    }

    return this.getProfile({ id: userId }, req);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload de avatar' })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
    @Req() req: TenantRequest,
  ) {
    const avatarUrl = await this.filesService.uploadUserAvatar(
      file,
      userId,
      req.schemaName,
    );

    const prisma = await this.db.forTenant(req.schemaName);
    await prisma.$executeRaw`
      UPDATE users SET avatar_url = ${avatarUrl}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    return { avatarUrl };
  }

  @Patch('me/fcm-token')
  @ApiOperation({ summary: 'Atualizar token FCM do dispositivo' })
  async updateFcmToken(
    @Body() dto: UpdateFcmTokenDto,
    @CurrentUser('id') userId: string,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);

    if (dto.action === 'add') {
      await prisma.$executeRaw`
        UPDATE users
        SET fcm_tokens = array_append(
          array_remove(fcm_tokens, ${dto.token}),  -- Remove duplicata antes
          ${dto.token}
        ),
        updated_at = NOW()
        WHERE id = ${userId}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE users
        SET fcm_tokens = array_remove(fcm_tokens, ${dto.token}),
            updated_at = NOW()
        WHERE id = ${userId}
      `;
    }

    return { action: dto.action, success: true };
  }

  @Get('me/notifications')
  @ApiOperation({ summary: 'Feed de notificações do usuário' })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    return prisma.$queryRaw`
      SELECT id, type, title, body, data, is_read, created_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
  }

  @Post('me/notifications/read-all')
  @ApiOperation({ summary: 'Marcar todas notificações como lidas' })
  async readAllNotifications(
    @CurrentUser('id') userId: string,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    await prisma.$executeRaw`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = ${userId} AND is_read = false
    `;
    return { success: true };
  }

  // ==========================================
  // ADMIN: Gerenciar outros usuários
  // ==========================================

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Alterar role de usuário (admin)' })
  async updateRole(
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('id') adminId: string,
    @Req() req: TenantRequest,
  ) {
    if (targetId === adminId) {
      return { error: 'Não é possível alterar seu próprio role' };
    }

    const prisma = await this.db.forTenant(req.schemaName);
    await prisma.$executeRaw`
      UPDATE users SET role = ${dto.role}, updated_at = NOW()
      WHERE id = ${targetId}
    `;
    return { updated: true, newRole: dto.role };
  }

  @Patch(':id/block')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Bloquear usuário' })
  async blockUser(
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() body: { reason: string; until?: string },
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    await prisma.$executeRaw`
      UPDATE users
      SET is_blocked = true,
          blocked_reason = ${body.reason},
          blocked_until = ${body.until ?? null}::timestamptz,
          updated_at = NOW()
      WHERE id = ${targetId}
    `;
    return { blocked: true };
  }

  @Patch(':id/unblock')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Desbloquear usuário' })
  async unblockUser(
    @Param('id', ParseUUIDPipe) targetId: string,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    await prisma.$executeRaw`
      UPDATE users
      SET is_blocked = false, blocked_reason = NULL, blocked_until = NULL, updated_at = NOW()
      WHERE id = ${targetId}
    `;
    return { unblocked: true };
  }
}
