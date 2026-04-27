// apps/api/src/modules/analytics/__tests__/analytics.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../analytics.service';
import { TenantPrismaService } from '../../../shared/database/tenant-prisma.service';

const SCHEMA = 'tenant_test';

const mockPrisma = {
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
};

const mockDbService = {
  forTenant: jest.fn().mockResolvedValue(mockPrisma),
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

// Fixture de dashboard
const dashboardFixture = {
  overview: [{
    total: '150',
    open: '20',
    in_progress: '15',
    resolved: '115',
  }],
  byStatus: [{ status: 'resolved', count: '115' }],
  byPriority: [{ priority: 'medium', count: '50' }],
  avgResolution: [{ avg_minutes: '180.50', median_minutes: '120.00' }],
  slaStats: [{
    total_resolved: '115',
    within_sla: '100',
    breached: '15',
    sla_compliance_pct: '87.0',
  }],
  today: [{ total_today: '5', resolved_today: '3' }],
  agentPerformance: [],
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: TenantPrismaService, useValue: mockDbService },
        { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  describe('getDashboard()', () => {
    it('deve retornar dados do cache quando disponível', async () => {
      const cached = { overview: { total: '50' }, cached: true };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getDashboard(SCHEMA);

      expect(result).toEqual(cached);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('deve buscar do banco e cachear quando não há cache', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.setex.mockResolvedValue('OK');

      // 7 queries paralelas no getDashboard
      mockPrisma.$queryRaw
        .mockResolvedValueOnce(dashboardFixture.overview)
        .mockResolvedValueOnce(dashboardFixture.byStatus)
        .mockResolvedValueOnce(dashboardFixture.byPriority)
        .mockResolvedValueOnce(dashboardFixture.avgResolution)
        .mockResolvedValueOnce(dashboardFixture.slaStats)
        .mockResolvedValueOnce(dashboardFixture.today)
        .mockResolvedValueOnce(dashboardFixture.agentPerformance);

      const result = await service.getDashboard(SCHEMA);

      expect(result.overview).toBeDefined();
      expect(result.sla).toBeDefined();
      expect(result.today).toBeDefined();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `stats:${SCHEMA}:dashboard`,
        300,
        expect.any(String),
      );
    });

    it('deve incluir generatedAt no resultado', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockPrisma.$queryRaw
        .mockResolvedValue([{}]);

      const result = await service.getDashboard(SCHEMA);
      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
    });
  });

  describe('getTimeline()', () => {
    it('deve chamar query com parâmetros corretos para groupBy=day', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { period: '2026-04-01', total: '10', resolved: '8' },
      ]);

      const result = await service.getTimeline(SCHEMA, {
        from: '2026-04-01',
        to: '2026-04-30',
        groupBy: 'day',
      });

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("date_trunc('day'"),
        '2026-04-01',
        '2026-04-30',
      );
      expect(result).toHaveLength(1);
    });

    it('deve usar groupBy=day como padrão', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await service.getTimeline(SCHEMA, { from: '2026-01-01', to: '2026-01-31' });

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("date_trunc('day'"),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('getHeatmap()', () => {
    it('deve retornar GeoJSON FeatureCollection válido', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { lat: -22.84, lng: -42.00, weight: 4 },
        { lat: -22.85, lng: -42.01, weight: 2 },
      ]);

      const result = await service.getHeatmap(SCHEMA);

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(2);
      expect(result.features[0].type).toBe('Feature');
      expect(result.features[0].geometry.type).toBe('Point');
      expect(result.features[0].geometry.coordinates).toEqual([-42.00, -22.84]);
      expect(result.features[0].properties.weight).toBe(4);
    });

    it('deve retornar FeatureCollection vazia sem dados', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      const result = await service.getHeatmap(SCHEMA);

      expect(result.features).toHaveLength(0);
    });
  });

  describe('getSlaReport()', () => {
    it('deve retornar relatório por prioridade', async () => {
      const mockReport = [
        { priority: 'critical', total: '10', within_sla: '8', breached: '2', compliance_pct: '80.0' },
        { priority: 'high', total: '30', within_sla: '28', breached: '2', compliance_pct: '93.3' },
      ];
      mockPrisma.$queryRaw.mockResolvedValueOnce(mockReport);

      const result = await service.getSlaReport(SCHEMA, {
        from: '2026-01-01',
        to: '2026-04-30',
      });

      expect(result).toHaveLength(2);
      expect(result[0].priority).toBe('critical');
    });
  });
});
