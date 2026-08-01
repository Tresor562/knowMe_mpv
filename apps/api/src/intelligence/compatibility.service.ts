import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompatibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async setInterests(userId: string, rawInterests: string[]) {
    const interests = [...new Set(
      rawInterests
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )];

    await this.prisma.$transaction(async (tx) => {
      await tx.userInterest.deleteMany({ where: { userId } });

      for (const name of interests) {
        const slug = name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const interest = await tx.interest.upsert({
          where: { slug },
          update: { name },
          create: { name, slug }
        });

        await tx.userInterest.create({
          data: {
            userId,
            interestId: interest.id
          }
        });
      }
    });

    return this.getInterests(userId);
  }

  async getInterests(userId: string) {
    return this.prisma.userInterest.findMany({
      where: { userId },
      include: { interest: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async calculate(userAId: string, userBId: string) {
    if (userAId === userBId) {
      return {
        score: 100,
        commonInterests: [],
        message: 'Il s’agit du même profil.'
      };
    }

    const [userA, userB] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userAId },
        include: {
          interests: { include: { interest: true } },
          challengeEntries: { include: { answers: true } }
        }
      }),
      this.prisma.user.findUnique({
        where: { id: userBId },
        include: {
          interests: { include: { interest: true } },
          challengeEntries: { include: { answers: true } }
        }
      })
    ]);

    if (!userA || !userB) {
      throw new NotFoundException('Un des utilisateurs est introuvable.');
    }

    const interestsA = new Set(
      userA.interests.map((item) => item.interest.slug)
    );
    const interestsB = new Set(
      userB.interests.map((item) => item.interest.slug)
    );

    const union = new Set([...interestsA, ...interestsB]);
    const common = [...interestsA].filter((slug) => interestsB.has(slug));

    const interestScore = union.size === 0
      ? 50
      : Math.round((common.length / union.size) * 100);

    const answersA = userA.challengeEntries.flatMap((entry) =>
      entry.answers.map((answer) => answer.value.trim().toLowerCase())
    );
    const answersB = userB.challengeEntries.flatMap((entry) =>
      entry.answers.map((answer) => answer.value.trim().toLowerCase())
    );

    const answerSetB = new Set(answersB);
    const matchingAnswers = answersA.filter((value) => answerSetB.has(value));
    const answerBase = Math.max(answersA.length, answersB.length, 1);
    const answerScore = Math.round((matchingAnswers.length / answerBase) * 100);

    const profileSignals = [
      userA.bio && userB.bio ? 10 : 0,
      userA.avatarUrl && userB.avatarUrl ? 5 : 0
    ].reduce((sum, value) => sum + value, 0);

    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          interestScore * 0.65 +
          answerScore * 0.25 +
          profileSignals
        )
      )
    );

    const commonInterests = userA.interests
      .filter((item) => common.includes(item.interest.slug))
      .map((item) => item.interest.name);

    await this.prisma.compatibilitySnapshot.create({
      data: {
        userAId,
        userBId,
        score,
        commonSignals: {
          commonInterests,
          interestScore,
          answerScore,
          matchingAnswerCount: matchingAnswers.length
        }
      }
    });

    return {
      score,
      commonInterests,
      signals: {
        interestScore,
        answerScore,
        profileSignals
      }
    };
  }

  async recommendations(userId: string) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { interests: { include: { interest: true } } }
    });

    if (!current) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const candidates = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        isSuspended: false
      },
      include: {
        interests: { include: { interest: true } }
      },
      take: 50
    });

    const currentSlugs = new Set(
      current.interests.map((item) => item.interest.slug)
    );

    return candidates
      .map((candidate) => {
        const commonInterests = candidate.interests
          .filter((item) => currentSlugs.has(item.interest.slug))
          .map((item) => item.interest.name);

        return {
          user: {
            id: candidate.id,
            username: candidate.username,
            displayName: candidate.displayName,
            avatarUrl: candidate.avatarUrl,
            bio: candidate.bio
          },
          commonInterests,
          scoreHint: Math.min(95, 45 + commonInterests.length * 12)
        };
      })
      .sort((a, b) => b.scoreHint - a.scoreHint)
      .slice(0, 12);
  }

  async suggestedChallenges(userId: string) {
    const interests = await this.getInterests(userId);
    const names = interests.map((item) => item.interest.name);

    const generic = [
      {
        title: 'Qui me connaît le mieux ?',
        description: 'Découvre qui comprend le mieux tes habitudes.'
      },
      {
        title: 'Nos trois plus grands points communs',
        description: 'Comparez vos réponses et révélez vos ressemblances.'
      },
      {
        title: 'Vrai ou faux sur moi',
        description: 'Teste les connaissances de tes proches.'
      }
    ];

    const personalized = names.slice(0, 3).map((name) => ({
      title: `Notre connexion autour de ${name}`,
      description: `Un défi personnalisé basé sur votre intérêt commun pour ${name}.`
    }));

    return [...personalized, ...generic].slice(0, 6);
  }
}
