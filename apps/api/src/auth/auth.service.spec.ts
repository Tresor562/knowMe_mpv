import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  it('is defined', async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: {} }
      ]
    }).compile();

    expect(module.get(AuthService)).toBeDefined();
  });
});
