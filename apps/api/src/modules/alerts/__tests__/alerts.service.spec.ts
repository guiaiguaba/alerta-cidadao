// apps/api/src/modules/alerts/__tests__/alerts.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts.service';
import { TenantPrismaService } from '../../../shared/database/tenant-prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OccurrencesGateway } from '../../../gateways/occurrences.gateway';

// ==========================================
// MOCKS
// ==========================================

const mockPrisma = {
  $queryRaw:        jest.fn(),
  $queryRawUnsafe:  jest.fn(),
  $executeRaw:      jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

const mockDbService = { forTenant: jest.fn().mockResolvedValue(mockPrisma) };
const mockNotifications = { broadcastAlert: jest.fn().mockResolvedValue(250) };
const mockGateway = { emitAlertNew: jest.fn() };

const SCHEMA    = 'tenant_test';
const TENANT_ID = 'tenant-uuid';
const USER_ID   = 'user-uuid';
const ALERT_ID  = 'alert-uuid';

const mockAlert = {
  id:        ALERT_ID,
  title:     '⚠️ Alerta de Alagamento',
  message:   'Evite a área central',
  alert_type: 'flood_warning',
  severity:  'high',
  target_scope: 'all',
  status:    'draft',
  created_by: USER_ID,
  creator_name: 'Admin Test',
  target_regions: null,
};

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: TenantPrismaService,  useValue: mockDbService },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: OccurrencesGateway,   useValue: mockGateway },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    jest.clearAllMocks();
  });

  // ==========================================
  describe('create()', () => {
    const dto = {
      title:        '⚠️ Alerta de Alagamento',
      message:      'Evite a área central',
      alertType:    'flood_warning',
      severity:     'high' as const,
      targetScope:  'all' as const,
    };

    it('deve criar alerta como rascunho', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      // findOne após insert
      mockPrisma.$queryRaw.mockResolvedValueOnce([mockAlert]);

      const result = await service.create(dto, USER_ID, TENANT_ID, SCHEMA);

      expect(result.status).toBe('draft');
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('deve lançar BadRequestException para scope=regions sem regiões', async () => {
      await expect(
        service.create(
          { ...dto, targetScope: 'regions', targetRegions: [] },
          USER_ID, TENANT_ID, SCHEMA,
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException para scope=radius sem coordenadas', async () => {
      await expect(
        service.create(
          { ...dto, targetScope: 'radius' },
          USER_ID, TENANT_ID, SCHEMA,
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('deve aceitar scope=radius com coordenadas e raio', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{
        ...mockAlert,
        target_scope: 'radius',
        target_lat: -22.84,
        target_lng: -42.00,
        target_radius_m: 5000,
      }]);

      const result = await service.create(
        { ...dto, targetScope: 'radius', targetLat: -22.84, targetLng: -42.00, targetRadiusM: 5000 },
        USER_ID, TENANT_ID, SCHEMA,
      );

      expect(result).toBeDefined();
    });
  });

  // ==========================================
  describe('send()', () => {
    it('deve disparar alerta e atualizar status para sent', async () => {
      // Primeira findOne: draft
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ ...mockAlert, status: 'draft' }]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      // Segunda findOne após update: sent
      mockPrisma.$queryRaw.mockResolvedValueOnce([{
        ...mockAlert, status: 'sent', recipients_count: 250,
      }]);

      const result = await service.send(ALERT_ID, USER_ID, TENANT_ID, SCHEMA);

      expect(result.status).toBe('sent');
      expect(mockNotifications.broadcastAlert).toHaveBeenCalledWith(
        expect.objectContaining({ alertId: ALERT_ID, schemaName: SCHEMA }),
      );
      expect(mockGateway.emitAlertNew).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ status: 'sent' }),
      );
    });

    it('deve lançar BadRequestException para alerta já enviado', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ ...mockAlert, status: 'sent' }]);

      await expect(
        service.send(ALERT_ID, USER_ID, TENANT_ID, SCHEMA)
      ).rejects.toThrow('enviado');
    });

    it('deve lançar BadRequestException para alerta cancelado', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ ...mockAlert, status: 'cancelled' }]);

      await expect(
        service.send(ALERT_ID, USER_ID, TENANT_ID, SCHEMA)
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar NotFoundException para alerta inexistente', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        service.send('nonexistent-id', USER_ID, TENANT_ID, SCHEMA)
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  describe('cancel()', () => {
    it('deve cancelar alerta em rascunho', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ ...mockAlert, status: 'draft' }]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ ...mockAlert, status: 'cancelled' }]);

      const result = await service.cancel(ALERT_ID, USER_ID, SCHEMA);
      expect(result.status).toBe('cancelled');
    });

    it('deve lançar BadRequestException ao cancelar alerta já enviado', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ ...mockAlert, status: 'sent' }]);

      await expect(
        service.cancel(ALERT_ID, USER_ID, SCHEMA)
      ).rejects.toThrow('cancelados');
    });
  });

  // ==========================================
  describe('findAll()', () => {
    it('deve listar apenas alertas ativos para cidadão', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([mockAlert])
        .mockResolvedValueOnce([{ count: '1' }]);

      const result = await service.findAll(SCHEMA, { activeOnly: true });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      // Verificar que a query contém filtro de sent + não expirado
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'sent'"),
      );
    });

    it('deve retornar todos alertas para admin', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([mockAlert, { ...mockAlert, id: 'a2', status: 'draft' }])
        .mockResolvedValueOnce([{ count: '2' }]);

      const result = await service.findAll(SCHEMA, { activeOnly: false });

      expect(result.data).toHaveLength(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('deve paginar resultados corretamente', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '50' }]);

      const result = await service.findAll(SCHEMA, { page: 3, limit: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
    });
  });
});
