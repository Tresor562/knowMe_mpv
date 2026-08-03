import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationCenterStateActionDto } from './dto/notification-center.dto';
import {
  groupNotificationCenterRows,
  isCriticalNotificationType,
  localMinuteOfDay,
  notificationCircleId,
  NotificationCenterView,
  resolveNotificationCenterDelivery
} from './notification-center.domain';
import { NotificationCenterPolicyService } from './notification-center-policy.service';

@Injectable()
export class NotificationCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly policy: NotificationCenterPolicyService
  ) {}

  async center(input: {
    userId: string;
    view?: NotificationCenterView;
    cursor?: string;
    limit?: number;
    now?: Date;
  }) {
    const view = input.view ?? 'ACTIVE';
    const limit = Math.min(100, Math.max(1, input.limit ?? 40));
    const now = input.now ?? new Date();
    const preference = await this.policy.preferenceForUser(input.userId);
    const minuteOfDay = localMinuteOfDay(now, preference.timezone);
    const collected: Array<{
      id: string;
      userId: string;
      type: string;
      title: string;
      body: string;
      data: Prisma.JsonValue | null;
      readAt: Date | null;
      createdAt: Date;
      state: {
        dismissedAt: Date | null;
        archivedAt: Date | null;
        snoozedUntil: Date | null;
        restoredAt: Date | null;
      } | null;
      category: string;
      critical: boolean;
      deliveryReason: string;
    }> = [];
    let scanCursor = input.cursor;
    let rawHasMore = true;
    let scans = 0;

    while (collected.length < limit + 1 && rawHasMore && scans < 20) {
      scans += 1;
      const rows = await this.prisma.notification.findMany({
        where: { userId: input.userId },
        take: 101,
        ...(scanCursor ? { skip: 1, cursor: { id: scanCursor } } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      });
      rawHasMore = rows.length > 100;
      const page = rawHasMore ? rows.slice(0, 100) : rows;
      if (!page.length) break;
      scanCursor = page[page.length - 1]?.id;
      const states =
        await this.prisma.notificationCenterUserState.findMany({
          where: {
            userId: input.userId,
            notificationId: { in: page.map((row) => row.id) }
          }
        });
      const stateById = new Map(
        states.map((state) => [state.notificationId, state])
      );

      for (const row of page) {
        const state = stateById.get(row.id) ?? null;
        if (!this.matchesView(state, view, now)) continue;
        const decision = resolveNotificationCenterDelivery({
          type: row.type,
          circleId: notificationCircleId(row.data),
          minuteOfDay,
          preference
        });
        if (!decision.visibleInCenter) continue;
        collected.push({
          ...row,
          state: state
            ? {
                dismissedAt: state.dismissedAt,
                archivedAt: state.archivedAt,
                snoozedUntil: state.snoozedUntil,
                restoredAt: state.restoredAt
              }
            : null,
          category: decision.category,
          critical: decision.critical,
          deliveryReason: decision.reason
        });
        if (collected.length >= limit + 1) break;
      }
    }

    const hasMore = collected.length > limit || rawHasMore;
    const items = collected.slice(0, limit);
    const nextCursor = hasMore
      ? items[items.length - 1]?.id ?? scanCursor ?? null
      : null;
    const groups = groupNotificationCenterRows(items);

    const stateTotals = await this.stateTotals(input.userId, now);
    return {
      preferences: preference,
      view,
      items,
      groups,
      nextCursor,
      totals: {
        items: items.length,
        groups: groups.length,
        unread: items.filter((item) => !item.readAt).length,
        ...stateTotals
      },
      policy: {
        criticalCategoriesAlwaysVisible: ['SECURITY', 'SYSTEM'],
        transportsOwnedBy: 'KMD-046/KMD-047',
        rawTransportSecretsExposed: false,
        groupingWindowMinutes: 60,
        serverTime: now
      }
    };
  }

  getPreferences(userId: string) {
    return this.policy.preferenceForUser(userId);
  }

  updatePreferences(
    userId: string,
    dto: Parameters<NotificationCenterPolicyService['update']>[1]
  ) {
    return this.policy.update(userId, dto);
  }

  async unreadCount(userId: string, now = new Date()) {
    let cursor: string | undefined;
    let count = 0;
    let scans = 0;
    const preference = await this.policy.preferenceForUser(userId);
    const minuteOfDay = localMinuteOfDay(now, preference.timezone);

    while (scans < 100) {
      scans += 1;
      const rows = await this.prisma.notification.findMany({
        where: { userId, readAt: null },
        take: 201,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      });
      const hasMore = rows.length > 200;
      const page = hasMore ? rows.slice(0, 200) : rows;
      if (!page.length) break;
      cursor = page[page.length - 1]?.id;
      const states =
        await this.prisma.notificationCenterUserState.findMany({
          where: {
            userId,
            notificationId: { in: page.map((row) => row.id) }
          }
        });
      const stateById = new Map(
        states.map((state) => [state.notificationId, state])
      );
      for (const row of page) {
        if (!this.matchesView(stateById.get(row.id) ?? null, 'ACTIVE', now)) {
          continue;
        }
        const decision = resolveNotificationCenterDelivery({
          type: row.type,
          circleId: notificationCircleId(row.data),
          minuteOfDay,
          preference
        });
        if (decision.visibleInCenter) count += 1;
      }
      if (!hasMore) break;
    }
    return { count };
  }

  async markAllVisibleRead(userId: string, now = new Date()) {
    const ids = await this.visibleUnreadIds(userId, now);
    const readAt = new Date();
    const result = ids.length
      ? await this.prisma.notification.updateMany({
          where: { id: { in: ids }, userId, readAt: null },
          data: { readAt }
        })
      : { count: 0 };
    this.realtime.emitNotificationsReadAll(userId, readAt);
    return { ...result, readAt };
  }

  async applyState(
    userId: string,
    notificationId: string,
    dto: NotificationCenterStateActionDto
  ) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true, type: true }
    });
    if (!notification) {
      throw new NotFoundException('Notification introuvable.');
    }
    if (
      isCriticalNotificationType(notification.type) &&
      dto.action !== 'RESTORE'
    ) {
      throw new BadRequestException(
        'Une alerte critique ne peut pas être masquée, archivée ou reportée.'
      );
    }

    const receipt =
      await this.prisma.notificationCenterActionReceipt.findUnique({
        where: { idempotencyKey: dto.idempotencyKey }
      });
    if (receipt) {
      if (
        receipt.userId !== userId ||
        receipt.notificationId !== notificationId ||
        receipt.action !== dto.action
      ) {
        throw new ConflictException('Clé d’action déjà utilisée.');
      }
      return { replayed: true, result: receipt.result };
    }

    const now = new Date();
    const data =
      dto.action === 'DISMISS'
        ? {
            dismissedAt: now,
            archivedAt: null,
            snoozedUntil: null,
            restoredAt: null
          }
        : dto.action === 'ARCHIVE'
          ? {
              archivedAt: now,
              dismissedAt: null,
              snoozedUntil: null,
              restoredAt: null
            }
          : dto.action === 'SNOOZE'
            ? {
                snoozedUntil: new Date(
                  now.getTime() + (dto.snoozeMinutes ?? 60) * 60_000
                ),
                dismissedAt: null,
                archivedAt: null,
                restoredAt: null
              }
            : {
                dismissedAt: null,
                archivedAt: null,
                snoozedUntil: null,
                restoredAt: now
              };

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const state = await tx.notificationCenterUserState.upsert({
            where: {
              notificationId_userId: { notificationId, userId }
            },
            create: { notificationId, userId, ...data },
            update: data
          });
          const result = {
            notificationId,
            action: dto.action,
            dismissedAt: state.dismissedAt?.toISOString() ?? null,
            archivedAt: state.archivedAt?.toISOString() ?? null,
            snoozedUntil: state.snoozedUntil?.toISOString() ?? null,
            restoredAt: state.restoredAt?.toISOString() ?? null
          };
          await tx.notificationCenterActionReceipt.create({
            data: {
              idempotencyKey: dto.idempotencyKey,
              userId,
              notificationId,
              action: dto.action,
              result: result as Prisma.InputJsonValue
            }
          });
          return { replayed: false, result };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay =
          await this.prisma.notificationCenterActionReceipt.findUnique({
            where: { idempotencyKey: dto.idempotencyKey }
          });
        return { replayed: true, result: replay?.result ?? null };
      }
      throw error;
    }
  }

  private matchesView(
    state: {
      dismissedAt: Date | null;
      archivedAt: Date | null;
      snoozedUntil: Date | null;
    } | null,
    view: NotificationCenterView,
    now: Date
  ) {
    if (view === 'ARCHIVED') return Boolean(state?.archivedAt);
    if (view === 'DISMISSED') return Boolean(state?.dismissedAt);
    if (view === 'SNOOZED') {
      return Boolean(state?.snoozedUntil && state.snoozedUntil > now);
    }
    return !(
      state?.dismissedAt ||
      state?.archivedAt ||
      (state?.snoozedUntil && state.snoozedUntil > now)
    );
  }

  private async stateTotals(userId: string, now: Date) {
    const [archived, dismissed, snoozed] = await Promise.all([
      this.prisma.notificationCenterUserState.count({
        where: { userId, archivedAt: { not: null } }
      }),
      this.prisma.notificationCenterUserState.count({
        where: { userId, dismissedAt: { not: null } }
      }),
      this.prisma.notificationCenterUserState.count({
        where: { userId, snoozedUntil: { gt: now } }
      })
    ]);
    return { archived, dismissed, snoozed };
  }

  private async visibleUnreadIds(userId: string, now: Date) {
    const ids: string[] = [];
    let cursor: string | undefined;
    let scans = 0;
    const preference = await this.policy.preferenceForUser(userId);
    const minuteOfDay = localMinuteOfDay(now, preference.timezone);

    while (scans < 100) {
      scans += 1;
      const rows = await this.prisma.notification.findMany({
        where: { userId, readAt: null },
        take: 501,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      });
      const hasMore = rows.length > 500;
      const page = hasMore ? rows.slice(0, 500) : rows;
      if (!page.length) break;
      cursor = page[page.length - 1]?.id;
      const states =
        await this.prisma.notificationCenterUserState.findMany({
          where: {
            userId,
            notificationId: { in: page.map((row) => row.id) }
          }
        });
      const stateById = new Map(
        states.map((state) => [state.notificationId, state])
      );
      for (const row of page) {
        if (!this.matchesView(stateById.get(row.id) ?? null, 'ACTIVE', now)) {
          continue;
        }
        const decision = resolveNotificationCenterDelivery({
          type: row.type,
          circleId: notificationCircleId(row.data),
          minuteOfDay,
          preference
        });
        if (decision.visibleInCenter) ids.push(row.id);
      }
      if (!hasMore) break;
    }
    return ids;
  }
}
