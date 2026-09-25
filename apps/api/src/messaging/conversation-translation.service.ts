import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MEDIA_MESSAGE_PREFIX } from './media-message-token.service';
import { STICKER_MESSAGE_PREFIX } from './stickers/sticker-token.service';

type TranslationSegment = {
  id: string;
  text: string;
};

type TranslationProviderResult = {
  translations?: Array<string | { text?: unknown; sourceLanguage?: unknown }>;
};

const LATIN_LANGUAGE_MARKERS: Record<string, string[]> = {
  fr: [' le ', ' la ', ' les ', ' des ', ' une ', ' est ', ' avec ', ' pour ', ' pas ', ' je ', ' tu ', ' vous ', ' ça ', ' mais '],
  en: [' the ', ' and ', ' is ', ' are ', ' with ', ' for ', ' not ', ' you ', ' this ', ' that ', ' but ', ' have '],
  es: [' el ', ' la ', ' los ', ' las ', ' una ', ' es ', ' con ', ' para ', ' no ', ' que ', ' pero ', ' está '],
  pt: [' o ', ' a ', ' os ', ' as ', ' uma ', ' é ', ' com ', ' para ', ' não ', ' que ', ' mas ', ' você '],
  de: [' der ', ' die ', ' das ', ' und ', ' ist ', ' mit ', ' für ', ' nicht ', ' ich ', ' du ', ' aber '],
  it: [' il ', ' lo ', ' la ', ' gli ', ' una ', ' è ', ' con ', ' per ', ' non ', ' che ', ' ma ']
};

export function detectDominantConversationLanguage(texts: string[]) {
  const text = ` ${texts.join(' ').toLocaleLowerCase()} `;
  if (!text.trim()) return null;

  if (/[぀-ヿ]/u.test(text)) return 'ja';
  if (/[가-힯]/u.test(text)) return 'ko';
  if (/[一-鿿]/u.test(text)) return 'zh';
  if (/[؀-ۿ]/u.test(text)) return 'ar';
  if (/[Ѐ-ӿ]/u.test(text)) return 'ru';

  let best: { language: string; score: number } | null = null;
  for (const [language, markers] of Object.entries(LATIN_LANGUAGE_MARKERS)) {
    const score = markers.reduce((total, marker) => {
      let cursor = 0;
      let matches = 0;
      while ((cursor = text.indexOf(marker, cursor)) >= 0) {
        matches += 1;
        cursor += marker.length;
      }
      return total + matches;
    }, 0);
    if (!best || score > best.score) best = { language, score };
  }

  return best && best.score >= 2 ? best.language : null;
}

@Injectable()
export class ConversationTranslationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async offer(userId: string, conversationId: string, targetLanguage: string) {
    await this.assertMember(userId, conversationId);
    const normalizedTarget = this.normalizeLanguage(targetLanguage);
    const [human, nexus] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 24,
        select: { content: true }
      }),
      this.prisma.nexusSocialReply.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 12,
        select: { content: true }
      })
    ]);
    const sourceLanguage = detectDominantConversationLanguage([
      ...human.map((item) => item.content),
      ...nexus.map((item) => item.content)
    ]);
    return {
      sourceLanguage,
      targetLanguage: normalizedTarget,
      shouldOffer:
        Boolean(sourceLanguage) &&
        this.baseLanguage(sourceLanguage!) !== this.baseLanguage(normalizedTarget)
    };
  }

  async translate(
    userId: string,
    conversationId: string,
    input: { targetLanguage: string; messageIds: string[] }
  ) {
    await this.assertMember(userId, conversationId);
    const targetLanguage = this.normalizeLanguage(input.targetLanguage);
    const segments = await this.resolveSegments(conversationId, input.messageIds);
    if (!segments.length) {
      return { targetLanguage, items: [] };
    }

    const providerUrl = this.config
      .get<string>('MESSENGER_TRANSLATION_PROVIDER_URL')
      ?.trim();
    if (!providerUrl) {
      throw new ServiceUnavailableException({
        code: 'MESSENGER_TRANSLATION_UNAVAILABLE',
        message: 'La traduction de conversation n’est pas encore configurée sur ce serveur.'
      });
    }

    const token = this.config
      .get<string>('MESSENGER_TRANSLATION_PROVIDER_TOKEN')
      ?.trim();
    let response: Response;
    try {
      response = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          targetLanguage,
          texts: segments.map((segment) => segment.text)
        }),
        signal: AbortSignal.timeout(12_000)
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'MESSENGER_TRANSLATION_UNAVAILABLE',
        message: 'Le service de traduction est temporairement indisponible.'
      });
    }

    if (!response.ok) {
      throw new BadGatewayException({
        code: 'MESSENGER_TRANSLATION_PROVIDER_ERROR',
        message: 'Le service de traduction a refusé la requête.'
      });
    }

    const payload = await response.json().catch(() => null) as TranslationProviderResult | null;
    const translations = payload?.translations;
    if (!Array.isArray(translations) || translations.length !== segments.length) {
      throw new BadGatewayException({
        code: 'MESSENGER_TRANSLATION_PROVIDER_INVALID',
        message: 'Réponse de traduction invalide.'
      });
    }

    const items = translations.map((value, index) => {
      const segment = segments[index]!;
      const translated =
        typeof value === 'string'
          ? value
          : typeof value?.text === 'string'
            ? value.text
            : null;
      if (!translated) {
        throw new BadGatewayException({
          code: 'MESSENGER_TRANSLATION_PROVIDER_INVALID',
          message: 'Réponse de traduction incomplète.'
        });
      }
      return {
        id: segment.id,
        original: segment.text,
        translated,
        sourceLanguage:
          typeof value === 'object' && typeof value.sourceLanguage === 'string'
            ? value.sourceLanguage
            : null
      };
    });

    return { targetLanguage, items };
  }

  private async resolveSegments(
    conversationId: string,
    ids: string[]
  ): Promise<TranslationSegment[]> {
    const unique = [...new Set(ids)];
    const humanIds = unique.filter((id) => !id.startsWith('nexus:'));
    const nexusIds = unique
      .filter((id) => id.startsWith('nexus:'))
      .map((id) => id.slice(6));

    const [human, nexus] = await Promise.all([
      humanIds.length
        ? this.prisma.message.findMany({
            where: { conversationId, id: { in: humanIds } },
            select: { id: true, content: true }
          })
        : Promise.resolve([]),
      nexusIds.length
        ? this.prisma.nexusSocialReply.findMany({
            where: { conversationId, id: { in: nexusIds } },
            select: { id: true, content: true }
          })
        : Promise.resolve([])
    ]);
    const byId = new Map<string, string>([
      ...human.map((item) => [item.id, item.content] as const),
      ...nexus.map((item) => [`nexus:${item.id}`, item.content] as const)
    ]);

    return unique.flatMap((id) => {
      const text = byId.get(id);
      if (
        !text ||
        text.startsWith(`${MEDIA_MESSAGE_PREFIX}.`) ||
        text.startsWith(`${STICKER_MESSAGE_PREFIX}.`)
      ) {
        return [];
      }
      return [{ id, text }];
    });
  }

  private async assertMember(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true }
    });
    if (!member) {
      throw new ForbiddenException('Accès interdit à cette conversation.');
    }
  }

  private normalizeLanguage(value: string) {
    const normalized = value.trim();
    if (
      normalized.length > 35 ||
      !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(normalized)
    ) {
      throw new ForbiddenException('Langue de traduction invalide.');
    }
    return normalized;
  }

  private baseLanguage(value: string) {
    return value.toLowerCase().split('-')[0] ?? value.toLowerCase();
  }
}
