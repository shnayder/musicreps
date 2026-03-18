// Dev panel: minimal debug UI for effort stats.
// Shown as a full-screen overlay, accessed via "Dev" link on home screen.

import { MODE_NAMES } from './music-data.ts';
import {
  computeAllModeEfforts,
  computeGlobalEffort,
  type ModeEffort,
} from './effort.ts';

export function createDevPanel(): { open: () => void; close: () => void } {
  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';

  const modal = document.createElement('div');
  modal.className = 'settings-modal dev-panel';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Dev');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close(): void {
    overlay.classList.remove('open');
  }

  function renderContent(): void {
    const modeEfforts = computeAllModeEfforts();
    const global = computeGlobalEffort();

    const rows = modeEfforts.map((m: ModeEffort) => {
      const name = MODE_NAMES[m.id] || m.id;
      return `<tr>
        <td>${name}</td>
        <td style="text-align:right">${m.totalReps}</td>
        <td style="text-align:right">${m.itemsStarted}/${m.totalItems}</td>
      </tr>`;
    }).join('');

    const dailyEntries = Object.entries(global.dailyReps)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14);

    const dailyRows = dailyEntries.map(([date, count]) =>
      `<tr><td>${date}</td><td style="text-align:right">${count}</td></tr>`
    ).join('');

    modal.innerHTML = `
      <div class="settings-header">
        <span class="settings-title">Dev</span>
        <button class="settings-close-btn" aria-label="Close">\u00D7</button>
      </div>
      <div class="settings-body" style="overflow-y:auto; max-height:80vh">
        <h3 style="margin:0 0 8px">Global</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px">
          <tr><td>Total reps</td><td style="text-align:right">${global.totalReps}</td></tr>
          <tr><td>Days active</td><td style="text-align:right">${global.daysActive}</td></tr>
        </table>

        <h3 style="margin:0 0 8px">Per Mode</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border, #333)">
              <th style="text-align:left">Mode</th>
              <th style="text-align:right">Reps</th>
              <th style="text-align:right">Items</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        ${
      dailyEntries.length > 0
        ? `
        <h3 style="margin:0 0 8px">Recent Days</h3>
        <table style="width:100%; border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border, #333)">
              <th style="text-align:left">Date</th>
              <th style="text-align:right">Reps</th>
            </tr>
          </thead>
          <tbody>${dailyRows}</tbody>
        </table>`
        : ''
    }
      </div>
    `;

    modal.querySelector('.settings-close-btn')!
      .addEventListener('click', close);
  }

  function open(): void {
    renderContent();
    overlay.classList.add('open');
  }

  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  return { open, close };
}
