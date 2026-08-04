import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

export const SOCIAL_MATCH_PURPOSES = ['CHAT', 'PLAY', 'LEARN', 'CREATE'] as const;
export const SOCIAL_MATCH_PACES = ['REALTIME', 'ASYNC', 'FLEXIBLE'] as const;
export const SOCIAL_MATCH_LANGUAGES = [
  'ar',
  'de',
  'en',
  'es',
  'fr',
  'it',
  'pt'
] as const;
export const SOCIAL_MATCH_TOPICS = [
  'TECH',
  'MUSIC',
  'ANIME',
  'GAMING',
  'ART',
  'SCIENCE',
  'ENTREPRENEURSHIP',
  'SPORTS',
  'MOVIES',
  'BOOKS',
  'LANGUAGES',
  'COOKING',
  'TRAVEL_IDEAS'
] as const;

export type SocialMatchPurpose = (typeof SOCIAL_MATCH_PURPOSES)[number];
export type SocialMatchPace = (typeof SOCIAL_MATCH_PACES)[number];
export type SocialMatchLanguage = (typeof SOCIAL_MATCH_LANGUAGES)[number];
export type SocialMatchTopic = (typeof SOCIAL_MATCH_TOPICS)[number];

export type SocialAvailabilityWindow = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type NormalizedSocialCriteria = Record<string, unknown> & {
  purpose: SocialMatchPurpose;
  pace: SocialMatchPace;
  languages: SocialMatchLanguage[];
  topics: SocialMatchTopic[];
  availability: SocialAvailabilityWindow[];
};

export type SocialCompatibility = Record<string, unknown> & {
  compatible: boolean;
  score: number;
  sharedLanguages: SocialMatchLanguage[];
  sharedTopics: SocialMatchTopic[];
  overlapMinutes: number;
  paceReason: string;
  explanations: string[];
};

export function normalizeSocialCriteria(input: {
  purpose: string;
  pace: string;
  languages: string[];
  topics: string[];
  availability: SocialAvailabilityWindow[];
}): NormalizedSocialCriteria {
  const purpose = input.purpose.toUpperCase() as SocialMatchPurpose;
  const pace = input.pace.toUpperCase() as SocialMatchPace;
  if (!SOCIAL_MATCH_PURPOSES.includes(purpose)) {
    throw new BadRequestException({
      code: 'SOCIAL_MATCH_PURPOSE_INVALID',
      message: 'Cet objectif social n’est pas autorisé.'
    });
  }
  if (!SOCIAL_MATCH_PACES.includes(pace)) {
    throw new BadRequestException({
      code: 'SOCIAL_MATCH_PACE_INVALID',
      message: 'Ce rythme social n’est pas autorisé.'
    });
  }

  const languages = [...new Set(input.languages.map(normalizeLanguage))].sort();
  if (!languages.length || languages.length > 5) {
    throw new BadRequestException({
      code: 'SOCIAL_MATCH_LANGUAGES_INVALID',
      message: 'Choisis entre une et cinq langues.'
    });
  }

  const topics = [
    ...new Set(input.topics.map((topic) => topic.toUpperCase() as SocialMatchTopic))
  ].sort() as SocialMatchTopic[];
  if (
    !topics.length ||
    topics.length > 8 ||
    topics.some((topic) => !SOCIAL_MATCH_TOPICS.includes(topic))
  ) {
    throw new BadRequestException({
      code: 'SOCIAL_MATCH_TOPICS_INVALID',
      message: 'Les sujets choisis ne sont pas autorisés.'
    });
  }

  const availability = normalizeAvailability(input.availability);
  return { purpose, pace, languages, topics, availability };
}

export function socialCriteriaHash(criteria: NormalizedSocialCriteria): string {
  return createHash('sha256')
    .update(JSON.stringify(criteria))
    .digest('hex');
}

export function compareSocialCriteria(
  first: NormalizedSocialCriteria,
  second: NormalizedSocialCriteria
): SocialCompatibility {
  if (first.purpose !== second.purpose) {
    return incompatible('Les objectifs sociaux choisis sont différents.');
  }
  const sharedLanguages = first.languages.filter((language) =>
    second.languages.includes(language)
  );
  if (!sharedLanguages.length) {
    return incompatible('Aucune langue explicitement choisie en commun.');
  }
  const sharedTopics = first.topics.filter((topic) => second.topics.includes(topic));
  if (!sharedTopics.length) {
    return incompatible('Aucun sujet explicitement choisi en commun.');
  }
  const pace = comparePace(first.pace, second.pace);
  if (!pace.compatible) return incompatible(pace.reason);

  const overlapMinutes = availabilityOverlapMinutes(
    first.availability,
    second.availability
  );
  if (overlapMinutes < 30) {
    return incompatible('Aucun créneau commun d’au moins trente minutes.');
  }

  const topicScore = Math.min(40, sharedTopics.length * 10);
  const languageScore = Math.min(20, sharedLanguages.length * 10);
  const availabilityScore = Math.min(20, Math.max(5, Math.floor(overlapMinutes / 60) * 4));
  const score = topicScore + languageScore + availabilityScore + pace.score;
  return {
    compatible: true,
    score,
    sharedLanguages,
    sharedTopics,
    overlapMinutes,
    paceReason: pace.reason,
    explanations: [
      `Objectif partagé : ${purposeLabel(first.purpose)}.`,
      `${sharedTopics.length} sujet${sharedTopics.length > 1 ? 's' : ''} choisi${sharedTopics.length > 1 ? 's' : ''} en commun.`,
      `${sharedLanguages.length} langue${sharedLanguages.length > 1 ? 's' : ''} choisie${sharedLanguages.length > 1 ? 's' : ''} en commun.`,
      `${overlapMinutes} minutes de disponibilité UTC communes par semaine.`,
      pace.reason
    ]
  };
}

export function parseStoredCriteria(input: {
  purpose: string;
  pace: string;
  languages: unknown;
  topics: unknown;
  availability: unknown;
}): NormalizedSocialCriteria {
  return normalizeSocialCriteria({
    purpose: input.purpose,
    pace: input.pace,
    languages: arrayOfStrings(input.languages),
    topics: arrayOfStrings(input.topics),
    availability: arrayOfWindows(input.availability)
  });
}

export function availabilityOverlapMinutes(
  first: SocialAvailabilityWindow[],
  second: SocialAvailabilityWindow[]
): number {
  let total = 0;
  for (const left of first) {
    for (const right of second) {
      if (left.dayOfWeek !== right.dayOfWeek) continue;
      total += Math.max(
        0,
        Math.min(left.endMinute, right.endMinute) -
          Math.max(left.startMinute, right.startMinute)
      );
    }
  }
  return total;
}

function normalizeLanguage(value: string): SocialMatchLanguage {
  const normalized = value.trim().replace('_', '-').toLowerCase();
  if (!SOCIAL_MATCH_LANGUAGES.includes(normalized as SocialMatchLanguage)) {
    throw new BadRequestException({
      code: 'SOCIAL_MATCH_LANGUAGE_INVALID',
      message: 'Une langue choisie ne fait pas partie du catalogue autorisé.'
    });
  }
  return normalized as SocialMatchLanguage;
}

function normalizeAvailability(input: SocialAvailabilityWindow[]) {
  if (!input.length || input.length > 14) {
    throw new BadRequestException({
      code: 'SOCIAL_MATCH_AVAILABILITY_INVALID',
      message: 'Choisis entre un et quatorze créneaux UTC.'
    });
  }
  const normalized = input.map((window) => {
    if (
      !Number.isInteger(window.dayOfWeek) ||
      window.dayOfWeek < 0 ||
      window.dayOfWeek > 6 ||
      !Number.isInteger(window.startMinute) ||
      !Number.isInteger(window.endMinute) ||
      window.startMinute < 0 ||
      window.startMinute > 1439 ||
      window.endMinute < 1 ||
      window.endMinute > 1440 ||
      window.endMinute - window.startMinute < 30
    ) {
      throw new BadRequestException({
        code: 'SOCIAL_MATCH_AVAILABILITY_INVALID',
        message: 'Chaque créneau UTC doit durer au moins trente minutes.'
      });
    }
    return {
      dayOfWeek: window.dayOfWeek,
      startMinute: window.startMinute,
      endMinute: window.endMinute
    };
  });
  normalized.sort(
    (left, right) =>
      left.dayOfWeek - right.dayOfWeek || left.startMinute - right.startMinute
  );
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (
      previous.dayOfWeek === current.dayOfWeek &&
      current.startMinute < previous.endMinute
    ) {
      throw new BadRequestException({
        code: 'SOCIAL_MATCH_AVAILABILITY_OVERLAP',
        message: 'Tes propres créneaux UTC ne doivent pas se chevaucher.'
      });
    }
  }
  return normalized;
}

function comparePace(first: SocialMatchPace, second: SocialMatchPace) {
  if (first === second) {
    return {
      compatible: true,
      score: 20,
      reason: `Rythme partagé : ${paceLabel(first)}.`
    };
  }
  if (first === 'FLEXIBLE' || second === 'FLEXIBLE') {
    return {
      compatible: true,
      score: 12,
      reason: 'Au moins une personne a choisi un rythme flexible.'
    };
  }
  return {
    compatible: false,
    score: 0,
    reason: 'Les rythmes temps réel et asynchrone sont incompatibles.'
  };
}

function incompatible(reason: string): SocialCompatibility {
  return {
    compatible: false,
    score: 0,
    sharedLanguages: [],
    sharedTopics: [],
    overlapMinutes: 0,
    paceReason: reason,
    explanations: [reason]
  };
}

function purposeLabel(value: SocialMatchPurpose) {
  return {
    CHAT: 'discuter',
    PLAY: 'jouer',
    LEARN: 'apprendre',
    CREATE: 'créer'
  }[value];
}

function paceLabel(value: SocialMatchPace) {
  return {
    REALTIME: 'temps réel',
    ASYNC: 'asynchrone',
    FLEXIBLE: 'flexible'
  }[value];
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('Stored social matchmaking string list is invalid.');
  }
  return value as string[];
}

function arrayOfWindows(value: unknown): SocialAvailabilityWindow[] {
  if (!Array.isArray(value)) {
    throw new Error('Stored social matchmaking availability is invalid.');
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Stored social matchmaking availability is invalid.');
    }
    const record = item as Record<string, unknown>;
    return {
      dayOfWeek: Number(record.dayOfWeek),
      startMinute: Number(record.startMinute),
      endMinute: Number(record.endMinute)
    };
  });
}
