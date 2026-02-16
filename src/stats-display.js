// Stats display helpers: shared color functions, table rendering for lookup
// modes, and heatmap grid rendering for math modes.
//
// ES module — main.ts strips "export" keywords for browser inlining.
// Depends on globals (browser): NOTES, INTERVALS

// --- Heatmap color scale (read from CSS custom properties) ---

var _heatmapColors = null;

function cssVar(name) {
  try {
    var val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (val) return val;
  } catch (_) { /* Node.js / test environment — fall through to default */ }
  return '';
}

function heatmapColors() {
  if (!_heatmapColors) {
    _heatmapColors = {
      none:  cssVar('--heatmap-none')  || 'hsl(60, 5%, 93%)',
      level: [
        cssVar('--heatmap-1') || 'hsl(15, 55%, 68%)',
        cssVar('--heatmap-2') || 'hsl(35, 55%, 58%)',
        cssVar('--heatmap-3') || 'hsl(55, 45%, 50%)',
        cssVar('--heatmap-4') || 'hsl(72, 42%, 42%)',
        cssVar('--heatmap-5') || 'hsl(88, 52%, 33%)',
      ],
    };
  }
  return _heatmapColors;
}

/**
 * Returns true if white text should be used on this heatmap background.
 * Parses lightness from hsl() strings; dark backgrounds (L <= 50%) get white.
 */
export function heatmapNeedsLightText(color) {
  var m = color && color.match(/,\s*(\d+)%\s*\)/);
  return m ? parseInt(m[1], 10) <= 50 : false;
}

// Labels for the retention legend (index matches heatmapColors().level)
var RETENTION_LABELS = [
  'Needs work (&lt;20%)',
  'Fading (&gt;20%)',
  'Getting there (&gt;40%)',
  'Solid (&gt;60%)',
  'Automatic (&gt;80%)',
];

export function getAutomaticityColor(auto) {
  var c = heatmapColors();
  if (auto === null) return c.none;
  if (auto > 0.8) return c.level[4];
  if (auto > 0.6) return c.level[3];
  if (auto > 0.4) return c.level[2];
  if (auto > 0.2) return c.level[1];
  return c.level[0];
}

export function getSpeedHeatmapColor(ms, baseline) {
  var c = heatmapColors();
  if (ms === null) return c.none;
  var b = baseline || 1000;
  if (ms < b * 1.5) return c.level[4];
  if (ms < b * 3.0) return c.level[3];
  if (ms < b * 4.5) return c.level[2];
  if (ms < b * 6.0) return c.level[1];
  return c.level[0];
}

export function getStatsCellColor(selector, itemId, statsMode, baseline) {
  if (statsMode === 'retention') {
    return getAutomaticityColor(selector.getAutomaticity(itemId));
  }
  var stats = selector.getStats(itemId);
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
    var sum = 0, count = 0;
    for (var i = 0; i < itemIds.length; i++) {
      var a = selector.getAutomaticity(itemIds[i]);
      if (a !== null) { sum += a; count++; }
    }
    return getAutomaticityColor(count > 0 ? sum / count : null);
  }
  var sum2 = 0, count2 = 0;
  for (var j = 0; j < itemIds.length; j++) {
    var stats = selector.getStats(itemIds[j]);
    if (stats && stats.ewma != null) { sum2 += stats.ewma; count2++; }
  }
  return getSpeedHeatmapColor(count2 > 0 ? sum2 / count2 : null, baseline);
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
  var html = '<table class="stats-table"><thead><tr>';
  html += '<th>' + rows[0]._colHeader + '</th><th>#</th>';
  html += '<th>' + fwdHeader + '</th><th>' + revHeader + '</th>';
  html += '</tr></thead><tbody>';

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var fwdColor = getStatsCellColor(selector, row.fwdItemId, statsMode, baseline);
    var revColor = getStatsCellColor(selector, row.revItemId, statsMode, baseline);
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
  var noteList = notes || NOTES;
  var html = '<table class="stats-grid"><thead><tr><th></th>';
  for (var c = 0; c < colLabels.length; c++) {
    html += '<th>' + colLabels[c] + '</th>';
  }
  html += '</tr></thead><tbody>';

  for (var n = 0; n < noteList.length; n++) {
    var note = noteList[n];
    html += '<tr><td class="stats-grid-row-label">' + displayNote(note.name || note.displayName) + '</td>';
    for (var i = 0; i < colLabels.length; i++) {
      var itemId = getItemId(note.name, i);
      var color = Array.isArray(itemId)
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
  var statsMode = null;
  var statsContainer = container.querySelector('.stats-container');

  function show(mode) {
    statsMode = mode;
    statsContainer.innerHTML = '';
    renderFn(mode, statsContainer);
    statsContainer.classList.remove('stats-hidden');
    container.querySelectorAll('.stats-toggle-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }

  function hide() {
    statsMode = null;
    statsContainer.classList.add('stats-hidden');
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
  var s = ms / 1000;
  return s % 1 === 0 ? s + 's' : s.toFixed(1) + 's';
}

/**
 * Build a legend item HTML for a single heatmap level.
 */
function legendItem(color, label) {
  return '<div class="legend-item"><div class="legend-swatch" style="background:' + color + '"></div>' + label + '</div>';
}

/**
 * Build a shared legend HTML string.
 */
export function buildStatsLegend(statsMode, baseline) {
  var c = heatmapColors();
  var html = '<div class="heatmap-legend active">';
  html += legendItem(c.none, 'No data');

  if (statsMode === 'retention') {
    for (var i = c.level.length - 1; i >= 0; i--) {
      html += legendItem(c.level[i], RETENTION_LABELS[i]);
    }
  } else {
    var b = baseline || 1000;
    var t1 = formatThreshold(b * 1.5);
    var t2 = formatThreshold(b * 3);
    var t3 = formatThreshold(b * 4.5);
    var t4 = formatThreshold(b * 6);
    html += legendItem(c.level[4], '&lt; ' + t1);
    html += legendItem(c.level[3], t1 + '\u2013' + t2);
    html += legendItem(c.level[2], t2 + '\u2013' + t3);
    html += legendItem(c.level[1], t3 + '\u2013' + t4);
    html += legendItem(c.level[0], '&ge; ' + t4);
  }

  html += '</div>';
  return html;
}
