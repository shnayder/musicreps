// Practice screen components for the skill screen redesign.
// New components: SkillHeader, SuggestionLines, LevelToggles,
// LevelProgressCard, PracticeConfig.

import type { ComponentChildren } from 'preact';
import type { SuggestionLine } from '../types.ts';
import { SkillIcon } from './icons.tsx';
import { Card, Stack } from './layout.tsx';
import { ScreenHeader } from './mode-screen.tsx';
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
  { modeId, title, totalReps, onBack }: {
    modeId?: string;
    title: string;
    totalReps?: number;
    onBack?: () => void;
  },
) {
  return (
    <ScreenHeader
      title={title}
      icon={modeId && <SkillIcon modeId={modeId} />}
      onClose={onBack}
      closeAriaLabel='Back to home'
      right={totalReps != null
        ? (
          <Text role='metric-header' as='span' class='skill-header-reps'>
            {totalReps.toLocaleString()}
            <RepeatMark size={18} class='skill-header-reps-icon' />
          </Text>
        )
        : undefined}
    />
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
    <Card variant='well' class='level-toggles-section'>
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
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LevelProgressCard — per-level card with label, pill, bar, check/x
// ---------------------------------------------------------------------------

export type LevelCardStatus = 'normal' | 'known' | 'skipped';

export function LevelProgressCard(
  {
    label,
    statusLabel,
    statusColor,
    pill,
    colors,
    status,
    baseline,
    onToggleKnown,
    onToggleSkip,
  }: {
    label: string;
    statusLabel?: string;
    /** Heatmap color for the status swatch dot. */
    statusColor?: string;
    pill?: string;
    colors: string[];
    status?: LevelCardStatus;
    /** Motor baseline in ms (null = default). Used in legend modal. */
    baseline?: number | null;
    onToggleKnown?: () => void;
    onToggleSkip?: () => void;
  },
) {
  const st = status ?? 'normal';
  return (
    <Card
      padding='compact'
      class={'level-progress-card' + (st !== 'normal' ? ' ' + st : '')}
    >
      <Stack gap='related'>
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
        {statusLabel && (
          <span class='level-progress-status'>
            {statusColor && (
              <span
                class='level-status-swatch'
                style={`background-color: var(${statusColor})`}
              />
            )}
            {statusLabel}
          </span>
        )}
        {pill && (
          <div class='level-progress-pill-row'>
            <Pill variant='notice'>{pill}</Pill>
          </div>
        )}
        <ProgressBarLabeled
          segments={colors.map((c) => ({ color: c, weight: 1 }))}
          disabled={st === 'skipped'}
          baseline={baseline}
        />
      </Stack>
    </Card>
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
    <Stack gap='group' class='practice-config'>
      <Text role='heading-section'>
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
      {mode === 'suggested' ? suggestedContent : customContent}
    </Stack>
  );
}
