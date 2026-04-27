// apps/api/src/modules/tenants/__tests__/tenant-provisioning.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantProvisioningService } from '../tenant-provisioning.service';
import { TenantPrismaService } from '../../../shared/database/tenant-prisma.service';
import * as fs from 'fs';

jest.mock('fs');
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

const mockPublicPrisma = {
  $queryRaw:        jest.fn(),
  $executeRaw:      jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

const mockTenantPrisma = {
  $queryRaw:        jest.fn(),
  $executeRaw:      jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

const mockDbService = {
  getPublicClient: jest.fn().mockReturnValue(mockPublicPrisma),
  forTenant:       jest.fn().mockResolvedValue(mockTenantPrisma),
};

const mockRedis = { del: jest.fn(), setex: jest.fn() };
const mockConfig = { get: jest.fn((key: string, def?: any) => def) };

const PROVISION_DTO = {
  slug:        'test-city',
  name:        'Prefeitura de Test City',
  displayName: 'Test City',
  subdomain:   'test',
  stateCode:   'RJ',
  adminEmail:  'admin@testcity.rj.gov.br',
  adminName:   'Admin Test',
};

describe('TenantProvisioningService', () => {
  let service: TenantProvisioningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantProvisioningService,
        { provide: TenantPrismaService, useValue: mockDbService },
        { provide: ConfigService,       useValue: mockConfig },
        { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<TenantProvisioningService>(TenantProvisioningService);
    jest.clearAllMocks();

    // Mock do arquivo de migration SQL
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      'CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY); -- comment\nCREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY);',
    );
  });

  describe('provision()', () => {
    it('deve provisionar tenant completo com sucesso', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([]);  // não existe
      mockPublicPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPublicPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      mockTenantPrisma.$executeRaw.mockResolvedValue(undefined);
      mockTenantPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      mockTenantPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.provision(PROVISION_DTO);

      expect(result.tenantId).toBeDefined();
      expect(result.schemaName).toBe('tenant_test_city');
      expect(result.adminCredentials.email).toBe(PROVISION_DTO.adminEmail);
      expect(result.adminCredentials.tempPassword).toBeDefined();
      expect(result.adminCredentials.tempPassword.length).toBeGreaterThan(0);
    });

    it('deve lançar ConflictException para slug duplicado', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'existing-tenant' }]);

      await expect(
        service.provision(PROVISION_DTO)
      ).rejects.toThrow(ConflictException);
    });

    it('deve fazer rollback se criação do schema falhar', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([]);  // não existe
      mockPublicPrisma.$executeRaw.mockResolvedValue(undefined); // INSERT tenant ok
      mockPublicPrisma.$executeRawUnsafe
        .mockRejectedValueOnce(new Error('Schema creation failed')); // CREATE SCHEMA falha

      await expect(
        service.provision(PROVISION_DTO)
      ).rejects.toThrow(InternalServerErrorException);

      // DELETE rollback deve ter sido chamado
      expect(mockPublicPrisma.$executeRaw).toHaveBeenCalledTimes(2); // INSERT + DELETE
    });

    it('deve gerar senha aleatória quando não fornecida', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockPublicPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPublicPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      mockTenantPrisma.$executeRaw.mockResolvedValue(undefined);
      mockTenantPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      mockTenantPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.provision(PROVISION_DTO); // sem adminPassword

      expect(result.adminCredentials.tempPassword).toBeDefined();
      expect(result.adminCredentials.tempPassword.length).toBeGreaterThanOrEqual(16);
    });

    it('deve gerar schemaName com underscores para slugs com hífens', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockPublicPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPublicPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      mockTenantPrisma.$executeRaw.mockResolvedValue(undefined);
      mockTenantPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      mockTenantPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.provision({
        ...PROVISION_DTO,
        slug:      'iguaba-grande',
        subdomain: 'iguaba',
      });

      expect(result.schemaName).toBe('tenant_iguaba_grande');
    });
  });

  describe('deprovision()', () => {
    it('deve desativar tenant sem deletar dados', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([{
        schema_name: 'tenant_test_city',
        subdomain:   'test',
      }]);
      mockPublicPrisma.$executeRaw.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(1);

      await service.deprovision('tenant-uuid');

      expect(mockPublicPrisma.$executeRaw).toHaveBeenCalledWith(
        expect.anything(), // UPDATE is_active = false
      );
      expect(mockRedis.del).toHaveBeenCalledWith('tenant:test');
    });

    it('deve completar sem erro se tenant não encontrado', async () => {
      mockPublicPrisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.deprovision('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('generatePassword()', () => {
    it('deve gerar senha com tamanho padrão de 16 caracteres', () => {
      const pwd = (service as any).generatePassword();
      expect(pwd.length).toBe(16);
    });

    it('deve gerar senhas únicas a cada chamada', () => {
      const pwd1 = (service as any).generatePassword();
      const pwd2 = (service as any).generatePassword();
      expect(pwd1).not.toBe(pwd2);
    });

    it('deve gerar senha com tamanho personalizado', () => {
      const pwd = (service as any).generatePassword(24);
      expect(pwd.length).toBe(24);
    });
  });
});
