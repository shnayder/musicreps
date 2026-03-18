// Structural components: Preact equivalents of the mode screen scaffold
// from html-helpers.ts modeScreen(). Compose leaf components into full
// mode screen layouts with phase management, tabs, and quiz sessions.

import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import type { PracticeSummaryState } from '../types.ts';
import { SkillIcon } from './icons.tsx';
import { BaselineInfo } from './speed-check.tsx';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';

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

let tabsIdCounter = 0;

export function Tabs<T extends string>(
  { tabs, activeTab, onTabSwitch, class: className = 'tabs' }: {
    tabs: TabDef<T>[];
    activeTab: T;
    onTabSwitch: (tab: T) => void;
    class?: string;
  },
) {
  const prefix = useMemo(() => 'tabs-' + tabsIdCounter++, []);

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
    <>
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
        {modeId && <SkillIcon modeId={modeId} />}
        <div class='mode-top-bar-text'>
          <h1 class='mode-title'>{title}</h1>
          {description && <p class='mode-description'>{description}</p>}
        </div>
        {showBack && (
          <CloseButton
            ariaLabel='Back to home'
            onClick={onBack}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModeTab — tab IDs for mode screens
// ---------------------------------------------------------------------------

export type ModeTab = 'practice' | 'progress' | 'about';

// ---------------------------------------------------------------------------
// PracticeCard — wraps practice zones (status, scope, action)
// ---------------------------------------------------------------------------

export function PracticeCard(
  props: {
    summary?: PracticeSummaryState;
    statusLabel?: string;
    statusDetail?: string;
    recommendation?: string;
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
  const onApplyRecommendation = props.onApplyRecommendation;
  const { scope, onStart } = props;
  const scopeDisabled = props.scopeValid === false;
  const validationMessage = scopeDisabled ? props.validationMessage : undefined;

  return (
    <div class='practice-card'>
      {statusLabel && (
        <div class='practice-status'>
          <div class='practice-status-row'>
            <Text role='label'>Status</Text>
            <span class='practice-status-label'>{statusLabel}</span>
          </div>
          {statusDetail && (
            <span class='practice-status-detail'>{statusDetail}</span>
          )}
        </div>
      )}
      {recommendation && (
        <Recommendation text={recommendation} onApply={onApplyRecommendation} />
      )}
      {scope && <div class='practice-scope'>{scope}</div>}
      <div class='practice-zone-action'>
        <StartButton
          onStart={onStart}
          disabled={scopeDisabled}
          validationMessage={validationMessage}
        />
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
    <div class='suggestion-card'>
      <div class='suggestion-card-header'>Suggestion</div>
      <div class='suggestion-card-body'>
        <Text role='secondary' class='suggestion-card-text'>{text}</Text>
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
      <ActionButton
        variant='primary'
        class='start-btn'
        onClick={onStart ?? noop}
        disabled={disabled}
        aria-describedby={msgId}
      >
        Practice
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
    context,
    count,
    isWarning,
    isLastQuestion,
    lastQuestion,
    onClose,
  }: {
    timeLeft?: string;
    timerPct?: number;
    context?: string;
    count?: string;
    isWarning?: boolean;
    isLastQuestion?: boolean;
    lastQuestion?: string;
    onClose?: () => void;
  },
) {
  return (
    <div class='quiz-session'>
      <div class='quiz-session-header'>
        <div class='quiz-session-header-content'>
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
          <SessionInfo
            context={context}
            count={count}
            lastQuestion={lastQuestion}
          />
        </div>
        <CloseButton
          ariaLabel='Stop quiz'
          onClick={onClose}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionInfo — quiz info context + count display
// ---------------------------------------------------------------------------

export function SessionInfo(
  { context, count, lastQuestion }: {
    context?: string;
    count?: string;
    lastQuestion?: string;
  },
) {
  return (
    <div class='quiz-session-info'>
      <span class='quiz-info-context'>{context || ''}</span>
      {lastQuestion
        ? <span class='quiz-info-last-question'>{lastQuestion}</span>
        : null}
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
  { context, heading, count, correct }: {
    context?: string;
    heading?: string;
    count?: number;
    correct?: string;
  },
) {
  return (
    <div class='round-complete'>
      <div class='round-complete-heading'>{heading || ''}</div>
      {count != null && (
        <>
          <div class='round-complete-count'>{count}</div>
          <div class='round-complete-count-label'>
            {count === 1 ? 'question answered' : 'questions answered'}
          </div>
        </>
      )}
      <div class='round-complete-stats'>
        <div class='round-stat-line round-stat-correct'>{correct || ''}</div>
      </div>
      {context
        ? (
          <div class='round-complete-overall'>
            <Text
              role='subsection-header'
              as='div'
              class='round-complete-overall-label'
            >
              Overall
            </Text>
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
// PracticeTab — composes Tabs + PracticeCard
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
    aboutContent,
    practiceContent,
    progressExtra,
  }: {
    summary: PracticeSummaryState;
    onStart: () => void;
    onApplyRecommendation?: () => void;
    scope?: ComponentChildren;
    statsContent: ComponentChildren;
    onCalibrate?: () => void;
    baseline?: number | null;
    activeTab: ModeTab;
    onTabSwitch: (tab: ModeTab) => void;
    scopeValid?: boolean;
    validationMessage?: string;
    aboutContent?: ComponentChildren;
    /** If provided, replaces the default PracticeCard in the practice tab. */
    practiceContent?: ComponentChildren;
    /** Extra content inserted above baseline in the progress tab. */
    progressExtra?: ComponentChildren;
  },
) {
  const tabs: TabDef<ModeTab>[] = [
    {
      id: 'practice',
      label: 'Practice',
      content: practiceContent ?? (
        <PracticeCard
          summary={summary}
          onStart={onStart}
          onApplyRecommendation={onApplyRecommendation}
          scope={scope}
          scopeValid={scopeValid}
          validationMessage={validationMessage}
        />
      ),
    },
    {
      id: 'progress',
      label: 'Progress',
      content: (
        <div>
          <div class='stats-container'>{statsContent}</div>
          {progressExtra}
          {onCalibrate && (
            <BaselineInfo baseline={baseline ?? null} onRun={onCalibrate} />
          )}
        </div>
      ),
    },
  ];
  if (aboutContent) {
    tabs.push({ id: 'about', label: 'About', content: aboutContent });
  }
  return <Tabs tabs={tabs} activeTab={activeTab} onTabSwitch={onTabSwitch} />;
}
