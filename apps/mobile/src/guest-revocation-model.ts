export function shouldClearGuestCredentialAfterRevocationFailure(status?: number) {
  return status === 401;
}
