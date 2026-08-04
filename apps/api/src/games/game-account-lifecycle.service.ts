import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  redactAffinityStoredResult,
  redactAffinityStoredState
} from './affinity-data-redaction';
import { AffinityGamePolicyService } from './affinity-game-policy.service';
import { canonicalJson, sha256Json } from './game-platform.domain';

@Injectable()
export class GameAccountLifecycleService {
  constructor(private readonly affinityPolicy: AffinityGamePolicyService) {}

  async prepareDeletion(userId: string, tx: Prisma.TransactionClient) {
    await this.affinityPolicy.deleteForAccount(userId, tx);
    const memberships = await tx.gameParticipant.findMany({
      where: { userId },
      select: { sessionId: true, position: true }
    });
    const sessionIds = [...new Set(memberships.map((item) => item.sessionId))];
    if (!sessionIds.length) return { prepared: 0, redacted: 0 };

    let redacted = 0;
    for (const membership of memberships) {
      const session = await tx.gameSession.findUnique({
        where: { id: membership.sessionId }
      });
      if (!session || session.definitionKey !== 'affinity-mirror') continue;

      const redactedState = redactAffinityStoredState(
        session.state,
        membership.position
      );
      const redactedResult = session.result
        ? redactAffinityStoredResult(session.result)
        : null;
      await tx.gameSession.update({
        where: { id: session.id },
        data: {
          state: this.json(redactedState),
          stateHash: sha256Json(redactedState),
          ...(redactedResult ? { result: this.json(redactedResult) } : {})
        }
      });
      await tx.gameAction.updateMany({
        where: { sessionId: session.id, actorId: userId },
        data: {
          payload: this.json({ redacted: true, reason: 'ACCOUNT_DELETED' })
        }
      });

      const snapshot = await tx.gameReplaySnapshot.findUnique({
        where: { sessionId: session.id }
      });
      if (snapshot) {
        const initialState = redactAffinityStoredState(
          snapshot.initialState,
          membership.position
        );
        const finalState = redactAffinityStoredState(
          snapshot.finalState,
          membership.position
        );
        const result = redactAffinityStoredResult(snapshot.result);
        const checksum = sha256Json({
          definitionKey: snapshot.definitionKey,
          definitionVersion: snapshot.definitionVersion,
          seed: snapshot.seed,
          initialState,
          finalState,
          result,
          actionCount: snapshot.actionCount
        });
        await tx.gameReplaySnapshot.update({
          where: { sessionId: session.id },
          data: {
            initialState: this.json(initialState),
            finalState: this.json(finalState),
            result: this.json(result),
            checksum
          }
        });
      }
      redacted += 1;
    }

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
        update: {
          finalState: this.json(session.state),
          result: this.json(result),
          actionCount: session.sequence,
          checksum: sha256Json(checksumInput)
        }
      });
      await tx.gameSession.update({
        where: { id: session.id },
        data: { result: this.json(result) }
      });
    }
    return { prepared: activeSessions.length, redacted };
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(canonicalJson(value)) as Prisma.InputJsonValue;
  }
}
