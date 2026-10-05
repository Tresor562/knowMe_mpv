import { PrismaClient } from '@prisma/client';
import {
  encryptMessageContent,
  isEncryptedMessageContent
} from './message-content-crypto';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

async function main() {
  let migrated = 0;

  while (true) {
    const rows = await prisma.message.findMany({
      where: {
        NOT: {
          content: { startsWith: 'kmmsg:v1:' }
        }
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        content: true
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE
    });

    if (!rows.length) break;

    for (const row of rows) {
      if (isEncryptedMessageContent(row.content)) continue;
      const encrypted = encryptMessageContent(row.content, {
        conversationId: row.conversationId,
        senderId: row.senderId
      });

      const updated = await prisma.message.updateMany({
        where: { id: row.id, content: row.content },
        data: { content: encrypted }
      });
      migrated += updated.count;
    }
  }

  process.stdout.write(
    JSON.stringify({ migrated, encryptedPrefix: 'kmmsg:v1:' }) + '\n'
  );
}

main()
  .catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
