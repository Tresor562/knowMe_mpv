import { BadRequestException, Injectable } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerificationPrivacyService {
  private readonly privateRoot = resolve(
    process.env.VERIFICATION_PRIVATE_DIR ??
      join(process.cwd(), 'private', 'verification')
  );

  constructor(private readonly prisma: PrismaService) {}

  exportForAccount(userId: string) {
    return Promise.all([
      this.prisma.verificationRequest.findMany({
        where: { userId },
        select: {
          id: true,
          subjectType: true,
          status: true,
          countryCode: true,
          publicCategory: true,
          publicReason: true,
          termsVersion: true,
          submittedAt: true,
          reviewStartedAt: true,
          resolvedAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
          documents: {
            select: {
              id: true,
              kind: true,
              mimeType: true,
              sizeBytes: true,
              uploadedAt: true,
              deletedAt: true
            },
            orderBy: { uploadedAt: 'asc' }
          },
          decisions: {
            select: {
              id: true,
              action: true,
              reasonCode: true,
              userMessage: true,
              createdAt: true
            },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.verifiedIdentity.findUnique({
        where: { userId },
        select: {
          status: true,
          badgeLabel: true,
          category: true,
          verifiedAt: true,
          expiresAt: true,
          suspendedAt: true,
          revokedAt: true,
          revocationReason: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]).then(([requests, identity]) => ({ requests, identity }));
  }

  async storageKeysForAccount(userId: string) {
    const documents = await this.prisma.verificationDocument.findMany({
      where: { request: { userId } },
      select: { storageKey: true }
    });
    return documents.map((document) => document.storageKey);
  }

  async removePrivateFiles(storageKeys: string[]) {
    await Promise.all(
      storageKeys.map(async (storageKey) => {
        const path = this.privatePath(storageKey);
        await unlink(path).catch(() => undefined);
      })
    );
  }

  private privatePath(storageKey: string) {
    const candidate = resolve(this.privateRoot, storageKey);
    if (
      candidate !== this.privateRoot &&
      !candidate.startsWith(`${this.privateRoot}${sep}`)
    ) {
      throw new BadRequestException('Clé de stockage privée invalide.');
    }
    return candidate;
  }
}
