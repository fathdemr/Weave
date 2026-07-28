import { ErrorCode, WeaveError } from '../errors';
import { ProviderId } from '../settings/schema';
import type {
  ProviderConfig,
  ProviderModel,
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Google Gemini adapter.
 *
 * Uses `generateContent` with a JSON response schema so the model is forced to
 * return exactly one translated string per input segment — no fragile
 * delimiter parsing.
 */
export const geminiProvider: TranslationProvider = {
  id: ProviderId.GEMINI,
  label: 'Google Gemini',
  // Fallback only — Google retires models regularly, so the options page
  // asks the API for the live list as soon as a key is available.
  supportedModels: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  apiKeyUrl: 'https://aistudio.google.com/apikey',

  async translate(request: TranslationRequest, config: ProviderConfig): Promise<TranslationResult> {
    const body = {
      contents: [{ role: 'user', parts: [{ text: buildPrompt(request) }] }],
      generationConfig: {
        // Translation should be faithful, not creative.
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
      },
    };

    const response = await requestGemini(config, body, request.signal);
    const segments = parseSegments(response, request.segments.length);
    const usage = readUsage(response);

    return usage ? { segments, usage } : { segments };
  },

  async listModels(config): Promise<ProviderModel[]> {
    const url = `${config.baseUrl ?? API_BASE}/models?pageSize=200`;

    let response: Response;
    try {
      response = await fetch(url, { headers: { 'x-goog-api-key': config.apiKey } });
    } catch (cause) {
      throw new WeaveError(ErrorCode.NETWORK_ERROR, 'Could not reach the Gemini API', {
        retryable: true,
        cause,
      });
    }

    if (!response.ok) throw await toProviderError(response);

    const data = (await response.json()) as GeminiModelList;
    return (data.models ?? [])
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => ({
        // The API returns "models/gemini-x"; the generateContent path adds
        // that prefix itself, so store the bare id.
        id: model.name.replace(/^models\//, ''),
        label: model.displayName || model.name.replace(/^models\//, ''),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  },
};

interface GeminiModelList {
  models?: Array<{
    name: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
}

function buildPrompt(request: TranslationRequest): string {
  const { context, segments } = request;
  const source =
    context.sourceLanguage === 'auto'
      ? 'Detect the source language.'
      : `The source language is "${context.sourceLanguage}".`;

  return [
    'You are a professional translator embedded in a browser extension.',
    `${source} Translate every segment below into the language with BCP 47 tag "${context.targetLanguage}".`,
    '',
    'Rules:',
    '- Stay faithful to the meaning, tone, and register of the original.',
    '- Keep terminology consistent across all segments; they come from the same page.',
    '- Do not translate code, URLs, email addresses, product names, or proper nouns.',
    '- Preserve leading/trailing whitespace, numbers, and punctuation style where sensible.',
    '- Never add explanations or notes; output translations only.',
    '',
    `Return a JSON array of exactly ${segments.length} strings, one translation per segment, in the same order.`,
    '',
    'Segments (JSON):',
    JSON.stringify(segments),
  ].join('\n');
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

async function requestGemini(
  config: ProviderConfig,
  body: unknown,
  signal: AbortSignal | undefined,
): Promise<GeminiResponse> {
  const url = `${config.baseUrl ?? API_BASE}/models/${config.model}:generateContent`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Key travels in a header, not in the URL, so it cannot end up in
        // server access logs or error messages that include the URL.
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    throw new WeaveError(ErrorCode.NETWORK_ERROR, 'Could not reach the Gemini API', {
      retryable: true,
      cause,
    });
  }

  if (!response.ok) {
    throw await toProviderError(response);
  }

  return (await response.json()) as GeminiResponse;
}

async function toProviderError(response: Response): Promise<WeaveError> {
  let detail = '';
  try {
    const data = (await response.json()) as GeminiResponse;
    detail = data.error?.message ?? '';
  } catch {
    // A non-JSON error body; the status code is all we have.
  }

  // Providers state how long to wait when they know; honouring it beats
  // guessing with backoff.
  const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));

  if (response.status === 429) {
    return new WeaveError(ErrorCode.RATE_LIMITED, 'Gemini is rate limiting requests', {
      retryable: true,
      retryAfterMs,
    });
  }
  if (response.status === 401 || response.status === 403) {
    return new WeaveError(
      ErrorCode.PROVIDER_ERROR,
      'Gemini rejected the API key — check it in the extension options',
    );
  }
  if (response.status === 503 || response.status === 502 || response.status === 504) {
    return new WeaveError(ErrorCode.PROVIDER_OVERLOADED, 'Gemini is busy right now', {
      retryable: true,
      retryAfterMs,
    });
  }
  return new WeaveError(
    ErrorCode.PROVIDER_ERROR,
    `Gemini request failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`,
    { retryable: response.status >= 500, retryAfterMs },
  );
}

/** Reads a Retry-After header, which may be seconds or an HTTP date. */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - Date.now());
}

function parseSegments(response: GeminiResponse, expectedCount: number): string[] {
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new WeaveError(ErrorCode.PROVIDER_ERROR, 'Gemini returned an empty response', {
      retryable: true,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new WeaveError(ErrorCode.PROVIDER_ERROR, 'Gemini returned malformed JSON', {
      retryable: true,
      cause,
    });
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== expectedCount ||
    parsed.some((item) => typeof item !== 'string')
  ) {
    throw new WeaveError(
      ErrorCode.PROVIDER_ERROR,
      `Gemini returned ${Array.isArray(parsed) ? parsed.length : 'no'} segments, expected ${expectedCount}`,
      { retryable: true },
    );
  }

  return parsed as string[];
}

function readUsage(response: GeminiResponse): TranslationResult['usage'] {
  const meta = response.usageMetadata;
  if (meta?.promptTokenCount === undefined || meta?.candidatesTokenCount === undefined) {
    return undefined;
  }
  return { inputTokens: meta.promptTokenCount, outputTokens: meta.candidatesTokenCount };
}
