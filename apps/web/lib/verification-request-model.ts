export type VerificationRequestStatus = {
  status: string;
  expiresAt?: string | null;
};

export function hasActiveVerificationApproval(
  requests: readonly VerificationRequestStatus[], now: Date = new Date()
): boolean {
  return requests.some(request => request.status === 'APPROVED' &&
    (!request.expiresAt ||
      (Number.isFinite(Date.parse(request.expiresAt)) && Date.parse(request.expiresAt) > now.getTime())));
}

export function canSubmitVerificationRequest(
  requests: readonly VerificationRequestStatus[], now: Date = new Date()
): boolean {
  const pending = requests.some(request =>
    request.status === 'SUBMITTED' || request.status === 'UNDER_REVIEW');
  return !pending && !hasActiveVerificationApproval(requests, now);
}

/** Mirrors the API's 3–500 character withdrawal reason contract. */
export function verificationWithdrawalReason(input: string | null): string | null {
  if (input === null) return null;
  const reason = input.trim();
  if (reason.length < 3 || reason.length > 500) return null;
  return reason;
}
