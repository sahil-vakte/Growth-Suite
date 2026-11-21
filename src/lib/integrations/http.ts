/** Small fetch wrapper with timeout and readable errors for provider calls. */
export async function callJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    const body = text ? safeParse(text) : null;
    if (!res.ok) {
      const msg =
        (body as { error?: { message?: string } } | null)?.error?.message ?? text.slice(0, 300);
      throw new ProviderError(res.status, msg || res.statusText);
    }
    return body as T;
  } finally {
    clearTimeout(t);
  }
}
const safeParse = (t: string) => {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};

export class ProviderError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
  get retryable() {
    return this.status >= 500 || this.status === 429;
  }
}

/** In mock mode, every call is recorded here so tests and the admin "integration log" can show what would have been sent. */
export const mockLog: { at: string; provider: string; action: string; payload: unknown }[] = [];
export function recordMock(provider: string, action: string, payload: unknown) {
  mockLog.unshift({ at: new Date().toISOString(), provider, action, payload });
  if (mockLog.length > 500) mockLog.length = 500;
  return { mock: true, id: `mock_${provider}_${Date.now().toString(36)}` };
}
