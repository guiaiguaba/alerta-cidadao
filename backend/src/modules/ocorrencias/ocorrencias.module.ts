import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bull';
import { OcorrenciasController } from './ocorrencias.controller';
import { OcorrenciasService } from './ocorrencias.service';
import { OcorrenciasRepository } from './ocorrencias.repository';
import { PrioridadeService } from './prioridade.service';

@Module({
  imports: [
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }), // 10 MB
    BullModule.registerQueue({ name: 'notificacoes' }),
  ],
  controllers: [OcorrenciasController],
  providers: [OcorrenciasService, OcorrenciasRepository, PrioridadeService],
  exports: [OcorrenciasService],
})
export class OcorrenciasModule {}
