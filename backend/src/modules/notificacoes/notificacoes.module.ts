// notificacoes.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificacoesProcessor } from './notificacoes.processor';
import { NotificacoesService } from './notificacoes.service';
import { NotificacoesController } from './notificacoes.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'notificacoes' })],
  controllers: [NotificacoesController],
  providers: [NotificacoesService, NotificacoesProcessor],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
