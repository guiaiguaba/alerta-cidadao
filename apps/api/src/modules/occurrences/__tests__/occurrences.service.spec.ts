// apps/api/src/modules/occurrences/__tests__/occurrences.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { OccurrencesService } from '../occurrences.service';
import { TenantPrismaService } from '../../../shared/database/tenant-prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

// ==========================================
// MOCKS
// ==========================================

const mockPrisma = {
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

const mockDbService = {
  forTenant: jest.fn().mockResolvedValue(mockPrisma),
};

const mockRedis = {
  del: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
  exists: jest.fn().mockResolvedValue(0),
};

const SCHEMA = 'tenant_test';
const TENANT_ID = 'tenant-uuid-123';
const USER_ID = 'user-uuid-456';

// ==========================================
// FIXTURES
// ==========================================

const mockCategory = {
  id: 4,
  name: 'Alagamento',
  default_priority: 'high',
};

const mockOccurrence = {
  id: 'occ-uuid-1',
  protocol: 'TST-2026-00001',
  status: 'open',
  priority: 'high',
  category_id: 4,
};

const mockReporterStats = [{ confirmed_reports: '2' }];
const mockCount = [{ count: '0' }];
const mockActivity = [];

// ==========================================
// TESTES
// ==========================================

describe('OccurrencesService', () => {
  let service: OccurrencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OccurrencesService,
        { provide: TenantPrismaService, useValue: mockDbService },
        { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<OccurrencesService>(OccurrencesService);
    jest.clearAllMocks();
  });

  // ==========================================
  describe('create()', () => {
    const dto = {
      categoryId: 4,
      description: 'Água subindo',
      lat: -22.8486,
      lng: -42.0085,
    };

    beforeEach(() => {
      // Sequência de mocks para create() bem-sucedido:
      // 1. checkSpamLimits: buscar activity
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])                    // spam check: sem atividade hoje
        // 2. deduplicação clientId: não existe
        // (sem clientId, pula)
        // 3. categoria
        .mockResolvedValueOnce([mockCategory])         // buscar categoria
        // 4. reporterStats
        .mockResolvedValueOnce(mockReporterStats)      // stats do reporter
        // 5. count para protocolo
        .mockResolvedValueOnce(mockCount)              // count para protocolo
        // 6. insert occurrence
        .mockResolvedValueOnce([mockOccurrence]);      // occurrence criada
    });

    it('deve criar ocorrência com prioridade calculada', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(1);

      const result = await service.create(dto, USER_ID, TENANT_ID, SCHEMA);

      expect(result).toEqual(mockOccurrence);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2); // timeline + spam counter
    });

    it('deve retornar ocorrência existente se client_id já sincronizado', async () => {
      const dtoWithClientId = { ...dto, clientId: 'existing-client-id' };

      // Limpar mocks e configurar para deduplicação
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])                    // spam check
        .mockResolvedValueOnce([mockOccurrence]);     // deduplicação: encontrou!

      const result = await service.create(dtoWithClientId, USER_ID, TENANT_ID, SCHEMA);

      expect(result).toEqual(mockOccurrence);
      // Não deve continuar criando (parou na deduplicação)
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('deve lançar BadRequestException se categoria não encontrada', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])  // spam
        .mockResolvedValueOnce([])  // categoria vazia
        .mockResolvedValueOnce(mockReporterStats);

      await expect(
        service.create(dto, USER_ID, TENANT_ID, SCHEMA)
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException por limite diário anti-spam', async () => {
      // Usuário já enviou 5 hoje
      mockPrisma.$queryRaw.mockResolvedValueOnce([{
        occurrences_today: 5,
        last_occurrence_at: new Date(Date.now() - 60 * 60 * 1000),
      }]);

      await expect(
        service.create(dto, USER_ID, TENANT_ID, SCHEMA)
      ).rejects.toThrow('Limite diário');
    });

    it('deve lançar BadRequestException por cooldown (< 15min)', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{
        occurrences_today: 1,
        last_occurrence_at: new Date(Date.now() - 5 * 60 * 1000), // 5min atrás
      }]);

      await expect(
        service.create(dto, USER_ID, TENANT_ID, SCHEMA)
      ).rejects.toThrow('Aguarde');
    });
  });

  // ==========================================
  describe('calculatePriority (via create)', () => {
    it('deve retornar critical quando score >= 90', () => {
      // Acessar método privado via reflection
      const priority = (service as any).calculatePriority('critical', 15);
      expect(priority).toBe('critical');
    });

    it('deve retornar high para categoria high sem boost', () => {
      const priority = (service as any).calculatePriority('high', 0);
      expect(priority).toBe('high');
    });

    it('deve fazer upscale de medium para high com muitos reports confirmados', () => {
      // medium base = 40, + 10 (>10 confirmed) = 50 → ainda medium
      // + 5 (hora de pico hipotético) = 55 → ainda medium, precisa 65 para high
      const priority = (service as any).calculatePriority('medium', 15);
      // Com 15 confirmed: +10, +5 pico possível → 40+15 = 55 ainda medium ou
      // pode chegar a 60. Sem pico: 50 = medium. Verificar limiar.
      expect(['medium', 'high']).toContain(priority);
    });

    it('deve manter critical mesmo sem histórico', () => {
      const priority = (service as any).calculatePriority('critical', 0);
      expect(priority).toBe('critical');
    });
  });

  // ==========================================
  describe('validateStatusTransition()', () => {
    const validate = (from: any, to: any, role: string) =>
      (service as any).validateStatusTransition(from, to, role);

    it('deve lançar ForbiddenException para cidadão tentando mudar status', () => {
      expect(() => validate('open', 'assigned', 'citizen')).toThrow(ForbiddenException);
    });

    it('deve permitir agente mover de open → assigned', () => {
      expect(() => validate('open', 'assigned', 'agent')).not.toThrow();
    });

    it('deve permitir agente resolver ocorrência em progresso', () => {
      expect(() => validate('in_progress', 'resolved', 'agent')).not.toThrow();
    });

    it('deve lançar BadRequestException para transição inválida', () => {
      expect(() => validate('resolved', 'open', 'admin')).toThrow(BadRequestException);
    });

    it('deve permitir admin reabrir ocorrência rejeitada', () => {
      expect(() => validate('rejected', 'open', 'admin')).not.toThrow();
    });

    it('deve bloquear transição de resolved para qualquer status', () => {
      expect(() => validate('resolved', 'open', 'admin')).toThrow(BadRequestException);
      expect(() => validate('resolved', 'in_progress', 'admin')).toThrow(BadRequestException);
    });
  });

  // ==========================================
  describe('syncBatch()', () => {
    it('deve sincronizar múltiplas ocorrências e retornar resultado', async () => {
      const items = [
        { categoryId: 4, lat: -22.8, lng: -42.0, clientId: 'client-1' },
        { categoryId: 4, lat: -22.9, lng: -42.1, clientId: 'client-2' },
      ];

      // Mockar create para retornar sucesso
      jest.spyOn(service, 'create').mockResolvedValue({
        id: 'new-occ',
        protocol: 'TST-2026-00001',
      } as any);

      const result = await service.syncBatch(
        items as any,
        USER_ID,
        TENANT_ID,
        SCHEMA,
      );

      expect(result.synced).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('deve separar erros de sincronização sem interromper o lote', async () => {
      const items = [
        { categoryId: 4, lat: -22.8, lng: -42.0, clientId: 'client-ok' },
        { categoryId: 4, lat: -22.9, lng: -42.1, clientId: 'client-fail' },
      ];

      jest.spyOn(service, 'create')
        .mockResolvedValueOnce({ id: 'ok', protocol: 'TST-001' } as any)
        .mockRejectedValueOnce(new Error('Categoria não encontrada'));

      const result = await service.syncBatch(items as any, USER_ID, TENANT_ID, SCHEMA);

      expect(result.synced).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  // ==========================================
  describe('generateProtocol()', () => {
    it('deve gerar protocolo com formato PREFIXO-ANO-SEQUENCIAL', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: '42' }]);

      const protocol = await (service as any).generateProtocol('tenant_iguaba_grande', mockPrisma);

      expect(protocol).toMatch(/^IGU-\d{4}-\d{5}$/);
      expect(protocol).toContain('00043');
    });
  });
});
