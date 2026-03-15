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
import { SequentialSlots } from './sequential-slots.tsx';
import type { StatsSelector } from './stats.tsx';
import { StatsGrid } from './stats.tsx';
import {
  GroupProgressToggles,
  GroupToggles,
  NoteFilter,
  StringToggles,
} from './scope.tsx';
import { CountdownBar, FeedbackDisplay, TextPrompt } from './quiz-ui.tsx';
import { SkillIcon } from './icons.tsx';
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

  it('applies btn-feedback-correct to the pressed button on correct answer', () => {
    const html = render(
      <NoteButtons
        feedback={{ correct: true, userInput: 'D', displayAnswer: 'D' }}
      />,
    );
    const btnD = html.match(/<button[^>]*data-note="D"[^>]*>/);
    assert.ok(btnD, 'D button should exist');
    assert.ok(btnD[0].includes('btn-feedback-correct'));
    // Other buttons should not have feedback classes
    const btnC = html.match(/<button[^>]*data-note="C"[^>]*>/);
    assert.ok(btnC && !btnC[0].includes('btn-feedback-'));
  });

  it('applies btn-feedback-wrong and btn-feedback-reveal on incorrect answer', () => {
    const html = render(
      <NoteButtons
        feedback={{ correct: false, userInput: 'C', displayAnswer: 'D' }}
      />,
    );
    const btnC = html.match(/<button[^>]*data-note="C"[^>]*>/);
    assert.ok(btnC, 'C button should exist');
    assert.ok(btnC[0].includes('btn-feedback-wrong'));
    const btnD = html.match(/<button[^>]*data-note="D"[^>]*>/);
    assert.ok(btnD, 'D button should exist');
    assert.ok(btnD[0].includes('btn-feedback-reveal'));
    // Uninvolved button should have no feedback class
    const btnE = html.match(/<button[^>]*data-note="E"[^>]*>/);
    assert.ok(btnE && !btnE[0].includes('btn-feedback-'));
  });
});

describe('NoteButtons keyboard feedback', () => {
  it('highlights wrong + reveal buttons when userInput is normalized from keyboard', () => {
    // Simulates what GenericMode does: resolveNoteInput("cs") → "C#"
    const html = render(
      <NoteButtons
        feedback={{ correct: false, userInput: 'C#', displayAnswer: 'D' }}
      />,
    );
    const btnCS = html.match(/<button[^>]*data-note="C#"[^>]*>/);
    assert.ok(btnCS, 'C# button should exist');
    assert.ok(btnCS[0].includes('btn-feedback-wrong'));
    const btnD = html.match(/<button[^>]*data-note="D"[^>]*>/);
    assert.ok(btnD, 'D button should exist');
    assert.ok(btnD[0].includes('btn-feedback-reveal'));
  });

  it('reveals correct button when displayAnswer is canonical note name (diatonic chords)', () => {
    // Diatonic chords "V in Bb = F major". GenericMode normalizes
    // "F major" → "F" (canonical) before passing to NoteButtons.
    const html = render(
      <NoteButtons
        feedback={{ correct: false, userInput: 'B', displayAnswer: 'F' }}
      />,
    );
    const btnB = html.match(/<button[^>]*data-note="B"[^>]*>/);
    assert.ok(btnB, 'B button should exist');
    assert.ok(btnB[0].includes('btn-feedback-wrong'));
    const btnF = html.match(/<button[^>]*data-note="F"[^>]*>/);
    assert.ok(btnF, 'F button should exist');
    assert.ok(btnF[0].includes('btn-feedback-reveal'));
  });

  it('reveals correct button via enharmonic normalization', () => {
    // Note-semitones: correct answer was "E♭" (random flat choice).
    // GenericMode normalizes to canonical "D#".
    const html = render(
      <NoteButtons
        feedback={{ correct: false, userInput: 'D', displayAnswer: 'D#' }}
      />,
    );
    const btnD = html.match(/<button[^>]*data-note="D"[^>]*>/);
    assert.ok(btnD, 'D button should exist');
    assert.ok(btnD[0].includes('btn-feedback-wrong'));
    const btnDS = html.match(/<button[^>]*data-note="D#"[^>]*>/);
    assert.ok(btnDS, 'D# button should exist');
    assert.ok(btnDS[0].includes('btn-feedback-reveal'));
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
  it('renders 6 degree buttons (1st excluded)', () => {
    const html = render(<DegreeButtons />);
    assert.ok(html.includes('answer-buttons-degrees'));
    const count = (html.match(/answer-btn-degree/g) || []).length;
    assert.equal(count, 6);
  });

  it('shows ordinal labels (2nd–7th)', () => {
    const html = render(<DegreeButtons />);
    assert.ok(!html.includes('>1st<'));
    assert.ok(html.includes('2nd'));
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
    getSpeedScore(id: string) {
      if (id === 'C+1') return 0.9;
      if (id === 'C+2') return 0.5;
      return null;
    },
    getFreshness(_id: string) {
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

describe('GroupProgressToggles', () => {
  const mockSel = {
    getSpeedScore: () => 0.7,
    getFreshness: () => 0.6,
  };
  const groups = [
    { label: 'G1', itemIds: ['a', 'b'] },
    { label: 'G2', itemIds: ['c'] },
  ];

  it('renders correct number of progress bar slices', () => {
    const html = render(
      <GroupProgressToggles
        groups={groups}
        active={new Set([0, 1])}
        onToggle={() => {}}
        selector={mockSel}
      />,
    );
    const slices = (html.match(/group-bar-slice/g) || []).length;
    assert.equal(slices, 3); // 2 items in G1 + 1 in G2
  });

  it('marks skipped group toggle as disabled', () => {
    const html = render(
      <GroupProgressToggles
        groups={groups}
        active={new Set([0])}
        onToggle={() => {}}
        selector={mockSel}
        skipped={new Map([[1, 'deferred']])}
        onSkip={() => {}}
        onUnskip={() => {}}
      />,
    );
    // The skipped toggle should have disabled attribute and skipped class
    assert.ok(html.includes('skipped'));
    assert.ok(html.includes('disabled'));
  });

  it('renders skip menu when onSkip/onUnskip provided', () => {
    const html = render(
      <GroupProgressToggles
        groups={groups}
        active={new Set([0, 1])}
        onToggle={() => {}}
        selector={mockSel}
        onSkip={() => {}}
        onUnskip={() => {}}
      />,
    );
    assert.ok(html.includes('group-skip-btn'));
    assert.ok(html.includes('has-skip'));
  });

  it('omits skip menu when onSkip/onUnskip not provided', () => {
    const html = render(
      <GroupProgressToggles
        groups={groups}
        active={new Set([0, 1])}
        onToggle={() => {}}
        selector={mockSel}
      />,
    );
    assert.ok(!html.includes('group-skip-btn'));
    assert.ok(!html.includes('has-skip'));
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

  it('renders hint when provided', () => {
    const html = render(
      <FeedbackDisplay
        text='Wrong'
        className='feedback incorrect'
        hint='Try again'
      />,
    );
    assert.ok(html.includes('hint'));
    assert.ok(html.includes('Try again'));
  });

  it('hint always present but hidden when not provided', () => {
    const html = render(
      <FeedbackDisplay text='X' className='feedback' />,
    );
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

  it('adds page-action-correct class when correct=true', () => {
    const html = render(
      <FeedbackDisplay
        text='Correct!'
        className='feedback correct'
        correct
        onNext={() => {}}
      />,
    );
    assert.ok(html.includes('page-action-correct'));
  });

  it('adds page-action-wrong class when correct=false', () => {
    const html = render(
      <FeedbackDisplay
        text='Wrong'
        className='feedback incorrect'
        correct={false}
        onNext={() => {}}
      />,
    );
    assert.ok(html.includes('page-action-wrong'));
  });

  it('no color class when correct is null', () => {
    const html = render(
      <FeedbackDisplay text='X' className='feedback' correct={null} />,
    );
    assert.ok(!html.includes('page-action-correct'));
    assert.ok(!html.includes('page-action-wrong'));
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

  it('renders skill icon when modeId is provided', () => {
    const html = render(
      <ModeTopBar modeId='semitoneMath' title='Semitone Math' />,
    );
    assert.ok(html.includes('skill-icon'));
    assert.ok(html.includes('aria-hidden="true"'));
  });

  it('renders no icon when modeId is omitted', () => {
    const html = render(<ModeTopBar title='Test' />);
    assert.ok(!html.includes('skill-icon'));
  });
});

describe('SkillIcon', () => {
  it('renders icon for known mode', () => {
    const html = render(<SkillIcon modeId='fretboard' />);
    assert.ok(html.includes('skill-icon'));
    assert.ok(html.includes('<svg'));
  });

  it('renders nothing for unknown mode', () => {
    const html = render(<SkillIcon modeId='nonexistent' />);
    assert.equal(html, '');
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
  it('renders status line and start button', () => {
    const html = render(
      <PracticeCard
        statusLabel='Strong'
        statusDetail='12 of 14 automatic'
      />,
    );
    assert.ok(html.includes('practice-card'));
    assert.ok(html.includes('practice-status-label'));
    assert.ok(html.includes('Strong'));
    assert.ok(html.includes('12 of 14 automatic'));
    assert.ok(html.includes('practice-zone-action'));
    assert.ok(html.includes('start-btn'));
  });

  it('shows recommendation with accept button', () => {
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
  });

  it('shows scope controls', () => {
    const html = render(
      <PracticeCard
        recommendation='start D string'
        onApplyRecommendation={() => {}}
        scope={<div class='mock-scope' />}
      />,
    );
    assert.ok(html.includes('practice-scope'));
    assert.ok(html.includes('mock-scope'));
    assert.ok(html.includes('suggestion-card-text'));
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
  it('renders heading, count, stats, and context', () => {
    const html = render(
      <RoundCompleteInfo
        context='Round 1 complete'
        heading='Great job!'
        count={10}
        correct='8 correct'
      />,
    );
    assert.ok(html.includes('round-complete'));
    assert.ok(html.includes('round-complete-context'));
    assert.ok(html.includes('Round 1 complete'));
    assert.ok(html.includes('round-complete-heading'));
    assert.ok(html.includes('Great job!'));
    assert.ok(html.includes('round-complete-count'));
    assert.ok(html.includes('>10<'));
    assert.ok(html.includes('questions answered'));
    assert.ok(html.includes('round-stat-correct'));
    assert.ok(html.includes('8 correct'));
  });
});

describe('RoundCompleteActions', () => {
  it('renders keep-going and stop buttons', () => {
    const html = render(<RoundCompleteActions />);
    assert.ok(html.includes('page-action-primary'));
    assert.ok(html.includes('Keep Going'));
    assert.ok(html.includes('page-action-secondary'));
    assert.ok(html.includes('Stop'));
  });
});

// ---------------------------------------------------------------------------
// SequentialSlots
// ---------------------------------------------------------------------------

describe('SequentialSlots', () => {
  it('renders empty slots with one active', () => {
    const html = render(
      <SequentialSlots
        expectedCount={3}
        entries={[]}
        evaluated={null}
        correctTones={null}
      />,
    );
    assert.ok(html.includes('seq-slots-container'));
    // Count <span> elements with seq-slot class (not seq-slots or seq-slots-container)
    const slots = html.match(/class="seq-slot[\s"]/g) || [];
    assert.equal(slots.length, 3);
    assert.ok(html.includes('seq-slot active'));
  });

  it('renders filled slots before evaluation', () => {
    const html = render(
      <SequentialSlots
        expectedCount={3}
        entries={[{ display: 'C' }, { display: 'E' }]}
        evaluated={null}
        correctTones={null}
      />,
    );
    assert.ok(html.includes('filled'));
    assert.ok(html.includes('>C<'));
    assert.ok(html.includes('>E<'));
    // Third slot is active
    assert.ok(html.includes('seq-slot active'));
  });

  it('renders correct/wrong classes after evaluation', () => {
    const html = render(
      <SequentialSlots
        expectedCount={3}
        entries={[]}
        evaluated={[
          { display: 'C', correct: true },
          { display: 'E', correct: true },
          { display: 'G', correct: false },
        ]}
        correctTones={['C', 'E', 'G♯']}
      />,
    );
    const correct = (html.match(/seq-slot correct/g) || []).length;
    const wrong = (html.match(/seq-slot wrong/g) || []).length;
    assert.equal(correct, 2);
    assert.equal(wrong, 1);
  });

  it('shows correct-row when any entry is wrong', () => {
    const html = render(
      <SequentialSlots
        expectedCount={2}
        entries={[]}
        evaluated={[
          { display: 'C', correct: true },
          { display: 'E', correct: false },
        ]}
        correctTones={['C', 'E♭']}
      />,
    );
    assert.ok(html.includes('seq-correct-row'));
    assert.ok(html.includes('seq-correct-note'));
    // correctTones are rendered as-is (already display-formatted)
    assert.ok(html.includes('>C<'));
    assert.ok(html.includes('>E♭<'));
  });

  it('does not show correct-row when all entries are correct', () => {
    const html = render(
      <SequentialSlots
        expectedCount={2}
        entries={[]}
        evaluated={[
          { display: 'C', correct: true },
          { display: 'E', correct: true },
        ]}
        correctTones={['C', 'E']}
      />,
    );
    assert.ok(!html.includes('seq-correct-row'));
  });

  it('renders correctTones without double-formatting', () => {
    // correctTones arrive already display-formatted (e.g. with ♯/♭ unicode).
    // SequentialSlots must render them as-is, not pass through displayNote().
    const html = render(
      <SequentialSlots
        expectedCount={2}
        entries={[]}
        evaluated={[
          { display: 'D', correct: false },
          { display: 'F', correct: false },
        ]}
        correctTones={['D♯', 'F♯']}
      />,
    );
    assert.ok(html.includes('>D♯<'));
    assert.ok(html.includes('>F♯<'));
  });
});
