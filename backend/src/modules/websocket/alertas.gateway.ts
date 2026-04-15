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
import { Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws',
})
export class AlertasGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AlertasGateway.name);

  // Map: socketId -> { tenantId, userId, role }
  private clients = new Map<string, { tenantId: string; userId: string; role: string }>();

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string;
    const tenantSlug = client.handshake.auth?.tenant as string;

    if (!token || !tenantSlug) {
      client.disconnect();
      return;
    }

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      // Simplified: store basic info from token
      const tenantId = tenantSlug; // will be resolved by consuming services
      this.clients.set(client.id, {
        tenantId,
        userId: decoded.uid,
        role: decoded['role'] ?? 'citizen',
      });
      client.join(`tenant:${tenantId}`);
      this.logger.log(`Client connected: ${client.id} tenant=${tenantId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-ocorrencia')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() ocorrenciaId: string) {
    client.join(`ocorrencia:${ocorrenciaId}`);
  }

  // Called by OcorrenciasService after creating
  emitNovaOcorrencia(tenantId: string, ocorrencia: any) {
    this.server.to(`tenant:${tenantId}`).emit('nova-ocorrencia', ocorrencia);
  }

  // Called by OcorrenciasService after update
  emitStatusAtualizado(tenantId: string, ocorrenciaId: string, payload: any) {
    this.server
      .to(`tenant:${tenantId}`)
      .to(`ocorrencia:${ocorrenciaId}`)
      .emit('status-atualizado', payload);
  }
}
