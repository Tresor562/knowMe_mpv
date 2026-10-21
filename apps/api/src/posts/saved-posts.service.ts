import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * SavedPost is an additive SQL-owned table. We use parameterized Prisma raw SQL
 * instead of altering schema.prisma here because other active workstreams own
 * that shared schema. The database migration maintains foreign keys and unique
 * constraints. Do not interpolate any input into SQL identifiers.
 */
@Injectable()
export class SavedPostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.$queryRaw<Array<{ postId: string; createdAt: Date }>>`
      SELECT "postId", "createdAt"
      FROM "SavedPost" WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT 40
    `;
  }

  async status(userId: string, postId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ saved: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM "SavedPost"
        WHERE "userId" = ${userId} AND "postId" = ${postId}
      ) AS saved
    `;
    return { saved: rows[0]?.saved === true };
  }

  async save(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId }, select: { id: true }
    });
    if (!post) throw new NotFoundException('Publication introuvable.');
    // ON CONFLICT ensures repeated taps never duplicate the bookmark.
    await this.prisma.$executeRaw`
      INSERT INTO "SavedPost" ("id", "userId", "postId")
      VALUES (${randomUUID()}, ${userId}, ${postId})
      ON CONFLICT ("userId", "postId") DO NOTHING
    `;
    return { saved: true };
  }

  async unsave(userId: string, postId: string) {
    await this.prisma.$executeRaw`
      DELETE FROM "SavedPost"
      WHERE "userId" = ${userId} AND "postId" = ${postId}
    `;
    return { saved: false };
  }
}
