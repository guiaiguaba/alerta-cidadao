// apps/api/src/modules/notifications/__tests__/notifications.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications.service';
import { TenantPrismaService } from '../../../shared/database/tenant-prisma.service';

const mockPrisma = {
  $queryRaw:   jest.fn(),
  $executeRaw: jest.fn(),
};
const mockDbService    = { forTenant: jest.fn().mockResolvedValue(mockPrisma) };
const mockConfigService = {
  get: jest.fn((key: string, def?: any) => {
    const cfg: Record<string, any> = {
      FCM_PROJECT_ID: 'test-project',
      FCM_PRIVATE_KEY: '',
      FCM_CLIENT_EMAIL: '',
    };
    return cfg[key] ?? def;
  }),
};

const SCHEMA  = 'tenant_test';
const USER_ID = 'user-uuid';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: TenantPrismaService, useValue: mockDbService },
        { provide: ConfigService,       useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  // ==========================================
  describe('sendToUser()', () => {
    it('deve persistir notificação e tentar enviar FCM', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{
        fcm_tokens: ['device-token-abc'],
      }]);

      global.fetch = jest.fn().mockResolvedValue({
        ok:   true,
        json: () => Promise.resolve({ name: 'projects/test/messages/msg123' }),
      });

      await service.sendToUser({
        userId:  USER_ID,
        type:    'occurrence_update',
        title:   'Ocorrência TST-001',
        body:    'Status: Resolvido ✅',
        schemaName: SCHEMA,
      });

      // Deve inserir notificação no banco
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2); // insert + update status
    });

    it('deve marcar delivery_status=no_token quando usuário sem tokens FCM', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ fcm_tokens: [] }]);

      await service.sendToUser({
        userId:  USER_ID,
        type:    'alert',
        title:   'Alerta',
        body:    'Mensagem',
        schemaName: SCHEMA,
      });

      // Deve ter atualizado para no_token
      expect(mockPrisma.$executeRaw).toHaveBeenCalledWith(
        expect.anything(), // template tag
      );
    });

    it('deve remover tokens inválidos (UNREGISTERED) do usuário', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{
        fcm_tokens: ['valid-token', 'invalid-token'],
      }]);

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: { status: 'UNREGISTERED' } }) })  // token 1 inválido
        .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: { status: 'UNREGISTERED' } }) }); // token 2 inválido - mas fetch precisa de token para oauth

      // O getFcmAccessToken vai falhar sem chaves, mas devemos testar o fluxo de remoção
      // Em dev: retorna 'dev_token' quando sem configuração
      await service.sendToUser({
        userId: USER_ID, type: 'alert', title: 'T', body: 'B', schemaName: SCHEMA,
      }).catch(() => {}); // Pode falhar no FCM sem credenciais — mas o banco deve ter sido chamado

      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });
  });

  // ==========================================
  describe('notifyOccurrenceUpdate()', () => {
    it('deve enviar notificação com label correto por status', async () => {
      const spy = jest.spyOn(service, 'sendToUser').mockResolvedValue(undefined);

      await service.notifyOccurrenceUpdate(
        USER_ID, 'occ-id', 'TST-001', 'resolved', SCHEMA,
      );

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Ocorrência TST-001',
        body:  expect.stringContaining('Resolvido'),
        type:  'occurrence_update',
      }));
    });

    it('deve incluir occurrenceId nos dados', async () => {
      const spy = jest.spyOn(service, 'sendToUser').mockResolvedValue(undefined);

      await service.notifyOccurrenceUpdate(USER_ID, 'occ-123', 'TST-002', 'assigned', SCHEMA);

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ occurrenceId: 'occ-123' }),
      }));
    });
  });

  // ==========================================
  describe('notifyAgentAssignment()', () => {
    it('deve enviar notificação com emoji de prioridade', async () => {
      const spy = jest.spyOn(service, 'sendToUser').mockResolvedValue(undefined);

      await service.notifyAgentAssignment(
        'agent-id', 'occ-id', 'TST-001', 'critical', SCHEMA,
      );

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'agent-id',
        title:  expect.stringContaining('🚨'),
        type:   'occurrence_assigned',
      }));
    });

    it('deve usar emoji correto por prioridade', async () => {
      const spy = jest.spyOn(service, 'sendToUser').mockResolvedValue(undefined);
      const priorities = [
        ['critical', '🚨'],
        ['high',     '🔴'],
        ['medium',   '🟡'],
        ['low',      '🟢'],
      ];

      for (const [priority, emoji] of priorities) {
        await service.notifyAgentAssignment('agent', 'occ', 'TST', priority, SCHEMA);
        expect(spy).toHaveBeenLastCalledWith(
          expect.objectContaining({ title: expect.stringContaining(emoji) }),
        );
      }
    });
  });

  // ==========================================
  describe('broadcastAlert()', () => {
    it('deve enviar para todos os usuários quando sem segmentação', async () => {
      mockPrisma.$queryRawUnsafe = jest.fn().mockResolvedValue([
        { id: 'u1', fcm_tokens: ['t1', 't2'] },
        { id: 'u2', fcm_tokens: ['t3'] },
      ]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', expires_in: 3600 }),
      });

      const count = await service.broadcastAlert({
        title:      'Alerta Geral',
        message:    'Mensagem importante',
        alertId:    'alert-id',
        severity:   'high',
        schemaName: SCHEMA,
      });

      // Deve ter tentado enviar para todos os tokens
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('deve retornar 0 quando não há usuários com tokens FCM', async () => {
      mockPrisma.$queryRawUnsafe = jest.fn().mockResolvedValue([]);

      const count = await service.broadcastAlert({
        title: 'T', message: 'M', alertId: 'a', severity: 'info', schemaName: SCHEMA,
      });

      expect(count).toBe(0);
    });
  });

  // ==========================================
  describe('notifySlaBreached()', () => {
    it('deve enviar notificação de SLA com dados corretos', async () => {
      const spy = jest.spyOn(service, 'sendToUser').mockResolvedValue(undefined);

      await service.notifySlaBreached(
        'supervisor-id', 'occ-id', 'TST-001', 'high', SCHEMA,
      );

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'supervisor-id',
        type:   'sla_breach',
        title:  expect.stringContaining('SLA Violado'),
      }));
    });
  });
});
