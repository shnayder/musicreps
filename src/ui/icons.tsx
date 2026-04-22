// Inline SVG icons from Lucide (MIT license).
// Source files saved in static/icons/.
// Each component renders a 28x28 SVG that inherits color via currentColor.

const ICON_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: '28',
  height: '28',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  class: 'skill-icon',
  'aria-hidden': 'true',
} as const;

// Guitar (acoustic guitar silhouette)
function Guitar() {
  return (
    <svg {...ICON_PROPS}>
      <path d='m11.9 12.1 4.514-4.514' />
      <path d='M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z' />
      <path d='m6 16 2 2' />
      <path d='M8.23 9.85A3 3 0 0 1 11 8a5 5 0 0 1 5 5 3 3 0 0 1-1.85 2.77l-.92.38A2 2 0 0 0 12 18a4 4 0 0 1-4 4 6 6 0 0 1-6-6 4 4 0 0 1 4-4 2 2 0 0 0 1.85-1.23z' />
    </svg>
  );
}

// Zap (lightning bolt — speed)
function Zap() {
  return (
    <svg {...ICON_PROPS}>
      <path d='M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z' />
    </svg>
  );
}

// Hash (# — number/sharp dual meaning)
function Hash() {
  return (
    <svg {...ICON_PROPS}>
      <line x1='4' x2='20' y1='9' y2='9' />
      <line x1='4' x2='20' y1='15' y2='15' />
      <line x1='10' x2='8' y1='3' y2='21' />
      <line x1='16' x2='14' y1='3' y2='21' />
    </svg>
  );
}

// Ruler (measuring — intervals)
function Ruler() {
  return (
    <svg {...ICON_PROPS}>
      <path d='M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z' />
      <path d='m14.5 12.5 2-2' />
      <path d='m11.5 9.5 2-2' />
      <path d='m8.5 6.5 2-2' />
      <path d='m17.5 15.5 2-2' />
    </svg>
  );
}

// Calculator (arithmetic — semitone math)
function Calculator() {
  return (
    <svg {...ICON_PROPS}>
      <rect width='16' height='20' x='4' y='2' rx='2' />
      <line x1='8' x2='16' y1='6' y2='6' />
      <line x1='16' x2='16' y1='14' y2='18' />
      <path d='M16 10h.01' />
      <path d='M12 10h.01' />
      <path d='M8 10h.01' />
      <path d='M12 14h.01' />
      <path d='M8 14h.01' />
      <path d='M12 18h.01' />
      <path d='M8 18h.01' />
    </svg>
  );
}

// ListOrdered (numbered list — diatonic chords I-VII)
function ListOrdered() {
  return (
    <svg {...ICON_PROPS}>
      <path d='M11 5h10' />
      <path d='M11 12h10' />
      <path d='M11 19h10' />
      <path d='M4 4h1v5' />
      <path d='M4 9h2' />
      <path d='M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02' />
    </svg>
  );
}

// KeyRound (key — key signatures)
function KeyRound() {
  return (
    <svg {...ICON_PROPS}>
      <path d='M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z' />
      <circle cx='16.5' cy='7.5' r='.5' fill='currentColor' />
    </svg>
  );
}

// Signal (ascending bars — scale degrees)
function Signal() {
  return (
    <svg {...ICON_PROPS}>
      <path d='M2 20h.01' />
      <path d='M7 20v-4' />
      <path d='M12 20v-8' />
      <path d='M17 20V8' />
      <path d='M22 4v16' />
    </svg>
  );
}

// SpellCheck (A with checkmark — chord spelling)
function SpellCheck() {
  return (
    <svg {...ICON_PROPS}>
      <path d='m6 16 6-12 6 12' />
      <path d='M8 12h8' />
      <path d='m16 20 2 2 4-4' />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Icon mapping by mode ID
// ---------------------------------------------------------------------------

const MODE_ICONS: Record<string, () => preact.JSX.Element> = {
  fretboard: Guitar,
  ukulele: Guitar,
  speedTap: Zap,
  ukuleleSpeedTap: Zap,
  noteSemitones: Hash,
  intervalSemitones: Ruler,
  semitoneMath: Calculator,
  intervalMath: Calculator,
  keySignatures: KeyRound,
  scaleDegrees: Signal,
  diatonicChords: ListOrdered,
  chordSpelling: SpellCheck,
  guitarChordShapes: Guitar,
  ukuleleChordShapes: Guitar,
};

export function SkillIcon({ skillId }: { skillId: string }) {
  const Icon = MODE_ICONS[skillId];
  if (!Icon) return null;
  return <Icon />;
}
