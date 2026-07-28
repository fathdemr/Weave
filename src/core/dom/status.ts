/**
 * Minimal, non-blocking status indicator for the content script.
 *
 * A single fixed pill in the corner of the viewport — never a modal, never
 * over the text being read. Errors stay until the next run; progress and
 * success dissolve on their own.
 */

const HOST_ID = 'weave-status';

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export type StatusTone = 'progress' | 'success' | 'error';

export function showStatus(message: string, tone: StatusTone): void {
  const pill = ensurePill();
  pill.textContent = message;
  pill.style.background = tone === 'error' ? '#b91c1c' : '#1f2937';
  pill.style.opacity = '1';

  clearTimeout(hideTimer);
  if (tone !== 'progress') {
    const visibleMs = tone === 'error' ? 6000 : 2500;
    hideTimer = setTimeout(hideStatus, visibleMs);
  }
}

export function hideStatus(): void {
  const pill = document.getElementById(HOST_ID);
  if (pill) pill.style.opacity = '0';
}

function ensurePill(): HTMLElement {
  let pill = document.getElementById(HOST_ID);
  if (pill) return pill;

  pill = document.createElement('div');
  pill.id = HOST_ID;
  pill.setAttribute('role', 'status');
  pill.style.cssText = [
    'position: fixed',
    'right: 16px',
    'bottom: 16px',
    'z-index: 2147483647',
    'max-width: 40ch',
    'padding: 8px 14px',
    'border-radius: 999px',
    'color: #fff',
    'font: 13px/1.4 system-ui, sans-serif',
    'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25)',
    'opacity: 0',
    'transition: opacity 0.2s ease',
    'pointer-events: none',
  ].join('; ');

  document.documentElement.append(pill);
  return pill;
}
