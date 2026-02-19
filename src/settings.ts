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

  function updateToggleState(): void {
    const current: string = getUseSolfege() ? 'solfege' : 'letter';
    toggleBtns.forEach(function (btn: HTMLElement): void {
      btn.classList.toggle('active', btn.dataset.notation === current);
    });
  }

  // --- Open / Close ---

  function open(): void {
    updateToggleState();
    overlay.classList.add('open');
  }

  function close(): void {
    overlay.classList.remove('open');
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
