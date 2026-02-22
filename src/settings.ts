// Global settings modal: notation toggle (A B C / Do Re Mi).
// Accessed via gear icon in top bar. Hidden during active quiz.

import { getUseSolfege, setUseSolfege } from './music-data.ts';

export function createSettingsModal(
  options: { onNotationChange?: () => void },
): {
  open: () => void;
  close: () => void;
} {
  const onNotationChange: () => void = options.onNotationChange ||
    function (): void {};

  // --- Build modal DOM ---

  const overlay: HTMLDivElement = document.createElement('div');
  overlay.className = 'settings-overlay';

  const modal: HTMLDivElement = document.createElement('div');
  modal.className = 'settings-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Settings');
  modal.innerHTML = '<div class="settings-header">' +
    '<span class="settings-title">Settings</span>' +
    '<button class="settings-close-btn" aria-label="Close">\u00D7</button>' +
    '</div>' +
    '<div class="settings-body">' +
    '<div class="settings-field">' +
    '<div class="settings-label">Note names</div>' +
    '<div class="settings-toggle-group">' +
    '<button class="settings-toggle-btn" data-notation="letter">A B C</button>' +
    '<button class="settings-toggle-btn" data-notation="solfege">Do Re Mi</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // --- Refs ---

  const closeBtn: Element = modal.querySelector('.settings-close-btn')!;
  const toggleBtns: NodeListOf<HTMLElement> = modal.querySelectorAll<
    HTMLElement
  >('.settings-toggle-btn');

  // --- State ---

  let previousFocus: HTMLElement | null = null;

  function updateToggleState(): void {
    const current: string = getUseSolfege() ? 'solfege' : 'letter';
    toggleBtns.forEach(function (btn: HTMLElement): void {
      btn.classList.toggle('active', btn.dataset.notation === current);
      btn.setAttribute(
        'aria-pressed',
        String(btn.dataset.notation === current),
      );
    });
  }

  // --- Focus trap ---

  function trapFocus(e: KeyboardEvent): void {
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

  // --- Open / Close ---

  function open(): void {
    updateToggleState();
    overlay.classList.add('open');
    previousFocus = document.activeElement as HTMLElement | null;
    (closeBtn as HTMLElement).focus();
    modal.addEventListener('keydown', trapFocus);
  }

  function close(): void {
    modal.removeEventListener('keydown', trapFocus);
    overlay.classList.remove('open');
    if (previousFocus) {
      previousFocus.focus();
      previousFocus = null;
    }
  }

  // --- Event handlers ---

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e: MouseEvent): void {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function (e: KeyboardEvent): void {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      close();
    }
  });

  toggleBtns.forEach(function (btn: HTMLElement): void {
    btn.addEventListener('click', function (): void {
      const wantSolfege: boolean = btn.dataset.notation === 'solfege';
      if (wantSolfege !== getUseSolfege()) {
        setUseSolfege(wantSolfege);
        updateToggleState();
        onNotationChange();
      }
    });
  });

  return { open: open, close: close };
}
