// Marketing asset manifest — maps store screenshots to templates, captions,
// and raw app screenshots from the screenshot manifest.

export type StoreFormat = 'ios69' | 'ipad13' | 'play' | 'play-feature';

export const STORE_DIMENSIONS: Record<
  StoreFormat,
  { width: number; height: number }
> = {
  ios69: { width: 1320, height: 2868 },
  ipad13: { width: 2064, height: 2752 },
  play: { width: 1320, height: 2868 },
  'play-feature': { width: 1024, height: 500 },
};

export type MarketingTemplate =
  | 'phone-single'
  | 'tablet-single'
  | 'feature-graphic';

export type MarketingAsset = {
  /** Output filename stem, e.g. "01-hero" */
  name: string;
  /** Template filename without extension (in marketing-templates/) */
  template: MarketingTemplate;
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

/** For formats that use a different template than the asset default,
 *  override here. iPad renders with the tablet template so the screenshot
 *  lands in a tablet frame with the correct aspect ratio. */
export const FORMAT_TEMPLATE_OVERRIDE: Partial<
  Record<StoreFormat, MarketingTemplate>
> = {
  ipad13: 'tablet-single',
};

/** Which capture viewport each format uses. iPad formats need the app
 *  rendered at iPad viewport so tablet-layout media queries kick in. */
export const FORMAT_CAPTURE: Record<StoreFormat, 'phone' | 'ipad' | 'none'> = {
  ios69: 'phone',
  play: 'phone',
  ipad13: 'ipad',
  'play-feature': 'phone',
};

// Play Store allows up to 8 screenshots per listing; iOS allows 10. The first
// 8 entries render for both stores; the rest are iOS-only.
const BOTH: StoreFormat[] = ['ios69', 'ipad13', 'play'];
const IOS_ONLY: StoreFormat[] = ['ios69', 'ipad13'];

export const MARKETING_ASSETS: MarketingAsset[] = [
  // --- Core story (5 shots) ---
  {
    name: '01-hero',
    template: 'phone-single',
    formats: BOTH,
    screenshots: ['home-recs-mixed'],
    caption: 'Make music fundamentals automatic',
    subcaption: 'Fast drills for instant recall',
  },
  {
    name: '02-fretboard',
    template: 'phone-single',
    formats: BOTH,
    screenshots: ['fretboard-quiz'],
    caption: 'Learn every note on the fretboard',
  },
  {
    name: '03-correct-feedback',
    template: 'phone-single',
    formats: BOTH,
    screenshots: ['design-fretboard-correct'],
    caption: "Train until it's automatic",
  },
  {
    name: '04-round-complete',
    template: 'phone-single',
    formats: BOTH,
    screenshots: ['marketing-fretboard-round-complete'],
    caption: 'Every rep counts',
  },
  {
    name: '05-progress',
    template: 'phone-single',
    formats: BOTH,
    screenshots: ['marketing-fretboard-practice-modal'],
    caption: 'Track your progress',
  },
  // --- Tier 2: breadth (5 shots) ---
  {
    name: '06-chord-shapes',
    template: 'phone-single',
    formats: BOTH,
    screenshots: ['marketing-guitarChordShapes-Am-correct'],
    caption: 'Master chord shapes',
  },
  {
    name: '07-interval-math',
    template: 'phone-single',
    formats: BOTH,
    screenshots: ['intervalMath-quiz'],
    caption: 'Think in intervals',
  },
  {
    name: '08-chord-spelling',
    template: 'phone-single',
    formats: BOTH,
    screenshots: ['marketing-chordSpelling-D7'],
    caption: 'Spell any chord instantly',
  },
  {
    name: '09-scale-degrees',
    template: 'phone-single',
    formats: IOS_ONLY,
    screenshots: ['marketing-scaleDegrees-D-4'],
    caption: '11 training modes',
  },
  {
    name: '10-ukulele',
    template: 'phone-single',
    formats: IOS_ONLY,
    screenshots: ['ukulele-quiz'],
    caption: 'Guitar and ukulele',
  },
  // --- Feature graphic (Play Store) ---
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
