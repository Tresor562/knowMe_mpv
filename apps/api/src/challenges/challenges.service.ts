import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateChallengeDto) {
    return this.prisma.challenge.create({
      data: {
        title: dto.title,
        description: dto.description,
        creatorId: userId,
        status: 'ACTIVE',
        questions: {
          create: dto.questions.map((prompt, position) => ({ prompt, position }))
        },
        participants: { create: { userId } }
      },
      include: { questions: true, participants: true }
    });
  }

  list(userId: string) {
    return this.prisma.challenge.findMany({
      where: { OR: [{ creatorId: userId }, { participants: { some: { userId } } }] },
      include: { questions: true, participants: { include: { user: { select: { id:true, username:true, displayName:true, avatarUrl:true } } } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async join(userId: string, challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new NotFoundException('Défi introuvable.');
    return this.prisma.challengeParticipant.upsert({
      where: { challengeId_userId: { challengeId, userId } },
      create: { challengeId, userId },
      update: {}
    });
  }
}
