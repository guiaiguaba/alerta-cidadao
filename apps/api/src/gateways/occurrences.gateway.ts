// apps/api/src/gateways/occurrences.gateway.ts
// WebSocket Gateway — eventos em tempo real por tenant e região

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class OccurrencesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OccurrencesGateway.name);

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify(token);
      client.data.userId = payload.sub;
      client.data.tenantId = payload.tenantId;
      client.data.role = payload.role;

      // Entrar automaticamente na sala do tenant
      client.join(`tenant:${payload.tenantId}`);

      this.logger.log(`Client conectado: ${payload.sub} (tenant: ${payload.tenantId})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client desconectado: ${client.data.userId}`);
  }

  @SubscribeMessage('join:region')
  handleJoinRegion(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { regionCode: string },
  ) {
    const roomName = `${client.data.tenantId}:region:${data.regionCode}`;
    client.join(roomName);
    return { joined: roomName };
  }

  @SubscribeMessage('leave:region')
  handleLeaveRegion(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { regionCode: string },
  ) {
    const roomName = `${client.data.tenantId}:region:${data.regionCode}`;
    client.leave(roomName);
  }

  // ==========================================
  // MÉTODOS CHAMADOS PELOS SERVICES
  // ==========================================

  emitOccurrenceCreated(tenantId: string, occurrence: any) {
    this.server.to(`tenant:${tenantId}`).emit('occurrence:created', occurrence);

    if (occurrence.region_code) {
      this.server
        .to(`${tenantId}:region:${occurrence.region_code}`)
        .emit('occurrence:created', occurrence);
    }
  }

  emitOccurrenceUpdated(tenantId: string, update: {
    id: string;
    status: string;
    priority: string;
    assignedTo?: string;
    regionCode?: string;
  }) {
    this.server.to(`tenant:${tenantId}`).emit('occurrence:updated', update);
  }

  emitAlertNew(tenantId: string, alert: any) {
    // Alertas vão para todos do tenant
    this.server.to(`tenant:${tenantId}`).emit('alert:new', alert);

    // Ou para regiões específicas
    if (alert.target_regions?.length > 0) {
      for (const regionCode of alert.target_regions) {
        this.server
          .to(`${tenantId}:region:${regionCode}`)
          .emit('alert:new', alert);
      }
    }
  }
}
