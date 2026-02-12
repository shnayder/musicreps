// Stats display helpers: shared color functions, table rendering for lookup
// modes, and heatmap grid rendering for math modes.
//
// ES module — main.ts strips "export" keywords for browser inlining.
// Depends on globals (browser): NOTES, INTERVALS

export function getAutomaticityColor(auto) {
  if (auto === null) return '#ddd';
  if (auto > 0.8) return 'hsl(120, 60%, 65%)';
  if (auto > 0.6) return 'hsl(80, 60%, 65%)';
  if (auto > 0.4) return 'hsl(50, 60%, 65%)';
  if (auto > 0.2) return 'hsl(30, 60%, 65%)';
  return 'hsl(0, 60%, 65%)';
}

export function getSpeedHeatmapColor(ms, baseline) {
  if (ms === null) return '#ddd';
  const b = baseline || 1000;
  if (ms < b * 1.5) return 'hsl(120, 60%, 65%)';
  if (ms < b * 3.0) return 'hsl(80, 60%, 65%)';
  if (ms < b * 4.5) return 'hsl(50, 60%, 65%)';
  if (ms < b * 6.0) return 'hsl(30, 60%, 65%)';
  return 'hsl(0, 60%, 65%)';
}

export function getStatsCellColor(selector, itemId, statsMode, baseline) {
  if (statsMode === 'retention') {
    return getAutomaticityColor(selector.getAutomaticity(itemId));
  }
  const stats = selector.getStats(itemId);
  return getSpeedHeatmapColor(stats ? stats.ewma : null, baseline);
}

/**
 * Average stats across multiple item IDs (e.g. both + and − directions).
 * Only items that have data contribute to the average.
 * Returns grey when no items have data.
 */
export function getStatsCellColorMerged(selector, itemIds, statsMode, baseline) {
  if (typeof itemIds === 'string') return getStatsCellColor(selector, itemIds, statsMode, baseline);
  if (statsMode === 'retention') {
    let sum = 0, count = 0;
    for (const id of itemIds) {
      const a = selector.getAutomaticity(id);
      if (a !== null) { sum += a; count++; }
    }
    return getAutomaticityColor(count > 0 ? sum / count : null);
  }
  let sum = 0, count = 0;
  for (const id of itemIds) {
    const stats = selector.getStats(id);
    if (stats && stats.ewma != null) { sum += stats.ewma; count++; }
  }
  return getSpeedHeatmapColor(count > 0 ? sum / count : null, baseline);
}

/**
 * Render a reference table for bidirectional lookup modes.
 *
 * @param {object}   selector  - adaptive selector instance
 * @param {Array}    rows      - [{ label, sublabel, _colHeader, fwdItemId, revItemId }]
 * @param {string}   fwdHeader - column header for forward direction (e.g. "N\u2192#")
 * @param {string}   revHeader - column header for reverse direction (e.g. "#\u2192N")
 * @param {string}   statsMode - 'retention' | 'speed'
 * @param {Element}  containerEl
 * @param {number}   [baseline] - motor baseline in ms (optional)
 */
export function renderStatsTable(selector, rows, fwdHeader, revHeader, statsMode, containerEl, baseline) {
  if (!rows || rows.length === 0) { containerEl.innerHTML = ''; return; }
  let html = '<table class="stats-table"><thead><tr>';
  html += '<th>' + rows[0]._colHeader + '</th><th>#</th>';
  html += '<th>' + fwdHeader + '</th><th>' + revHeader + '</th>';
  html += '</tr></thead><tbody>';

  for (const row of rows) {
    const fwdColor = getStatsCellColor(selector, row.fwdItemId, statsMode, baseline);
    const revColor = getStatsCellColor(selector, row.revItemId, statsMode, baseline);
    html += '<tr>';
    html += '<td>' + row.label + '</td>';
    html += '<td>' + row.sublabel + '</td>';
    html += '<td class="stats-cell" style="background:' + fwdColor + '"></td>';
    html += '<td class="stats-cell" style="background:' + revColor + '"></td>';
    html += '</tr>';
  }

  html += '</tbody></table>';
  containerEl.innerHTML = html;
}

/**
 * Render a heatmap grid for math modes (12 notes x 11 offsets/intervals).
 *
 * @param {object}   selector    - adaptive selector instance
 * @param {Array}    colLabels   - column header labels (e.g. ["1","2",...] or ["m2","M2",...])
 * @param {Function} getItemId   - (noteName, colIndex) => itemId string or array of strings
 * @param {string}   statsMode   - 'retention' | 'speed'
 * @param {Element}  containerEl
 * @param {Array}    [notes]     - optional notes array (defaults to global NOTES)
 * @param {number}   [baseline]  - motor baseline in ms (optional)
 */
export function renderStatsGrid(selector, colLabels, getItemId, statsMode, containerEl, notes, baseline) {
  const noteList = notes || NOTES;
  let html = '<table class="stats-grid"><thead><tr><th></th>';
  for (const col of colLabels) {
    html += '<th>' + col + '</th>';
  }
  html += '</tr></thead><tbody>';

  for (const note of noteList) {
    html += '<tr><td class="stats-grid-row-label">' + (note.displayName || note.name) + '</td>';
    for (let i = 0; i < colLabels.length; i++) {
      const itemId = getItemId(note.name, i);
      const color = Array.isArray(itemId)
        ? getStatsCellColorMerged(selector, itemId, statsMode, baseline)
        : getStatsCellColor(selector, itemId, statsMode, baseline);
      html += '<td class="stats-cell" style="background:' + color + '"></td>';
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  containerEl.innerHTML = html;
}

/**
 * Create shared stats toggle controls for a mode.
 * Manages Recall/Speed toggle state, button wiring, show/hide of stats container.
 *
 * @param {Element}  container - mode's root container element
 * @param {Function} renderFn  - (mode, statsContainerEl) => void; populates stats content
 * @returns {{ show(mode), hide(), mode }}
 */
export function createStatsControls(container, renderFn) {
  let statsMode = null;
  const statsContainer = container.querySelector('.stats-container');

  function show(mode) {
    statsMode = mode;
    statsContainer.innerHTML = '';
    renderFn(mode, statsContainer);
    statsContainer.style.display = '';
    container.querySelectorAll('.stats-toggle-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }

  function hide() {
    statsMode = null;
    statsContainer.style.display = 'none';
    statsContainer.innerHTML = '';
  }

  // Wire toggle buttons
  container.querySelectorAll('.stats-toggle-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { show(btn.dataset.mode); });
  });

  return {
    show: show,
    hide: hide,
    get mode() { return statsMode; },
  };
}

function formatThreshold(ms) {
  const s = ms / 1000;
  return s % 1 === 0 ? s + 's' : s.toFixed(1) + 's';
}

/**
 * Build a shared legend HTML string.
 */
export function buildStatsLegend(statsMode, baseline) {
  if (statsMode === 'retention') {
    return '<div class="heatmap-legend active">'
      + '<div class="legend-item"><div class="legend-swatch" style="background:#ddd"></div>No data</div>'
      + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(120,60%,65%)"></div>Automatic (&gt;80%)</div>'
      + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(80,60%,65%)"></div>Solid (&gt;60%)</div>'
      + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(50,60%,65%)"></div>Getting there (&gt;40%)</div>'
      + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(30,60%,65%)"></div>Fading (&gt;20%)</div>'
      + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(0,60%,65%)"></div>Needs work (&lt;20%)</div>'
      + '</div>';
  }
  const b = baseline || 1000;
  const t1 = formatThreshold(b * 1.5);
  const t2 = formatThreshold(b * 3);
  const t3 = formatThreshold(b * 4.5);
  const t4 = formatThreshold(b * 6);
  return '<div class="heatmap-legend active">'
    + '<div class="legend-item"><div class="legend-swatch" style="background:#ddd"></div>No data</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(120,60%,65%)"></div>&lt; ' + t1 + '</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(80,60%,65%)"></div>' + t1 + '\u2013' + t2 + '</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(50,60%,65%)"></div>' + t2 + '\u2013' + t3 + '</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(30,60%,65%)"></div>' + t3 + '\u2013' + t4 + '</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(0,60%,65%)"></div>&ge; ' + t4 + '</div>'
    + '</div>';
}
