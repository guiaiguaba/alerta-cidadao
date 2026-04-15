// websocket.module.ts
import { Module } from '@nestjs/common';
import { AlertasGateway } from './alertas.gateway';

@Module({
  providers: [AlertasGateway],
  exports: [AlertasGateway],
})
export class WebsocketModule {}
