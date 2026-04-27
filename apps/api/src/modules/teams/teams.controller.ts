// apps/api/src/modules/teams/teams.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, Role, CurrentUser } from '../../shared/decorators/index';
import { TenantRequest } from '../tenants/tenant.middleware';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { v4 as uuidv4 } from 'uuid';

class CreateTeamDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  regionCodes?: string[];
}

class AddTeamMemberDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsIn(['member', 'supervisor'])
  role?: string;
}

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly db: TenantPrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar equipes' })
  async list(@Req() req: TenantRequest) {
    const prisma = await this.db.forTenant(req.schemaName);
    return prisma.$queryRaw`
      SELECT
        t.*,
        COUNT(tm.user_id) AS member_count,
        json_agg(
          jsonb_build_object('id', u.id, 'name', u.name, 'role', tm.role)
        ) FILTER (WHERE u.id IS NOT NULL) AS members
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN users u ON u.id = tm.user_id
      WHERE t.is_active = true
      GROUP BY t.id
      ORDER BY t.name
    `;
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Criar equipe' })
  async create(
    @Body() dto: CreateTeamDto,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    const id = uuidv4();
    await prisma.$executeRaw`
      INSERT INTO teams (id, name, description, region_codes)
      VALUES (
        ${id},
        ${dto.name},
        ${dto.description ?? null},
        ${dto.regionCodes ?? []}::text[]
      )
    `;
    const [team] = await prisma.$queryRaw<any[]>`SELECT * FROM teams WHERE id = ${id}`;
    return team;
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Editar equipe' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateTeamDto>,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    const updates: string[] = [];
    if (dto.name) updates.push(`name = '${dto.name}'`);
    if (dto.description) updates.push(`description = '${dto.description}'`);
    if (dto.regionCodes) updates.push(`region_codes = ARRAY[${dto.regionCodes.map(r => `'${r}'`).join(',')}]`);

    if (updates.length) {
      await prisma.$executeRawUnsafe(
        `UPDATE teams SET ${updates.join(', ')} WHERE id = '${id}'`,
      );
    }
    const [team] = await prisma.$queryRaw<any[]>`SELECT * FROM teams WHERE id = ${id}`;
    return team;
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Desativar equipe' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    await prisma.$executeRaw`UPDATE teams SET is_active = false WHERE id = ${id}`;
    return { deactivated: true };
  }

  @Post(':id/members')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Adicionar membro à equipe' })
  async addMember(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Body() dto: AddTeamMemberDto,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    await prisma.$executeRaw`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${teamId}, ${dto.userId}, ${dto.role ?? 'member'})
      ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `;
    return { added: true };
  }

  @Delete(':id/members/:userId')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Remover membro da equipe' })
  async removeMember(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: TenantRequest,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    await prisma.$executeRaw`
      DELETE FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}
    `;
    return { removed: true };
  }
}
