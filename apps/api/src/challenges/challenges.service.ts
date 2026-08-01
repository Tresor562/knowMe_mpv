import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly rewards: RewardsService,
    private readonly audit: AuditService
  ) {}

  async create(userId: string, dto: CreateChallengeDto) {
    const title = dto.title.trim();
    const description = this.normalizeDescription(dto.description);
    const visibility = dto.visibility ?? 'PRIVATE';
    const questions = this.normalizeQuestions(dto.questions);

    return this.prisma.$transaction(async (tx) => {
      return tx.challenge.create({
        data: {
          title,
          description,
          visibility,
          currentVersion: 1,
          creatorId: userId,
          status: 'ACTIVE',
          versions: {
            create: {
              version: 1,
              title,
              description,
              visibility,
              questionCount: questions.length,
              createdById: userId,
              changeReason: 'Création initiale du défi.'
            }
          },
          questions: {
            create: questions.map((prompt, position) => ({
              prompt,
              position,
              version: 1
            }))
          },
          participants: {
            create: { userId, challengeVersion: 1 }
          }
        },
        include: {
          questions: { where: { version: 1 }, orderBy: { position: 'asc' } },
          participants: true,
          versions: true
        }
      });
    });
  }

  async list(userId: string) {
    const challenges = await this.prisma.challenge.findMany({
      where: {
        OR: [{ creatorId: userId }, { participants: { some: { userId } } }]
      },
      include: {
        questions: { orderBy: [{ version: 'desc' }, { position: 'asc' }] },
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

    return challenges.map((challenge) => ({
      ...challenge,
      questions: challenge.questions.filter(
        (question) => question.version === challenge.currentVersion
      )
    }));
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
          versions: { orderBy: { version: 'desc' } },
          questions: { orderBy: [{ version: 'asc' }, { position: 'asc' }] },
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

    const viewerParticipation = challenge.participants.find(
      (participant) => participant.userId === userId
    );
    const isCreator = challenge.creatorId === userId;
    if (!isCreator && !viewerParticipation) {
      throw new ForbiddenException('Accès interdit à ce défi.');
    }

    const viewerVersion = isCreator
      ? challenge.currentVersion
      : viewerParticipation!.challengeVersion;
    const questions = challenge.questions.filter(
      (question) => question.version === viewerVersion
    );
    const versionSnapshot = challenge.versions.find(
      (version) => version.version === viewerVersion
    );

    return {
      ...challenge,
      title: versionSnapshot?.title ?? challenge.title,
      description: versionSnapshot?.description ?? challenge.description,
      visibility: versionSnapshot?.visibility ?? challenge.visibility,
      questions,
      viewerVersion,
      versionSnapshot: versionSnapshot ?? null,
      isCurrentVersion: viewerVersion === challenge.currentVersion,
      canEdit: isCreator && challenge.status === 'ACTIVE',
      canAnswer:
        Boolean(viewerParticipation) &&
        viewerParticipation?.challengeVersion === viewerVersion &&
        challenge.status === 'ACTIVE',
      rewardPolicy
    };
  }

  async versions(userId: string, challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        versions: { orderBy: { version: 'desc' } },
        questions: { orderBy: [{ version: 'desc' }, { position: 'asc' }] }
      }
    });

    if (!challenge) throw new NotFoundException('Défi introuvable.');
    if (challenge.creatorId !== userId) {
      throw new ForbiddenException(
        'Seul le créateur peut consulter l’historique des versions.'
      );
    }

    await this.ensureVersionSnapshot(challenge);

    return this.prisma.challengeVersion.findMany({
      where: { challengeId },
      orderBy: { version: 'desc' }
    });
  }

  async update(userId: string, challengeId: string, dto: UpdateChallengeDto) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        questions: {
          where: { version: dto.expectedVersion },
          orderBy: { position: 'asc' }
        },
        participants: {
          where: { userId },
          include: { _count: { select: { answers: true } } }
        }
      }
    });

    if (!challenge) throw new NotFoundException('Défi introuvable.');
    if (challenge.creatorId !== userId) {
      throw new ForbiddenException('Seul le créateur peut modifier ce défi.');
    }
    if (challenge.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Un défi terminé ou annulé ne peut plus être modifié.'
      );
    }
    if (challenge.currentVersion !== dto.expectedVersion) {
      throw new ConflictException(
        `Le défi a déjà évolué vers la version ${challenge.currentVersion}. Recharge la page avant de recommencer.`
      );
    }

    const title = dto.title?.trim() ?? challenge.title;
    const description =
      dto.description === undefined
        ? challenge.description
        : this.normalizeDescription(dto.description);
    const visibility = dto.visibility ?? challenge.visibility;
    const questions = dto.questions
      ? this.normalizeQuestions(dto.questions)
      : challenge.questions.map((question) => question.prompt);

    if (!questions.length) {
      throw new BadRequestException('La version doit contenir au moins une question.');
    }

    const unchanged =
      title === challenge.title &&
      description === challenge.description &&
      visibility === challenge.visibility &&
      questions.length === challenge.questions.length &&
      questions.every(
        (question, index) => question === challenge.questions[index]?.prompt
      );
    if (unchanged) {
      throw new BadRequestException('Aucune modification à publier.');
    }

    const nextVersion = challenge.currentVersion + 1;
    const creatorParticipation = challenge.participants[0];

    await this.prisma.$transaction(
      async (tx) => {
        await tx.challengeVersion.upsert({
          where: {
            challengeId_version: {
              challengeId,
              version: challenge.currentVersion
            }
          },
          create: {
            challengeId,
            version: challenge.currentVersion,
            title: challenge.title,
            description: challenge.description,
            visibility: challenge.visibility,
            questionCount: challenge.questions.length,
            createdById: userId,
            changeReason: 'Version historique importée automatiquement.'
          },
          update: {}
        });

        const updated = await tx.challenge.updateMany({
          where: {
            id: challengeId,
            creatorId: userId,
            status: 'ACTIVE',
            currentVersion: dto.expectedVersion
          },
          data: {
            title,
            description,
            visibility,
            currentVersion: nextVersion
          }
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            'Une autre modification a été publiée simultanément. Recharge le défi.'
          );
        }

        await tx.challengeVersion.create({
          data: {
            challengeId,
            version: nextVersion,
            title,
            description,
            visibility,
            questionCount: questions.length,
            createdById: userId,
            changeReason: dto.changeReason.trim()
          }
        });

        await tx.challengeQuestion.createMany({
          data: questions.map((prompt, position) => ({
            challengeId,
            version: nextVersion,
            prompt,
            position
          }))
        });

        if (
          creatorParticipation &&
          !creatorParticipation.completedAt &&
          creatorParticipation._count.answers === 0
        ) {
          await tx.challengeParticipant.update({
            where: { id: creatorParticipation.id },
            data: { challengeVersion: nextVersion }
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await this.audit.record({
      actorId: userId,
      action: 'CHALLENGE_VERSION_PUBLISH',
      entity: 'Challenge',
      entityId: challengeId,
      targetAccountId: userId,
      metadata: {
        previousVersion: challenge.currentVersion,
        version: nextVersion,
        visibility,
        questionCount: questions.length,
        changeReason: dto.changeReason.trim()
      }
    });

    return this.detail(userId, challengeId);
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
        select: { id: true, challengeVersion: true }
      })
    ]);

    if (!challenge || !actor) {
      throw new NotFoundException('Défi ou utilisateur introuvable.');
    }
    if (challenge.status !== 'ACTIVE') {
      throw new BadRequestException('Ce défi n’accepte plus de participants.');
    }

    const participant = existingParticipant
      ? await this.prisma.challengeParticipant.findUniqueOrThrow({
          where: { id: existingParticipant.id }
        })
      : await this.prisma.challengeParticipant.create({
          data: {
            challengeId,
            userId,
            challengeVersion: challenge.currentVersion
          }
        });

    if (!existingParticipant && challenge.creatorId !== userId) {
      await this.notifications.create({
        userId: challenge.creatorId,
        type: 'CHALLENGE_JOINED',
        title: 'Nouveau participant',
        body: `${actor.displayName} a rejoint la version ${challenge.currentVersion} de ton défi.`,
        data: {
          route: `/challenges/${challengeId}`,
          entityType: 'CHALLENGE',
          entityId: challengeId,
          actorId: userId,
          challengeVersion: challenge.currentVersion
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
      include: { challenge: true }
    });

    if (!participant) {
      throw new ForbiddenException('Rejoins le défi avant de répondre.');
    }
    if (participant.challenge.status !== 'ACTIVE') {
      throw new BadRequestException('Ce défi est terminé.');
    }

    const questions = await this.prisma.challengeQuestion.findMany({
      where: {
        challengeId,
        version: participant.challengeVersion
      },
      orderBy: { position: 'asc' }
    });
    const validQuestionIds = new Set(questions.map((question) => question.id));
    const submittedQuestionIds = new Set(
      dto.answers.map((answer) => answer.questionId)
    );

    if (submittedQuestionIds.size !== dto.answers.length) {
      throw new BadRequestException('Une question ne peut être envoyée qu’une fois.');
    }
    if (dto.answers.some((answer) => !validQuestionIds.has(answer.questionId))) {
      throw new BadRequestException(
        `Une réponse ne correspond pas à la version ${participant.challengeVersion} de ce défi.`
      );
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
      where: {
        participantId: participant.id,
        questionId: { in: questions.map((question) => question.id) }
      }
    });
    const completed = questions.length > 0 && answerCount === questions.length;
    let reward = null;
    let completedAt = participant.completedAt;

    if (completed && !participant.completedAt) {
      completedAt = new Date();
      reward = await this.rewards.processChallengeCompletion({
        participantId: participant.id,
        userId,
        creatorId: participant.challenge.creatorId,
        challengeId,
        questionCount: questions.length,
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
      challengeVersion: participant.challengeVersion,
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

  private normalizeQuestions(values: string[]) {
    const questions = values.map((value) => value.trim()).filter(Boolean);
    if (!questions.length) {
      throw new BadRequestException('Ajoute au moins une question valide.');
    }
    return questions;
  }

  private normalizeDescription(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async ensureVersionSnapshot(challenge: {
    id: string;
    creatorId: string;
    currentVersion: number;
    title: string;
    description: string | null;
    visibility: string;
    versions: Array<{ version: number }>;
    questions: Array<{ version: number }>;
  }) {
    if (
      challenge.versions.some(
        (version) => version.version === challenge.currentVersion
      )
    ) {
      return;
    }

    await this.prisma.challengeVersion.upsert({
      where: {
        challengeId_version: {
          challengeId: challenge.id,
          version: challenge.currentVersion
        }
      },
      create: {
        challengeId: challenge.id,
        version: challenge.currentVersion,
        title: challenge.title,
        description: challenge.description,
        visibility: challenge.visibility,
        questionCount: challenge.questions.filter(
          (question) => question.version === challenge.currentVersion
        ).length,
        createdById: challenge.creatorId,
        changeReason: 'Version historique importée automatiquement.'
      },
      update: {}
    });
  }
}
