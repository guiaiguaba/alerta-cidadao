import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { FirebaseService } from '../../infra/firebase/firebase.service';
import { DatabaseService } from '../../infra/database/database.service';
import { UnauthorizedException } from '@nestjs/common';

const mockKnex = () => {
  const chain: any = {};
  chain.where = jest.fn().mockReturnValue(chain);
  chain.first = jest.fn();
  chain.update = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.returning = jest.fn().mockResolvedValue([{ id: 'u1', email: 'a@b.com', role: 'citizen' }]);
  chain.fn = { now: jest.fn() };
  
  // Criamos a função mock principal
  const knexFn: any = jest.fn().mockReturnValue(chain);
  
  // Atribuímos a propriedade fn diretamente à função mock
  knexFn.fn = { now: jest.fn() };
  
  return knexFn; 
};

describe('AuthService', () => {
  let service: AuthService;
  let firebase: jest.Mocked<FirebaseService>;
  let db: any;

  beforeEach(async () => {
    const knex = mockKnex();
    knex.fn = { now: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: FirebaseService,
          useValue: { auth: { verifyIdToken: jest.fn() } },
        },
        {
          provide: DatabaseService,
          useValue: { knex },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    firebase = module.get(FirebaseService);
    db = module.get(DatabaseService);
  });

  it('should throw UnauthorizedException for invalid token', async () => {
    (firebase.auth.verifyIdToken as jest.Mock).mockRejectedValue(new Error('invalid'));
    await expect(
      service.syncUser({ id_token: 'bad' }, { id: 't1', slug: 'test' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should create user when not existing', async () => {
    (firebase.auth.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: 'fb123', email: 'a@b.com', name: 'Alice', picture: null,
    });

    const chain = db.knex('users');
    chain.first.mockResolvedValue(null);

    const result = await service.syncUser(
      { id_token: 'valid' },
      { id: 'tenant1', slug: 'iguaba' },
    );

    expect(result).toBeDefined();
  });
});
