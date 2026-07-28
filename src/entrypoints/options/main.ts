import { AUTO_DETECT, LANGUAGES } from '@/core/languages';
import { createLogger } from '@/core/logger';
import { sendToBackground } from '@/core/messaging/client';
import type { PublicSettings, RenderMode, SettingsPatch } from '@/core/settings/schema';

const log = createLogger('options');

/**
 * Options page — settings only.
 *
 * No translation happens here, and the page never reads the stored API key
 * back: it can write a new one, and it is told whether one exists.
 */
const form = requireElement<HTMLFormElement>('#settings-form');
const status = requireElement<HTMLOutputElement>('#status');
const workerStatus = requireElement<HTMLParagraphElement>('#worker-status');
const apiKeyInput = requireElement<HTMLInputElement>('#apiKey');

void init();

async function init(): Promise<void> {
  populateLanguageSelects();
  const result = await sendToBackground('settings:get');
  if (!result.ok) {
    setStatus(`Could not load settings: ${result.error.message}`, 'error');
    return;
  }
  applySettings(result.data);
  await refreshWorkerStatus();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const patch: SettingsPatch = {
    provider: 'gemini',
    model: readString(data, 'model'),
    sourceLanguage: readString(data, 'sourceLanguage'),
    targetLanguage: readString(data, 'targetLanguage'),
    renderMode: readString(data, 'renderMode') as RenderMode,
  };

  // An empty field means "keep the existing key", not "delete it" — the input
  // is never pre-filled with the stored value.
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) patch.apiKey = apiKey;

  const result = await sendToBackground('settings:update', patch);
  if (!result.ok) {
    setStatus(`Save failed: ${result.error.message}`, 'error');
    return;
  }

  apiKeyInput.value = '';
  applySettings(result.data);
  setStatus('Saved.');
});

function populateLanguageSelects(): void {
  const source = requireElement<HTMLSelectElement>('#sourceLanguage');
  const target = requireElement<HTMLSelectElement>('#targetLanguage');

  source.append(new Option('Auto-detect', AUTO_DETECT));
  for (const { tag, label } of LANGUAGES) {
    source.append(new Option(label, tag));
    target.append(new Option(label, tag));
  }
}

function applySettings(settings: PublicSettings): void {
  requireElement<HTMLSelectElement>('#provider').value = settings.provider;
  requireElement<HTMLInputElement>('#model').value = settings.model;
  selectLanguage(requireElement<HTMLSelectElement>('#sourceLanguage'), settings.sourceLanguage);
  selectLanguage(requireElement<HTMLSelectElement>('#targetLanguage'), settings.targetLanguage);

  const mode = form.querySelector<HTMLInputElement>(
    `input[name="renderMode"][value="${settings.renderMode}"]`,
  );
  if (mode) mode.checked = true;

  apiKeyInput.placeholder = settings.hasApiKey
    ? 'A key is saved — type a new one to replace it'
    : 'Paste your key';
}

async function refreshWorkerStatus(): Promise<void> {
  const result = await sendToBackground('ping');
  workerStatus.textContent = result.ok
    ? `Background worker ready (v${result.data.version}).`
    : `Background worker unreachable: ${result.error.message}`;
}

function setStatus(message: string, tone: 'info' | 'error' = 'info'): void {
  status.textContent = message;
  status.dataset.tone = tone;
  if (tone === 'error') log.error(message);
}

/**
 * Selects a stored tag, adding an option on the fly when it is not in the
 * curated list — a hand-edited setting must never be silently replaced.
 */
function selectLanguage(select: HTMLSelectElement, tag: string): void {
  if (![...select.options].some((option) => option.value === tag)) {
    select.append(new Option(tag, tag));
  }
  select.value = tag;
}

function readString(data: FormData, field: string): string {
  const value = data.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}
