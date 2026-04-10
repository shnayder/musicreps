// Structural components for mode screen layouts: phase management, tabs,
// quiz sessions, and round-complete overlays.

import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { SkillIcon } from './icons.tsx';
import { RepeatMark } from './repeat-mark.tsx';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';
import { Bar } from './layout.tsx';
import { LayoutFooter, LayoutMain } from './screen-layout.tsx';
import { ProgressBarLabeled } from './scope.tsx';

// ---------------------------------------------------------------------------
// CloseButton — × dismiss button used in top bars and overlays
// ---------------------------------------------------------------------------

export function CloseButton(
  { onClick, ariaLabel }: {
    onClick?: () => void;
    ariaLabel: string;
  },
) {
  return (
    <button
      type='button'
      class='close-btn'
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {'\u00D7'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tabs — accessible tablist + panels (WAI-ARIA Tabs pattern)
// ---------------------------------------------------------------------------

export type TabDef<T extends string = string> = {
  id: T;
  label: ComponentChildren;
  content: ComponentChildren;
};

// ---------------------------------------------------------------------------
// TabBar + TabPanels — split rendering for layout flexibility.
// TabBar goes in footer (mobile) or header (desktop); panels go in main.
// ---------------------------------------------------------------------------

export type TabsPrefix = string;

let tabsPrefixCounter = 0;

/** Generate a stable prefix for tab ARIA IDs. Call once per component. */
export function useTabsPrefix(): TabsPrefix {
  return useMemo(() => 'tabs-' + tabsPrefixCounter++, []);
}

/** Tab bar (the row of tab buttons). Place in footer or header. */
export function TabBar<T extends string>(
  { tabs, activeTab, onTabSwitch, prefix, class: className = 'tabs' }: {
    tabs: TabDef<T>[];
    activeTab: T;
    onTabSwitch: (tab: T) => void;
    prefix: TabsPrefix;
    class?: string;
  },
) {
  function handleKeyDown(e: KeyboardEvent, current: T) {
    const ids = tabs.map((t) => t.id);
    const idx = ids.indexOf(current);
    let nextIdx = idx;
    if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === 'ArrowRight') nextIdx = (idx + 1) % ids.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = ids.length - 1;
    else return;
    e.preventDefault();
    const nextId = ids[nextIdx];
    onTabSwitch(nextId);
    requestAnimationFrame(() => {
      (document.getElementById(
        prefix + '-tab-' + nextId,
      ) as HTMLElement | null)?.focus();
    });
  }

  return (
    <div class={className} role='tablist'>
      {tabs.map((tab) => (
        <button
          type='button'
          key={tab.id}
          id={prefix + '-tab-' + tab.id}
          role='tab'
          aria-selected={activeTab === tab.id}
          aria-controls={prefix + '-panel-' + tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          class={'tab-btn' + (activeTab === tab.id ? ' active' : '')}
          data-tab={tab.id}
          onClick={() => onTabSwitch(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Tab panels (the content areas). Place in main content zone. */
export function TabPanels<T extends string>(
  { tabs, activeTab, prefix }: {
    tabs: TabDef<T>[];
    activeTab: T;
    prefix: TabsPrefix;
  },
) {
  return (
    <>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={prefix + '-panel-' + tab.id}
          role='tabpanel'
          aria-labelledby={prefix + '-tab-' + tab.id}
          class={'tab-panel' + (activeTab === tab.id ? ' active' : '')}
        >
          {tab.content}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tabs — composed TabBar + TabPanels (backward-compatible, renders together)
// ---------------------------------------------------------------------------

export function Tabs<T extends string>(
  { tabs, activeTab, onTabSwitch, class: className = 'tabs' }: {
    tabs: TabDef<T>[];
    activeTab: T;
    onTabSwitch: (tab: T) => void;
    class?: string;
  },
) {
  const prefix = useTabsPrefix();
  return (
    <>
      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabSwitch={onTabSwitch}
        prefix={prefix}
        class={className}
      />
      <TabPanels tabs={tabs} activeTab={activeTab} prefix={prefix} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase type
// ---------------------------------------------------------------------------

export type Phase = 'idle' | 'active' | 'calibration' | 'round-complete';

// ---------------------------------------------------------------------------
// ModeScreen — top-level wrapper with phase class
// ---------------------------------------------------------------------------

export function ModeScreen(
  { id, phase, children }: {
    id: string;
    phase: Phase;
    children: ComponentChildren;
  },
) {
  return (
    <div class={`mode-screen phase-${phase}`} id={`mode-${id}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModeTopBar — close button + mode title + description
// ---------------------------------------------------------------------------

export function ModeTopBar(
  { modeId, title, description, onBack, showBack = true }: {
    modeId?: string;
    title: string;
    description?: string;
    onBack?: () => void;
    showBack?: boolean;
  },
) {
  return (
    <div class='mode-top-bar'>
      <div class='mode-top-bar-row'>
        {showBack && (
          <CloseButton
            ariaLabel='Back to home'
            onClick={onBack}
          />
        )}
        {modeId && <SkillIcon modeId={modeId} />}
        <div class='mode-top-bar-text'>
          <Text role='heading-page' as='h1' class='mode-title'>{title}</Text>
          {description && (
            <Text role='body-secondary' as='p' class='mode-description'>
              {description}
            </Text>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModeTab — tab IDs for mode screens
// ---------------------------------------------------------------------------

export type ModeTab = 'practice' | 'progress' | 'about';

// ---------------------------------------------------------------------------
// StartButton — quiz start button
// ---------------------------------------------------------------------------

export function StartButton(
  { onStart, disabled, validationMessage, label }: {
    onStart?: () => void;
    disabled?: boolean;
    validationMessage?: string;
    label?: string;
  },
) {
  const msgId = validationMessage ? 'start-validation-msg' : undefined;
  return (
    <>
      <ActionButton
        variant='primary'
        class='start-btn'
        onClick={onStart ?? noop}
        disabled={disabled}
        aria-describedby={msgId}
      >
        {label ?? 'Practice'}
      </ActionButton>
      {validationMessage
        ? (
          <div id={msgId} class='start-validation-message'>
            {validationMessage}
          </div>
        )
        : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// QuizSession — countdown, session info, close button
// ---------------------------------------------------------------------------

export function QuizSession(
  {
    timeLeft,
    timerPct,
    count,
    isWarning,
    isLastQuestion,
    onClose,
  }: {
    timeLeft?: string;
    timerPct?: number;
    count?: string;
    isWarning?: boolean;
    isLastQuestion?: boolean;
    onClose?: () => void;
  },
) {
  return (
    <div class='quiz-session'>
      <Bar gap='component' class='quiz-session-header'>
        <CloseButton
          ariaLabel='Stop quiz'
          onClick={onClose}
        />
        <Bar gap='related' class='quiz-countdown-group'>
          <div
            class={'quiz-countdown-bar' +
              (isWarning ? ' round-timer-warning' : '') +
              (isLastQuestion ? ' last-question' : '')}
          >
            <div
              class='quiz-countdown-fill'
              style={{ width: `${timerPct ?? 100}%` }}
            />
          </div>
          <Text role='metric-info' as='span' class='quiz-info-time'>
            {timeLeft || ''}
          </Text>
        </Bar>
        {count && (
          <Text role='metric-effort' as='span' class='quiz-info-count'>
            {count}
            <RepeatMark size={13} class='quiz-info-count-icon' />
          </Text>
        )}
      </Bar>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuizArea — two-zone layout: content (what app presents) + controls (user
// responds with). When `controls` is provided, QuizArea renders both zones.
// When omitted, children render directly (e.g. SpeedCheck manages its own).
// ---------------------------------------------------------------------------

export function QuizArea(
  { prompt, controls, children }: {
    prompt?: string;
    controls?: ComponentChildren;
    children?: ComponentChildren;
  },
) {
  if (controls !== undefined) {
    return (
      <div class='quiz-area'>
        <div class='quiz-content'>
          {prompt && (
            <div class='quiz-prompt-row'>
              <Text role='quiz-prompt' as='div' class='quiz-prompt'>
                {prompt}
              </Text>
            </div>
          )}
          {children}
        </div>
        <div class='quiz-controls'>{controls}</div>
      </div>
    );
  }
  return <div class='quiz-area'>{children}</div>;
}

// ---------------------------------------------------------------------------
// RoundCompleteInfo — round-complete content (heading, stats, overall context).
// Rendered in .quiz-content zone.
// ---------------------------------------------------------------------------

/** Per-level progress entry: label + color array for one level. */
export type LevelProgressEntry = {
  id: string;
  label: string;
  colors: string[];
};

export function RoundCompleteInfo(
  { heading, count, correct, levelBars }: {
    heading?: string;
    count?: number;
    correct?: string;
    levelBars?: LevelProgressEntry[];
  },
) {
  return (
    <div class='round-complete'>
      <Text role='heading-page' as='div' class='round-complete-heading'>
        {heading || ''}
      </Text>
      {count != null && (
        <>
          <Text role='metric-hero' as='div' class='round-complete-count'>
            {count}
          </Text>
          <Text
            role='body-secondary'
            as='div'
            class='round-complete-count-label'
          >
            {count === 1 ? 'rep' : 'reps'}
          </Text>
        </>
      )}
      <div class='round-complete-stats'>
        <Text role='status' as='div' class='round-stat-correct'>
          {correct || ''}
        </Text>
      </div>
      {levelBars && levelBars.length > 0 && (
        <div class='round-complete-progress'>
          {levelBars.map((entry) => (
            <ProgressBarLabeled
              key={entry.id}
              label={entry.label}
              colors={entry.colors}
              plain
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoundCompleteActions — round-complete controls (keep going / stop).
// Rendered in .quiz-controls zone.
// ---------------------------------------------------------------------------

const noop = () => {};

export function RoundCompleteActions(
  { onContinue, onStop }: {
    onContinue?: () => void;
    onStop?: () => void;
  },
) {
  return (
    <>
      <div class='page-action-row'>
        <ActionButton variant='primary' onClick={onContinue ?? noop}>
          Keep Going
        </ActionButton>
        <ActionButton variant='secondary' onClick={onStop ?? noop}>
          Stop
        </ActionButton>
      </div>
      <div class='hint hint-spacer'>&nbsp;</div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TabIcon — icon + label for mode navigation tabs
// ---------------------------------------------------------------------------

const TAB_ICONS: Record<string, string> = {
  // Bar chart
  progress: '<line x1="18" x2="18" y1="20" y2="10"/>' +
    '<line x1="12" x2="12" y1="20" y2="4"/>' +
    '<line x1="6" x2="6" y1="20" y2="14"/>',
  // Info circle
  about: '<circle cx="12" cy="12" r="10"/>' +
    '<path d="M12 16v-4"/><path d="M12 8h.01"/>',
  // Star — filled star for Active skills tab
  'active-skills':
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  // List — bulleted list for All Skills tab
  'all-skills': '<line x1="8" x2="21" y1="6" y2="6"/>' +
    '<line x1="8" x2="21" y1="12" y2="12"/>' +
    '<line x1="8" x2="21" y1="18" y2="18"/>' +
    '<line x1="3" x2="3.01" y1="6" y2="6"/>' +
    '<line x1="3" x2="3.01" y1="12" y2="12"/>' +
    '<line x1="3" x2="3.01" y1="18" y2="18"/>',
  // Gear — settings cog
  settings: '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

export function TabIcon({ icon, text }: { icon: string; text: string }) {
  const paths = TAB_ICONS[icon] ?? '';
  return (
    <span class='tab-icon-label'>
      <svg
        xmlns='http://www.w3.org/2000/svg'
        width='24'
        height='24'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        stroke-width='2'
        stroke-linecap='round'
        stroke-linejoin='round'
        aria-hidden='true'
        // deno-lint-ignore react-no-danger
        dangerouslySetInnerHTML={{ __html: paths }}
      />
      <span class='tab-icon-text'>{text}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// BaselineInfo — progress tab inline component (moved from speed-check.tsx
// to avoid circular dependency)
// ---------------------------------------------------------------------------

function BaselineInfo(
  { baseline, onRun }: { baseline: number | null; onRun: () => void },
) {
  const value = baseline ? (baseline / 1000).toFixed(1) + 's' : '1s';
  const tag = baseline
    ? null
    : <Text role='supporting' class='baseline-default-tag'>(default)</Text>;
  const btnLabel = baseline ? 'Redo speed check' : 'Run speed check';
  return (
    <div class='baseline-info'>
      <div class='baseline-metric'>
        <Text role='label'>Response time for note input</Text>
        <Text role='metric-primary'>
          {value}
          {tag && <>{' '}{tag}</>}
        </Text>
      </div>
      <Text role='supporting' as='div' class='baseline-explanation'>
        Timing thresholds are based on this measurement.
      </Text>
      <button
        type='button'
        tabIndex={0}
        class='baseline-rerun-btn'
        onClick={onRun}
      >
        {btnLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PracticeTab — composes Tabs + practice content
// ---------------------------------------------------------------------------

export function PracticeTab(
  {
    onStart,
    statsContent,
    statsHeading,
    onCalibrate,
    baseline,
    activeTab,
    onTabSwitch,
    scopeValid,
    validationMessage,
    aboutContent,
    practiceContent,
    progressExtra,
    startLabel,
  }: {
    onStart: () => void;
    statsContent: ComponentChildren;
    /** Heading rendered outside the centered stats container. */
    statsHeading?: ComponentChildren;
    onCalibrate?: () => void;
    baseline?: number | null;
    activeTab: ModeTab;
    onTabSwitch: (tab: ModeTab) => void;
    scopeValid?: boolean;
    validationMessage?: string;
    aboutContent?: ComponentChildren;
    practiceContent: ComponentChildren;
    /** Extra content inserted above baseline in the progress tab. */
    progressExtra?: ComponentChildren;
    /** Custom label for the start button (e.g. "Practice (32 items)"). */
    startLabel?: string;
  },
) {
  const prefix = useTabsPrefix();
  const tabs: TabDef<ModeTab>[] = [
    {
      id: 'practice',
      label: (
        <span class='tab-icon-label'>
          <RepeatMark size={24} />
          <span class='tab-icon-text'>Practice</span>
        </span>
      ),
      content: practiceContent,
    },
    {
      id: 'progress',
      label: <TabIcon icon='progress' text='Progress' />,
      content: (
        <div>
          {progressExtra && <div class='progress-section'>{progressExtra}</div>}
          <div class='progress-section'>
            {statsHeading}
            <div class='stats-container'>{statsContent}</div>
          </div>
          {onCalibrate && (
            <div class='progress-section'>
              <Text role='heading-section'>Speed check</Text>
              <BaselineInfo baseline={baseline ?? null} onRun={onCalibrate} />
            </div>
          )}
        </div>
      ),
    },
  ];
  if (aboutContent) {
    tabs.push({
      id: 'about',
      label: <TabIcon icon='about' text='Info' />,
      content: aboutContent,
    });
  }

  return (
    <>
      <LayoutMain>
        <TabPanels tabs={tabs} activeTab={activeTab} prefix={prefix} />
      </LayoutMain>
      <LayoutFooter>
        {activeTab === 'practice' && (
          <div class='practice-zone-action'>
            <StartButton
              onStart={onStart}
              disabled={scopeValid === false}
              validationMessage={scopeValid === false
                ? validationMessage
                : undefined}
              label={startLabel}
            />
          </div>
        )}
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabSwitch={onTabSwitch}
          prefix={prefix}
          class='mode-nav'
        />
      </LayoutFooter>
    </>
  );
}
