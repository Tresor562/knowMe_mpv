import { canonicalJson } from './game-platform.domain';

export function redactAffinityStoredState(
  value: unknown,
  deletedPosition: number
): Record<string, unknown> {
  const state = cloneRecord(value);
  if (state.engine !== 'AFFINITY_MIRROR_V1') return state;

  if (Array.isArray(state.shareAnswers) && state.shareAnswers.length === 2) {
    state.shareAnswers = state.shareAnswers.map(() => false);
  }
  if (Array.isArray(state.pendingAnswers) && state.pendingAnswers.length === 2) {
    state.pendingAnswers = state.pendingAnswers.map((answer, position) =>
      position === deletedPosition ? null : answer
    );
  }
  if (Array.isArray(state.rounds)) {
    state.rounds = state.rounds.map((round) => {
      if (!round || typeof round !== 'object' || Array.isArray(round)) return round;
      const next = { ...(round as Record<string, unknown>) };
      if (Array.isArray(next.answers) && next.answers.length === 2) {
        next.answers = next.answers.map((answer, position) =>
          position === deletedPosition ? null : answer
        );
      }
      return next;
    });
  }
  if (state.summary && typeof state.summary === 'object' && !Array.isArray(state.summary)) {
    state.summary = redactAffinityStoredResult(state.summary);
  }
  return state;
}

export function redactAffinityStoredResult(value: unknown): Record<string, unknown> {
  const result = cloneRecord(value);
  if ('detailedAnswersShared' in result) result.detailedAnswersShared = false;
  delete result.answerDetails;
  return result;
}

function cloneRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(canonicalJson(value)) as Record<string, unknown>;
}
