// Structural components: Preact equivalents of the mode screen scaffold
// from html-helpers.ts modeScreen(). Compose leaf components into full
// mode screen layouts with phase management, tabs, and quiz sessions.

import type { ComponentChildren } from 'preact';

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
// TabbedIdle — practice/progress tab switching
// ---------------------------------------------------------------------------

export function TabbedIdle(
  { activeTab, onTabSwitch, practiceContent, progressContent }: {
    activeTab: 'practice' | 'progress';
    onTabSwitch: (tab: 'practice' | 'progress') => void;
    practiceContent: ComponentChildren;
    progressContent: ComponentChildren;
  },
) {
  return (
    <>
      <div class='mode-tabs'>
        <button
          type='button'
          class={'mode-tab' + (activeTab === 'practice' ? ' active' : '')}
          data-tab='practice'
          onClick={() => onTabSwitch('practice')}
        >
          Practice
        </button>
        <button
          type='button'
          class={'mode-tab' + (activeTab === 'progress' ? ' active' : '')}
          data-tab='progress'
          onClick={() => onTabSwitch('progress')}
        >
          Progress
        </button>
      </div>
      <div
        class={'tab-content tab-practice' +
          (activeTab === 'practice' ? ' active' : '')}
      >
        {practiceContent}
      </div>
      <div
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
  {
    statusLabel,
    statusDetail,
    recommendation,
    mastery,
    scope,
    sessionSummary,
    onStart,
    onApplyRecommendation,
  }: {
    statusLabel?: string;
    statusDetail?: string;
    recommendation?: string;
    mastery?: string;
    scope?: ComponentChildren;
    sessionSummary?: string;
    onStart?: () => void;
    onApplyRecommendation?: () => void;
  },
) {
  const recBlock = recommendation
    ? (
      <div class='practice-recommendation'>
        <span class='practice-rec-text'>{recommendation}</span>
        {onApplyRecommendation
          ? (
            <button
              type='button'
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
    ? <div class='mastery-message visible'>{mastery}</div>
    : null;

  // When scope toggles exist, recommendation + mastery go in scope zone;
  // otherwise they appear inline in the status zone.
  const statusExtra = !scope ? <>{recBlock}{masteryBlock}</> : null;
  const scopeZone = scope
    ? (
      <div class='practice-zone practice-zone-scope'>
        {recBlock}
        <div class='practice-scope'>
          <div class='settings-row'>
            {scope}
          </div>
        </div>
        {masteryBlock}
      </div>
    )
    : null;

  return (
    <div class='practice-card'>
      <div class='practice-zone practice-zone-status'>
        <div class='practice-status'>
          <span class='practice-status-label'>{statusLabel || ''}</span>
          <span class='practice-status-detail'>{statusDetail || ''}</span>
        </div>
        {statusExtra}
      </div>
      {scopeZone}
      <div class='practice-zone practice-zone-action'>
        <StartButton summary={sessionSummary} onStart={onStart} />
      </div>
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
          <button type='button' class='practice-rec-btn' onClick={onApply}>
            Use suggestion
          </button>
        )
        : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StartButton — start button + session summary
// ---------------------------------------------------------------------------

export function StartButton(
  { summary, onStart }: { summary?: string; onStart?: () => void },
) {
  return (
    <>
      {summary ? <div class='session-summary-text'>{summary}</div> : null}
      <button type='button' class='start-btn' onClick={onStart}>
        Start Quiz
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// QuizSession — countdown, session info, close button, progress bar
// ---------------------------------------------------------------------------

export function QuizSession(
  {
    timeLeft,
    context,
    count,
    fluent,
    total,
    isWarning,
    isLastQuestion,
    onClose,
  }: {
    timeLeft?: string;
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
          <div class='quiz-countdown-fill' />
        </div>
        <span class='quiz-info-time'>{timeLeft || ''}</span>
      </div>
      <SessionInfo context={context} count={count} />
      <button
        type='button'
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
      <div class='quiz-prompt-row'>
        <div class='quiz-prompt'>{prompt || ''}</div>
        <div class='quiz-last-question'>{lastQuestion || ''}</div>
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
      <div class='round-complete-context'>{context || ''}</div>
      <div class='round-complete-heading'>{heading || ''}</div>
      <div class='round-complete-stats'>
        <div class='round-stat-line round-stat-correct'>{correct || ''}</div>
        <div class='round-stat-line round-stat-median'>{median || ''}</div>
      </div>
      <div class='round-complete-actions'>
        <button
          type='button'
          class='round-complete-continue'
          onClick={onContinue}
        >
          Keep Going
        </button>
        <button type='button' class='round-complete-stop' onClick={onStop}>
          Stop
        </button>
      </div>
    </div>
  );
}
