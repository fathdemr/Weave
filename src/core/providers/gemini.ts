import { ErrorCode, WeaveError } from '../errors';
import { ProviderId } from '../settings/schema';
import type {
  ProviderConfig,
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
  supportedModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
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
};

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

  if (response.status === 429) {
    return new WeaveError(ErrorCode.RATE_LIMITED, 'Gemini is rate limiting requests', {
      retryable: true,
    });
  }
  if (response.status === 401 || response.status === 403) {
    return new WeaveError(
      ErrorCode.PROVIDER_ERROR,
      'Gemini rejected the API key — check it in the extension options',
    );
  }
  return new WeaveError(
    ErrorCode.PROVIDER_ERROR,
    `Gemini request failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`,
    { retryable: response.status >= 500 },
  );
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
