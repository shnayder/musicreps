// Global settings modal: notation toggle (A B C / Do Re Mi).
// Accessed via gear icon in top bar. Hidden during active quiz.

import { getUseSolfege, setUseSolfege } from './music-data.js';

export function createSettingsModal(options) {
  var onNotationChange = options.onNotationChange || function() {};

  // --- Build modal DOM ---

  var overlay = document.createElement('div');
  overlay.className = 'settings-overlay';

  var modal = document.createElement('div');
  modal.className = 'settings-modal';
  modal.innerHTML =
    '<div class="settings-header">' +
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

  var closeBtn = modal.querySelector('.settings-close-btn');
  var toggleBtns = modal.querySelectorAll('.settings-toggle-btn');

  // --- State ---

  function updateToggleState() {
    var current = getUseSolfege() ? 'solfege' : 'letter';
    toggleBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.notation === current);
    });
  }

  // --- Open / Close ---

  function open() {
    updateToggleState();
    overlay.classList.add('open');
  }

  function close() {
    overlay.classList.remove('open');
  }

  // --- Event handlers ---

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      close();
    }
  });

  toggleBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var wantSolfege = btn.dataset.notation === 'solfege';
      if (wantSolfege !== getUseSolfege()) {
        setUseSolfege(wantSolfege);
        updateToggleState();
        onNotationChange();
      }
    });
  });

  return { open: open, close: close };
}
