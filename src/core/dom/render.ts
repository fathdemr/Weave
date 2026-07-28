import { RenderMode } from '../settings/schema';
import { TRANSLATED_ATTR } from './collect';

/**
 * Paints a translation onto a block element.
 *
 * Phase 1 renders plain text. Replace mode flattens inline markup (links,
 * emphasis) inside the block — a known limitation until Phase 2 introduces
 * node-level rendering. Originals are kept so a restore feature can be added
 * without re-fetching anything.
 */

/** Original DOM of replaced blocks, kept for a future "show original" toggle. */
const originals = new WeakMap<HTMLElement, DocumentFragment>();

export function renderTranslation(
  element: HTMLElement,
  translation: string,
  mode: RenderMode,
  targetLanguage: string,
): void {
  if (mode === RenderMode.REPLACE) {
    renderReplace(element, translation, targetLanguage);
  } else {
    renderDualView(element, translation, targetLanguage);
  }
  element.setAttribute(TRANSLATED_ATTR, mode);
}

function renderReplace(element: HTMLElement, translation: string, targetLanguage: string): void {
  const original = document.createDocumentFragment();
  original.append(...element.childNodes);
  originals.set(element, original);

  element.textContent = translation;
  element.setAttribute('lang', targetLanguage);
}

function renderDualView(element: HTMLElement, translation: string, targetLanguage: string): void {
  const block = document.createElement('span');
  block.setAttribute('lang', targetLanguage);
  block.setAttribute('data-weave-dual', '');
  block.textContent = translation;
  // Inline styles keep the extension from injecting a stylesheet into every
  // page; font metrics are inherited so the block blends into the site.
  block.style.cssText = [
    'display: block',
    'margin-top: 0.35em',
    'padding-left: 0.6em',
    'border-left: 2px solid color-mix(in srgb, currentColor 35%, transparent)',
    'opacity: 0.85',
  ].join('; ');

  element.append(block);
}

/** Restores a replaced block to its original content. Currently unused by UI. */
export function restoreOriginal(element: HTMLElement): boolean {
  const original = originals.get(element);
  if (!original) return false;

  element.replaceChildren(original);
  element.removeAttribute(TRANSLATED_ATTR);
  element.removeAttribute('lang');
  originals.delete(element);
  return true;
}
