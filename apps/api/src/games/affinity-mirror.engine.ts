import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  GameApplyInput,
  GameApplyResult,
  GameCatalogDefinition,
  GameEngineAdapter
} from './game-platform.domain';

export type AffinityQuestion = {
  key: string;
  category: 'COMMUNICATION' | 'TRUST' | 'RHYTHM';
  prompt: string;
  options: [string, string, string, string];
};

export const AFFINITY_QUESTIONS_V1: AffinityQuestion[] = [
  {
    key: 'communication-after-tension',
    category: 'COMMUNICATION',
    prompt: 'Après un désaccord, quel rythme de reprise te convient le mieux ?',
    options: [
      'En parler immédiatement',
      'Prendre quelques minutes',
      'Revenir dessus plus tard dans la journée',
      'Attendre le lendemain'
    ]
  },
  {
    key: 'communication-good-news',
    category: 'COMMUNICATION',
    prompt: 'Quand une bonne nouvelle arrive, comment préfères-tu la partager ?',
    options: [
      'Par un message court',
      'Par un appel',
      'En racontant tous les détails',
      'En la célébrant ensemble'
    ]
  },
  {
    key: 'trust-private-story',
    category: 'TRUST',
    prompt: 'Quand on te confie une histoire privée, quelle règle te paraît la plus importante ?',
    options: [
      'Ne jamais la répéter',
      'Demander avant d’en parler',
      'N’en parler qu’à une personne de confiance',
      'Adapter selon la gravité'
    ]
  },
  {
    key: 'trust-help-request',
    category: 'TRUST',
    prompt: 'Quand tu as besoin d’aide, quelle approche te ressemble le plus ?',
    options: [
      'Demander directement',
      'Donner quelques indices',
      'Attendre qu’on le remarque',
      'Essayer seul avant de demander'
    ]
  },
  {
    key: 'rhythm-free-evening',
    category: 'RHYTHM',
    prompt: 'Pour une soirée libre à deux, quel programme te tente le plus ?',
    options: [
      'Sortir et improviser',
      'Planifier une activité',
      'Rester au calme à la maison',
      'Faire chacun son activité, ensemble'
    ]
  },
  {
    key: 'rhythm-weekend-plan',
    category: 'RHYTHM',
    prompt: 'Comment préfères-tu organiser un week-end commun ?',
    options: [
      'Tout décider à l’avance',
      'Prévoir les grandes étapes',
      'Choisir au jour le jour',
      'Alterner les choix de chacun'
    ]
  }
];

export const AFFINITY_GAME_DEFINITION: GameCatalogDefinition = {
  key: 'affinity-mirror',
  version: 1,
  name: 'Miroir d’affinité',
  description:
    'Un jeu volontaire qui compare six préférences et produit un instantané explicable, sans diagnostic ni classement de la relation.',
  engineKey: 'AFFINITY_MIRROR_V1',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    contentVersion: 1,
    actions: ['CONSENT', 'ANSWER'],
    consentRequired: true,
    hiddenAnswers: true,
    noWinner: true,
    noPsychologicalDiagnosis: true,
    noPublicRelationshipRanking: true,
    detailedAnswersRequireMutualConsent: true,
    economicStakeAllowed: false
  },
  initialConfig: {
    contentVersion: 1,
    questions: AFFINITY_QUESTIONS_V1
  }
};

type AffinityRound = {
  questionKey: string;
  category: AffinityQuestion['category'];
  answers: [number, number];
  distance: number;
  points: number;
  exact: boolean;
};

type AffinitySummary = {
  title: 'Instantané de préférences partagées';
  overallScore: number;
  exactMatches: number;
  questionCount: number;
  categories: Array<{
    key: AffinityQuestion['category'];
    label: string;
    score: number;
    exactMatches: number;
    questionCount: number;
  }>;
  explanations: string[];
  disclaimer: string;
  detailedAnswersShared: boolean;
  answerDetails?: Array<{
    questionKey: string;
    prompt: string;
    firstChoice: string;
    secondChoice: string;
  }>;
};

type AffinityState = {
  engine: 'AFFINITY_MIRROR_V1';
  phase: 'CONSENT' | 'QUESTIONS' | 'COMPLETED';
  turnPosition: 0 | 1;
  consented: [boolean, boolean];
  shareAnswers: [boolean, boolean];
  questionIndex: number;
  pendingAnswers: [number | null, number | null];
  rounds: AffinityRound[];
  completed: boolean;
  summary: AffinitySummary | null;
};

export class AffinityMirrorEngine implements GameEngineAdapter {
  readonly engineKey = 'AFFINITY_MIRROR_V1';

  createInitialState(playerCount: number): AffinityState {
    if (playerCount !== 2) {
      throw new BadRequestException({
        code: 'AFFINITY_PLAYER_COUNT_INVALID',
        message: 'Miroir d’affinité nécessite exactement deux joueurs.'
      });
    }
    return {
      engine: 'AFFINITY_MIRROR_V1',
      phase: 'CONSENT',
      turnPosition: 0,
      consented: [false, false],
      shareAnswers: [false, false],
      questionIndex: 0,
      pendingAnswers: [null, null],
      rounds: [],
      completed: false,
      summary: null
    };
  }

  apply(input: GameApplyInput): GameApplyResult {
    const state = this.parseState(input.state);
    if (state.completed) {
      throw new ConflictException({
        code: 'AFFINITY_ALREADY_COMPLETED',
        message: 'Cet instantané est déjà terminé.'
      });
    }
    if (input.actorPosition !== state.turnPosition) {
      throw new ConflictException({
        code: 'GAME_NOT_YOUR_TURN',
        message: 'Ce n’est pas ton tour.'
      });
    }

    if (state.phase === 'CONSENT') return this.applyConsent(state, input);
    if (state.phase === 'QUESTIONS') return this.applyAnswer(state, input);
    throw new ConflictException({
      code: 'AFFINITY_PHASE_INVALID',
      message: 'Cette étape du jeu n’accepte plus d’action.'
    });
  }

  publicState(value: unknown) {
    const state = this.parseState(value);
    const question =
      state.phase === 'QUESTIONS'
        ? AFFINITY_QUESTIONS_V1[state.questionIndex] ?? null
        : null;
    return {
      engine: state.engine,
      phase: state.phase,
      consentCount: state.consented.filter(Boolean).length,
      questionIndex: state.questionIndex,
      questionCount: AFFINITY_QUESTIONS_V1.length,
      question: question
        ? {
            key: question.key,
            category: question.category,
            prompt: question.prompt,
            options: question.options
          }
        : null,
      answeredPositions: state.pendingAnswers
        .map((answer, position) => (answer === null ? null : position))
        .filter((position): position is number => position !== null),
      completedRounds: state.rounds.length,
      lastComparison:
        state.rounds.length > 0
          ? this.publicRound(state.rounds[state.rounds.length - 1])
          : null,
      summary: state.summary,
      completed: state.completed,
      winnerPosition: null,
      disclaimer:
        'Ce jeu décrit uniquement les réponses données ici. Il ne mesure ni la qualité, ni la compatibilité, ni l’avenir d’une relation.'
    };
  }

  private applyConsent(state: AffinityState, input: GameApplyInput): GameApplyResult {
    if (input.actionType !== 'CONSENT') {
      throw new BadRequestException({
        code: 'AFFINITY_CONSENT_REQUIRED',
        message: 'Chaque joueur doit d’abord donner son consentement explicite.'
      });
    }
    const payload = this.record(input.payload);
    if (
      Object.keys(payload).some((key) => !['accepted', 'shareAnswers'].includes(key)) ||
      payload.accepted !== true ||
      typeof payload.shareAnswers !== 'boolean'
    ) {
      throw new BadRequestException({
        code: 'AFFINITY_CONSENT_INVALID',
        message: 'Le consentement doit être explicite et le choix de partage doit être indiqué.'
      });
    }
    const position = input.actorPosition as 0 | 1;
    if (state.consented[position]) {
      throw new ConflictException({
        code: 'AFFINITY_CONSENT_ALREADY_RECORDED',
        message: 'Ton consentement est déjà enregistré.'
      });
    }
    const consented: [boolean, boolean] = [...state.consented];
    const shareAnswers: [boolean, boolean] = [...state.shareAnswers];
    consented[position] = true;
    shareAnswers[position] = payload.shareAnswers;
    const allConsented = consented.every(Boolean);
    const next: AffinityState = {
      ...state,
      consented,
      shareAnswers,
      phase: allConsented ? 'QUESTIONS' : 'CONSENT',
      turnPosition: allConsented ? 0 : ((position === 0 ? 1 : 0) as 0 | 1)
    };
    return {
      state: next,
      currentTurnPosition: next.turnPosition,
      completed: false,
      winnerPosition: null,
      result: null
    };
  }

  private applyAnswer(state: AffinityState, input: GameApplyInput): GameApplyResult {
    if (input.actionType !== 'ANSWER') {
      throw new BadRequestException({
        code: 'AFFINITY_ANSWER_REQUIRED',
        message: 'Une réponse est attendue pour cette question.'
      });
    }
    const payload = this.record(input.payload);
    if (
      Object.keys(payload).length !== 1 ||
      !Number.isInteger(payload.option) ||
      Number(payload.option) < 0 ||
      Number(payload.option) > 3
    ) {
      throw new BadRequestException({
        code: 'AFFINITY_ANSWER_INVALID',
        message: 'La réponse doit correspondre à l’une des quatre options proposées.'
      });
    }
    const question = AFFINITY_QUESTIONS_V1[state.questionIndex];
    if (!question) throw new Error('Affinity question version is inconsistent.');
    const position = input.actorPosition as 0 | 1;
    if (state.pendingAnswers[position] !== null) {
      throw new ConflictException({
        code: 'AFFINITY_ANSWER_ALREADY_RECORDED',
        message: 'Ta réponse est déjà enregistrée pour cette question.'
      });
    }
    const pendingAnswers: [number | null, number | null] = [...state.pendingAnswers];
    pendingAnswers[position] = Number(payload.option);
    const bothAnswered = pendingAnswers.every((answer) => answer !== null);

    if (!bothAnswered) {
      const next: AffinityState = {
        ...state,
        pendingAnswers,
        turnPosition: (position === 0 ? 1 : 0) as 0 | 1
      };
      return {
        state: next,
        currentTurnPosition: next.turnPosition,
        completed: false,
        winnerPosition: null,
        result: null
      };
    }

    const answers = pendingAnswers as [number, number];
    const distance = Math.abs(answers[0] - answers[1]);
    const points = [100, 67, 33, 0][distance];
    const round: AffinityRound = {
      questionKey: question.key,
      category: question.category,
      answers,
      distance,
      points,
      exact: distance === 0
    };
    const rounds = [...state.rounds, round];
    const completed = state.questionIndex >= AFFINITY_QUESTIONS_V1.length - 1;

    if (completed) {
      const summary = this.buildSummary(rounds, state.shareAnswers);
      const next: AffinityState = {
        ...state,
        phase: 'COMPLETED',
        pendingAnswers: [null, null],
        rounds,
        completed: true,
        summary
      };
      return {
        state: next,
        currentTurnPosition: null,
        completed: true,
        winnerPosition: null,
        result: summary as unknown as Record<string, unknown>
      };
    }

    const nextStarter = (state.questionIndex % 2 === 0 ? 1 : 0) as 0 | 1;
    const next: AffinityState = {
      ...state,
      questionIndex: state.questionIndex + 1,
      pendingAnswers: [null, null],
      rounds,
      turnPosition: nextStarter
    };
    return {
      state: next,
      currentTurnPosition: next.turnPosition,
      completed: false,
      winnerPosition: null,
      result: null
    };
  }

  private buildSummary(
    rounds: AffinityRound[],
    shareAnswers: [boolean, boolean]
  ): AffinitySummary {
    const categories: AffinityQuestion['category'][] = [
      'COMMUNICATION',
      'TRUST',
      'RHYTHM'
    ];
    const labels: Record<AffinityQuestion['category'], string> = {
      COMMUNICATION: 'Communication',
      TRUST: 'Confiance pratique',
      RHYTHM: 'Rythme partagé'
    };
    const categoryResults = categories.map((key) => {
      const items = rounds.filter((round) => round.category === key);
      return {
        key,
        label: labels[key],
        score: Math.round(
          items.reduce((total, round) => total + round.points, 0) / items.length
        ),
        exactMatches: items.filter((round) => round.exact).length,
        questionCount: items.length
      };
    });
    const overallScore = Math.round(
      rounds.reduce((total, round) => total + round.points, 0) / rounds.length
    );
    const exactMatches = rounds.filter((round) => round.exact).length;
    const strongest = [...categoryResults].sort((left, right) => right.score - left.score)[0];
    const detailedAnswersShared = shareAnswers.every(Boolean);

    return {
      title: 'Instantané de préférences partagées',
      overallScore,
      exactMatches,
      questionCount: rounds.length,
      categories: categoryResults,
      explanations: [
        `Vous avez choisi exactement la même option sur ${exactMatches} question${exactMatches > 1 ? 's' : ''} sur ${rounds.length}.`,
        `La proximité de réponses la plus élevée apparaît dans la catégorie « ${strongest.label} » (${strongest.score}/100).`,
        'Les écarts indiquent seulement des préférences différentes dans ce jeu et ne constituent pas un jugement.'
      ],
      disclaimer:
        'Cet instantané n’est ni un test psychologique, ni une mesure de compatibilité, ni un classement de votre relation.',
      detailedAnswersShared,
      ...(detailedAnswersShared
        ? {
            answerDetails: rounds.map((round) => {
              const question = AFFINITY_QUESTIONS_V1.find(
                (item) => item.key === round.questionKey
              );
              if (!question) throw new Error('Affinity replay question is missing.');
              return {
                questionKey: question.key,
                prompt: question.prompt,
                firstChoice: question.options[round.answers[0]],
                secondChoice: question.options[round.answers[1]]
              };
            })
          }
        : {})
    };
  }

  private publicRound(round: AffinityRound) {
    return {
      questionKey: round.questionKey,
      category: round.category,
      distance: round.distance,
      points: round.points,
      exact: round.exact
    };
  }

  private record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException({
        code: 'AFFINITY_ACTION_PAYLOAD_INVALID',
        message: 'Les données de cette action sont invalides.'
      });
    }
    return value as Record<string, unknown>;
  }

  private parseState(value: unknown): AffinityState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid affinity state.');
    }
    const state = value as Partial<AffinityState>;
    if (
      state.engine !== 'AFFINITY_MIRROR_V1' ||
      !['CONSENT', 'QUESTIONS', 'COMPLETED'].includes(String(state.phase)) ||
      (state.turnPosition !== 0 && state.turnPosition !== 1) ||
      !Array.isArray(state.consented) ||
      state.consented.length !== 2 ||
      !Array.isArray(state.shareAnswers) ||
      state.shareAnswers.length !== 2 ||
      !Number.isInteger(state.questionIndex) ||
      !Array.isArray(state.pendingAnswers) ||
      state.pendingAnswers.length !== 2 ||
      !Array.isArray(state.rounds) ||
      typeof state.completed !== 'boolean'
    ) {
      throw new Error('Invalid affinity state.');
    }
    return state as AffinityState;
  }
}

export function sanitizeAffinityReplay(input: {
  initialState: unknown;
  finalState: unknown;
  result: unknown;
  actions: Array<{
    sequence: number;
    actorId: string;
    actionType: string;
    payload: unknown;
    stateHashBefore: string;
    stateHashAfter: string;
    createdAt: Date;
  }>;
}) {
  const result =
    input.result && typeof input.result === 'object' && !Array.isArray(input.result)
      ? (input.result as Record<string, unknown>)
      : {};
  const detailedAnswersShared = result.detailedAnswersShared === true;
  const engine = new AffinityMirrorEngine();
  return {
    initialState: engine.publicState(input.initialState),
    finalState: engine.publicState(input.finalState),
    actions: input.actions.map((action) => ({
      sequence: action.sequence,
      actorId: action.actorId,
      actionType: action.actionType,
      payload:
        action.actionType === 'ANSWER' && !detailedAnswersShared
          ? { redacted: true }
          : action.actionType === 'CONSENT'
            ? { accepted: true, shareAnswers: detailedAnswersShared }
            : action.payload,
      stateHashBefore: action.stateHashBefore,
      stateHashAfter: action.stateHashAfter,
      createdAt: action.createdAt
    })),
    privacyRedacted: !detailedAnswersShared,
    detailedAnswersShared,
    interpretable: true,
    reproducibleByParticipant: detailedAnswersShared
  };
}
