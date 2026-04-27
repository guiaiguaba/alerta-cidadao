// apps/api/src/modules/occurrences/occurrences.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import { OccurrencesService } from './occurrences.service';
import { FilesService } from '../files/files.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, Role, CurrentUser } from '../../shared/decorators/index';
import { Public } from '../../shared/decorators/public.decorator';
import { TenantRequest } from '../tenants/tenant.middleware';
import {
  CreateOccurrenceDto,
  UpdateStatusDto,
  ListOccurrencesQueryDto,
  SyncBatchDto,
} from './dto/occurrence.dto';

@ApiTags('Occurrences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('occurrences')
export class OccurrencesController {
  constructor(
    private readonly occurrencesService: OccurrencesService,
    private readonly filesService: FilesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar ocorrências com filtros e paginação' })
  list(@Query() query: ListOccurrencesQueryDto, @Req() req: TenantRequest) {
    const bbox = query.bbox
      ? (query.bbox.split(',').map(Number) as [number, number, number, number])
      : undefined;
    return this.occurrencesService.list(
      { ...query, bbox },
      req.schemaName,
    );
  }

  @Get('map')
  @Public()
  @ApiOperation({ summary: 'GeoJSON para mapa (ocorrências públicas)' })
  mapData(@Query() query: ListOccurrencesQueryDto, @Req() req: TenantRequest) {
    const bbox = query.bbox
      ? (query.bbox.split(',').map(Number) as [number, number, number, number])
      : undefined;
    return this.occurrencesService.getMapGeoJson({ ...query, bbox }, req.schemaName);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar nova ocorrência' })
  create(
    @Body() dto: CreateOccurrenceDto,
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.occurrencesService.create(dto, userId, tenantId, req.schemaName);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da ocorrência com timeline e mídia' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: TenantRequest,
  ) {
    return this.occurrencesService.findOne(id, req.schemaName);
  }

  @Patch(':id/status')
  @Roles(Role.AGENT, Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: 'Atualizar status (agente+)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.occurrencesService.updateStatus(
      id, dto, userId, userRole, req.schemaName,
    );
  }

  @Post(':id/assign')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: 'Atribuir ocorrência a agente/equipe' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { agentId?: string; teamId?: string },
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
  ) {
    return this.occurrencesService.assign(
      id, body.agentId, body.teamId, userId, req.schemaName,
    );
  }

  @Post(':id/media')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de foto/vídeo para ocorrência' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('phase') phase: string = 'report',
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
  ) {
    const uploaded = await this.filesService.uploadOccurrenceMedia(
      file,
      id,
      req.schemaName,
    );
    return this.occurrencesService.addMedia(
      id, userId, uploaded, phase, req.schemaName,
    );
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Histórico de ações da ocorrência' })
  timeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: TenantRequest,
  ) {
    return this.occurrencesService.getTimeline(id, req.schemaName);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sincronização em lote (modo offline)' })
  sync(
    @Body() dto: SyncBatchDto,
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.occurrencesService.syncBatch(
      dto.items as any,
      userId,
      tenantId,
      req.schemaName,
    );
  }
}
