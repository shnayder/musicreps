// Structural components: Preact equivalents of the mode screen scaffold
// from html-helpers.ts modeScreen(). Compose leaf components into full
// mode screen layouts with phase management, tabs, and quiz sessions.

import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import type { PracticeSummaryState } from '../types.ts';
import { StatsToggle } from './stats.tsx';
import { BaselineInfo } from './speed-check.tsx';

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
// ModeTopBar — back button + mode title
// ---------------------------------------------------------------------------

export function ModeTopBar(
  { title, onBack }: { title: string; onBack?: () => void },
) {
  return (
    <div class='mode-top-bar'>
      <button
        type='button'
        tabIndex={0}
        class='mode-back-btn'
        aria-label='Back to home'
        onClick={onBack}
      >
        {'\u2190' /* ← back arrow */}
      </button>
      <h1 class='mode-title'>{title}</h1>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabbedIdle — practice/progress tab switching (WAI-ARIA Tabs pattern)
// ---------------------------------------------------------------------------

let tabbedIdCounter = 0;

const TABS = ['practice', 'progress'] as const;
const TAB_LABELS: Record<string, string> = {
  practice: 'Practice',
  progress: 'Progress',
};

export function TabbedIdle(
  { activeTab, onTabSwitch, practiceContent, progressContent }: {
    activeTab: 'practice' | 'progress';
    onTabSwitch: (tab: 'practice' | 'progress') => void;
    practiceContent: ComponentChildren;
    progressContent: ComponentChildren;
  },
) {
  const prefix = useMemo(() => 'tabs-' + tabbedIdCounter++, []);

  function handleTabKeyDown(
    e: KeyboardEvent,
    current: 'practice' | 'progress',
  ) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = current === 'practice' ? 'progress' : 'practice';
      onTabSwitch(next);
      requestAnimationFrame(() => {
        const container = (e.currentTarget as HTMLElement).parentElement;
        const nextBtn = container?.querySelector(
          '[data-tab="' + next + '"]',
        ) as HTMLElement | null;
        nextBtn?.focus();
      });
    }
  }

  return (
    <>
      <div class='mode-tabs' role='tablist'>
        {TABS.map((tab) => (
          <button
            type='button'
            key={tab}
            id={prefix + '-tab-' + tab}
            role='tab'
            aria-selected={activeTab === tab}
            aria-controls={prefix + '-panel-' + tab}
            tabIndex={activeTab === tab ? 0 : -1}
            class={'mode-tab' + (activeTab === tab ? ' active' : '')}
            data-tab={tab}
            onClick={() => onTabSwitch(tab)}
            onKeyDown={(e) => handleTabKeyDown(e, tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      <div
        id={prefix + '-panel-practice'}
        role='tabpanel'
        aria-labelledby={prefix + '-tab-practice'}
        class={'tab-content tab-practice' +
          (activeTab === 'practice' ? ' active' : '')}
      >
        {practiceContent}
      </div>
      <div
        id={prefix + '-panel-progress'}
        role='tabpanel'
        aria-labelledby={prefix + '-tab-progress'}
        class={'tab-content tab-progress' +
          (activeTab === 'progress' ? ' active' : '')}
      >
        {progressContent}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// PracticeCard — wraps practice zones (status, scope, action)
// ---------------------------------------------------------------------------

export function PracticeCard(
  props: {
    summary?: PracticeSummaryState;
    statusLabel?: string;
    statusDetail?: string;
    recommendation?: string;
    mastery?: string;
    scope?: ComponentChildren;
    onStart?: () => void;
    onApplyRecommendation?: () => void;
  },
) {
  // When summary is provided, map its fields; individual props override.
  const statusLabel = props.statusLabel ??
    (props.summary ? props.summary.statusLabel : undefined);
  const statusDetail = props.statusDetail ??
    (props.summary ? props.summary.statusDetail : undefined);
  const recommendation = props.recommendation ??
    (props.summary && props.summary.recommendationText
      ? props.summary.recommendationText
      : undefined);
  const mastery = props.mastery ??
    (props.summary && props.summary.showMastery
      ? props.summary.masteryText
      : undefined);
  const onApplyRecommendation = props.onApplyRecommendation;
  const { scope, onStart } = props;

  const recBlock = recommendation
    ? (
      <div class='practice-recommendation'>
        <span class='practice-rec-text'>{recommendation}</span>
        {onApplyRecommendation
          ? (
            <button
              type='button'
              tabIndex={0}
              class='practice-rec-btn'
              onClick={onApplyRecommendation}
            >
              Use suggestion
            </button>
          )
          : null}
      </div>
    )
    : null;

  const masteryBlock = mastery
    ? <div class='mastery-message mastery-visible'>{mastery}</div>
    : null;

  // Zone 2: "Quiz setup" — suggestion + scope controls + start button.
  // When neither scope controls nor a recommendation exist, show just the
  // start button (no header).
  const hasSetupContent = scope || recommendation;
  const setupZone = (
    <div class='practice-zone practice-zone-setup'>
      {hasSetupContent
        ? <div class='practice-section-header'>Quiz setup</div>
        : null}
      {recBlock}
      {scope
        ? (
          <div class='practice-scope'>
            <div class='settings-row'>
              {scope}
            </div>
          </div>
        )
        : null}
      <div class='practice-zone-action'>
        <StartButton onStart={onStart} />
      </div>
    </div>
  );

  return (
    <div class='practice-card'>
      <div class='practice-zone practice-zone-mastery'>
        <div class='practice-section-header'>Mastery</div>
        <div class='practice-status'>
          <span class='practice-status-label'>{statusLabel || ''}</span>
        </div>
        <span class='practice-status-detail'>{statusDetail || ''}</span>
        {masteryBlock}
      </div>
      {setupZone}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommendation — standalone recommendation text + button
// ---------------------------------------------------------------------------

export function Recommendation(
  { text, onApply }: { text: string; onApply?: () => void },
) {
  return (
    <div class='practice-recommendation'>
      <span class='practice-rec-text'>{text}</span>
      {onApply
        ? (
          <button
            type='button'
            tabIndex={0}
            class='practice-rec-btn'
            onClick={onApply}
          >
            Use suggestion
          </button>
        )
        : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StartButton — quiz start button
// ---------------------------------------------------------------------------

export function StartButton(
  { onStart }: { onStart?: () => void },
) {
  return (
    <button type='button' tabIndex={0} class='start-btn' onClick={onStart}>
      Start Quiz
    </button>
  );
}

// ---------------------------------------------------------------------------
// QuizSession — countdown, session info, close button, progress bar
// ---------------------------------------------------------------------------

export function QuizSession(
  {
    timeLeft,
    timerPct,
    context,
    count,
    fluent,
    total,
    isWarning,
    isLastQuestion,
    onClose,
  }: {
    timeLeft?: string;
    timerPct?: number;
    context?: string;
    count?: string;
    fluent?: number;
    total?: number;
    isWarning?: boolean;
    isLastQuestion?: boolean;
    onClose?: () => void;
  },
) {
  const pct = total ? Math.round((fluent || 0) / total * 100) : 0;
  return (
    <div class='quiz-session'>
      <div class='quiz-countdown-row'>
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
        <span class='quiz-info-time'>{timeLeft || ''}</span>
      </div>
      <SessionInfo context={context} count={count} />
      <button
        type='button'
        tabIndex={0}
        class='quiz-header-close'
        aria-label='Stop quiz'
        onClick={onClose}
      >
        {'\u00D7' /* × close button */}
      </button>
      <div class='progress-bar'>
        <div class='progress-fill' style={{ width: `${pct}%` }} />
        <div class='progress-text'>
          {fluent != null && total != null ? `${fluent} / ${total} fluent` : ''}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionInfo — quiz info context + count display
// ---------------------------------------------------------------------------

export function SessionInfo(
  { context, count }: { context?: string; count?: string },
) {
  return (
    <div class='quiz-session-info'>
      <span class='quiz-info-context'>{context || ''}</span>
      <span class='quiz-info-count'>{count || ''}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuizArea — prompt + content + feedback + round-complete wrapper
// ---------------------------------------------------------------------------

export function QuizArea(
  { prompt, lastQuestion, children }: {
    prompt?: string;
    lastQuestion?: string;
    children: ComponentChildren;
  },
) {
  return (
    <div class='quiz-area'>
      <div class='quiz-last-question'>{lastQuestion || ''}</div>
      <div class='quiz-prompt-row'>
        <div class='quiz-prompt'>{prompt || ''}</div>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoundComplete — round-complete display
// ---------------------------------------------------------------------------

export function RoundComplete(
  { context, heading, correct, median, onContinue, onStop }: {
    context?: string;
    heading?: string;
    correct?: string;
    median?: string;
    onContinue?: () => void;
    onStop?: () => void;
  },
) {
  return (
    <div class='round-complete'>
      <div class='round-complete-heading'>{heading || ''}</div>
      <div class='round-complete-stats'>
        <div class='round-stat-line round-stat-correct'>{correct || ''}</div>
        <div class='round-stat-line round-stat-median'>{median || ''}</div>
      </div>
      {context
        ? (
          <div class='round-complete-overall'>
            <div class='round-complete-overall-label'>Overall</div>
            <div class='round-complete-context'>{context}</div>
          </div>
        )
        : null}
      <div class='round-complete-actions'>
        <button
          type='button'
          tabIndex={0}
          class='round-complete-continue'
          onClick={onContinue}
        >
          Keep Going
        </button>
        <button
          type='button'
          tabIndex={0}
          class='round-complete-stop'
          onClick={onStop}
        >
          Stop
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PracticeTab — composes TabbedIdle + PracticeCard + progress wrapper
// ---------------------------------------------------------------------------

export function PracticeTab(
  {
    summary,
    onStart,
    onApplyRecommendation,
    scope,
    statsContent,
    statsMode,
    onStatsToggle,
    baseline,
    onCalibrate,
    activeTab,
    onTabSwitch,
  }: {
    summary: PracticeSummaryState;
    onStart: () => void;
    onApplyRecommendation?: () => void;
    scope?: ComponentChildren;
    statsContent: ComponentChildren;
    statsMode: string;
    onStatsToggle: (mode: string) => void;
    baseline: number | null;
    onCalibrate: () => void;
    activeTab: 'practice' | 'progress';
    onTabSwitch: (tab: 'practice' | 'progress') => void;
  },
) {
  return (
    <TabbedIdle
      activeTab={activeTab}
      onTabSwitch={onTabSwitch}
      practiceContent={
        <PracticeCard
          summary={summary}
          onStart={onStart}
          onApplyRecommendation={onApplyRecommendation}
          scope={scope}
        />
      }
      progressContent={
        <div>
          <div class='stats-controls'>
            <StatsToggle active={statsMode} onToggle={onStatsToggle} />
          </div>
          <div class='stats-container'>
            {statsContent}
          </div>
          <BaselineInfo
            baseline={baseline}
            onRun={onCalibrate}
          />
        </div>
      }
    />
  );
}
