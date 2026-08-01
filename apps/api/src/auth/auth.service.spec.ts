import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from '../security/security.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('is defined', async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: SecurityService, useValue: {} }
      ]
    }).compile();

    expect(module.get(AuthService)).toBeDefined();
  });
});
