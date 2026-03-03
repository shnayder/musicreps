// Structural components: Preact equivalents of the mode screen scaffold
// from html-helpers.ts modeScreen(). Compose leaf components into full
// mode screen layouts with phase management, tabs, and quiz sessions.

import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { FixtureDetail } from '../fixtures/quiz-page.ts';
import type { PracticeSummaryState } from '../types.ts';
import { BaselineInfo } from './speed-check.tsx';

const FIXTURES_ENABLED = typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('fixtures');

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
// ModeTopBar — back button + mode title + expandable detail
// ---------------------------------------------------------------------------

export function ModeTopBar(
  { title, description, detail, onBack, showBack = true, _previewOpen }: {
    title: string;
    description?: string;
    detail?: string;
    onBack?: () => void;
    showBack?: boolean;
    /** Force detail open state for component previews. */
    _previewOpen?: boolean;
  },
) {
  const [detailOpen, setDetailOpen] = useState(_previewOpen ?? false);
  const ref = useRef<HTMLDivElement>(null);

  // Listen for __fixture__ events to control detail open state in screenshots.
  useEffect(() => {
    if (!FIXTURES_ENABLED || !ref.current) return;
    const container = ref.current.closest('.mode-screen');
    if (!container) return;
    function handleFixture(e: Event) {
      const d = (e as CustomEvent<FixtureDetail>).detail;
      if (d?.skillAboutOpen !== undefined) setDetailOpen(d.skillAboutOpen);
    }
    container.addEventListener('__fixture__', handleFixture);
    return () => container.removeEventListener('__fixture__', handleFixture);
  }, []);

  return (
    <div ref={ref} class='mode-top-bar'>
      <div class='mode-top-bar-row'>
        {showBack && (
          <button
            type='button'
            tabIndex={0}
            class='mode-back-btn'
            aria-label='Back to home'
            onClick={onBack}
          >
            {'\u2190' /* ← back arrow */}
          </button>
        )}
        <div class='mode-top-bar-text'>
          <h1 class='mode-title'>{title}</h1>
          {description && (
            detail
              ? (
                <button
                  type='button'
                  class={'mode-description-toggle' +
                    (detailOpen ? ' open' : '')}
                  aria-expanded={detailOpen}
                  onClick={() => setDetailOpen(!detailOpen)}
                >
                  <span class='mode-description-chevron'>›</span>
                  <span>
                    {description}
                    {detailOpen && (
                      <>
                        <br />
                        <br />
                        {detail}
                      </>
                    )}
                  </span>
                </button>
              )
              : <p class='mode-description'>{description}</p>
          )}
        </div>
      </div>
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
    scopeValid?: boolean;
    validationMessage?: string;
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
  const scopeDisabled = props.scopeValid === false;
  const validationMessage = scopeDisabled ? props.validationMessage : undefined;

  const recBlock = recommendation
    ? (
      <div class='suggestion-card'>
        <div class='suggestion-card-header'>Suggestion</div>
        <div class='suggestion-card-body'>
          <span class='suggestion-card-text'>{recommendation}</span>
          {onApplyRecommendation
            ? (
              <button
                type='button'
                tabIndex={0}
                class='suggestion-card-accept'
                onClick={onApplyRecommendation}
              >
                Accept
              </button>
            )
            : null}
        </div>
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
        ? <div class='practice-section-header'>Practice Settings</div>
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
        <StartButton
          onStart={onStart}
          disabled={scopeDisabled}
          validationMessage={validationMessage}
        />
      </div>
    </div>
  );

  return (
    <div class='practice-card'>
      <div class='practice-zone practice-zone-mastery'>
        <div class='practice-section-header'>Mastery</div>
        <div class='practice-status'>
          {statusLabel
            ? (
              <>
                <span class='practice-status-prefix'>Status</span>
                <span class='practice-status-label'>{statusLabel}</span>
              </>
            )
            : null}
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
    <div class='suggestion-card'>
      <div class='suggestion-card-header'>Suggestion</div>
      <div class='suggestion-card-body'>
        <span class='suggestion-card-text'>{text}</span>
        {onApply
          ? (
            <button
              type='button'
              tabIndex={0}
              class='suggestion-card-accept'
              onClick={onApply}
            >
              Accept
            </button>
          )
          : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StartButton — quiz start button
// ---------------------------------------------------------------------------

export function StartButton(
  { onStart, disabled, validationMessage }: {
    onStart?: () => void;
    disabled?: boolean;
    validationMessage?: string;
  },
) {
  const msgId = validationMessage ? 'start-validation-msg' : undefined;
  return (
    <>
      <button
        type='button'
        tabIndex={0}
        class='start-btn'
        onClick={onStart}
        disabled={disabled}
        aria-describedby={msgId}
      >
        Practice
      </button>
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
    context,
    count,
    isWarning,
    isLastQuestion,
    onClose,
  }: {
    timeLeft?: string;
    timerPct?: number;
    context?: string;
    count?: string;
    isWarning?: boolean;
    isLastQuestion?: boolean;
    onClose?: () => void;
  },
) {
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
// QuizArea — two-zone layout: content (what app presents) + controls (user
// responds with). When `controls` is provided, QuizArea renders both zones.
// When omitted, children render directly (e.g. SpeedCheck manages its own).
// ---------------------------------------------------------------------------

export function QuizArea(
  { prompt, lastQuestion, controls, children }: {
    prompt?: string;
    lastQuestion?: string;
    controls?: ComponentChildren;
    children?: ComponentChildren;
  },
) {
  if (controls !== undefined) {
    return (
      <div class='quiz-area'>
        <div class='quiz-content'>
          {
            /* Always render the wrapper to keep DOM positions stable
               (prevents Preact from recreating sibling nodes like the
               fretboard when lastQuestion toggles). :empty hides it. */
          }
          <div class='quiz-last-question'>{lastQuestion || null}</div>
          {prompt && (
            <div class='quiz-prompt-row'>
              <div class='quiz-prompt'>{prompt}</div>
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

export function RoundCompleteInfo(
  { context, heading, correct, median }: {
    context?: string;
    heading?: string;
    correct?: string;
    median?: string;
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoundCompleteActions — round-complete controls (keep going / stop).
// Rendered in .quiz-controls zone.
// ---------------------------------------------------------------------------

export function RoundCompleteActions(
  { onContinue, onStop }: {
    onContinue?: () => void;
    onStop?: () => void;
  },
) {
  return (
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
    onCalibrate,
    baseline,
    activeTab,
    onTabSwitch,
    scopeValid,
    validationMessage,
  }: {
    summary: PracticeSummaryState;
    onStart: () => void;
    onApplyRecommendation?: () => void;
    scope?: ComponentChildren;
    statsContent: ComponentChildren;
    onCalibrate: () => void;
    baseline: number | null;
    activeTab: 'practice' | 'progress';
    onTabSwitch: (tab: 'practice' | 'progress') => void;
    scopeValid?: boolean;
    validationMessage?: string;
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
          scopeValid={scopeValid}
          validationMessage={validationMessage}
        />
      }
      progressContent={
        <div>
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
