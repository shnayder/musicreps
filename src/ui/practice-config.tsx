// Practice screen components for the skill screen redesign.
// New components: SkillHeader, SuggestionLines, LevelToggles,
// LevelProgressCard, PracticeConfig.

import type { ComponentChildren } from 'preact';
import type { SuggestionLine } from '../types.ts';
import { SkillIcon } from './icons.tsx';
import { CloseButton } from './mode-screen.tsx';
import { GroupProgressBar } from './scope.tsx';
import { SegmentedControl } from './segmented-control.tsx';
import { Text } from './text.tsx';

// Re-export so existing consumers can import from here.
export type { SuggestionLine } from '../types.ts';

// ---------------------------------------------------------------------------
// ProgressBarLabeled — labeled progress bar with border, for skill header
// and level progress cards. Distinct from the bare GroupProgressBar used
// on home screen cards.
// ---------------------------------------------------------------------------

export function ProgressBarLabeled(
  { label, colors, disabled }: {
    label?: string;
    colors: string[];
    disabled?: boolean;
  },
) {
  return (
    <div class='progress-bar-labeled'>
      {label && (
        <Text role='caption' as='div' class='progress-bar-label'>{label}</Text>
      )}
      <GroupProgressBar colors={colors} disabled={disabled} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillHeader — title + close + progress bar (replaces ModeTopBar for idle)
// ---------------------------------------------------------------------------

export function SkillHeader(
  { modeId, title, progressColors, onBack }: {
    modeId?: string;
    title: string;
    progressColors?: string[];
    onBack?: () => void;
  },
) {
  return (
    <div class='skill-header'>
      <div class='skill-header-row'>
        {modeId && <SkillIcon modeId={modeId} />}
        <h1 class='mode-title'>{title}</h1>
        {onBack && <CloseButton ariaLabel='Back to home' onClick={onBack} />}
      </div>
      {progressColors && progressColors.length > 0 && (
        <div class='skill-header-progress'>
          <ProgressBarLabeled label='Progress' colors={progressColors} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuggestionLines — renders structured recommendations as separate lines
// ---------------------------------------------------------------------------

// SuggestionLine type is defined in types.ts and re-exported above.

export function SuggestionLines(
  { lines }: { lines: SuggestionLine[] },
) {
  if (lines.length === 0) return null;
  return (
    <div class='suggestion-lines'>
      {lines.map((line, i) => (
        <div key={i} class='suggestion-line'>
          <span class='suggestion-verb'>{line.verb}</span>{' '}
          {line.levels.join(', ')}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LevelToggles — on/off buttons for each level (no progress bars)
// ---------------------------------------------------------------------------

export function LevelToggles(
  { labels, active, onToggle, itemCount }: {
    labels: string[];
    active: ReadonlySet<number>;
    onToggle: (index: number) => void;
    itemCount: number;
  },
) {
  return (
    <div class='level-toggles-section'>
      <Text role='secondary' as='div' class='level-toggles-header'>
        Choose levels to practice
      </Text>
      <div class='level-toggles'>
        {labels.map((label, i) => (
          <button
            type='button'
            tabIndex={0}
            key={i}
            class={'level-toggle-btn' + (active.has(i) ? ' active' : '')}
            aria-pressed={active.has(i)}
            onClick={() => onToggle(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <Text role='secondary' as='div' class='level-toggles-count'>
        {itemCount} {itemCount === 1 ? 'item' : 'items'} selected
      </Text>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LevelProgressCard — per-level card with label, pill, bar, check/x
// ---------------------------------------------------------------------------

export type LevelCardStatus = 'normal' | 'known' | 'skipped';

export function LevelProgressCard(
  { label, pill, colors, status, onToggleKnown, onToggleSkip }: {
    label: string;
    pill?: string;
    colors: string[];
    status?: LevelCardStatus;
    onToggleKnown?: () => void;
    onToggleSkip?: () => void;
  },
) {
  const st = status ?? 'normal';
  return (
    <div class={'level-progress-card' + (st !== 'normal' ? ' ' + st : '')}>
      <div class='level-progress-header'>
        <span class='level-progress-label'>{label}</span>
        {pill && <span class='level-progress-pill'>{pill}</span>}
        {(onToggleKnown || onToggleSkip) && (
          <span class='level-progress-actions'>
            <button
              type='button'
              class={'level-action-btn known' +
                (st === 'known' ? ' active' : '')}
              aria-label={`Mark ${label} as known`}
              aria-pressed={st === 'known'}
              onClick={onToggleKnown}
            >
              {'\u2713'}
            </button>
            <button
              type='button'
              class={'level-action-btn skip' +
                (st === 'skipped' ? ' active' : '')}
              aria-label={`Skip ${label}`}
              aria-pressed={st === 'skipped'}
              onClick={onToggleSkip}
            >
              {'\u2717'}
            </button>
          </span>
        )}
      </div>
      <ProgressBarLabeled colors={colors} disabled={st === 'skipped'} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PracticeConfig — suggested/custom toggle + mode-specific content
// ---------------------------------------------------------------------------

export type PracticeMode = 'suggested' | 'custom';

export function PracticeConfig(
  { mode, onModeChange, suggestedContent, customContent }: {
    mode: PracticeMode;
    onModeChange: (mode: PracticeMode) => void;
    suggestedContent: ComponentChildren;
    customContent: ComponentChildren;
  },
) {
  return (
    <div class='practice-config'>
      <Text role='label' as='div' class='practice-config-label'>
        Practice setup
      </Text>
      <SegmentedControl
        options={[
          { value: 'suggested' as PracticeMode, label: 'Suggested' },
          { value: 'custom' as PracticeMode, label: 'Custom' },
        ]}
        value={mode}
        onChange={onModeChange}
      />
      <div class='practice-config-content'>
        {mode === 'suggested' ? suggestedContent : customContent}
      </div>
    </div>
  );
}
