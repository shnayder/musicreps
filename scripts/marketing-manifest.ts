// Marketing asset manifest — maps store screenshots to templates, captions,
// and raw app screenshots from the screenshot manifest.

export type StoreFormat = 'ios69' | 'play' | 'play-feature';

export const STORE_DIMENSIONS: Record<
  StoreFormat,
  { width: number; height: number }
> = {
  ios69: { width: 1320, height: 2868 },
  play: { width: 1320, height: 2868 },
  'play-feature': { width: 1024, height: 500 },
};

export type MarketingAsset = {
  /** Output filename stem, e.g. "01-hero" */
  name: string;
  /** Template filename without extension (in marketing-templates/) */
  template: 'phone-single' | 'feature-graphic';
  /** Which store formats to render */
  formats: StoreFormat[];
  /** Screenshot names from screenshot-manifest (pass 1 captures these) */
  screenshots: string[];
  /** Primary caption text */
  caption?: string;
  /** Secondary caption text */
  subcaption?: string;
  /** CSS background override */
  backgroundColor?: string;
};

export const MARKETING_ASSETS: MarketingAsset[] = [
  {
    name: '01-hero',
    template: 'phone-single',
    formats: ['ios69', 'play'],
    screenshots: ['home-recs-mixed'],
    caption: 'Make music fundamentals automatic',
    subcaption: 'Fast drills for instant recall',
  },
  {
    name: '02-fretboard',
    template: 'phone-single',
    formats: ['ios69', 'play'],
    screenshots: ['fretboard-quiz'],
    caption: 'Learn every note on the fretboard',
  },
  {
    name: '03-intervals',
    template: 'phone-single',
    formats: ['ios69', 'play'],
    screenshots: ['intervalMath-quiz'],
    caption: 'Build instant recall',
    subcaption: 'Intervals, keys, chords, and more',
  },
  {
    name: '04-feedback',
    template: 'phone-single',
    formats: ['ios69', 'play'],
    screenshots: ['design-correct-feedback'],
    caption: 'Train until it\'s automatic',
    subcaption: 'Adaptive drills that adjust to you',
  },
  {
    name: '05-keys',
    template: 'phone-single',
    formats: ['ios69', 'play'],
    screenshots: ['keySignatures-quiz'],
    caption: '11 training modes',
    subcaption: 'From fretboard notes to chord spelling',
  },
  {
    name: 'feature-graphic',
    template: 'feature-graphic',
    formats: ['play-feature'],
    screenshots: ['fretboard-quiz'],
    caption: 'Music Reps',
    subcaption: 'Make music fundamentals automatic',
  },
];

/** All raw screenshot names needed by marketing assets. */
export function requiredScreenshots(): string[] {
  const set = new Set<string>();
  for (const asset of MARKETING_ASSETS) {
    for (const s of asset.screenshots) set.add(s);
  }
  return [...set];
}
