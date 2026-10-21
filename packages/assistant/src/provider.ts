/** Provider-only boundary. No application write commands or DB clients are available here. */
export interface ModelInput { schema: Record<string, unknown>; input: string; deadline: number; maxOutputTokens: number; callId: string; signal?: AbortSignal }
export interface ModelResult { parsed: unknown; usage: { inputTokens: number; outputTokens: number }; providerRequestId: string }
export interface ModelProvider { generate(request: ModelInput): Promise<ModelResult> }
export class ProviderError extends Error {
  readonly cost: 'UNKNOWN' | 'KNOWN';
  readonly code: 'PROVIDER_UNAVAILABLE' | 'PROVIDER_TIMEOUT' | 'PROVIDER_INVALID_RESULT';
  readonly usage: ModelResult['usage'] | null;
  readonly providerRequestId: string | null;
  constructor(code: ProviderError['code'], cost: 'UNKNOWN' | 'KNOWN' = 'UNKNOWN', usage: ModelResult['usage'] | null = null, providerRequestId: string | null = null) {
    super(code); this.name = 'ProviderError'; this.code = code; this.cost = cost; this.usage = usage; this.providerRequestId = providerRequestId;
  }
}

/** No default model/price/credentials. Integration remains disabled until the real gates pass. */
export function deepSeekProvider(config: {
  apiKey: string; model: string; modelVerified: boolean; priceVersion: string; enabled: boolean;
  fetch?: typeof fetch; now?: () => number;
}): ModelProvider {
  const now = config.now ?? Date.now;
  return { async generate(req) {
    if (!config.enabled || !config.apiKey || !config.modelVerified || !config.model || !config.priceVersion || req.deadline <= now() || !Number.isSafeInteger(req.maxOutputTokens) || req.maxOutputTokens < 1 || req.maxOutputTokens > 2000 || !Number.isFinite(req.deadline) || req.signal?.aborted) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'KNOWN');
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.signal?.addEventListener('abort', abort, { once: true });
    if (req.signal?.aborted) controller.abort();
    const timer = setTimeout(abort, Math.min(30_000, req.deadline - now()));
    try {
      // Fixed official origin. Raw provider bodies/errors are never logged or reflected to clients.
      // Fetch has no retry. Each internal call needs its own durable budget admission first.
      const response = await (config.fetch ?? fetch)('https://api.deepseek.com/chat/completions', {
        method: 'POST', signal: controller.signal, redirect:'error',
        headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: config.model, stream: false, thinking: { type: 'disabled' }, max_tokens: req.maxOutputTokens,
          response_format: { type: 'json_object' }, messages: [
            { role: 'system', content: `Return one JSON object conforming to this JSON schema. No tools or business actions. Schema: ${JSON.stringify(req.schema)}` },
            { role: 'user', content: req.input },
          ] }),
      });
      if (!response.ok) throw new ProviderError('PROVIDER_UNAVAILABLE');
      const raw:unknown=await response.json();
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ProviderError('PROVIDER_INVALID_RESULT');
      const body = raw as { id?: unknown; choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown; refusal?:unknown; tool_calls?:unknown } }>; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
      const input = body.usage?.prompt_tokens;
      const output = body.usage?.completion_tokens;
      const validUsage = Number.isSafeInteger(input) && Number.isSafeInteger(output) && Number(input) >= 0 && Number(output) >= 0;
      const usage = validUsage ? { inputTokens: Number(input), outputTokens: Number(output) } : null;
      const choice = body.choices?.[0];
      if (!usage || typeof body.id !== 'string' || !body.id || body.id.length>256 || choice?.finish_reason !== 'stop' || choice.message?.refusal != null || (Array.isArray(choice.message?.tool_calls)&&choice.message.tool_calls.length>0) || typeof choice.message?.content !== 'string' || choice.message.content.length > 64_000 || usage.outputTokens > req.maxOutputTokens) {
        throw new ProviderError('PROVIDER_INVALID_RESULT', usage ? 'KNOWN' : 'UNKNOWN', usage, typeof body.id === 'string' ? body.id : null);
      }
      if (controller.signal.aborted || now() >= req.deadline) throw new ProviderError('PROVIDER_TIMEOUT', 'KNOWN', usage, body.id);
      try { const parsed:unknown=JSON.parse(choice.message.content);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Expected JSON object');return { parsed, usage, providerRequestId: body.id }; }
      catch { throw new ProviderError('PROVIDER_INVALID_RESULT', 'KNOWN', usage, body.id); }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timer); req.signal?.removeEventListener('abort', abort);
    }
  } };
}

export function mockProvider(environment: string, generate: ModelProvider['generate']): ModelProvider {
  if (environment !== 'test' && environment !== 'development') throw new ProviderError('PROVIDER_UNAVAILABLE', 'KNOWN');
  return { generate };
}

/** Integer microCNY price per million tokens; ceil each component so fractions cannot underreserve. */
export function maximumCost(inputTokenUpperBound: number, maxOutputTokens: number, price: { inputMicroCnyPerMillion: bigint; outputMicroCnyPerMillion: bigint }): bigint {
  if (![inputTokenUpperBound, maxOutputTokens].every((n) => Number.isSafeInteger(n) && n >= 0) || price.inputMicroCnyPerMillion < 0n || price.outputMicroCnyPerMillion < 0n) throw new ProviderError('PROVIDER_UNAVAILABLE', 'KNOWN');
  return (BigInt(inputTokenUpperBound) * price.inputMicroCnyPerMillion + 999_999n) / 1_000_000n
    + (BigInt(maxOutputTokens) * price.outputMicroCnyPerMillion + 999_999n) / 1_000_000n;
}
