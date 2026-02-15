// Color scheme definitions and dynamic switching.
// Each scheme overrides the CSS custom properties defined in :root.
// Semantic feedback colors (success, error, focus) stay constant.
//
// Heatmap scales are multi-hue and colorblind-safe: each ramp has
// monotonically decreasing lightness (~72% → ~35%) and spans ~100°
// of hue, avoiding red-green as the sole differentiator.
// See scripts/preview-heatmaps.html to visualize all scales.
//
// Depends on: resetHeatmapCache (from stats-display.js)

var COLOR_SCHEMES = {
  classic: {
    name: 'Classic',
    // Amber/gold — the original scheme
    vars: {
      '--color-brand':       'hsl(38, 90%, 55%)',
      '--color-brand-dark':  'hsl(38, 90%, 42%)',
      '--color-brand-bg':    'hsl(38, 60%, 95%)',
      '--color-topbar-bg':   'hsl(220, 15%, 18%)',
      '--color-topbar-text': 'hsl(0, 0%, 95%)',
      '--color-toggle-active':      '#4CAF50',
      '--color-toggle-recommended': '#FF9800',
      // Blue → amber (original multi-hue scale)
      '--heatmap-none': 'hsl(30, 5%, 85%)',
      '--heatmap-1':    'hsl(215, 45%, 60%)',
      '--heatmap-2':    'hsl(200, 40%, 65%)',
      '--heatmap-3':    'hsl(50, 50%, 65%)',
      '--heatmap-4':    'hsl(42, 70%, 58%)',
      '--heatmap-5':    'hsl(38, 85%, 55%)',
    },
  },

  ocean: {
    name: 'Ocean',
    // Deep navy header, teal brand
    vars: {
      '--color-brand':       'hsl(178, 65%, 42%)',
      '--color-brand-dark':  'hsl(178, 65%, 32%)',
      '--color-brand-bg':    'hsl(178, 40%, 94%)',
      '--color-topbar-bg':   'hsl(210, 50%, 22%)',
      '--color-topbar-text': 'hsl(180, 20%, 95%)',
      '--color-toggle-active':      'hsl(178, 65%, 38%)',
      '--color-toggle-recommended': 'hsl(35, 80%, 55%)',
      // Lavender → blue → teal (cool spectrum)
      '--heatmap-none': 'hsl(200, 8%, 85%)',
      '--heatmap-1':    'hsl(280, 22%, 72%)',
      '--heatmap-2':    'hsl(235, 32%, 62%)',
      '--heatmap-3':    'hsl(205, 42%, 52%)',
      '--heatmap-4':    'hsl(188, 55%, 42%)',
      '--heatmap-5':    'hsl(175, 65%, 34%)',
    },
  },

  forest: {
    name: 'Forest',
    // Dark green header, emerald brand
    vars: {
      '--color-brand':       'hsl(152, 55%, 42%)',
      '--color-brand-dark':  'hsl(152, 55%, 32%)',
      '--color-brand-bg':    'hsl(152, 35%, 94%)',
      '--color-topbar-bg':   'hsl(160, 30%, 18%)',
      '--color-topbar-text': 'hsl(140, 15%, 95%)',
      '--color-toggle-active':      'hsl(152, 55%, 38%)',
      '--color-toggle-recommended': 'hsl(35, 80%, 55%)',
      // Blue-violet → cyan → emerald
      '--heatmap-none': 'hsl(140, 5%, 85%)',
      '--heatmap-1':    'hsl(250, 22%, 72%)',
      '--heatmap-2':    'hsl(215, 32%, 62%)',
      '--heatmap-3':    'hsl(185, 40%, 50%)',
      '--heatmap-4':    'hsl(165, 50%, 40%)',
      '--heatmap-5':    'hsl(150, 58%, 33%)',
    },
  },

  sunset: {
    name: 'Sunset',
    // Deep charcoal header, coral brand
    vars: {
      '--color-brand':       'hsl(12, 75%, 58%)',
      '--color-brand-dark':  'hsl(12, 75%, 45%)',
      '--color-brand-bg':    'hsl(12, 60%, 95%)',
      '--color-topbar-bg':   'hsl(250, 12%, 20%)',
      '--color-topbar-text': 'hsl(30, 20%, 95%)',
      '--color-toggle-active':      'hsl(12, 72%, 52%)',
      '--color-toggle-recommended': 'hsl(45, 85%, 55%)',
      // Steel blue → purple → rose → coral
      '--heatmap-none': 'hsl(20, 8%, 85%)',
      '--heatmap-1':    'hsl(220, 25%, 72%)',
      '--heatmap-2':    'hsl(270, 30%, 62%)',
      '--heatmap-3':    'hsl(320, 38%, 52%)',
      '--heatmap-4':    'hsl(350, 52%, 44%)',
      '--heatmap-5':    'hsl(10, 68%, 38%)',
    },
  },

  midnight: {
    name: 'Midnight',
    // Deep blue-purple header, violet brand
    vars: {
      '--color-brand':       'hsl(262, 60%, 58%)',
      '--color-brand-dark':  'hsl(262, 60%, 45%)',
      '--color-brand-bg':    'hsl(262, 40%, 95%)',
      '--color-topbar-bg':   'hsl(250, 35%, 18%)',
      '--color-topbar-text': 'hsl(260, 20%, 95%)',
      '--color-toggle-active':      'hsl(262, 58%, 52%)',
      '--color-toggle-recommended': 'hsl(35, 80%, 55%)',
      // Teal → blue → indigo → violet
      '--heatmap-none': 'hsl(250, 8%, 85%)',
      '--heatmap-1':    'hsl(170, 25%, 72%)',
      '--heatmap-2':    'hsl(205, 32%, 62%)',
      '--heatmap-3':    'hsl(230, 40%, 52%)',
      '--heatmap-4':    'hsl(250, 52%, 44%)',
      '--heatmap-5':    'hsl(265, 62%, 37%)',
    },
  },

  rose: {
    name: 'Rose',
    // Dark rose-brown header, rose-pink brand
    vars: {
      '--color-brand':       'hsl(340, 60%, 55%)',
      '--color-brand-dark':  'hsl(340, 60%, 42%)',
      '--color-brand-bg':    'hsl(340, 40%, 95%)',
      '--color-topbar-bg':   'hsl(345, 25%, 20%)',
      '--color-topbar-text': 'hsl(340, 15%, 95%)',
      '--color-toggle-active':      'hsl(340, 58%, 50%)',
      '--color-toggle-recommended': 'hsl(40, 80%, 55%)',
      // Blue → purple → magenta → rose
      '--heatmap-none': 'hsl(340, 5%, 85%)',
      '--heatmap-1':    'hsl(210, 25%, 72%)',
      '--heatmap-2':    'hsl(250, 30%, 62%)',
      '--heatmap-3':    'hsl(290, 38%, 52%)',
      '--heatmap-4':    'hsl(320, 50%, 44%)',
      '--heatmap-5':    'hsl(340, 60%, 37%)',
    },
  },

  slate: {
    name: 'Slate',
    // Cool slate header, steel blue brand
    vars: {
      '--color-brand':       'hsl(215, 45%, 50%)',
      '--color-brand-dark':  'hsl(215, 45%, 38%)',
      '--color-brand-bg':    'hsl(215, 30%, 95%)',
      '--color-topbar-bg':   'hsl(220, 20%, 25%)',
      '--color-topbar-text': 'hsl(210, 10%, 95%)',
      '--color-toggle-active':      'hsl(215, 45%, 46%)',
      '--color-toggle-recommended': 'hsl(35, 80%, 55%)',
      // Warm buff → teal → steel blue
      '--heatmap-none': 'hsl(215, 8%, 85%)',
      '--heatmap-1':    'hsl(45, 28%, 72%)',
      '--heatmap-2':    'hsl(120, 18%, 60%)',
      '--heatmap-3':    'hsl(180, 30%, 50%)',
      '--heatmap-4':    'hsl(200, 42%, 42%)',
      '--heatmap-5':    'hsl(218, 55%, 35%)',
    },
  },

  ember: {
    name: 'Ember',
    // Dark brown header, warm copper brand
    vars: {
      '--color-brand':       'hsl(25, 70%, 50%)',
      '--color-brand-dark':  'hsl(25, 70%, 38%)',
      '--color-brand-bg':    'hsl(25, 45%, 95%)',
      '--color-topbar-bg':   'hsl(20, 25%, 18%)',
      '--color-topbar-text': 'hsl(25, 15%, 95%)',
      '--color-toggle-active':      'hsl(25, 68%, 45%)',
      '--color-toggle-recommended': 'hsl(50, 85%, 50%)',
      // Blue → violet → rose → copper
      '--heatmap-none': 'hsl(25, 8%, 85%)',
      '--heatmap-1':    'hsl(220, 22%, 72%)',
      '--heatmap-2':    'hsl(270, 28%, 62%)',
      '--heatmap-3':    'hsl(325, 35%, 52%)',
      '--heatmap-4':    'hsl(0, 50%, 44%)',
      '--heatmap-5':    'hsl(22, 65%, 37%)',
    },
  },

  sage: {
    name: 'Sage',
    // Muted olive-green header, sage brand
    vars: {
      '--color-brand':       'hsl(90, 35%, 45%)',
      '--color-brand-dark':  'hsl(90, 35%, 35%)',
      '--color-brand-bg':    'hsl(90, 25%, 94%)',
      '--color-topbar-bg':   'hsl(100, 15%, 22%)',
      '--color-topbar-text': 'hsl(90, 10%, 95%)',
      '--color-toggle-active':      'hsl(90, 35%, 42%)',
      '--color-toggle-recommended': 'hsl(35, 80%, 55%)',
      // Warm terracotta → amber → olive → sage
      '--heatmap-none': 'hsl(90, 8%, 92%)',
      '--heatmap-1':    'hsl(18, 45%, 70%)',
      '--heatmap-2':    'hsl(38, 50%, 60%)',
      '--heatmap-3':    'hsl(58, 40%, 50%)',
      '--heatmap-4':    'hsl(75, 38%, 42%)',
      '--heatmap-5':    'hsl(88, 45%, 35%)',
    },
  },
};

var SCHEME_STORAGE_KEY = 'fretboard_colorScheme';

function getColorSchemeId() {
  try {
    return localStorage.getItem(SCHEME_STORAGE_KEY) || 'classic';
  } catch (_) { return 'classic'; }
}

function applyColorScheme(id) {
  var scheme = COLOR_SCHEMES[id];
  if (!scheme) scheme = COLOR_SCHEMES.classic;

  var root = document.documentElement;
  var vars = scheme.vars;
  for (var prop in vars) {
    if (vars.hasOwnProperty(prop)) {
      root.style.setProperty(prop, vars[prop]);
    }
  }

  // Invalidate cached heatmap colors so stats pick up the new palette
  resetHeatmapCache();

  try {
    localStorage.setItem(SCHEME_STORAGE_KEY, id);
  } catch (_) { /* storage unavailable */ }
}

// Apply saved scheme on load (before first paint of stats)
applyColorScheme(getColorSchemeId());
