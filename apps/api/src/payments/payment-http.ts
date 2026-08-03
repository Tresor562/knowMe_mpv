import { BadGatewayException, RequestTimeoutException } from '@nestjs/common';

export class ProviderHttpError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    readonly responseBody: unknown
  ) {
    super(`${provider} a répondu avec le statut ${status}.`);
  }
}

export async function fetchProviderJson<T>(
  provider: string,
  url: string,
  init: RequestInit,
  timeoutMs = 12_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'KnowMe-Payments/1.0',
        ...(init.headers ?? {})
      }
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 500) };
      }
    }
    if (!response.ok) throw new ProviderHttpError(provider, response.status, body);
    return body as T;
  } catch (error) {
    if (error instanceof ProviderHttpError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RequestTimeoutException(`${provider} n’a pas répondu à temps.`);
    }
    throw new BadGatewayException(`${provider} est temporairement indisponible.`);
  } finally {
    clearTimeout(timer);
  }
}
