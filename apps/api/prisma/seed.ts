import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('KnowMeDemo123!');

  const demo = await prisma.user.upsert({
    where: { email: 'demo@knowme.app' },
    update: {},
    create: {
      email: 'demo@knowme.app',
      username: 'demo',
      displayName: 'Compte Démo',
      passwordHash,
      bio: 'Bienvenue dans KnowMe.',
      knowCoins: 120
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@knowme.app' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin@knowme.app',
      username: 'admin',
      displayName: 'Administrateur',
      passwordHash,
      role: 'ADMIN'
    }
  });

  const existing = await prisma.challenge.findFirst({
    where: { title: 'Qui me connaît le mieux ?', creatorId: demo.id }
  });

  if (!existing) {
    await prisma.challenge.create({
      data: {
        title: 'Qui me connaît le mieux ?',
        description: 'Un défi de démonstration KnowMe.',
        status: 'ACTIVE',
        creatorId: demo.id,
        questions: {
          create: [
            { position: 0, prompt: 'Quel est mon plus grand objectif ?' },
            { position: 1, prompt: 'Quel type de musique je préfère ?' },
            { position: 2, prompt: 'Quelle activité me détend le plus ?' }
          ]
        },
        participants: { create: [{ userId: demo.id }, { userId: admin.id }] }
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
