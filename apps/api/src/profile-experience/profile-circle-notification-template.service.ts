import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleTransportChannel } from './profile-circle-notification-endpoints.service';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function interpolate(
  template: string,
  variables: Record<string, string>,
  html: boolean
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key] ?? '';
    return html ? escapeHtml(value) : value;
  });
}

function toJsonValue(value?: Record<string, unknown>) {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class ProfileCircleNotificationTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async publish(input: {
    key: string;
    version: number;
    locale: string;
    channel: ProfileCircleTransportChannel;
    subject?: string;
    textBody: string;
    htmlBody?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string;
  }) {
    const key = input.key.trim().toLowerCase();
    const locale = input.locale.trim().toLowerCase();
    if (!key || !locale || !input.textBody.trim()) {
      throw new Error('NOTIFICATION_TEMPLATE_INVALID');
    }
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new Error('NOTIFICATION_TEMPLATE_VERSION_INVALID');
    }
    const metadata = toJsonValue(input.metadata);

    return this.prisma.$transaction(async (tx) => {
      await tx.profileCircleNotificationTemplate.updateMany({
        where: { key, locale, channel: input.channel, active: true },
        data: { active: false }
      });
      return tx.profileCircleNotificationTemplate.upsert({
        where: {
          key_version_locale_channel: {
            key,
            version: input.version,
            locale,
            channel: input.channel
          }
        },
        create: {
          key,
          version: input.version,
          locale,
          channel: input.channel,
          subject: input.subject?.replace(/[\r\n]+/g, ' ').slice(0, 180) ?? null,
          textBody: input.textBody,
          htmlBody: input.htmlBody ?? null,
          metadata,
          createdBy: input.createdBy ?? null,
          active: true,
          publishedAt: new Date()
        },
        update: {
          subject: input.subject?.replace(/[\r\n]+/g, ' ').slice(0, 180) ?? null,
          textBody: input.textBody,
          htmlBody: input.htmlBody ?? null,
          metadata,
          createdBy: input.createdBy ?? null,
          active: true,
          publishedAt: new Date()
        }
      });
    });
  }

  async render(input: {
    key: string;
    locale: string;
    channel: ProfileCircleTransportChannel;
    variables: Record<string, string>;
  }) {
    const key = input.key.trim().toLowerCase();
    const locale = input.locale.trim().toLowerCase();
    const template =
      (await this.prisma.profileCircleNotificationTemplate.findFirst({
        where: { key, locale, channel: input.channel, active: true },
        orderBy: { version: 'desc' }
      })) ??
      (await this.prisma.profileCircleNotificationTemplate.findFirst({
        where: { key, locale: 'fr', channel: input.channel, active: true },
        orderBy: { version: 'desc' }
      }));
    if (!template) throw new Error('NOTIFICATION_TEMPLATE_NOT_FOUND');

    return {
      templateId: template.id,
      version: template.version,
      subject: template.subject
        ? interpolate(template.subject, input.variables, false)
            .replace(/[\r\n]+/g, ' ')
            .slice(0, 180)
        : null,
      textBody: interpolate(template.textBody, input.variables, false),
      htmlBody: template.htmlBody
        ? interpolate(template.htmlBody, input.variables, true)
        : null
    };
  }

  list(key?: string) {
    return this.prisma.profileCircleNotificationTemplate.findMany({
      where: key ? { key: key.trim().toLowerCase() } : undefined,
      orderBy: [{ key: 'asc' }, { locale: 'asc' }, { version: 'desc' }],
      select: {
        id: true,
        key: true,
        version: true,
        locale: true,
        channel: true,
        active: true,
        publishedAt: true,
        updatedAt: true
      }
    });
  }
}
