import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressionService } from '../progression/progression.service';
import { StreaksService } from '../streaks/streaks.service';

@Injectable()
export class ChallengeProgressionInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progression: ProgressionService,
    private readonly streaks: StreaksService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      user: { userId: string };
      params: { id: string };
    }>();

    return next.handle().pipe(
      mergeMap(async (response: unknown) => {
        if (!this.isCompletedParticipation(response)) return response;

        const participant = await this.prisma.challengeParticipant.findUnique({
          where: { id: response.id },
          include: { challenge: true }
        });
        if (
          !participant ||
          participant.userId !== request.user.userId ||
          participant.challengeId !== request.params.id
        ) {
          return response;
        }

        const questionCount = await this.prisma.challengeQuestion.count({
          where: {
            challengeId: participant.challengeId,
            version: participant.challengeVersion
          }
        });
        const completion = {
          participantId: participant.id,
          userId: participant.userId,
          creatorId: participant.challenge.creatorId,
          challengeId: participant.challengeId,
          questionCount,
          completedAt: participant.completedAt!
        };
        const [progression, streak] = await Promise.all([
          this.progression.processChallengeCompletion(completion),
          this.streaks.processChallengeCompletion(completion)
        ]);

        return { ...response, progression, streak };
      })
    );
  }

  private isCompletedParticipation(
    value: unknown
  ): value is { id: string; completedAt: Date | string } & Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.id === 'string' && Boolean(candidate.completedAt);
  }
}
