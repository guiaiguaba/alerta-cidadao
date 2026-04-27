// apps/api/src/modules/sla/__tests__/sla-cron.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SlaCronService } from '../sla-cron.service';
import { TenantPrismaService } from '../../../shared/database/tenant-prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OccurrencesGateway } from '../../../gateways/occurrences.gateway';

// ==========================================
// MOCKS
// ==========================================

const mockPrisma = {
  $queryRaw:    jest.fn(),
  $executeRaw:  jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

const mockPublicPrisma = {
  $queryRaw: jest.fn(),
};

const mockDbService = {
  forTenant:       jest.fn().mockResolvedValue(mockPrisma),
  getPublicClient: jest.fn().mockReturnValue(mockPublicPrisma),
};

const mockNotifications = {
  sendToUser: jest.fn().mockResolvedValue(undefined),
};

const mockGateway = {
  emitOccurrenceUpdated: jest.fn(),
};

describe('SlaCronService', () => {
  let service: SlaCronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaCronService,
        { provide: TenantPrismaService,  useValue: mockDbService },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: OccurrencesGateway,   useValue: mockGateway },
      ],
    }).compile();

    service = module.get<SlaCronService>(SlaCronService);
    jest.clearAllMocks();
  });

  // ==========================================
  describe('runCheck()', () => {
    it('deve processar todos os tenants ativos', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([
        { id: 'tenant-1', schema_name: 'tenant_one' },
        { id: 'tenant-2', schema_name: 'tenant_two' },
      ]);

      // Para cada tenant: sem violações e sem warnings
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await service.runCheck();

      // forTenant chamado uma vez por tenant
      expect(mockDbService.forTenant).toHaveBeenCalledTimes(2);
    });

    it('deve continuar processando mesmo se um tenant falhar', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([
        { id: 'tenant-ok',   schema_name: 'tenant_ok' },
        { id: 'tenant-fail', schema_name: 'tenant_fail' },
      ]);

      // Primeiro tenant falha, segundo passa
      mockDbService.forTenant
        .mockRejectedValueOnce(new Error('DB connection failed'))
        .mockResolvedValueOnce(mockPrisma);

      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      // Não deve lançar — erros por tenant são capturados internamente
      await expect(service.runCheck()).resolves.not.toThrow();
    });

    it('deve lidar com lista vazia de tenants', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.runCheck()).resolves.not.toThrow();
      expect(mockDbService.forTenant).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  describe('checkTenant() — SLA violations', () => {
    it('deve marcar ocorrências com SLA violado', async () => {
      const breachedOccs = [
        { id: 'occ-1', protocol: 'TST-001', priority: 'critical', assigned_to: 'agent-1', region_code: 'centro' },
        { id: 'occ-2', protocol: 'TST-002', priority: 'high',     assigned_to: null,      region_code: 'norte' },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(breachedOccs)                              // UPDATE RETURNING violados
        .mockResolvedValueOnce([{ id: 'sys-user-id' }])                  // getSystemUserId
        .mockResolvedValueOnce([])                                        // pre-breach warnings
        .mockResolvedValueOnce([{ id: 'sup-1', fcm_tokens: ['t1'] }]);  // notifySupervisors

      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await (service as any).checkTenant('tenant-uuid', 'tenant_test');

      // Timeline deve ser inserida para cada violação
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(
        breachedOccs.length,  // uma entrada de timeline por violação
      );

      // WebSocket deve emitir para cada violação
      expect(mockGateway.emitOccurrenceUpdated).toHaveBeenCalledTimes(
        breachedOccs.length,
      );
    });

    it('deve notificar supervisores quando há violações', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{
          id: 'occ-1', protocol: 'TST-001', priority: 'critical', assigned_to: null, region_code: null,
        }])
        .mockResolvedValueOnce([{ id: 'sys-user-id' }])
        .mockResolvedValueOnce([])   // pre-breach warnings
        .mockResolvedValueOnce([     // supervisores
          { id: 'sup-1', fcm_tokens: ['t1'] },
          { id: 'sup-2', fcm_tokens: ['t2'] },
        ]);

      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await (service as any).checkTenant('tenant-uuid', 'tenant_test');

      // sendToUser chamado para cada supervisor
      expect(mockNotifications.sendToUser).toHaveBeenCalledTimes(2);
      expect(mockNotifications.sendToUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sla_breach' }),
      );
    });

    it('deve processar checagem sem violações sem erros', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])  // sem violações
        .mockResolvedValueOnce([]); // sem pre-breach
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await expect(
        (service as any).checkTenant('tenant-uuid', 'tenant_test')
      ).resolves.toEqual({ breached: 0, warnings: 0 });

      expect(mockNotifications.sendToUser).not.toHaveBeenCalled();
      expect(mockGateway.emitOccurrenceUpdated).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  describe('getSystemUserId()', () => {
    it('deve criar usuário sistema se não existir', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])                              // sistema não existe
        .mockResolvedValueOnce([{ id: 'system-user-id' }]);   // após insert

      const id = await (service as any).getSystemUserId('tenant_test', mockPrisma);

      expect(id).toBe('system-user-id');
    });

    it('deve retornar usuário sistema existente do cache', async () => {
      // Pré-popular cache
      (service as any).systemUserIdCache['tenant_cached'] = 'cached-system-id';

      const id = await (service as any).getSystemUserId('tenant_cached', mockPrisma);

      expect(id).toBe('cached-system-id');
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('deve usar usuário sistema existente do banco', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'existing-system-id' }]);

      const id = await (service as any).getSystemUserId('tenant_new', mockPrisma);

      expect(id).toBe('existing-system-id');
      // Apenas uma query (SELECT), sem INSERT
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
