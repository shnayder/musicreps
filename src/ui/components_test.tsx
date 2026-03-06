// Render-to-string tests for Preact components (leaf + structural).
// Verifies DOM structure and CSS class names match existing build-time HTML.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';

import {
  DegreeButtons,
  IntervalButtons,
  KeysigButtons,
  NoteButtons,
  NumberButtons,
  NumeralButtons,
  PianoNoteButtons,
} from './buttons.tsx';
import type { StatsSelector } from './stats.tsx';
import { StatsGrid } from './stats.tsx';
import { GroupToggles, NoteFilter, StringToggles } from './scope.tsx';
import { CountdownBar, FeedbackDisplay, TextPrompt } from './quiz-ui.tsx';
import {
  ModeScreen,
  ModeTopBar,
  PracticeCard,
  QuizArea,
  QuizSession,
  Recommendation,
  RoundCompleteActions,
  RoundCompleteInfo,
  SessionInfo,
  StartButton,
  TabbedIdle,
} from './mode-screen.tsx';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function render(vnode: ReturnType<typeof h>): string {
  return renderToString(vnode);
}

// ---------------------------------------------------------------------------
// Button components
// ---------------------------------------------------------------------------

describe('NoteButtons', () => {
  it('renders 12 note buttons', () => {
    const html = render(<NoteButtons />);
    assert.ok(html.includes('answer-buttons-notes'));
    // 12 notes: C C# D D# E F F# G G# A A# B
    const count = (html.match(/answer-btn-note/g) || []).length;
    assert.equal(count, 12);
  });

  it('includes data-note attributes', () => {
    const html = render(<NoteButtons />);
    assert.ok(html.includes('data-note="C"'));
    assert.ok(html.includes('data-note="F#"'));
  });

  it('applies hidden class', () => {
    const html = render(<NoteButtons hidden />);
    assert.ok(html.includes('answer-group-hidden'));
  });
});

describe('PianoNoteButtons', () => {
  it('renders accidentals and naturals rows', () => {
    const html = render(<PianoNoteButtons />);
    assert.ok(html.includes('note-row-accidentals'));
    assert.ok(html.includes('note-row-naturals'));
  });

  it('renders 5 accidental + 7 natural buttons', () => {
    const html = render(<PianoNoteButtons />);
    const accidentals = (html.match(/note-btn accidental/g) || []).length;
    const allButtons = (html.match(/note-btn/g) || []).length;
    assert.equal(accidentals, 5);
    assert.equal(allButtons - accidentals, 7);
  });
});

describe('NumberButtons', () => {
  it('renders correct range', () => {
    const html = render(<NumberButtons start={0} end={11} />);
    assert.ok(html.includes('answer-buttons-numbers'));
    const count = (html.match(/answer-btn-num/g) || []).length;
    assert.equal(count, 12);
  });

  it('renders custom range', () => {
    const html = render(<NumberButtons start={1} end={5} />);
    const count = (html.match(/answer-btn-num/g) || []).length;
    assert.equal(count, 5);
  });
});

describe('IntervalButtons', () => {
  it('renders 12 interval buttons', () => {
    const html = render(<IntervalButtons />);
    assert.ok(html.includes('answer-buttons-intervals'));
    const count = (html.match(/answer-btn-interval/g) || []).length;
    assert.equal(count, 12);
  });
});

describe('KeysigButtons', () => {
  it('renders 15 key signature buttons', () => {
    const html = render(<KeysigButtons />);
    assert.ok(html.includes('answer-buttons-keysig'));
    const count = (html.match(/answer-btn-keysig/g) || []).length;
    assert.equal(count, 15);
  });
});

describe('DegreeButtons', () => {
  it('renders 7 degree buttons', () => {
    const html = render(<DegreeButtons />);
    assert.ok(html.includes('answer-buttons-degrees'));
    const count = (html.match(/answer-btn-degree/g) || []).length;
    assert.equal(count, 7);
  });

  it('shows ordinal labels', () => {
    const html = render(<DegreeButtons />);
    assert.ok(html.includes('1st'));
    assert.ok(html.includes('7th'));
  });
});

describe('NumeralButtons', () => {
  it('renders 7 numeral buttons', () => {
    const html = render(<NumeralButtons />);
    assert.ok(html.includes('answer-buttons-numerals'));
    const count = (html.match(/answer-btn-numeral/g) || []).length;
    assert.equal(count, 7);
  });

  it('includes diminished symbol', () => {
    const html = render(<NumeralButtons />);
    // vii° has the degree symbol
    assert.ok(html.includes('vii\u00B0'));
  });
});

// ---------------------------------------------------------------------------
// Stats components
// ---------------------------------------------------------------------------

function mockSelector(): StatsSelector {
  return {
    getAutomaticity(id: string) {
      if (id === 'C+1') return 0.9;
      if (id === 'C+2') return 0.5;
      return null;
    },
    getStats() {
      return null;
    },
  };
}

describe('StatsGrid', () => {
  it('renders table with correct structure', () => {
    const html = render(
      <StatsGrid
        selector={mockSelector()}
        colLabels={['+1', '+2']}
        getItemId={(name, ci) => `${name}+${ci + 1}`}
      />,
    );
    assert.ok(html.includes('stats-grid'));
    assert.ok(html.includes('stats-grid-row-label'));
    assert.ok(html.includes('stats-cell'));
  });
});

// ---------------------------------------------------------------------------
// Scope components
// ---------------------------------------------------------------------------

describe('GroupToggles', () => {
  it('renders toggles with active state', () => {
    const html = render(
      <GroupToggles
        labels={['+1 to +3', '+4 to +6']}
        active={new Set([0])}
        onToggle={() => {}}
      />,
    );
    assert.ok(html.includes('toggle-group'));
    assert.ok(html.includes('distance-toggle active'));
    assert.ok(html.includes('+1 to +3'));
    assert.ok(html.includes('+4 to +6'));
  });
});

describe('StringToggles', () => {
  it('renders string toggles', () => {
    const html = render(
      <StringToggles
        stringNames={['E', 'A', 'D']}
        active={new Set([0, 1])}
        onToggle={() => {}}
      />,
    );
    assert.ok(html.includes('string-toggles'));
    const activeCount = (html.match(/string-toggle active/g) || []).length;
    assert.equal(activeCount, 2);
  });
});

describe('NoteFilter', () => {
  it('renders natural/sharps-flats toggle', () => {
    const html = render(
      <NoteFilter mode='natural' onChange={() => {}} />,
    );
    assert.ok(html.includes('notes-toggles'));
    assert.ok(html.includes('notes-toggle active'));
    assert.ok(html.includes('natural'));
  });
});

// ---------------------------------------------------------------------------
// Quiz UI components
// ---------------------------------------------------------------------------

describe('TextPrompt', () => {
  it('renders prompt text', () => {
    const html = render(<TextPrompt text='C + 5' />);
    assert.ok(html.includes('quiz-prompt'));
    assert.ok(html.includes('C + 5'));
  });
});

describe('FeedbackDisplay', () => {
  it('renders feedback with class', () => {
    const html = render(
      <FeedbackDisplay
        text='Correct!'
        className='feedback correct'
      />,
    );
    assert.ok(html.includes('feedback correct'));
    assert.ok(html.includes('Correct!'));
  });

  it('renders time and hint when provided', () => {
    const html = render(
      <FeedbackDisplay
        text='Wrong'
        className='feedback incorrect'
        time='1.2s'
        hint='Try again'
      />,
    );
    assert.ok(html.includes('time-display'));
    assert.ok(html.includes('1.2s'));
    assert.ok(html.includes('hint'));
    assert.ok(html.includes('Try again'));
  });

  it('omits time when not provided; hint always present but hidden', () => {
    const html = render(
      <FeedbackDisplay text='X' className='feedback' />,
    );
    assert.ok(!html.includes('time-display'));
    // hint div is always rendered to reserve space (prevents layout jump)
    const hintDivMatch = html.match(
      /<div[^>]*class="[^"]*\bhint\b[^"]*"[^>]*>/,
    );
    assert.ok(hintDivMatch, 'hint div should be rendered');
    assert.match(
      hintDivMatch[0],
      /style="[^"]*\bvisibility:\s*hidden\b[^"]*"/,
    );
  });

  it('renders visible Next button when onNext provided', () => {
    const html = render(
      <FeedbackDisplay
        text='Correct!'
        className='feedback correct'
        onNext={() => {}}
      />,
    );
    const btnMatch = html.match(
      /<button[^>]*class="[^"]*\bnext-btn\b[^"]*"[^>]*>/,
    );
    assert.ok(btnMatch, 'next-btn should be rendered');
    assert.ok(
      !btnMatch[0].includes('visibility'),
      'should not be hidden when onNext provided',
    );
  });

  it('hides Next button when onNext not provided', () => {
    const html = render(
      <FeedbackDisplay text='X' className='feedback' />,
    );
    const btnMatch = html.match(
      /<button[^>]*class="[^"]*\bnext-btn\b[^"]*"[^>]*>/,
    );
    assert.ok(btnMatch, 'next-btn should be rendered for layout stability');
    assert.match(
      btnMatch[0],
      /style="[^"]*\bvisibility:\s*hidden\b[^"]*"/,
    );
  });
});

describe('CountdownBar', () => {
  it('renders with percentage width', () => {
    const html = render(<CountdownBar pct={75} />);
    assert.ok(html.includes('quiz-countdown-bar'));
    assert.ok(html.includes('quiz-countdown-fill'));
    assert.ok(html.includes('75%'));
  });

  it('adds warning class', () => {
    const html = render(<CountdownBar pct={10} warning />);
    assert.ok(html.includes('round-timer-warning'));
  });

  it('adds last-question class', () => {
    const html = render(<CountdownBar pct={50} lastQuestion />);
    assert.ok(html.includes('last-question'));
  });
});

// ---------------------------------------------------------------------------
// Structural components
// ---------------------------------------------------------------------------

describe('ModeScreen', () => {
  it('renders with phase class and id', () => {
    const html = render(
      <ModeScreen id='test' phase='idle'>
        <div>content</div>
      </ModeScreen>,
    );
    assert.ok(html.includes('mode-screen phase-idle'));
    assert.ok(html.includes('id="mode-test"'));
  });

  it('changes phase class', () => {
    const html = render(
      <ModeScreen id='test' phase='active'>
        <div />
      </ModeScreen>,
    );
    assert.ok(html.includes('mode-screen phase-active'));
  });
});

describe('ModeTopBar', () => {
  it('renders close button and title', () => {
    const html = render(<ModeTopBar title='Semitone Math' />);
    assert.ok(html.includes('mode-top-bar'));
    assert.ok(html.includes('mode-close-btn'));
    assert.ok(html.includes('mode-title'));
    assert.ok(html.includes('Semitone Math'));
    assert.ok(html.includes('\u00D7'));
  });

  it('hides close button when showBack is false', () => {
    const html = render(<ModeTopBar title='Test' showBack={false} />);
    assert.ok(html.includes('mode-top-bar'));
    assert.ok(html.includes('mode-title'));
    assert.ok(!html.includes('mode-close-btn'));
  });

  it('renders description as static paragraph', () => {
    const html = render(
      <ModeTopBar title='Test' description='Some description' />,
    );
    assert.ok(html.includes('mode-description'));
    assert.ok(html.includes('Some description'));
  });

  it('renders before/after line when provided', () => {
    const html = render(
      <ModeTopBar
        title='Test'
        description='Short desc'
        beforeAfter={{ before: 'slow way', after: 'fast way' }}
      />,
    );
    assert.ok(html.includes('mode-before-after'));
    assert.ok(html.includes('slow way'));
    assert.ok(html.includes('fast way'));
  });
});

describe('TabbedIdle', () => {
  it('renders tabs with practice active', () => {
    const html = render(
      <TabbedIdle
        activeTab='practice'
        onTabSwitch={() => {}}
        practiceContent={<div class='test-practice'>P</div>}
        progressContent={<div class='test-progress'>G</div>}
      />,
    );
    assert.ok(html.includes('mode-tabs'));
    // Practice tab button has active class
    assert.ok(html.includes('mode-tab active'));
    // Practice content has active class
    assert.ok(html.includes('tab-practice active'));
    // Progress content does NOT have active class
    assert.ok(!html.includes('tab-progress active'));
  });

  it('renders tabs with progress active', () => {
    const html = render(
      <TabbedIdle
        activeTab='progress'
        onTabSwitch={() => {}}
        practiceContent={<div>P</div>}
        progressContent={<div>G</div>}
      />,
    );
    assert.ok(html.includes('tab-progress active'));
    assert.ok(!html.includes('tab-practice active'));
  });
});

describe('PracticeCard', () => {
  it('renders mastery zone with label and detail', () => {
    const html = render(
      <PracticeCard
        statusLabel='Strong'
        statusDetail='12 of 14 fluent'
      />,
    );
    assert.ok(html.includes('practice-card'));
    assert.ok(html.includes('practice-zone-mastery'));
    assert.ok(html.includes('practice-status-label'));
    assert.ok(html.includes('Strong'));
    assert.ok(html.includes('12 of 14 fluent'));
    assert.ok(html.includes('practice-zone-action'));
    assert.ok(html.includes('start-btn'));
  });

  it('shows Practice Settings header when recommendation present', () => {
    const html = render(
      <PracticeCard
        recommendation='start A string'
        onApplyRecommendation={() => {}}
      />,
    );
    assert.ok(html.includes('suggestion-card'));
    assert.ok(html.includes('suggestion-card-header'));
    assert.ok(html.includes('suggestion-card-text'));
    assert.ok(html.includes('suggestion-card-accept'));
    assert.ok(html.includes('Practice Settings'));
  });

  it('shows scope controls in setup zone', () => {
    const html = render(
      <PracticeCard
        recommendation='start D string'
        onApplyRecommendation={() => {}}
        scope={<div class='mock-scope' />}
      />,
    );
    assert.ok(html.includes('practice-zone-setup'));
    assert.ok(html.includes('practice-scope'));
    assert.ok(html.includes('mock-scope'));
    assert.ok(html.includes('suggestion-card-text'));
  });

  it('shows mastery message', () => {
    const html = render(
      <PracticeCard mastery="Looks like you've got this!" />,
    );
    assert.ok(html.includes('mastery-message'));
    assert.ok(html.includes("Looks like you've got this!"));
  });
});

describe('Recommendation', () => {
  it('renders text and button', () => {
    const html = render(
      <Recommendation text='solidify +1' onApply={() => {}} />,
    );
    assert.ok(html.includes('suggestion-card'));
    assert.ok(html.includes('suggestion-card-header'));
    assert.ok(html.includes('solidify +1'));
    assert.ok(html.includes('suggestion-card-accept'));
  });

  it('omits button when no onApply', () => {
    const html = render(<Recommendation text='test' />);
    assert.ok(!html.includes('suggestion-card-accept'));
  });
});

describe('StartButton', () => {
  it('renders start button', () => {
    const html = render(<StartButton />);
    assert.ok(html.includes('start-btn'));
    assert.ok(html.includes('Practice'));
  });

  it('applies disabled attribute', () => {
    const html = render(<StartButton disabled />);
    assert.ok(html.includes('disabled'));
  });

  it('shows validation message with aria-describedby', () => {
    const html = render(
      <StartButton validationMessage='Select at least one string' />,
    );
    assert.ok(html.includes('Select at least one string'));
    assert.ok(html.includes('start-validation-message'));
    assert.ok(html.includes('aria-describedby'));
  });

  it('omits validation message when not provided', () => {
    const html = render(<StartButton />);
    assert.ok(!html.includes('start-validation-message'));
    assert.ok(!html.includes('aria-describedby'));
  });
});

describe('QuizSession', () => {
  it('renders countdown, info, and close', () => {
    const html = render(
      <QuizSession
        timeLeft='42s'
        timerPct={65}
        context='Natural notes'
        count='5 of 12'
      />,
    );
    assert.ok(html.includes('quiz-session'));
    assert.ok(html.includes('quiz-countdown-row'));
    assert.ok(html.includes('quiz-countdown-bar'));
    assert.ok(html.includes('quiz-countdown-fill'));
    assert.ok(html.includes('width:65%'));
    assert.ok(html.includes('quiz-info-time'));
    assert.ok(html.includes('42s'));
    assert.ok(html.includes('quiz-session-info'));
    assert.ok(html.includes('Natural notes'));
    assert.ok(html.includes('5 of 12'));
    assert.ok(html.includes('quiz-header-close'));
  });
});

describe('SessionInfo', () => {
  it('renders context and count', () => {
    const html = render(
      <SessionInfo context='A string' count='3 of 8' />,
    );
    assert.ok(html.includes('quiz-session-info'));
    assert.ok(html.includes('quiz-info-context'));
    assert.ok(html.includes('A string'));
    assert.ok(html.includes('quiz-info-count'));
    assert.ok(html.includes('3 of 8'));
  });

  it('renders last question in session info', () => {
    const html = render(
      <SessionInfo
        context='natural'
        count='3 answers'
        lastQuestion='Last question'
      />,
    );
    assert.ok(html.includes('Last question'));
    assert.ok(html.includes('quiz-info-last-question'));
  });
});

describe('QuizArea', () => {
  it('renders prompt and controls in two zones', () => {
    const html = render(
      <QuizArea
        prompt='C + 5'
        controls={<div class='test-buttons'>buttons</div>}
      />,
    );
    assert.ok(html.includes('quiz-area'));
    assert.ok(html.includes('quiz-content'));
    assert.ok(html.includes('quiz-controls'));
    assert.ok(html.includes('quiz-prompt-row'));
    assert.ok(html.includes('quiz-prompt'));
    assert.ok(html.includes('C + 5'));
    assert.ok(html.includes('test-buttons'));
  });

  it('renders children directly when no controls', () => {
    const html = render(
      <QuizArea>
        <div class='raw-child'>inner</div>
      </QuizArea>,
    );
    assert.ok(html.includes('quiz-area'));
    assert.ok(html.includes('raw-child'));
    assert.ok(!html.includes('quiz-content'));
    assert.ok(!html.includes('quiz-controls'));
  });
});

describe('RoundCompleteInfo', () => {
  it('renders heading, stats, and context', () => {
    const html = render(
      <RoundCompleteInfo
        context='Round 1 complete'
        heading='Great job!'
        correct='8 correct (80%)'
        median='Median: 425ms'
      />,
    );
    assert.ok(html.includes('round-complete'));
    assert.ok(html.includes('round-complete-context'));
    assert.ok(html.includes('Round 1 complete'));
    assert.ok(html.includes('round-complete-heading'));
    assert.ok(html.includes('Great job!'));
    assert.ok(html.includes('round-stat-correct'));
    assert.ok(html.includes('8 correct (80%)'));
    assert.ok(html.includes('round-stat-median'));
    assert.ok(html.includes('Median: 425ms'));
  });
});

describe('RoundCompleteActions', () => {
  it('renders keep-going and stop buttons', () => {
    const html = render(<RoundCompleteActions />);
    assert.ok(html.includes('round-complete-continue'));
    assert.ok(html.includes('Keep Going'));
    assert.ok(html.includes('round-complete-stop'));
    assert.ok(html.includes('Stop'));
  });
});
