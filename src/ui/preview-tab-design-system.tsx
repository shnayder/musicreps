// Design System tab — tokens, typography, spacing, radius, shadows, and
// design-system-level components (close button, skill card header, etc.).

import { useState } from 'preact/hooks';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';
import { CloseButton, Tabs } from './mode-screen.tsx';
import {
  SegmentedControl,
  SettingToggle,
  SkillCardHeader,
  TrackPill,
  TrackSection,
} from './home-screen.tsx';
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
            trackId='core'
            trackLabel='Core'
          />
        </Section>
        <Section title='TrackPill variants' tabId={tabId}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <TrackPill trackId='core' label='Core' />
            <TrackPill trackId='reading' label='Reading' />
            <TrackPill trackId='guitar' label='Guitar' />
            <TrackPill trackId='ukulele' label='Ukulele' />
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
            trackId='core'
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
            trackId='guitar'
            label='Guitar'
            isExpanded={false}
            onToggle={() => {}}
          >
            <div style={{ padding: '8px', color: 'var(--color-text-muted)' }}>
              Skills go here
            </div>
          </TrackSection>
        </Section>
        <Section title='All track colors' tabId={tabId}>
          <div>
            {(['core', 'reading', 'guitar', 'ukulele'] as const).map((id) => (
              <TrackSection
                key={id}
                trackId={id}
                label={id.charAt(0).toUpperCase() + id.slice(1)}
                isExpanded={false}
                onToggle={() => {}}
              >
                {''}
              </TrackSection>
            ))}
          </div>
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

function TypographySection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Typography</h2>
      <PreviewGrid>
        <Section title='Text roles' tabId={tabId}>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <Text role='section-header' as='div'>Section Header</Text>
            <Text role='subsection-header' as='div'>Subsection Header</Text>
            <Text role='label' as='div'>Label</Text>
            <div>Body text (default — no Text component needed)</div>
            <Text role='secondary' as='div'>Secondary text</Text>
            <Text role='caption' as='div'>Caption text</Text>
            <Text role='metric' as='div'>42.5s</Text>
          </div>
        </Section>
        <Section title='Text roles — in context (metric display)' tabId={tabId}>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
          >
            <Text role='subsection-header' as='div'>Speed check</Text>
            <div
              style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}
            >
              <Text role='label'>Response time</Text>
              <Text role='metric'>0.5s</Text>
            </div>
            <Text role='caption' as='div'>
              Timing thresholds are based on this measurement.
            </Text>
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

const SPACE_TOKENS: Array<{ name: string; desc: string }> = [
  { name: '--space-1', desc: 'Toggle gaps, pixel-level' },
  { name: '--space-2', desc: 'Button grid gaps, tight padding' },
  { name: '--space-3', desc: 'Standard gap, small padding' },
  { name: '--space-4', desc: 'Section gaps, nav padding' },
  { name: '--space-5', desc: 'Body padding, section spacing' },
  { name: '--space-6', desc: 'Large section gaps' },
];

function SpacingSection({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Spacing Scale</h2>
      <PreviewGrid>
        <Section title='Spacing tokens' tabId={tabId}>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
          >
            {SPACE_TOKENS.map(({ name, desc }) => {
              const val = cssVar(name);
              const px = parseFloat(val) * 16;
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
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
                  <div
                    style={{
                      height: '14px',
                      width: `${Math.max(px * 3, 4)}px`,
                      background: 'var(--color-brand)',
                      opacity: 0.65,
                      borderRadius: '2px',
                    }}
                  />
                  <Text role='caption'>{desc}</Text>
                </div>
              );
            })}
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

const TYPE_TOKENS: Array<{ name: string; usage: string }> = [
  { name: '--text-xs', usage: 'Legend labels, tiny annotations' },
  { name: '--text-sm', usage: 'Session stats, settings, table text' },
  { name: '--text-base', usage: 'Body, buttons, nav items' },
  { name: '--text-md', usage: 'Answer buttons, note buttons' },
  { name: '--text-lg', usage: 'Mode title, answer count' },
  { name: '--text-xl', usage: 'Feedback, close buttons' },
  { name: '--text-2xl', usage: 'Home title, quiz prompts' },
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
                  <Text role='caption' as='span' style={{ marginLeft: 'auto' }}>
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
            <Text role='caption' as='span'>{cssVar(name)}</Text>
            <Text
              role='caption'
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
            <Text role='caption'>Flat</Text>
          </div>
          <Text role='caption'>Cards, tables</Text>
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
            <Text role='caption'>Low</Text>
          </div>
          <Text role='caption'>CTA button</Text>
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
            <Text role='caption'>High</Text>
          </div>
          <Text role='caption'>Modal, drawer</Text>
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
      <ActionButtonsSection tabId={tabId} />
      <TypographySection tabId={tabId} />
      <SpacingSection tabId={tabId} />
      <TypeScaleSection tabId={tabId} />
      <RadiusShadowSection tabId={tabId} />
    </div>
  );
}
