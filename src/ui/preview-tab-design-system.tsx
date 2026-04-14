// Design System tab — tokens, typography, spacing, radius, shadows, and
// design-system-level components (close button, skill card header, etc.).

import { useState } from 'preact/hooks';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';
import { CloseButton, Tabs } from './mode-screen.tsx';
import {
  SegmentedControl,
  SettingsPanel,
  SettingToggle,
  SkillCardHeader,
  TrackPill,
  TrackSection,
} from './home-screen.tsx';
import { Pill } from './pill.tsx';
import { cssVar, PreviewGrid, Section } from './preview-shared.tsx';

// ---------------------------------------------------------------------------
// File-local sub-section components
// ---------------------------------------------------------------------------

function CloseButtonSection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Close Button</h2>
      <PreviewGrid>
        <Section title='CloseButton' tabId={tabId}>
          <CloseButton ariaLabel='Close' onClick={() => {}} />
        </Section>
      </PreviewGrid>
    </>
  );
}

function SkillCardHeaderSection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Skill Card Header</h2>
      <PreviewGrid>
        <Section title='SkillCardHeader — no pill' tabId={tabId}>
          <SkillCardHeader modeId='semitoneMath' />
        </Section>
        <Section title='SkillCardHeader — with pill' tabId={tabId}>
          <SkillCardHeader
            modeId='semitoneMath'
            trackLabel='Core'
          />
        </Section>
        <Section title='Pill variants' tabId={tabId}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <TrackPill label='Core' />
            </div>
            <div>
              <TrackPill label='Reading' />
            </div>
            <div>
              <TrackPill label='Guitar' />
            </div>
            <div>
              <TrackPill label='Ukulele' />
            </div>
            <div>
              <Pill variant='notice'>Review soon</Pill>
            </div>
            <div>
              <Pill variant='notice'>Review in 5d</Pill>
            </div>
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

function TrackSectionPreview({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Track Section</h2>
      <PreviewGrid>
        <Section title='TrackSection — expanded' tabId={tabId}>
          <TrackSection
            label='Core'
            isExpanded
            onToggle={() => {}}
          >
            <div style={{ padding: '8px', color: 'var(--color-text-muted)' }}>
              Skills go here
            </div>
          </TrackSection>
        </Section>
        <Section title='TrackSection — collapsed' tabId={tabId}>
          <TrackSection
            label='Guitar'
            isExpanded={false}
            onToggle={() => {}}
          >
            <div style={{ padding: '8px', color: 'var(--color-text-muted)' }}>
              Skills go here
            </div>
          </TrackSection>
        </Section>
      </PreviewGrid>
    </>
  );
}

function SegmentedControlSection({ tabId }: { tabId: string }) {
  const [val1, setVal1] = useState<'letter' | 'solfege'>('letter');
  const [val2, setVal2] = useState<'letter' | 'solfege'>('solfege');
  const noteOptions = [
    { value: 'letter' as const, label: 'A B C' },
    { value: 'solfege' as const, label: 'Do Re Mi' },
  ];
  return (
    <>
      <h2>Segmented Control</h2>
      <PreviewGrid>
        <Section title='SegmentedControl — first selected' tabId={tabId}>
          <SegmentedControl
            options={noteOptions}
            value={val1}
            onChange={setVal1}
          />
        </Section>
        <Section title='SegmentedControl — second selected' tabId={tabId}>
          <SegmentedControl
            options={noteOptions}
            value={val2}
            onChange={setVal2}
          />
        </Section>
        <Section title='SettingToggle — with label' tabId={tabId}>
          <SettingToggle
            label='Note names'
            options={noteOptions}
            value={val1}
            onChange={setVal1}
          />
        </Section>
      </PreviewGrid>
    </>
  );
}

function TabsSection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Tabs</h2>
      <PreviewGrid>
        <Section title='2 tabs — first active' tabId={tabId}>
          <Tabs
            activeTab='practice'
            onTabSwitch={() => {}}
            tabs={[
              {
                id: 'practice',
                label: 'Practice',
                content: <div>Practice content</div>,
              },
              {
                id: 'progress',
                label: 'Progress',
                content: <div>Progress content</div>,
              },
            ]}
          />
        </Section>
        <Section title='2 tabs — second active' tabId={tabId}>
          <Tabs
            activeTab='progress'
            onTabSwitch={() => {}}
            tabs={[
              {
                id: 'practice',
                label: 'Practice',
                content: <div>Practice content</div>,
              },
              {
                id: 'progress',
                label: 'Progress',
                content: <div>Progress content</div>,
              },
            ]}
          />
        </Section>
        <Section title='3 tabs' tabId={tabId}>
          <Tabs
            activeTab='about'
            onTabSwitch={() => {}}
            tabs={[
              {
                id: 'practice',
                label: 'Practice',
                content: <div>Practice content</div>,
              },
              {
                id: 'progress',
                label: 'Progress',
                content: <div>Progress content</div>,
              },
              {
                id: 'about',
                label: 'About',
                content: <div>About content</div>,
              },
            ]}
          />
        </Section>
      </PreviewGrid>
    </>
  );
}

function ActionButtonsSection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Action Buttons</h2>
      <PreviewGrid>
        <Section title='ActionButton — Primary' tabId={tabId}>
          <ActionButton variant='primary' onClick={() => {}}>
            Practice
          </ActionButton>
        </Section>
        <Section title='ActionButton — Secondary' tabId={tabId}>
          <ActionButton variant='secondary' onClick={() => {}}>
            Stop
          </ActionButton>
        </Section>
        <Section title='ActionButton — Pair (round-complete)' tabId={tabId}>
          <div class='page-action-row'>
            <ActionButton variant='primary' onClick={() => {}}>
              Keep Going
            </ActionButton>
            <ActionButton variant='secondary' onClick={() => {}}>
              Stop
            </ActionButton>
          </div>
        </Section>
        <Section title='ActionButton — Disabled' tabId={tabId}>
          <ActionButton variant='primary' onClick={() => {}} disabled>
            Disabled
          </ActionButton>
        </Section>
      </PreviewGrid>
    </>
  );
}

// ---------------------------------------------------------------------------
// Typography — Role Reference (live from CSS)
// ---------------------------------------------------------------------------

const ROLE_GROUPS: Array<{
  group: string;
  roles: Array<{
    role: string;
    sample: string;
    variants?: Array<{ label: string; class: string; sample: string }>;
  }>;
}> = [
  {
    group: 'Display',
    roles: [{ role: 'display-brand', sample: 'Music Reps' }],
  },
  {
    group: 'Heading',
    roles: [
      { role: 'heading-page', sample: 'Guitar Fretboard' },
      { role: 'heading-section', sample: 'Section Title' },
      { role: 'heading-subsection', sample: 'Subsection' },
    ],
  },
  {
    group: 'Body',
    roles: [
      { role: 'body', sample: 'Body text for content' },
      { role: 'body-secondary', sample: 'Secondary description' },
    ],
  },
  {
    group: 'Label',
    roles: [
      { role: 'label', sample: 'Response time' },
      { role: 'label-tag', sample: 'NEW' },
    ],
  },
  {
    group: 'Quiz',
    roles: [
      { role: 'quiz-instruction', sample: 'What note is this?' },
      { role: 'quiz-prompt', sample: 'C#' },
      { role: 'quiz-response', sample: 'D' },
      { role: 'quiz-feedback', sample: 'Correct! C#' },
    ],
  },
  {
    group: 'Supporting',
    roles: [{ role: 'supporting', sample: 'Helper text' }],
  },
  {
    group: 'Metric',
    roles: [
      { role: 'metric-hero', sample: '42' },
      { role: 'metric-primary', sample: '0.52s' },
      { role: 'metric-info', sample: '30 reps' },
    ],
  },
  {
    group: 'Status',
    roles: [{ role: 'status', sample: 'Practicing strings 1–3' }],
  },
  {
    group: 'Interactive',
    roles: [
      {
        role: 'action',
        sample: 'Practice',
        variants: [
          {
            label: 'action-secondary',
            class: 'action-secondary',
            sample: 'Stop',
          },
        ],
      },
      { role: 'answer', sample: 'C#' },
      {
        role: 'control',
        sample: 'Letters',
        variants: [
          {
            label: 'control-selected',
            class: 'control-selected',
            sample: 'Solfège',
          },
        ],
      },
    ],
  },
];

function readRoleProps(role: string) {
  const p = `--type-${role}`;
  return {
    size: cssVar(`${p}-size`),
    weight: cssVar(`${p}-weight`),
    leading: cssVar(`${p}-leading`),
    color: cssVar(`${p}-color`),
    family: cssVar(`${p}-family`) || null,
  };
}

const propCellStyle = {
  fontSize: '0.7rem',
  color: 'var(--color-text-muted)',
  fontFamily: 'monospace',
  minWidth: '2.5rem',
  flexShrink: 0,
} as const;

function RoleRow(
  { role, sample, cls }: { role: string; sample: string; cls?: string },
) {
  const props = readRoleProps(role);
  const textClass = cls ? `text-${role} ${cls}` : `text-${role}`;
  const needsBg = role === 'action' && !cls;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.5rem',
        padding: '0.2rem 0',
      }}
    >
      <code
        style={{
          fontSize: '0.65rem',
          minWidth: '10rem',
          color: 'var(--color-text-light)',
          flexShrink: 0,
        }}
      >
        {cls || role}
      </code>
      <span
        class={textClass}
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: '1 1 0',
          minWidth: 0,
          ...(needsBg
            ? {
              background: 'var(--color-brand)',
              padding: '0.1rem 0.4rem',
              borderRadius: '4px',
            }
            : {}),
        }}
      >
        {sample}
      </span>
      <span style={propCellStyle}>{props.size}</span>
      <span style={propCellStyle}>{props.weight}</span>
      <span style={propCellStyle}>{props.leading}</span>
      <span
        style={{
          width: '14px',
          height: '14px',
          borderRadius: '2px',
          background: props.color || 'transparent',
          border: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      />
    </div>
  );
}

function TypographyRoleReference({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Typography — Role Reference</h2>
      <PreviewGrid>
        <Section title='All 20 roles — live from CSS' tabId={tabId}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.5rem',
              padding: '0.2rem 0',
              borderBottom: '1px solid var(--color-border)',
              marginBottom: '0.25rem',
            }}
          >
            <span
              style={{
                fontSize: '0.65rem',
                minWidth: '10rem',
                color: 'var(--color-text-muted)',
                fontWeight: 600,
              }}
            >
              Role
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--color-text-muted)',
                fontWeight: 600,
              }}
            >
              Sample
            </span>
            <span
              style={{
                ...propCellStyle,
                marginLeft: 'auto',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
              }}
            >
              Size
            </span>
            <span
              style={{
                ...propCellStyle,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
              }}
            >
              Wt
            </span>
            <span
              style={{
                ...propCellStyle,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
              }}
            >
              Lh
            </span>
            <span style={{ width: '14px', flexShrink: 0 }} />
          </div>
          {ROLE_GROUPS.map(({ group, roles }) => (
            <div key={group}>
              <Text
                role='label-tag'
                as='div'
                style={{ padding: '0.4rem 0 0.15rem' }}
              >
                {group}
              </Text>
              {roles.map(({ role, sample, variants }) => (
                <div key={role}>
                  <RoleRow role={role} sample={sample} />
                  {variants?.map((v) => (
                    <RoleRow
                      key={v.label}
                      role={role}
                      sample={v.sample}
                      cls={v.class}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </Section>
      </PreviewGrid>
    </>
  );
}

const SPACE_TOKENS: Array<{ name: string; desc: string }> = [
  { name: '--space-1', desc: 'Palette: 0.125rem (2px)' },
  { name: '--space-2', desc: 'Palette: 0.25rem (4px)' },
  { name: '--space-3', desc: 'Palette: 0.5rem (8px)' },
  { name: '--space-4', desc: 'Palette: 0.75rem (12px)' },
  { name: '--space-5', desc: 'Palette: 1rem (16px)' },
  { name: '--space-6', desc: 'Palette: 1.5rem (24px)' },
  { name: '--space-7', desc: 'Palette: 2rem (32px)' },
  {
    name: '--gap-micro',
    desc: 'Sub-element coupling: icon+label, toggle rows',
  },
  {
    name: '--gap-related',
    desc: 'Related siblings: buttons in group, label+value',
  },
  { name: '--gap-group', desc: 'Distinct groups within container' },
  { name: '--pad-component', desc: 'Internal padding of controls/cards/wells' },
  { name: '--pad-region', desc: 'Layout region padding, major section breaks' },
  { name: '--gap-section', desc: 'Page-level group separators' },
];

function SpacingSection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Spacing Scale</h2>
      <PreviewGrid>
        <Section title='Spacing tokens' tabId={tabId}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.75rem',
            }}
          >
            <thead>
              <tr>
                {['Token', 'Value', 'Size', 'Usage'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '0.25rem 0.5rem',
                      borderBottom: '1px solid var(--color-border-light)',
                      color: 'var(--color-text-muted)',
                      fontWeight: 600,
                      fontSize: '0.65rem',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SPACE_TOKENS.map(({ name, desc }) => {
                const val = cssVar(name);
                return (
                  <tr key={name}>
                    <td
                      style={{
                        padding: '0.3rem 0.5rem',
                        borderBottom: '1px solid var(--color-border-lighter)',
                        fontFamily: 'monospace',
                        color: 'var(--color-text-light)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {name}
                    </td>
                    <td
                      style={{
                        padding: '0.3rem 0.5rem',
                        borderBottom: '1px solid var(--color-border-lighter)',
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {val}
                    </td>
                    <td
                      style={{
                        padding: '0.3rem 0.5rem',
                        borderBottom: '1px solid var(--color-border-lighter)',
                      }}
                    >
                      <div
                        style={{
                          height: '14px',
                          width: `var(${name})`,
                          minWidth: '2px',
                          background: 'var(--color-brand)',
                          opacity: 0.65,
                          borderRadius: '2px',
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: '0.3rem 0.5rem',
                        borderBottom: '1px solid var(--color-border-lighter)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {desc}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      </PreviewGrid>
    </>
  );
}

const TYPE_TOKENS: Array<{ name: string; usage: string }> = [
  { name: '--text-xs', usage: 'Legend labels, tiny annotations' },
  { name: '--text-sm', usage: 'Descriptions, settings, table text' },
  { name: '--text-base', usage: 'Body, buttons, nav items' },
  { name: '--text-md', usage: 'Answer buttons, metrics' },
  { name: '--text-lg', usage: 'Screen titles' },
  { name: '--text-xl', usage: 'Feedback, close buttons' },
  { name: '--text-2xl', usage: 'Page title, quiz prompts' },
  { name: '--text-3xl', usage: 'Round-complete count' },
];

function TypeScaleSection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Type Scale</h2>
      <PreviewGrid>
        <Section title='Size tokens' tabId={tabId}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {TYPE_TOKENS.map(({ name, usage }) => {
              const val = cssVar(name);
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.6rem',
                    padding: '0.25rem 0',
                    borderBottom: '1px solid var(--color-border-lighter)',
                  }}
                >
                  <code
                    style={{
                      fontSize: '0.7rem',
                      minWidth: '6.5rem',
                      color: 'var(--color-text-light)',
                      flexShrink: 0,
                    }}
                  >
                    {name}
                  </code>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      minWidth: '2.5rem',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                    }}
                  >
                    {val}
                  </span>
                  <span style={{ fontSize: val }}>Ag 0–9 C#</span>
                  <Text
                    role='supporting'
                    as='span'
                    style={{ marginLeft: 'auto' }}
                  >
                    {usage}
                  </Text>
                </div>
              );
            })}
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

const WEIGHT_TOKENS: Array<{ name: string; value: string; usage: string }> = [
  { name: '--font-normal', value: '400', usage: 'Body, descriptions' },
  { name: '--font-medium', value: '500', usage: 'Buttons, labels, toggles' },
  { name: '--font-semibold', value: '600', usage: 'Headings, CTA, titles' },
  { name: '--font-bold', value: '700', usage: 'Track headings, round stats' },
];

const LEADING_TOKENS: Array<{ name: string; value: string; usage: string }> = [
  { name: '--leading-none', value: '1', usage: 'Icons, buttons, inputs' },
  { name: '--leading-tight', value: '1.2', usage: 'Headings, prompts' },
  { name: '--leading-snug', value: '1.4', usage: 'Cards, descriptions' },
  {
    name: '--leading-normal',
    value: '1.5',
    usage: 'Body text, readable blocks',
  },
];

function FontWeightSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Font weight tokens' tabId={tabId}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {WEIGHT_TOKENS.map(({ name, value, usage }) => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.6rem',
            }}
          >
            <code
              style={{
                fontSize: '0.7rem',
                minWidth: '8rem',
                color: 'var(--color-text-light)',
                flexShrink: 0,
              }}
            >
              {name}
            </code>
            <span
              style={{
                fontWeight: value,
                minWidth: '8rem',
              }}
            >
              Music Reps Ag
            </span>
            <Text role='supporting' as='span'>{usage}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

function LineHeightSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Line height tokens' tabId={tabId}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {LEADING_TOKENS.map(({ name, value, usage }) => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
            }}
          >
            <code
              style={{
                fontSize: '0.7rem',
                minWidth: '8rem',
                color: 'var(--color-text-light)',
                flexShrink: 0,
                paddingTop: '0.15rem',
              }}
            >
              {name}
            </code>
            <div
              style={{
                lineHeight: value,
                background: 'var(--color-surface)',
                padding: '0 0.25rem',
                borderRadius: '2px',
                minWidth: '10rem',
              }}
            >
              Two-line sample to show leading value
            </div>
            <Text role='supporting' as='span' style={{ paddingTop: '0.15rem' }}>
              {usage}
            </Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FontFamilySection({ tabId }: { tabId: string }) {
  return (
    <Section title='Font family tokens' tabId={tabId}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <code
            style={{
              fontSize: '0.7rem',
              color: 'var(--color-text-light)',
            }}
          >
            --font-body
          </code>
          <div style={{ fontSize: 'var(--text-lg)' }}>
            Music Reps — Ag 0–9 C# Bb
          </div>
        </div>
        <div>
          <code
            style={{
              fontSize: '0.7rem',
              color: 'var(--color-text-light)',
            }}
          >
            --font-display
          </code>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
            }}
          >
            Music Reps — Ag 0–9 C# Bb
          </div>
        </div>
      </div>
    </Section>
  );
}

function TypographyPaletteSection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Typography — Palette</h2>
      <PreviewGrid>
        <FontFamilySection tabId={tabId} />
        <FontWeightSection tabId={tabId} />
        <LineHeightSection tabId={tabId} />
      </PreviewGrid>
    </>
  );
}

const RADIUS_TOKENS: Array<{ name: string; usage: string }> = [
  { name: '--radius-sm', usage: 'Toggles, cells, bars, small btns' },
  { name: '--radius-md', usage: 'Cards, answer btns, CTAs, progress' },
  { name: '--radius-lg', usage: 'Settings modal' },
];

function RadiusSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Radius tokens' tabId={tabId}>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {RADIUS_TOKENS.map(({ name, usage }) => (
          <div
            key={name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '48px',
                border: '2px solid var(--color-border)',
                background: 'var(--color-surface)',
                borderRadius: `var(${name})`,
              }}
            />
            <code
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-light)',
              }}
            >
              {name}
            </code>
            <Text role='supporting' as='span'>{cssVar(name)}</Text>
            <Text
              role='supporting'
              as='span'
              style={{ textAlign: 'center', maxWidth: '80px' }}
            >
              {usage}
            </Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ShadowSection({ tabId }: { tabId: string }) {
  return (
    <Section title='Shadow / elevation' tabId={tabId}>
      <div
        style={{
          display: 'flex',
          gap: '1.25rem',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <div
            style={{
              width: '90px',
              height: '60px',
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text role='supporting'>Flat</Text>
          </div>
          <Text role='supporting'>Cards, tables</Text>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <div
            style={{
              width: '90px',
              height: '60px',
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text role='supporting'>Low</Text>
          </div>
          <Text role='supporting'>CTA button</Text>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <div
            style={{
              width: '90px',
              height: '60px',
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text role='supporting'>High</Text>
          </div>
          <Text role='supporting'>Modal, drawer</Text>
        </div>
      </div>
    </Section>
  );
}

function RadiusShadowSection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Border Radius & Shadows</h2>
      <PreviewGrid>
        <RadiusSection tabId={tabId} />
        <ShadowSection tabId={tabId} />
      </PreviewGrid>
    </>
  );
}

// ---------------------------------------------------------------------------
// SettingsPanel — inline settings panel (used as home screen tab content)
// ---------------------------------------------------------------------------

function SettingsPanelSection({ tabId }: { tabId: string }) {
  const [useSolfege, setUseSolfege] = useState(false);
  const mockSettings = {
    getUseSolfege: () => useSolfege,
    setUseSolfege: (_v: boolean) => {},
  };
  const mockConfig = {
    contactEmail: 'test@example.com',
    supportUrl: 'https://example.com/support.html',
    termsUrl: 'https://example.com/terms',
    privacyUrl: 'https://example.com/privacy',
  };
  return (
    <>
      <h2>Settings Panel</h2>
      <PreviewGrid>
        <Section title='SettingsPanel — inline' tabId={tabId}>
          <SettingsPanel
            settings={mockSettings}
            appConfig={mockConfig}
            version='preview-1.0.0'
            useSolfege={useSolfege}
            setUseSolfege={setUseSolfege}
          />
        </Section>
      </PreviewGrid>
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported tab component
// ---------------------------------------------------------------------------

export function DesignSystemTab({ tabId }: { tabId: string }) {
  return (
    <div>
      <CloseButtonSection tabId={tabId} />
      <SkillCardHeaderSection tabId={tabId} />
      <TrackSectionPreview tabId={tabId} />
      <SegmentedControlSection tabId={tabId} />
      <TabsSection tabId={tabId} />
      <SettingsPanelSection tabId={tabId} />
      <ActionButtonsSection tabId={tabId} />
      <TypographyRoleReference tabId={tabId} />
      <TypeScaleSection tabId={tabId} />
      <TypographyPaletteSection tabId={tabId} />
      <SpacingSection tabId={tabId} />
      <RadiusShadowSection tabId={tabId} />
    </div>
  );
}
