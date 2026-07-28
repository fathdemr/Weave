import { ErrorCode, WeaveError } from '../errors';
import type { ProviderId } from '../settings/schema';
import type { TranslationProvider } from './types';

/**
 * Registry of available provider adapters.
 *
 * Phase 0 ships the registry without adapters; Gemini lands in Phase 1. Keeping
 * the lookup here means the options page can list providers without importing
 * any adapter implementation.
 */
const providers = new Map<ProviderId, TranslationProvider>();

export function registerProvider(provider: TranslationProvider): void {
  providers.set(provider.id, provider);
}

export function listProviders(): TranslationProvider[] {
  return [...providers.values()];
}

export function getProvider(id: ProviderId): TranslationProvider {
  const provider = providers.get(id);
  if (!provider) {
    throw new WeaveError(ErrorCode.NOT_IMPLEMENTED, `Provider "${id}" is not available yet`);
  }
  return provider;
}
