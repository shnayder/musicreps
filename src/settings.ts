// Global settings modal: notation toggle (A B C / Do Re Mi).
// Accessed via gear icon in top bar. Hidden during active quiz.

import { getUseSolfege, setUseSolfege } from './music-data.ts';

// ---------------------------------------------------------------------------
// DOM construction
// ---------------------------------------------------------------------------

function buildSettingsDOM(): {
  overlay: HTMLDivElement;
  modal: HTMLDivElement;
} {
  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';

  const modal = document.createElement('div');
  modal.className = 'settings-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Settings');
  modal.innerHTML = '<div class="settings-header">' +
    '<span class="settings-title">Settings</span>' +
    '<button tabindex="0" class="settings-close-btn" aria-label="Close">\u00D7</button>' +
    '</div>' +
    '<div class="settings-body">' +
    '<div class="settings-field">' +
    '<div class="settings-label">Note names</div>' +
    '<div class="settings-toggle-group">' +
    '<button tabindex="0" class="settings-toggle-btn" data-notation="letter">A B C</button>' +
    '<button tabindex="0" class="settings-toggle-btn" data-notation="solfege">Do Re Mi</button>' +
    '</div></div></div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  return { overlay, modal };
}

// ---------------------------------------------------------------------------
// Focus trap
// ---------------------------------------------------------------------------

function trapFocus(modal: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const focusable = modal.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSettingsModal(
  options: { onNotationChange?: () => void },
): { open: () => void; close: () => void } {
  const onNotationChange = options.onNotationChange || (() => {});
  const { overlay, modal } = buildSettingsDOM();
  const closeBtn = modal.querySelector('.settings-close-btn')!;
  const toggleBtns = modal.querySelectorAll<HTMLElement>(
    '.settings-toggle-btn',
  );
  let previousFocus: HTMLElement | null = null;

  function updateToggleState(): void {
    const current = getUseSolfege() ? 'solfege' : 'letter';
    toggleBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.notation === current);
      btn.setAttribute(
        'aria-pressed',
        String(btn.dataset.notation === current),
      );
    });
  }

  const boundTrapFocus = (e: KeyboardEvent) => trapFocus(modal, e);

  function open(): void {
    updateToggleState();
    overlay.classList.add('open');
    previousFocus = document.activeElement as HTMLElement | null;
    (closeBtn as HTMLElement).focus();
    modal.addEventListener('keydown', boundTrapFocus);
  }

  function close(): void {
    modal.removeEventListener('keydown', boundTrapFocus);
    overlay.classList.remove('open');
    if (previousFocus) {
      previousFocus.focus();
      previousFocus = null;
    }
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const wantSolfege = btn.dataset.notation === 'solfege';
      if (wantSolfege !== getUseSolfege()) {
        setUseSolfege(wantSolfege);
        updateToggleState();
        onNotationChange();
      }
    });
  });

  return { open, close };
}
