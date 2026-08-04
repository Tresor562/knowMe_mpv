import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative tournaments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accounts: AccountService;

  beforeAll(async () => {
    process.env.GAME_PLATFORM_MAINTENANCE_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    accounts = app.get(AccountService);

    await prisma.tournamentReceipt.deleteMany();
    await prisma.tournamentEvent.deleteMany();
    await prisma.tournamentMatch.deleteMany();
    await prisma.tournamentEntrantMember.deleteMany();
    await prisma.tournamentEntrant.deleteMany();
    await prisma.tournament.deleteMany();
    await prisma.gameActionReceipt.deleteMany();
    await prisma.gameAction.deleteMany();
    await prisma.gameReplaySnapshot.deleteMany();
    await prisma.gameGovernanceEvent.deleteMany();
    await prisma.gameParticipant.deleteMany();
    await prisma.gameSession.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    delete process.env.GAME_PLATFORM_MAINTENANCE_ENABLED;
    await app.close();
  });

  async function register(email: string, username: string, displayName: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username, displayName, password: 'KnowMeTest123!' })
      .expect(201);
  }

  function auth(response: Awaited<ReturnType<typeof register>>) {
    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  function key(prefix: string) {
    return `${prefix}:${Math.random().toString(36).slice(2)}:${Date.now()}`;
  }

  it('advances brackets only from authoritative game sessions and governs exceptional outcomes', async () => {
    const owner = await register('tournament-owner@knowme.test', 'tournament_owner', 'Tournament Owner');
    const bravo = await register('tournament-bravo@knowme.test', 'tournament_bravo', 'Tournament Bravo');
    const charlie = await register('tournament-charlie@knowme.test', 'tournament_charlie', 'Tournament Charlie');
    const delta = await register('tournament-delta@knowme.test', 'tournament_delta', 'Tournament Delta');

    const users = [owner, bravo, charlie, delta];
    const userById = new Map(
      users.map((response) => [
        response.body.user.id as string,
        { response, headers: auth(response) }
      ])
    );
    const ownerId = owner.body.user.id as string;
    const closesAt = new Date(Date.now() + 60 * 60 * 1_000).toISOString();

    const created = await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth(owner))
      .send({
        name: 'KnowMe Pulse Cup',
        description: 'Tournoi E2E sans mise.',
        gameKey: 'pulse-duel',
        teamSize: 1,
        maxEntrants: 4,
        registrationClosesAt: closesAt,
        idempotencyKey: 'tournament:create:main:0001'
      })
      .expect(201);
    const tournamentId = created.body.id as string;
    expect(created.body.policy).toEqual(
      expect.objectContaining({
        serverAuthoritative: true,
        clientWinnerAccepted: false,
        clientScoreAccepted: false,
        economicStakeAllowed: false,
        paidPriorityAllowed: false
      })
    );

    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/registration/open`)
      .set(auth(owner))
      .send({ idempotencyKey: 'tournament:open:main:0001' })
      .expect(201);

    for (const [index, user] of users.entries()) {
      const registrationPayload = {
        memberUsernames: [],
        idempotencyKey: `tournament:register:main:${index}:0001`
      };
      const registered = await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/entrants`)
        .set(auth(user))
        .send(registrationPayload)
        .expect(201);
      expect(registered.body.replayed).toBe(false);
      const replay = await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/entrants`)
        .set(auth(user))
        .send(registrationPayload)
        .expect(201);
      expect(replay.body.replayed).toBe(true);
    }

    const started = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/start`)
      .set(auth(owner))
      .send({ idempotencyKey: 'tournament:start:main:0001' })
      .expect(201);
    expect(started.body.status).toBe('ACTIVE');
    expect(started.body.bracketSize).toBe(4);
    expect(started.body.matches).toHaveLength(3);
    expect(started.body.entrants.every((entrant: { seed: number | null }) => entrant.seed)).toBe(true);
    expect(JSON.stringify(started.body)).not.toMatch(/bracketSeed|economicStake[^A]/i);

    let view = started.body;
    const firstRound = view.matches.filter((match: { round: number }) => match.round === 1);
    expect(firstRound).toHaveLength(2);

    const untouchedMatch = firstRound[0];
    const ignoredClientResult = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/matches/${untouchedMatch.id}/sync`)
      .set(auth(owner))
      .send({ winnerEntrantId: untouchedMatch.firstEntrantId, score: 999 })
      .expect(201);
    const untouchedAfter = ignoredClientResult.body.matches.find(
      (match: { id: string }) => match.id === untouchedMatch.id
    );
    expect(untouchedAfter.winnerEntrantId).toBeNull();
    expect(untouchedAfter.status).toBe('WAITING');

    for (const roundMatch of firstRound) {
      const secondEntrant = view.entrants.find(
        (entrant: { id: string }) => entrant.id === roundMatch.secondEntrantId
      );
      const secondCaptain = userById.get(secondEntrant.captainId);
      expect(secondCaptain).toBeDefined();
      await request(app.getHttpServer())
        .post(`/games/sessions/${roundMatch.gameSessionId}/join`)
        .set(secondCaptain!.headers)
        .expect(201);
      const abandoned = await request(app.getHttpServer())
        .post(`/games/sessions/${roundMatch.gameSessionId}/abandon`)
        .set(secondCaptain!.headers)
        .expect(201);
      expect(abandoned.body.status).toBe('ABANDONED');
      expect(abandoned.body.winnerUserId).toBeTruthy();
      view = (
        await request(app.getHttpServer())
          .post(`/tournaments/${tournamentId}/matches/${roundMatch.id}/sync`)
          .set(auth(owner))
          .expect(201)
      ).body;
      const synchronized = view.matches.find(
        (match: { id: string }) => match.id === roundMatch.id
      );
      expect(synchronized.status).toBe('COMPLETED');
      expect(synchronized.winnerEntrantId).toBe(roundMatch.firstEntrantId);
    }

    const finalMatch = view.matches.find((match: { round: number }) => match.round === 2);
    expect(finalMatch.firstEntrantId).toBeTruthy();
    expect(finalMatch.secondEntrantId).toBeTruthy();
    expect(finalMatch.gameSessionId).toBeTruthy();
    expect(finalMatch.status).toBe('WAITING');

    const finalSecondEntrant = view.entrants.find(
      (entrant: { id: string }) => entrant.id === finalMatch.secondEntrantId
    );
    const finalSecondCaptain = userById.get(finalSecondEntrant.captainId);
    await request(app.getHttpServer())
      .post(`/games/sessions/${finalMatch.gameSessionId}/join`)
      .set(finalSecondCaptain!.headers)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/games/sessions/${finalMatch.gameSessionId}/abandon`)
      .set(finalSecondCaptain!.headers)
      .expect(201);
    view = (
      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/matches/${finalMatch.id}/sync`)
        .set(auth(owner))
        .expect(201)
    ).body;
    expect(view.status).toBe('COMPLETED');
    expect(view.championEntrantId).toBe(finalMatch.firstEntrantId);
    expect(
      await prisma.gameSession.count({
        where: { creationKey: { startsWith: `tournament:${tournamentId}:match:` } }
      })
    ).toBe(3);
    expect(await prisma.knowCoinLedgerEntry.count()).toBe(0);

    const teamTournament = await request(app.getHttpServer())
      .post('/tournaments')
      .set(auth(owner))
      .send({
        name: 'KnowMe Team Review Cup',
        gameKey: 'pulse-duel',
        teamSize: 2,
        maxEntrants: 2,
        registrationClosesAt: closesAt,
        idempotencyKey: 'tournament:create:team:0001'
      })
      .expect(201);
    const teamTournamentId = teamTournament.body.id as string;
    await request(app.getHttpServer())
      .post(`/tournaments/${teamTournamentId}/registration/open`)
      .set(auth(owner))
      .send({ idempotencyKey: 'tournament:open:team:0001' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tournaments/${teamTournamentId}/entrants`)
      .set(auth(owner))
      .send({
        teamName: 'Alpha Team',
        memberUsernames: ['tournament_bravo'],
        idempotencyKey: 'tournament:register:team:alpha'
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/tournaments/${teamTournamentId}/entrants`)
      .set(auth(charlie))
      .send({
        teamName: 'Delta Team',
        memberUsernames: ['tournament_delta'],
        idempotencyKey: 'tournament:register:team:delta'
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tournaments/${teamTournamentId}/invitations/accept`)
      .set(auth(bravo))
      .send({ idempotencyKey: 'tournament:accept:team:bravo' })
      .expect(201);
    const teamsReady = await request(app.getHttpServer())
      .post(`/tournaments/${teamTournamentId}/invitations/accept`)
      .set(auth(delta))
      .send({ idempotencyKey: 'tournament:accept:team:delta' })
      .expect(201);
    expect(
      teamsReady.body.entrants.every((entrant: { status: string }) => entrant.status === 'READY')
    ).toBe(true);

    const teamStarted = await request(app.getHttpServer())
      .post(`/tournaments/${teamTournamentId}/start`)
      .set(auth(owner))
      .send({ idempotencyKey: 'tournament:start:team:0001' })
      .expect(201);
    const reviewMatch = teamStarted.body.matches[0];
    await prisma.gameSession.update({
      where: { id: reviewMatch.gameSessionId },
      data: {
        status: 'EXPIRED',
        cancellationReason: 'E2E_REVIEW',
        cancelledAt: new Date()
      }
    });
    const requiresReview = await request(app.getHttpServer())
      .post(`/tournaments/${teamTournamentId}/matches/${reviewMatch.id}/sync`)
      .set(auth(owner))
      .expect(201);
    expect(requiresReview.body.matches[0].status).toBe('REVIEW_REQUIRED');

    await request(app.getHttpServer())
      .patch(`/admin/tournaments/${teamTournamentId}/matches/${reviewMatch.id}/resolve`)
      .set(auth(bravo))
      .send({
        winnerEntrantId: reviewMatch.firstEntrantId,
        reason: 'Tentative sans permission administrative.'
      })
      .expect(403);

    const moderatorRole = await prisma.accessRole.findUniqueOrThrow({
      where: { key: 'moderator' }
    });
    await prisma.userRoleGrant.create({
      data: {
        userId: ownerId,
        roleId: moderatorRole.id,
        source: 'E2E',
        reason: 'Tournament moderation E2E',
        grantedById: ownerId
      }
    });
    await request(app.getHttpServer())
      .patch(`/admin/tournaments/${teamTournamentId}/matches/${reviewMatch.id}/resolve`)
      .set(auth(owner))
      .send({
        winnerEntrantId: reviewMatch.firstEntrantId,
        reason: 'Session expirée vérifiée, résolution administrative documentée.'
      })
      .expect(200);
    const reviewed = await request(app.getHttpServer())
      .get(`/tournaments/${teamTournamentId}`)
      .set(auth(owner))
      .expect(200);
    expect(reviewed.body.status).toBe('COMPLETED');
    expect(reviewed.body.championEntrantId).toBe(reviewMatch.firstEntrantId);

    const exported = await accounts.exportData(ownerId);
    expect(exported.formatVersion).toBe(17);
    const tournamentExport = exported.gamePlatform?.tournaments;
    expect(tournamentExport).toBeDefined();
    if (!tournamentExport) throw new Error('KMD-056 export missing.');
    expect(tournamentExport).toEqual(
      expect.objectContaining({
        formatVersion: 1,
        economicStakeIncluded: false,
        bracketSeedIncluded: false,
        clientSubmittedResultsIncluded: false,
        tournaments: expect.any(Array),
        matches: expect.any(Array)
      })
    );

    const eliminatedEntrant = view.entrants.find(
      (entrant: { status: string }) => entrant.status === 'ELIMINATED'
    );
    expect(eliminatedEntrant).toBeDefined();
    const deletedCaptain = userById.get(eliminatedEntrant.captainId)!.response;
    await accounts.deleteAccount(eliminatedEntrant.captainId, {
      password: 'KnowMeTest123!'
    });
    expect(
      await prisma.tournamentEntrantMember.count({
        where: { userId: eliminatedEntrant.captainId }
      })
    ).toBe(0);
    const anonymizedEntrant = await prisma.tournamentEntrant.findUniqueOrThrow({
      where: { id: eliminatedEntrant.id }
    });
    expect(anonymizedEntrant.captainId).toMatch(/^deleted-/);
    expect(
      await prisma.user.count({ where: { id: deletedCaptain.body.user.id } })
    ).toBe(0);
  });
});
