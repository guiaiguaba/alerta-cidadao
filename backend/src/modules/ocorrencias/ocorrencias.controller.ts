import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { OcorrenciasService } from './ocorrencias.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentTenant } from '../../common/decorators';
import { CreateOcorrenciaDto } from './dto/create-ocorrencia.dto';
import { UpdateOcorrenciaDto } from './dto/update-ocorrencia.dto';
import { ListOcorrenciasDto } from './dto/list-ocorrencias.dto';

@Controller('ocorrencias')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class OcorrenciasController {
  constructor(private svc: OcorrenciasService) {}

  @Post()
  create(
    @Body() dto: CreateOcorrenciaDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenant: any,
  ) {
    return this.svc.create(dto, user, tenant);
  }

  @Get()
  findAll(
    @Query() dto: ListOcorrenciasDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenant: any,
  ) {
    return this.svc.findAll(dto, user, tenant);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenant: any,
  ) {
    return this.svc.findOne(id, user, tenant);
  }

  @Patch(':id')
  @Roles('agent', 'admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOcorrenciaDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenant: any,
  ) {
    return this.svc.update(id, dto, user, tenant);
  }

  @Post(':id/imagens')
  @UseInterceptors(FilesInterceptor('imagens', 5))
  addImagens(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('tipo') tipo: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenant: any,
  ) {
    return this.svc.addImagens(id, files, tipo, user, tenant);
  }
}
