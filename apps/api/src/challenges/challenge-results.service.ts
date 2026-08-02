import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type AnswerInput = {
  questionId: string;
  value: string;
};

type QuestionSnapshotInput = {
  id: string;
  prompt: string;
  position: number;
};

type StoredAnswer = {
  questionId: string;
  position: number;
  prompt: string;
  answer: string;
};

type StoredReferenceAnswer = StoredAnswer & {
  normalizedHash: string;
};

type StoredFeedback = StoredAnswer & {
  expectedAnswer: string;
  correct: boolean;
};

type CompletionInput = {
  participantId: string;
  userId: string;
  creatorId: string;
  challengeId: string;
  challengeVersion: number;
  questions: QuestionSnapshotInput[];
  answers: AnswerInput[];
  completedAt: Date;
};

@Injectable()
export class ChallengeResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async recordCompletion(input: CompletionInput) {
    const answerSnapshot = this.snapshotAnswers(input.questions, input.answers);

    if (input.userId === input.creatorId) {
      const reference = await this.createReference(
        input.userId,
        input.challengeId,
        input.challengeVersion,
        answerSnapshot,
        false
      );
      if (reference.created) {
        await this.auditReference(
          input.userId,
          input.challengeId,
          input.challengeVersion,
          reference.value.id,
          answerSnapshot.length,
          'CREATOR_COMPLETION'
        );
        await this.scorePending(
          input.challengeId,
          input.challengeVersion,
          reference.value.answers
        );
      }
      return {
        result: null,
        reference: this.publicReference(reference.value),
        referenceLocked: reference.created
      };
    }

    const existing = await this.prisma.challengeResultSnapshot.findUnique({
      where: { participantId: input.participantId }
    });
    if (existing) {
      return {
        result: this.publicResult(existing),
        reference: await this.referenceState(
          input.challengeId,
          input.challengeVersion
        ),
        referenceLocked: false
      };
    }

    const reference = await this.prisma.challengeReferenceSnapshot.findUnique({
      where: {
        challengeId_challengeVersion: {
          challengeId: input.challengeId,
          challengeVersion: input.challengeVersion
        }
      }
    });
    const assessment = reference
      ? this.assess(answerSnapshot, this.referenceAnswers(reference.answers))
      : null;

    try {
      const result = await this.prisma.challengeResultSnapshot.create({
        data: {
          challengeId: input.challengeId,
          participantId: input.participantId,
          userId: input.userId,
          challengeVersion: input.challengeVersion,
          status: assessment ? 'SCORED' : 'PENDING_REFERENCE',
          score: assessment?.score ?? 0,
          correctCount: assessment?.correctCount ?? 0,
          questionCount: answerSnapshot.length,
          answers: answerSnapshot as unknown as Prisma.InputJsonValue,
          feedback: assessment
            ? (assessment.feedback as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          completedAt: input.completedAt,
          scoredAt: assessment ? new Date() : null
        }
      });
      return {
        result: this.publicResult(result),
        reference: reference ? this.publicReference(reference) : null,
        referenceLocked: false
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.challengeResultSnapshot.findUnique({
          where: { participantId: input.participantId }
        });
        if (replay) {
          return {
            result: this.publicResult(replay),
            reference: reference ? this.publicReference(reference) : null,
            referenceLocked: false
          };
        }
      }
      throw error;
    }
  }

  async setReference(
    actorId: string,
    challengeId: string,
    challengeVersion: number,
    answers: AnswerInput[]
  ) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      select: { id: true, creatorId: true }
    });
    if (!challenge) throw new NotFoundException('Défi introuvable.');
    if (challenge.creatorId !== actorId) {
      throw new ForbiddenException(
        'Seul le créateur peut verrouiller les réponses de référence.'
      );
    }

    const questions = await this.prisma.challengeQuestion.findMany({
      where: { challengeId, version: challengeVersion },
      orderBy: { position: 'asc' },
      select: { id: true, prompt: true, position: true }
    });
    if (!questions.length) {
      throw new NotFoundException('Version du défi introuvable.');
    }

    const answerSnapshot = this.snapshotAnswers(questions, answers);
    const reference = await this.createReference(
      actorId,
      challengeId,
      challengeVersion,
      answerSnapshot,
      true
    );
    await this.auditReference(
      actorId,
      challengeId,
      challengeVersion,
      reference.value.id,
      answerSnapshot.length,
      'EXPLICIT_REFERENCE'
    );
    const scoredResults = await this.scorePending(
      challengeId,
      challengeVersion,
      reference.value.answers
    );

    return {
      ...this.publicReference(reference.value),
      scoredResults
    };
  }

  async listHistory(userId: string) {
    const results = await this.prisma.challengeResultSnapshot.findMany({
      where: { userId },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: 100
    });
    const challengeIds = [...new Set(results.map((result) => result.challengeId))];
    const challenges = challengeIds.length
      ? await this.prisma.challenge.findMany({
          where: { id: { in: challengeIds } },
          include: {
            versions: {
              orderBy: { version: 'desc' },
              select: {
                version: true,
                title: true,
                description: true,
                visibility: true
              }
            },
            creator: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        })
      : [];
    const byId = new Map(challenges.map((challenge) => [challenge.id, challenge]));

    return {
      items: results.map((result) => {
        const challenge = byId.get(result.challengeId);
        const version = challenge?.versions.find(
          (item) => item.version === result.challengeVersion
        );
        return {
          id: result.id,
          challengeId: result.challengeId,
          participantId: result.participantId,
          challengeVersion: result.challengeVersion,
          status: result.status,
          score: result.score,
          correctCount: result.correctCount,
          questionCount: result.questionCount,
          completedAt: result.completedAt,
          scoredAt: result.scoredAt,
          challenge: challenge
            ? {
                title: version?.title ?? challenge.title,
                description: version?.description ?? challenge.description,
                visibility: version?.visibility ?? challenge.visibility,
                creator: challenge.creator
              }
            : null
        };
      })
    };
  }

  async getResult(
    viewerId: string,
    challengeId: string,
    participantId: string
  ) {
    const [challenge, participant, result] = await Promise.all([
      this.prisma.challenge.findUnique({
        where: { id: challengeId },
        select: { id: true, creatorId: true }
      }),
      this.prisma.challengeParticipant.findUnique({
        where: { id: participantId },
        select: { id: true, challengeId: true, userId: true }
      }),
      this.prisma.challengeResultSnapshot.findUnique({
        where: { participantId }
      })
    ]);

    if (!challenge || !participant || participant.challengeId !== challengeId) {
      throw new NotFoundException('Résultat de défi introuvable.');
    }
    if (viewerId !== participant.userId && viewerId !== challenge.creatorId) {
      throw new ForbiddenException('Accès interdit à ce résultat.');
    }
    if (!result) {
      throw new NotFoundException('Le participant n’a pas encore terminé ce défi.');
    }
    return this.publicResult(result);
  }

  async getForParticipant(participantId: string) {
    const result = await this.prisma.challengeResultSnapshot.findUnique({
      where: { participantId }
    });
    return result ? this.publicResult(result) : null;
  }

  async referenceState(challengeId: string, challengeVersion: number) {
    const reference = await this.prisma.challengeReferenceSnapshot.findUnique({
      where: {
        challengeId_challengeVersion: { challengeId, challengeVersion }
      }
    });
    return reference ? this.publicReference(reference) : null;
  }

  async summaries(challengeId: string) {
    const results = await this.prisma.challengeResultSnapshot.findMany({
      where: { challengeId },
      select: {
        participantId: true,
        status: true,
        score: true,
        correctCount: true,
        questionCount: true,
        completedAt: true,
        scoredAt: true
      }
    });
    return new Map(results.map((result) => [result.participantId, result]));
  }

  private async createReference(
    actorId: string,
    challengeId: string,
    challengeVersion: number,
    answerSnapshot: StoredAnswer[],
    rejectExisting: boolean
  ) {
    const stored = answerSnapshot.map((answer) => ({
      ...answer,
      normalizedHash: this.hashNormalized(answer.answer)
    }));

    try {
      const value = await this.prisma.challengeReferenceSnapshot.create({
        data: {
          challengeId,
          challengeVersion,
          createdById: actorId,
          answers: stored as unknown as Prisma.InputJsonValue
        }
      });
      return { created: true, value };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.challengeReferenceSnapshot.findUnique({
          where: {
            challengeId_challengeVersion: { challengeId, challengeVersion }
          }
        });
        if (existing && !rejectExisting) {
          return { created: false, value: existing };
        }
        if (existing) {
          throw new ConflictException(
            'Les réponses de référence de cette version sont déjà verrouillées.'
          );
        }
      }
      throw error;
    }
  }

  private async scorePending(
    challengeId: string,
    challengeVersion: number,
    referenceValue: Prisma.JsonValue
  ) {
    const reference = this.referenceAnswers(referenceValue);
    const pending = await this.prisma.challengeResultSnapshot.findMany({
      where: {
        challengeId,
        challengeVersion,
        status: 'PENDING_REFERENCE'
      }
    });
    if (!pending.length) return 0;

    await this.prisma.$transaction(
      pending.map((result) => {
        const assessment = this.assess(
          this.storedAnswers(result.answers),
          reference
        );
        return this.prisma.challengeResultSnapshot.update({
          where: { id: result.id },
          data: {
            status: 'SCORED',
            score: assessment.score,
            correctCount: assessment.correctCount,
            feedback: assessment.feedback as unknown as Prisma.InputJsonValue,
            scoredAt: new Date()
          }
        });
      })
    );
    return pending.length;
  }

  private snapshotAnswers(
    questions: QuestionSnapshotInput[],
    answers: AnswerInput[]
  ): StoredAnswer[] {
    const answerMap = new Map<string, string>();
    for (const answer of answers) {
      if (answerMap.has(answer.questionId)) {
        throw new BadRequestException(
          'Une question ne peut être envoyée qu’une fois.'
        );
      }
      const value = answer.value.trim();
      if (!value) {
        throw new BadRequestException('Toutes les réponses sont obligatoires.');
      }
      answerMap.set(answer.questionId, value);
    }

    const validIds = new Set(questions.map((question) => question.id));
    if (
      answers.length !== questions.length ||
      answers.some((answer) => !validIds.has(answer.questionId))
    ) {
      throw new BadRequestException(
        'Les réponses doivent couvrir exactement toutes les questions de cette version.'
      );
    }

    return questions.map((question) => ({
      questionId: question.id,
      position: question.position,
      prompt: question.prompt,
      answer: answerMap.get(question.id)!
    }));
  }

  private assess(
    answers: StoredAnswer[],
    reference: StoredReferenceAnswer[]
  ) {
    const referenceByQuestion = new Map(
      reference.map((item) => [item.questionId, item])
    );
    const feedback: StoredFeedback[] = answers.map((answer) => {
      const expected = referenceByQuestion.get(answer.questionId);
      if (!expected) {
        throw new ConflictException(
          'Le corrigé ne correspond pas à la version jouée.'
        );
      }
      return {
        ...answer,
        expectedAnswer: expected.answer,
        correct: this.hashNormalized(answer.answer) === expected.normalizedHash
      };
    });
    const correctCount = feedback.filter((item) => item.correct).length;
    return {
      feedback,
      correctCount,
      score: feedback.length
        ? Math.round((correctCount / feedback.length) * 100)
        : 0
    };
  }

  private storedAnswers(value: Prisma.JsonValue): StoredAnswer[] {
    if (!Array.isArray(value)) return [];
    return value as unknown as StoredAnswer[];
  }

  private referenceAnswers(value: Prisma.JsonValue): StoredReferenceAnswer[] {
    if (!Array.isArray(value)) return [];
    return value as unknown as StoredReferenceAnswer[];
  }

  private publicResult(result: {
    id: string;
    challengeId: string;
    participantId: string;
    userId: string;
    challengeVersion: number;
    status: string;
    score: number;
    correctCount: number;
    questionCount: number;
    answers: Prisma.JsonValue;
    feedback: Prisma.JsonValue | null;
    completedAt: Date;
    scoredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: result.id,
      challengeId: result.challengeId,
      participantId: result.participantId,
      userId: result.userId,
      challengeVersion: result.challengeVersion,
      status: result.status,
      score: result.score,
      correctCount: result.correctCount,
      questionCount: result.questionCount,
      answers: this.storedAnswers(result.answers),
      feedback: result.feedback
        ? (result.feedback as unknown as StoredFeedback[])
        : null,
      completedAt: result.completedAt,
      scoredAt: result.scoredAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    };
  }

  private publicReference(reference: {
    id: string;
    challengeId: string;
    challengeVersion: number;
    answers: Prisma.JsonValue;
    createdAt: Date;
  }) {
    return {
      id: reference.id,
      challengeId: reference.challengeId,
      challengeVersion: reference.challengeVersion,
      questionCount: this.referenceAnswers(reference.answers).length,
      createdAt: reference.createdAt
    };
  }

  private async auditReference(
    actorId: string,
    challengeId: string,
    challengeVersion: number,
    referenceId: string,
    questionCount: number,
    source: string
  ) {
    await this.audit.record({
      actorId,
      action: 'CHALLENGE_REFERENCE_LOCK',
      entity: 'ChallengeReferenceSnapshot',
      entityId: referenceId,
      targetAccountId: actorId,
      metadata: {
        challengeId,
        challengeVersion,
        questionCount,
        source
      }
    });
  }

  private hashNormalized(value: string) {
    return createHash('sha256').update(this.normalize(value)).digest('hex');
  }

  private normalize(value: string) {
    return value
      .normalize('NFKC')
      .trim()
      .toLocaleLowerCase('fr')
      .replace(/\s+/g, ' ');
  }
}
