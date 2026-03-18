// Dev panel: minimal debug UI for effort stats.
// Shown as a full-screen overlay, accessed via "Dev" link on home screen.
// Uses DOM APIs (no innerHTML) to avoid XSS from localStorage-derived values.

import { MODE_NAMES } from './music-data.ts';
import { computeAllModeEfforts, computeGlobalEffort } from './effort.ts';

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function el(
  tag: string,
  attrs?: Record<string, string>,
  ...children: (string | Node)[]
): HTMLElement {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  }
  for (const c of children) {
    e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

function textCell(text: string, style?: string): HTMLElement {
  const td = el('td', style ? { style } : undefined, text);
  return td;
}

function headerCell(text: string, style?: string): HTMLElement {
  const th = el('th', style ? { style } : undefined, text);
  return th;
}

// ---------------------------------------------------------------------------
// Dev panel factory
// ---------------------------------------------------------------------------

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

    modal.textContent = '';

    // Header
    const header = el('div', { class: 'settings-header' });
    header.append(el('span', { class: 'settings-title' }, 'Dev'));
    const closeBtn = el(
      'button',
      { class: 'settings-close-btn', 'aria-label': 'Close' },
      '\u00D7',
    );
    closeBtn.addEventListener('click', close);
    header.append(closeBtn);
    modal.append(header);

    // Body
    const body = el('div', {
      class: 'settings-body',
      style: 'overflow-y:auto; max-height:80vh',
    });

    // Global stats
    body.append(el('h3', { style: 'margin:0 0 8px' }, 'Global'));
    const globalTable = el('table', {
      style: 'width:100%; border-collapse:collapse; margin-bottom:16px',
    });
    const r1 = el('tr');
    r1.append(
      textCell('Total reps'),
      textCell(String(global.totalReps), 'text-align:right'),
    );
    const r2 = el('tr');
    r2.append(
      textCell('Days active'),
      textCell(String(global.daysActive), 'text-align:right'),
    );
    globalTable.append(r1, r2);
    body.append(globalTable);

    // Per-mode table
    body.append(el('h3', { style: 'margin:0 0 8px' }, 'Per Mode'));
    const modeTable = el('table', {
      style: 'width:100%; border-collapse:collapse; margin-bottom:16px',
    });
    const thead = el('thead');
    const headRow = el('tr', {
      style: 'border-bottom:1px solid var(--color-border, #333)',
    });
    headRow.append(
      headerCell('Mode', 'text-align:left'),
      headerCell('Reps', 'text-align:right'),
      headerCell('Items', 'text-align:right'),
    );
    thead.append(headRow);
    modeTable.append(thead);

    const tbody = el('tbody');
    for (const m of modeEfforts) {
      const name = MODE_NAMES[m.id] || m.id;
      const row = el('tr');
      row.append(
        textCell(name),
        textCell(String(m.totalReps), 'text-align:right'),
        textCell(`${m.itemsStarted}/${m.totalItems}`, 'text-align:right'),
      );
      tbody.append(row);
    }
    modeTable.append(tbody);
    body.append(modeTable);

    // Daily reps table
    const dailyEntries = Object.entries(global.dailyReps)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14);

    if (dailyEntries.length > 0) {
      body.append(el('h3', { style: 'margin:0 0 8px' }, 'Recent Days'));
      const dailyTable = el('table', {
        style: 'width:100%; border-collapse:collapse',
      });
      const dHead = el('thead');
      const dHeadRow = el('tr', {
        style: 'border-bottom:1px solid var(--color-border, #333)',
      });
      dHeadRow.append(
        headerCell('Date', 'text-align:left'),
        headerCell('Reps', 'text-align:right'),
      );
      dHead.append(dHeadRow);
      dailyTable.append(dHead);

      const dBody = el('tbody');
      for (const [date, count] of dailyEntries) {
        const row = el('tr');
        row.append(
          textCell(date),
          textCell(String(count), 'text-align:right'),
        );
        dBody.append(row);
      }
      dailyTable.append(dBody);
      body.append(dailyTable);
    }

    modal.append(body);
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
