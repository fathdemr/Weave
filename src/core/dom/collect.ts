/**
 * Finds the block-level elements worth translating on a page.
 *
 * Phase 1 works at block granularity: each collected element's visible text is
 * one segment. Chunking with neighbouring context refines this in Phase 2.
 */

/** Elements whose visible text forms a natural translation unit. */
const BLOCK_SELECTOR = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
  'figcaption',
  'dt',
  'dd',
  'th',
  'td',
  'summary',
].join(', ');

/** Subtrees that must never be translated. */
const EXCLUDED_ANCESTOR = 'code, pre, script, style, noscript, textarea, [contenteditable="true"]';

/** Marks an element as already handled so a second run skips it. */
export const TRANSLATED_ATTR = 'data-weave-translated';

export interface CollectedBlock {
  element: HTMLElement;
  text: string;
}

export function collectBlocks(root: ParentNode, selection?: Selection | null): CollectedBlock[] {
  const range = selectionRange(selection);
  const blocks: CollectedBlock[] = [];

  for (const element of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    if (element.closest(`[${TRANSLATED_ATTR}]`)) continue;
    if (element.closest(EXCLUDED_ANCESTOR)) continue;
    // Nested candidates (an <li> wrapping a <p>) are handled by their
    // innermost block so text is never translated twice.
    if (element.querySelector(BLOCK_SELECTOR)) continue;
    if (!isVisible(element)) continue;
    if (range && !range.intersectsNode(element)) continue;

    const text = element.innerText.trim();
    if (!isTranslatable(text)) continue;

    blocks.push({ element, text });
  }

  return blocks;
}

function selectionRange(selection: Selection | null | undefined): Range | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  return selection.getRangeAt(0);
}

function isVisible(element: HTMLElement): boolean {
  // Cheap check that skips display:none subtrees without forcing a style
  // resolution per element; position:fixed blocks are rare enough to accept.
  return element.offsetParent !== null || element.getClientRects().length > 0;
}

function isTranslatable(text: string): boolean {
  // At least one letter in any script — skips separators, prices, timestamps.
  return text.length >= 2 && /\p{L}/u.test(text);
}
