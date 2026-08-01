import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly rewards: RewardsService
  ) {}

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
      where: {
        OR: [{ creatorId: userId }, { participants: { some: { userId } } }]
      },
      include: {
        questions: true,
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async detail(userId: string, challengeId: string) {
    const [challenge, rewardPolicy] = await Promise.all([
      this.prisma.challenge.findUnique({
        where: { id: challengeId },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          },
          questions: { orderBy: { position: 'asc' } },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true
                }
              },
              answers: true
            },
            orderBy: { createdAt: 'asc' }
          }
        }
      }),
      this.rewards.preview('CHALLENGE_COMPLETION')
    ]);

    if (!challenge) throw new NotFoundException('Défi introuvable.');

    const canView =
      challenge.creatorId === userId ||
      challenge.participants.some(
        (participant) => participant.userId === userId
      );

    if (!canView) throw new ForbiddenException('Accès interdit à ce défi.');

    return {
      ...challenge,
      rewardPolicy
    };
  }

  async join(userId: string, challengeId: string) {
    const [challenge, actor, existingParticipant] = await Promise.all([
      this.prisma.challenge.findUnique({ where: { id: challengeId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true }
      }),
      this.prisma.challengeParticipant.findUnique({
        where: { challengeId_userId: { challengeId, userId } },
        select: { id: true }
      })
    ]);

    if (!challenge || !actor) {
      throw new NotFoundException('Défi ou utilisateur introuvable.');
    }

    if (challenge.status !== 'ACTIVE') {
      throw new BadRequestException('Ce défi n’accepte plus de participants.');
    }

    const participant = await this.prisma.challengeParticipant.upsert({
      where: { challengeId_userId: { challengeId, userId } },
      create: { challengeId, userId },
      update: {}
    });

    if (!existingParticipant && challenge.creatorId !== userId) {
      await this.notifications.create({
        userId: challenge.creatorId,
        type: 'CHALLENGE_JOINED',
        title: 'Nouveau participant',
        body: `${actor.displayName} a rejoint ton défi.`,
        data: {
          route: `/challenges/${challengeId}`,
          entityType: 'CHALLENGE',
          entityId: challengeId,
          actorId: userId
        }
      });
    }

    return participant;
  }

  async submitAnswers(
    userId: string,
    challengeId: string,
    dto: SubmitAnswersDto
  ) {
    const participant = await this.prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
      include: { challenge: { include: { questions: true } } }
    });

    if (!participant) {
      throw new ForbiddenException('Rejoins le défi avant de répondre.');
    }

    if (participant.challenge.status !== 'ACTIVE') {
      throw new BadRequestException('Ce défi est terminé.');
    }

    const validQuestionIds = new Set(
      participant.challenge.questions.map((question) => question.id)
    );

    if (dto.answers.some((answer) => !validQuestionIds.has(answer.questionId))) {
      throw new BadRequestException('Une réponse ne correspond pas à ce défi.');
    }

    await this.prisma.$transaction(
      dto.answers.map((answer) =>
        this.prisma.challengeAnswer.upsert({
          where: {
            participantId_questionId: {
              participantId: participant.id,
              questionId: answer.questionId
            }
          },
          create: {
            participantId: participant.id,
            questionId: answer.questionId,
            value: answer.value.trim()
          },
          update: { value: answer.value.trim() }
        })
      )
    );

    const answerCount = await this.prisma.challengeAnswer.count({
      where: { participantId: participant.id }
    });
    const completed = answerCount === participant.challenge.questions.length;
    let reward = null;
    let completedAt = participant.completedAt;

    if (completed && !participant.completedAt) {
      completedAt = new Date();
      reward = await this.rewards.processChallengeCompletion({
        participantId: participant.id,
        userId,
        creatorId: participant.challenge.creatorId,
        challengeId,
        questionCount: participant.challenge.questions.length,
        completedAt
      });
    }

    const updated = await this.prisma.challengeParticipant.update({
      where: { id: participant.id },
      data: { completedAt: completed ? completedAt : null },
      include: { answers: true }
    });

    return {
      ...updated,
      reward
    };
  }

  async complete(userId: string, challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) throw new NotFoundException('Défi introuvable.');
    if (challenge.creatorId !== userId) {
      throw new ForbiddenException('Seul le créateur peut terminer ce défi.');
    }

    return this.prisma.challenge.update({
      where: { id: challengeId },
      data: { status: 'COMPLETED' }
    });
  }
}
