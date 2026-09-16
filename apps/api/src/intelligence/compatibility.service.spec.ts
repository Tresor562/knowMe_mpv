import { CompatibilityService } from './compatibility.service';

describe('CompatibilityService', () => {
  it('is created with a Prisma dependency', () => {
    const prisma = {} as never;
    const service = new CompatibilityService(prisma);

    expect(service).toBeDefined();
  });

  it('excludes pending, accepted and blocked social relations from recommendations', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'viewer',
      interests: [{ interest: { slug: 'anime', name: 'anime' } }]
    });
    const friendshipFindMany = jest.fn().mockResolvedValue([
      { requesterId: 'viewer', addresseeId: 'pending-user' },
      { requesterId: 'accepted-user', addresseeId: 'viewer' },
      { requesterId: 'viewer', addresseeId: 'blocked-user' }
    ]);
    const userFindMany = jest.fn().mockResolvedValue([
      {
        id: 'candidate',
        username: 'candidate',
        displayName: 'Candidate',
        avatarUrl: null,
        bio: null,
        interests: [{ interest: { slug: 'anime', name: 'anime' } }]
      }
    ]);
    const prisma = {
      user: {
        findUnique,
        findMany: userFindMany
      },
      friendship: {
        findMany: friendshipFindMany
      }
    } as never;
    const service = new CompatibilityService(prisma);

    await expect(service.recommendations('viewer')).resolves.toEqual([
      {
        user: {
          id: 'candidate',
          username: 'candidate',
          displayName: 'Candidate',
          avatarUrl: null,
          bio: null
        },
        commonInterests: ['anime'],
        scoreHint: 57
      }
    ]);

    expect(friendshipFindMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['PENDING', 'ACCEPTED', 'BLOCKED'] },
        OR: [{ requesterId: 'viewer' }, { addresseeId: 'viewer' }]
      },
      select: {
        requesterId: true,
        addresseeId: true
      }
    });
    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        id: {
          notIn: ['viewer', 'pending-user', 'accepted-user', 'blocked-user']
        },
        isSuspended: false
      },
      include: {
        interests: { include: { interest: true } }
      },
      take: 50
    });
  });

  it('builds ready-to-edit challenge suggestions from interests without creating anything', async () => {
    const interestFindMany = jest.fn().mockResolvedValue([
      { interest: { id: 'interest-anime', name: 'anime', slug: 'anime' } }
    ]);
    const prisma = {
      userInterest: {
        findMany: interestFindMany
      }
    } as never;
    const service = new CompatibilityService(prisma);

    const suggestions = await service.suggestedChallenges('viewer');

    expect(interestFindMany).toHaveBeenCalledWith({
      where: { userId: 'viewer' },
      include: { interest: true },
      orderBy: { createdAt: 'asc' }
    });
    expect(suggestions[0]).toEqual({
      title: 'Notre connexion autour de anime',
      description: 'Un défi personnalisé basé sur votre intérêt commun pour anime.',
      questions: [
        'Qu’est-ce que je préfère dans anime ?',
        'Depuis quand anime m’intéresse-t-il vraiment ?',
        'Quelle expérience liée à anime aimerais-je vivre ensuite ?'
      ]
    });
    expect(suggestions).toHaveLength(4);
    expect(suggestions.every((suggestion) => suggestion.questions.length === 3)).toBe(true);
  });
});
