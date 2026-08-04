import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AffinityGamePolicyService } from './affinity-game-policy.service';
import { canonicalJson, sha256Json } from './game-platform.domain';

@Injectable()
export class GameAccountLifecycleService {
  constructor(private readonly affinityPolicy: AffinityGamePolicyService) {}

  async prepareDeletion(userId: string, tx: Prisma.TransactionClient) {
    await this.affinityPolicy.deleteForAccount(userId, tx);
    const memberships = await tx.gameParticipant.findMany({
      where: { userId },
      select: { sessionId: true }
    });
    const sessionIds = [...new Set(memberships.map((item) => item.sessionId))];
    if (!sessionIds.length) return { prepared: 0 };

    const activeSessions = await tx.gameSession.findMany({
      where: {
        id: { in: sessionIds },
        status: { in: ['WAITING', 'ACTIVE'] }
      }
    });
    for (const session of activeSessions) {
      const result = { outcome: 'CANCELLED', reason: 'ACCOUNT_DELETED' };
      const checksumInput = {
        definitionKey: session.definitionKey,
        definitionVersion: session.definitionVersion,
        seed: session.seed,
        initialState: session.initialState,
        finalState: session.state,
        result,
        actionCount: session.sequence
      };
      await tx.gameReplaySnapshot.upsert({
        where: { sessionId: session.id },
        create: {
          sessionId: session.id,
          definitionKey: session.definitionKey,
          definitionVersion: session.definitionVersion,
          seed: session.seed,
          initialState: this.json(session.initialState),
          finalState: this.json(session.state),
          result: this.json(result),
          actionCount: session.sequence,
          checksum: sha256Json(checksumInput)
        },
        update: {}
      });
      await tx.gameSession.update({
        where: { id: session.id },
        data: { result: this.json(result) }
      });
    }
    return { prepared: activeSessions.length };
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(canonicalJson(value)) as Prisma.InputJsonValue;
  }
}
