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

export function getSpeedHeatmapColor(ms) {
  if (ms === null) return '#ddd';
  if (ms < 1500) return 'hsl(120, 60%, 65%)';
  if (ms < 3000) return 'hsl(80, 60%, 65%)';
  if (ms < 4500) return 'hsl(50, 60%, 65%)';
  if (ms < 6000) return 'hsl(30, 60%, 65%)';
  return 'hsl(0, 60%, 65%)';
}

export function getStatsCellColor(selector, itemId, statsMode) {
  if (statsMode === 'retention') {
    return getAutomaticityColor(selector.getAutomaticity(itemId));
  }
  const stats = selector.getStats(itemId);
  return getSpeedHeatmapColor(stats ? stats.ewma : null);
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
 */
export function renderStatsTable(selector, rows, fwdHeader, revHeader, statsMode, containerEl) {
  if (!rows || rows.length === 0) { containerEl.innerHTML = ''; return; }
  let html = '<table class="stats-table"><thead><tr>';
  html += '<th>' + rows[0]._colHeader + '</th><th>#</th>';
  html += '<th>' + fwdHeader + '</th><th>' + revHeader + '</th>';
  html += '</tr></thead><tbody>';

  for (const row of rows) {
    const fwdColor = getStatsCellColor(selector, row.fwdItemId, statsMode);
    const revColor = getStatsCellColor(selector, row.revItemId, statsMode);
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
 * @param {Function} getItemId   - (noteName, colIndex) => itemId string
 * @param {string}   statsMode   - 'retention' | 'speed'
 * @param {Element}  containerEl
 * @param {Array}    [notes]     - optional notes array (defaults to global NOTES)
 */
export function renderStatsGrid(selector, colLabels, getItemId, statsMode, containerEl, notes) {
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
      const color = getStatsCellColor(selector, itemId, statsMode);
      html += '<td class="stats-cell" style="background:' + color + '"></td>';
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  containerEl.innerHTML = html;
}

/**
 * Build a shared legend HTML string.
 */
export function buildStatsLegend(statsMode) {
  if (statsMode === 'retention') {
    return '<div class="heatmap-legend active">'
      + '<div class="legend-item"><div class="legend-swatch" style="background:#ddd"></div>No data</div>'
      + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(120,60%,65%)"></div>Automatic</div>'
      + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(50,60%,65%)"></div>Getting there</div>'
      + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(0,60%,65%)"></div>Needs work</div>'
      + '</div>';
  }
  return '<div class="heatmap-legend active">'
    + '<div class="legend-item"><div class="legend-swatch" style="background:#ddd"></div>No data</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(120,60%,65%)"></div>&lt; 1.5s</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(80,60%,65%)"></div>1.5\u20133s</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(50,60%,65%)"></div>3\u20134.5s</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(30,60%,65%)"></div>4.5\u20136s</div>'
    + '<div class="legend-item"><div class="legend-swatch" style="background:hsl(0,60%,65%)"></div>&gt; 6s</div>'
    + '</div>';
}
