import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  assertMessageEncryptionRuntimeConfig,
  decryptMessageContent,
  encryptMessageContent,
  isEncryptedMessageContent
} from './message-content-crypto';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(record: UnknownRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function encryptContentField(
  data: unknown,
  inheritedContext: { conversationId?: string; senderId?: string } = {}
) {
  if (Array.isArray(data)) {
    for (const item of data) encryptContentField(item, inheritedContext);
    return;
  }
  if (!isRecord(data)) return;

  const context = {
    conversationId: stringField(data, 'conversationId') ?? inheritedContext.conversationId,
    senderId: stringField(data, 'senderId') ?? inheritedContext.senderId
  };

  const content = data.content;
  if (typeof content === 'string') {
    data.content = encryptMessageContent(content, context);
  } else if (isRecord(content) && typeof content.set === 'string') {
    content.set = encryptMessageContent(content.set, context);
  }
}

function encryptMessageWrite(action: string, args: unknown) {
  if (!isRecord(args)) return;

  const where = isRecord(args.where) ? args.where : undefined;
  const inheritedContext = {
    conversationId: stringField(where, 'conversationId'),
    senderId: stringField(where, 'senderId')
  };

  switch (action) {
    case 'create':
    case 'createMany':
    case 'createManyAndReturn':
      encryptContentField(args.data, inheritedContext);
      break;
    case 'update':
    case 'updateMany':
    case 'updateManyAndReturn':
      encryptContentField(args.data, inheritedContext);
      break;
    case 'upsert':
      encryptContentField(args.create, inheritedContext);
      encryptContentField(args.update, inheritedContext);
      break;
  }
}

function decryptMessageResults(value: unknown): unknown {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = decryptMessageResults(value[index]);
    }
    return value;
  }
  if (!isRecord(value) || value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (typeof value.content === 'string' && isEncryptedMessageContent(value.content)) {
    value.content = decryptMessageContent(value.content, {
      conversationId: stringField(value, 'conversationId'),
      senderId: stringField(value, 'senderId')
    });
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === 'content') continue;
    value[key] = decryptMessageResults(nested);
  }
  return value;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    assertMessageEncryptionRuntimeConfig();

    this.$use(async (params, next) => {
      if (params.model === 'Message') {
        encryptMessageWrite(params.action, params.args);
      }

      const result = await next(params);
      return decryptMessageResults(result);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
