import { ERROR_STATUS, type ErrorCode } from '@fancy/contracts';

export type ErrorKind = 'auth' | 'forbidden' | 'not_found' | 'conflict' | 'gone' | 'validation' | 'precondition' | 'rate_limit' | 'unavailable' | 'internal' | 'network';

export interface TimeChoice {
  utcOffsetMinutes: number;
  label: string;
  instant: string;
}

/** Normalised API failure; UIs branch on `code`, never on message text. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly kind: ErrorKind;
  readonly requestId: string | null;
  readonly fieldErrors: Record<string, string> | undefined;
  readonly retryAfterSeconds: number | undefined;
  readonly currentVersion: string | undefined;
  readonly choices: TimeChoice[] | undefined;

  constructor(init: {
    status: number; code: ErrorCode | 'NETWORK_ERROR'; message: string; requestId?: string | null;
    fieldErrors?: Record<string, string>; retryAfterSeconds?: number; currentVersion?: string; choices?: TimeChoice[];
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.kind = classify(init.status, init.code);
    this.requestId = init.requestId ?? null;
    this.fieldErrors = init.fieldErrors;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.currentVersion = init.currentVersion;
    this.choices = init.choices;
  }

  /** Same intent may be retried with the same key: transport failure, provider outage, or intent still in progress. */
  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'unavailable' || this.kind === 'rate_limit' || this.code === 'INTENT_IN_PROGRESS';
  }
}

function classify(status: number, code: string): ErrorKind {
  if (code === 'NETWORK_ERROR') return 'network';
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 410) return 'gone';
  if (status === 400 || status === 422) return 'validation';
  if (status === 428) return 'precondition';
  if (status === 429) return 'rate_limit';
  if (status === 503) return 'unavailable';
  return 'internal';
}

const KNOWN = new Set(Object.keys(ERROR_STATUS));

export async function errorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const error = (body as { error?: Record<string, unknown> } | undefined)?.error;
  const meta = (body as { meta?: { requestId?: string } } | undefined)?.meta;
  const code = typeof error?.code === 'string' && KNOWN.has(error.code) ? (error.code as ErrorCode)
    : response.status === 503 ? 'PROVIDER_UNAVAILABLE' : 'INTERNAL_ERROR';
  return new ApiError({
    status: response.status,
    code,
    message: typeof error?.message === 'string' ? error.message : `HTTP ${response.status}`,
    requestId: meta?.requestId ?? response.headers.get('x-request-id'),
    ...(error?.fieldErrors ? { fieldErrors: error.fieldErrors as Record<string, string> } : {}),
    ...(typeof error?.retryAfterSeconds === 'number' ? { retryAfterSeconds: error.retryAfterSeconds }
      : response.headers.get('retry-after') ? { retryAfterSeconds: Number(response.headers.get('retry-after')) } : {}),
    ...(typeof error?.currentVersion === 'string' ? { currentVersion: error.currentVersion } : {}),
    ...(Array.isArray(error?.choices) ? { choices: error.choices as TimeChoice[] } : {}),
  });
}
