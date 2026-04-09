// Practice screen components for the skill screen redesign.
// New components: SkillHeader, SuggestionLines, LevelToggles,
// LevelProgressCard, PracticeConfig.

import type { ComponentChildren } from 'preact';
import type { SuggestionLine } from '../types.ts';
import { SkillIcon } from './icons.tsx';
import { CloseButton } from './mode-screen.tsx';
import { Pill } from './pill.tsx';
import { RepeatMark } from './repeat-mark.tsx';
import { ProgressBarLabeled } from './scope.tsx';
import { SegmentedControl } from './segmented-control.tsx';
import { Text } from './text.tsx';

// Re-export so existing consumers can import from here.
export type { SuggestionLine } from '../types.ts';
export { ProgressBarLabeled };

// ---------------------------------------------------------------------------
// SkillHeader — title + close + progress bar (replaces ModeTopBar for idle)
// ---------------------------------------------------------------------------

export function SkillHeader(
  { modeId, title, totalReps, progressColors, onBack }: {
    modeId?: string;
    title: string;
    totalReps?: number;
    progressColors?: string[];
    onBack?: () => void;
  },
) {
  return (
    <div class='skill-header'>
      <div class='skill-header-row'>
        {onBack && <CloseButton ariaLabel='Back to home' onClick={onBack} />}
        <div class='skill-header-title'>
          {modeId && <SkillIcon modeId={modeId} />}
          <Text role='heading-page' as='h1' class='mode-title'>{title}</Text>
        </div>
        {totalReps != null && (
          <span class='skill-header-reps'>
            {totalReps.toLocaleString()}
            <RepeatMark size={18} class='skill-header-reps-icon' />
          </span>
        )}
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
  { labels, groupIds, active, onToggle }: {
    labels: string[];
    groupIds: string[];
    active: ReadonlySet<string>;
    onToggle: (id: string) => void;
  },
) {
  return (
    <div class='level-toggles-section'>
      <Text role='heading-subsection' as='div' class='level-toggles-header'>
        Choose levels
      </Text>
      <div class='level-toggles'>
        {labels.map((label, i) => {
          const id = groupIds[i];
          return (
            <button
              type='button'
              tabIndex={0}
              key={id}
              class={'level-toggle-btn' + (active.has(id) ? ' active' : '')}
              aria-pressed={active.has(id)}
              onClick={() => onToggle(id)}
            >
              {label}
            </button>
          );
        })}
      </div>
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
      {pill && (
        <div class='level-progress-pill-row'>
          <Pill variant='notice'>{pill}</Pill>
        </div>
      )}
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
      <Text role='heading-section' as='div' class='practice-config-label'>
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
