// apps/api/src/modules/auth/__tests__/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { TenantPrismaService } from '../../../shared/database/tenant-prisma.service';
import * as bcrypt from 'bcrypt';

// ==========================================
// MOCKS
// ==========================================

jest.mock('bcrypt');

const mockPrisma = {
  $queryRaw:        jest.fn(),
  $executeRaw:      jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

const mockDbService    = { forTenant: jest.fn().mockResolvedValue(mockPrisma) };
const mockJwtService   = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
const mockConfigService = { get: jest.fn((key: string, def?: any) => {
  const cfg: Record<string, any> = {
    JWT_EXPIRY: '15m',
    BCRYPT_ROUNDS: 12,
    GOOGLE_CLIENT_ID: 'test-google-client-id',
  };
  return cfg[key] ?? def;
}) };

const SCHEMA    = 'tenant_test';
const TENANT_ID = 'tenant-uuid';
const USER_ID   = 'user-uuid-123';

// ==========================================
// TESTES
// ==========================================

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: TenantPrismaService, useValue: mockDbService },
        { provide: JwtService,          useValue: mockJwtService },
        { provide: ConfigService,       useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    // Default bcrypt mocks
    (bcrypt.hash    as jest.Mock).mockResolvedValue('hashed_password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  // ==========================================
  describe('register()', () => {
    it('deve registrar novo usuário e retornar tokens', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])               // e-mail não existe
        .mockResolvedValueOnce([{                // insert retorna usuário
          id: USER_ID, name: 'João', email: 'joao@test.com', role: 'citizen',
        }]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      const result = await service.register({
        name:      'João Silva',
        email:     'joao@test.com',
        password:  'senha123',
        tenantId:  TENANT_ID,
        schemaName: SCHEMA,
      });

      expect(result).toHaveProperty('accessToken', 'signed.jwt.token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.expiresIn).toBe(900);
      expect(bcrypt.hash).toHaveBeenCalledWith('senha123', 12);
    });

    it('deve lançar ConflictException para e-mail duplicado', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'existing' }]);

      await expect(
        service.register({
          name: 'Outro', email: 'joao@test.com',
          tenantId: TENANT_ID, schemaName: SCHEMA,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('deve registrar com telefone sem e-mail', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ id: USER_ID, role: 'citizen' }]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      const result = await service.register({
        name:      'Maria',
        phone:     '+5522999990000',
        tenantId:  TENANT_ID,
        schemaName: SCHEMA,
      });

      expect(result).toHaveProperty('accessToken');
      // Sem senha, bcrypt.hash não deve ser chamado
      expect(bcrypt.hash).not.toHaveBeenCalledWith(undefined, 12);
    });

    it('deve hashear a senha com o número correto de rounds', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: USER_ID, role: 'citizen' }]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      await service.register({
        name: 'Test', email: 'test@test.com', password: 'minha_senha',
        tenantId: TENANT_ID, schemaName: SCHEMA,
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('minha_senha', 12);
    });
  });

  // ==========================================
  describe('login()', () => {
    const loginDto = {
      email:      'joao@test.com',
      password:   'senha123',
      tenantId:   TENANT_ID,
      schemaName: SCHEMA,
    };

    const mockUser = {
      id: USER_ID, email: 'joao@test.com',
      password_hash: 'hashed', role: 'citizen',
      is_active: true, is_blocked: false,
    };

    it('deve retornar tokens com credenciais válidas', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([mockUser]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined); // last_login + insert token

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result.expiresIn).toBe(900);
      expect(bcrypt.compare).toHaveBeenCalledWith('senha123', 'hashed');
    });

    it('deve lançar UnauthorizedException se usuário não encontrado', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException com senha errada', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login(loginDto)).rejects.toThrow('Credenciais inválidas');
    });

    it('deve lançar UnauthorizedException para conta inativa', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ ...mockUser, is_active: false }]);

      await expect(service.login(loginDto)).rejects.toThrow('inativa');
    });

    it('deve lançar UnauthorizedException para conta bloqueada', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ ...mockUser, is_blocked: true }]);

      await expect(service.login(loginDto)).rejects.toThrow('bloqueada');
    });

    it('deve atualizar last_login_at após login bem-sucedido', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([mockUser]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      await service.login(loginDto);

      // $executeRaw chamado ao menos 2x: last_login + insert token
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================
  describe('refreshTokens()', () => {
    it('deve gerar novos tokens com refresh token válido', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{
        id: 'token-id', user_id: USER_ID, role: 'citizen', is_active: true,
      }]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      const result = await service.refreshTokens({
        refreshToken: 'valid-refresh-token',
        tenantId:     TENANT_ID,
        schemaName:   SCHEMA,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      // Token antigo deve ser revogado
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2); // revoke + insert new
    });

    it('deve lançar UnauthorizedException para refresh token inválido', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // token não encontrado

      await expect(
        service.refreshTokens({
          refreshToken: 'invalid-token',
          tenantId:     TENANT_ID,
          schemaName:   SCHEMA,
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ==========================================
  describe('logout()', () => {
    it('deve revogar o refresh token', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      await service.logout({
        refreshToken: 'some-token',
        userId:       USER_ID,
        schemaName:   SCHEMA,
      });

      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('deve completar sem erro mesmo com token já revogado', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      await expect(
        service.logout({
          refreshToken: 'already-revoked',
          userId:       USER_ID,
          schemaName:   SCHEMA,
        })
      ).resolves.not.toThrow();
    });
  });

  // ==========================================
  describe('googleAuth()', () => {
    const mockGooglePayload = {
      sub: 'google-uid-123',
      email: 'joao@gmail.com',
      name: 'João Google',
      picture: 'https://lh3.googleusercontent.com/avatar.jpg',
      aud: 'test-google-client-id',
    };

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok:   true,
        json: () => Promise.resolve(mockGooglePayload),
      });
    });

    it('deve criar novo usuário no primeiro login Google', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])  // usuário não existe
        .mockResolvedValueOnce([{ id: USER_ID, role: 'citizen', is_active: true, is_blocked: false }]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      const result = await service.googleAuth({
        idToken:    'google-id-token',
        tenantId:   TENANT_ID,
        schemaName: SCHEMA,
      });

      expect(result).toHaveProperty('accessToken');
    });

    it('deve autenticar usuário existente pelo google_id', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{
        id: USER_ID, role: 'citizen', is_active: true, is_blocked: false,
      }]);
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      const result = await service.googleAuth({
        idToken:    'google-id-token',
        tenantId:   TENANT_ID,
        schemaName: SCHEMA,
      });

      expect(result).toHaveProperty('accessToken');
      // INSERT de novo usuário NÃO deve ter sido chamado
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('deve lançar UnauthorizedException com token Google inválido', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok:   false,
        json: () => Promise.resolve({ error: 'invalid_token' }),
      });

      await expect(
        service.googleAuth({ idToken: 'bad-token', tenantId: TENANT_ID, schemaName: SCHEMA })
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
