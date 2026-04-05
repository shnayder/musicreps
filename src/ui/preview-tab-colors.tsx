// Colors tab — palette ramps, semantic families, pairings, heatmap, and
// component token reference. Replaces the old colors.html page.

import { cssVar, PreviewGrid, Section } from './preview-shared.tsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Perceived brightness (0–255) for contrast-safe text color. */
function perceivedBrightness(color: string): number {
  const el = document.createElement('div');
  el.style.color = color;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);
  const m = computed.match(/(\d+)/g);
  if (!m || m.length < 3) return 128;
  return Number(m[0]) * 0.299 + Number(m[1]) * 0.587 + Number(m[2]) * 0.114;
}

function textColor(bgValue: string): string {
  return perceivedBrightness(bgValue) > 140 ? '#333' : '#eee';
}

// ---------------------------------------------------------------------------
// Swatch card (token name + resolved value + preview)
// ---------------------------------------------------------------------------

function SwatchCard(
  { name, note, key: _key }: { name: string; note?: string; key?: string },
) {
  const val = cssVar(name);
  const needsLight = perceivedBrightness(val) < 140;
  return (
    <div class='swatch-card'>
      <div
        class='swatch-color'
        style={{
          background: val,
          color: needsLight ? 'white' : undefined,
        }}
      />
      <div class='swatch-info'>
        <div class='swatch-var'>{name}</div>
        <div class='swatch-value'>{val}</div>
        {note && <div class='swatch-note'>{note}</div>}
      </div>
    </div>
  );
}

function SwatchGrid(
  { items }: { items: Array<{ name: string; note?: string }> },
) {
  return (
    <div class='grid'>
      {items.map((item) => (
        <SwatchCard key={item.name} name={item.name} note={item.note} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Palette ramps
// ---------------------------------------------------------------------------

const RAMPS = [
  {
    name: 'neutral',
    hueVar: '--hue-neutral',
    steps: [
      '0',
      '100',
      '150',
      '200',
      '250',
      '300',
      '350',
      '400',
      '450',
      '500',
      '550',
      '600',
      '650',
      '700',
      '800',
      '850',
      '900',
      '950',
    ],
  },
  { name: 'brand', hueVar: '--hue-brand', steps: ['100', '600', '800'] },
  { name: 'success', hueVar: '--hue-success', steps: ['100', '600', '800'] },
  {
    name: 'error',
    hueVar: '--hue-error',
    steps: ['100', '200', '300', '500', '600', '800'],
  },
  {
    name: 'notice',
    hueVar: '--hue-notice',
    steps: ['100', '300', '400', '450', '500', '600', '700', '800'],
  },
] as const;

function PaletteRamps({ tabId }: { tabId: string }) {
  return (
    <Section title='Palette ramps' tabId={tabId}>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        Raw color scales derived from anchor hues. Change a <code>--hue-*</code>
        {' '}
        value in <code>:root</code> to shift an entire family.
      </p>
      {RAMPS.map((ramp) => {
        const hueVal = cssVar(ramp.hueVar);
        return (
          <div key={ramp.name} style={{ marginBottom: '1rem' }}>
            <div class='palette-label'>
              {ramp.name}{' '}
              <span class='palette-hue-note'>
                {ramp.hueVar}: {hueVal}&deg;
              </span>
            </div>
            <div class='palette-row'>
              {ramp.steps.map((step) => {
                const varName = `--${ramp.name}-${step}`;
                const val = cssVar(varName);
                return (
                  <div
                    key={step}
                    class='palette-cell'
                    style={{ background: val, color: textColor(val) }}
                  >
                    {step}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Semantic family sections
// ---------------------------------------------------------------------------

function BrandSuccessSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Brand / Success' tabId={tabId}>
      <SwatchGrid
        items={[
          { name: '--color-brand', note: 'brand-600 · CTA, active toggles' },
          { name: '--color-brand-dark', note: 'brand-800 · Hover, pressed' },
          { name: '--color-brand-bg', note: 'brand-200 · Brand background' },
          { name: '--color-brand-border', note: 'brand-600 · Brand borders' },
          { name: '--color-brand-text', note: 'brand-800 · Text on brand-bg' },
          { name: '--color-on-brand', note: 'white · Text on brand fill' },
          {
            name: '--color-success',
            note: 'success-600 · Correct feedback',
          },
          { name: '--color-success-bg', note: 'success-100 · Correct bg' },
          {
            name: '--color-success-reveal',
            note: 'success-300 · Missed targets',
          },
          {
            name: '--color-success-text',
            note: 'success-800 · Text on success-bg',
          },
          { name: '--color-on-success', note: 'white · Text on success fill' },
          { name: '--color-focus', note: 'brand-600 · Focus ring' },
          { name: '--color-focus-bg', note: 'brand-100 · Focus background' },
        ]}
      />
    </Section>
  );
}

function ErrorSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Error' tabId={tabId}>
      <SwatchGrid
        items={[
          { name: '--color-error', note: 'error-600 · Wrong answer, timer' },
          { name: '--color-error-bg', note: 'error-100 · Wrong answer bg' },
          { name: '--color-error-border', note: 'error-300 · Error borders' },
          { name: '--color-error-text', note: 'error-800 · Text on error-bg' },
          { name: '--color-on-error', note: 'white · Text on error fill' },
        ]}
      />
    </Section>
  );
}

function NoticeSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Notice (attention, recommendations)' tabId={tabId}>
      <SwatchGrid
        items={[
          { name: '--color-notice', note: 'notice-500 · Card header/border' },
          { name: '--color-notice-bg', note: 'notice-100 · Card background' },
          { name: '--color-notice-border', note: 'notice-300 · Card border' },
          { name: '--color-notice-bg-hover', note: 'notice-400 · Hover' },
          { name: '--color-notice-bg-pressed', note: 'notice-450 · Pressed' },
          { name: '--color-notice-text', note: 'notice-800 · Text on notice' },
          { name: '--color-highlight', note: 'notice-600 · Fretboard HL' },
        ]}
      />
    </Section>
  );
}

function AccentSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Accent & Chrome' tabId={tabId}>
      <SwatchGrid
        items={[
          { name: '--color-accent', note: 'brand-600 · Slot underline' },
          { name: '--color-accent-muted', note: 'hsl · Secondary accent' },
          { name: '--color-toggle-active', note: 'brand-600 · Toggle fill' },
          { name: '--color-chrome', note: 'neutral-75 · Segmented bg' },
        ]}
      />
    </Section>
  );
}

function TextSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Text' tabId={tabId}>
      <SwatchGrid
        items={[
          { name: '--color-text', note: 'neutral-800 · Primary text' },
          { name: '--color-text-muted', note: 'neutral-650 · Secondary' },
          { name: '--color-text-light', note: 'neutral-550 · Tertiary' },
        ]}
      />
    </Section>
  );
}

function SurfaceSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Surfaces & backgrounds' tabId={tabId}>
      <SwatchGrid
        items={[
          { name: '--color-canvas', note: 'neutral-50 · Page background' },
          { name: '--color-chrome', note: 'neutral-75 · Top bar, tab bar' },
          { name: '--color-well', note: 'neutral-100 · Recessed containers' },
          { name: '--color-card', note: 'neutral-0 · Elevated cards' },
          { name: '--color-surface', note: 'neutral-75 · Inactive toggles' },
          { name: '--color-surface-hover', note: 'neutral-150 · Hover' },
          { name: '--color-surface-raised', note: 'neutral-200 · Progress bg' },
          { name: '--color-surface-pressed', note: 'neutral-350 · :active' },
        ]}
      />
    </Section>
  );
}

function BorderSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Borders' tabId={tabId}>
      <SwatchGrid
        items={[
          { name: '--color-border', note: 'neutral-550 · Toggle borders' },
          { name: '--color-border-light', note: 'neutral-400 · Tables' },
          {
            name: '--color-border-lighter',
            note: 'neutral-300 · Section dividers',
          },
        ]}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Semantic pairings
// ---------------------------------------------------------------------------

const PAIRINGS = [
  { bg: '--color-success-bg', text: '--color-success-text', label: 'Success' },
  { bg: '--color-error-bg', text: '--color-error-text', label: 'Error' },
  { bg: '--color-notice-bg', text: '--color-notice-text', label: 'Notice' },
  { bg: '--color-focus-bg', text: '--color-focus', label: 'Focus' },
  { bg: '--color-brand-bg', text: '--color-brand-dark', label: 'Brand' },
] as const;

function PairingsSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Semantic pairings' tabId={tabId}>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        How bg + text variants look together.
      </p>
      {PAIRINGS.map((p) => (
        <div
          key={p.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            margin: '0.5rem 0',
            fontSize: '0.8rem',
          }}
        >
          <span
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              fontWeight: 600,
              background: cssVar(p.bg),
              color: cssVar(p.text),
            }}
          >
            {p.label} text on bg
          </span>
          <code
            style={{
              fontSize: '0.7rem',
              color: 'var(--color-text-light)',
            }}
          >
            {p.bg} + {p.text}
          </code>
        </div>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Heatmap strip
// ---------------------------------------------------------------------------

const HEATMAP_STEPS = [
  { name: '--heatmap-none', label: 'none' },
  { name: '--heatmap-1', label: '1 (worst)' },
  { name: '--heatmap-2', label: '2' },
  { name: '--heatmap-3', label: '3' },
  { name: '--heatmap-4', label: '4' },
  { name: '--heatmap-5', label: '5 (best)' },
] as const;

function HeatmapSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Heatmap scale' tabId={tabId}>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        Warm terracotta &rarr; sage sequential scale. Bright at both ends, muted
        in the middle. No red/green dependency.
      </p>
      <div class='heatmap-strip'>
        {HEATMAP_STEPS.map((s) => (
          <div
            key={s.name}
            class='heatmap-step'
            style={{ background: cssVar(s.name) }}
          >
            {s.label}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Component token reference
// ---------------------------------------------------------------------------

type TokenMapping = {
  component: string;
  tokens: string[];
  states: Array<{
    state: string;
    values: Record<string, string>;
  }>;
};

const COMPONENT_TOKENS: TokenMapping[] = [
  {
    component: 'ActionButton (.page-action-btn)',
    tokens: ['--_bg', '--_text', '--_border', '--_weight'],
    states: [
      {
        state: 'primary',
        values: {
          '--_bg': '--color-brand',
          '--_text': '--color-on-brand',
          '--_border': 'transparent',
        },
      },
      {
        state: 'secondary',
        values: {
          '--_bg': 'transparent',
          '--_text': '--color-text-muted',
          '--_border': '--color-border',
          '--_weight': '--font-normal',
        },
      },
      {
        state: 'disabled',
        values: {
          '--_bg': '--color-surface-raised',
          '--_text': '--color-text-light',
          '--_border': '--color-border-light',
        },
      },
    ],
  },
  {
    component: 'AnswerButton (.answer-btn)',
    tokens: ['--_bg', '--_text', '--_border'],
    states: [
      {
        state: 'default',
        values: {
          '--_bg': '--color-bg',
          '--_text': 'inherit',
          '--_border': '--color-text-muted',
        },
      },
      {
        state: 'correct',
        values: {
          '--_bg': '--color-success-bg',
          '--_text': '--color-success-text',
          '--_border': '--color-success',
        },
      },
      {
        state: 'wrong',
        values: {
          '--_bg': '--color-error-bg',
          '--_text': '--color-error-text',
          '--_border': '--color-error',
        },
      },
    ],
  },
  {
    component: 'Toggle (.string-toggle, .distance-toggle, etc.)',
    tokens: ['--_bg', '--_text', '--_border'],
    states: [
      {
        state: 'inactive',
        values: {
          '--_bg': '--color-surface',
          '--_text': '--color-border',
          '--_border': '--color-border',
        },
      },
      {
        state: 'active',
        values: {
          '--_bg': '--color-toggle-active',
          '--_text': '--color-on-brand',
          '--_border': '--color-toggle-active',
        },
      },
    ],
  },
  {
    component: 'SequentialSlot (.seq-slot)',
    tokens: ['--_text', '--_border'],
    states: [
      {
        state: 'empty',
        values: {
          '--_text': '--color-text-muted',
          '--_border': '--color-border',
        },
      },
      {
        state: 'active',
        values: { '--_border': '--color-accent' },
      },
      {
        state: 'correct',
        values: {
          '--_text': '--color-success-text',
          '--_border': '--color-success',
        },
      },
      {
        state: 'wrong',
        values: {
          '--_text': '--color-error-text',
          '--_border': '--color-error',
        },
      },
    ],
  },
];

function ComponentTokenTable(
  { mapping, key: _key }: { mapping: TokenMapping; key?: string },
) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          fontWeight: 600,
          fontSize: '0.85rem',
          marginBottom: '0.5rem',
        }}
      >
        {mapping.component}
      </div>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.75rem',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '0.25rem 0.5rem',
                borderBottom: '1px solid var(--color-border-light)',
              }}
            >
              State
            </th>
            {mapping.tokens.map((t) => (
              <th
                key={t}
                style={{
                  textAlign: 'left',
                  padding: '0.25rem 0.5rem',
                  borderBottom: '1px solid var(--color-border-light)',
                }}
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mapping.states.map((s) => (
            <tr key={s.state}>
              <td
                style={{
                  padding: '0.25rem 0.5rem',
                  borderBottom: '1px solid var(--color-border-lighter)',
                  fontWeight: 500,
                }}
              >
                {s.state}
              </td>
              {mapping.tokens.map((t) => (
                <td
                  key={t}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderBottom: '1px solid var(--color-border-lighter)',
                    color: s.values[t]
                      ? 'var(--color-text)'
                      : 'var(--color-text-light)',
                  }}
                >
                  {s.values[t] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComponentTokenSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Component token reference' tabId={tabId}>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        Components with <code>--_</code>{' '}
        prefix tokens. Each state overrides semantic token mappings — dark mode
        only needs to change the semantic layer.
      </p>
      {COMPONENT_TOKENS.map((m) => (
        <ComponentTokenTable key={m.component} mapping={m} />
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Exported tab component
// ---------------------------------------------------------------------------

export function ColorsTab({ tabId }: { tabId: string }) {
  return (
    <div>
      <h2>Palette</h2>
      <PreviewGrid>
        <PaletteRamps tabId={tabId} />
      </PreviewGrid>

      <h2>Semantic Families</h2>
      <PreviewGrid>
        <BrandSuccessSection tabId={tabId} />
        <ErrorSection tabId={tabId} />
        <NoticeSection tabId={tabId} />
        <AccentSection tabId={tabId} />
        <TextSection tabId={tabId} />
        <SurfaceSection tabId={tabId} />
        <BorderSection tabId={tabId} />
      </PreviewGrid>

      <h2>Pairings & Scales</h2>
      <PreviewGrid>
        <PairingsSection tabId={tabId} />
        <HeatmapSection tabId={tabId} />
      </PreviewGrid>

      <h2>Component Tokens</h2>
      <PreviewGrid>
        <ComponentTokenSection tabId={tabId} />
      </PreviewGrid>
    </div>
  );
}
