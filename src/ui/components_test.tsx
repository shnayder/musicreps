// Render-to-string tests for Preact components (leaf + structural).
// Verifies DOM structure and CSS class names match existing build-time HTML.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';

import {
  DegreeButtons,
  IntervalButtons,
  NoteButtons,
  NumberButtons,
  NumeralButtons,
  SplitKeysigButtons,
} from './buttons.tsx';
import { SequentialSlots } from './sequential-slots.tsx';
import type { StatsSelector } from './stats.tsx';
import { StatsGrid } from './stats.tsx';
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
  StartButton,
  Tabs,
} from './mode-screen.tsx';
import { SegmentedControl, SettingToggle } from './segmented-control.tsx';
import {
  CenteredContent,
  LayoutFooter,
  LayoutHeader,
  LayoutMain,
  QuizStage,
  ScreenLayout,
} from './screen-layout.tsx';

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
    assert.ok(html.includes('answer-grid'));
    const count = (html.match(/answer-btn/g) || []).length;
    assert.equal(count, 12);
  });

  it('includes data-note attributes', () => {
    const html = render(<NoteButtons />);
    assert.ok(html.includes('data-note="C"'));
    assert.ok(html.includes('data-note="F#"'));
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

describe('NoteButtons hideAccidentals', () => {
  it('renders only 7 natural buttons when hideAccidentals is true', () => {
    const html = render(<NoteButtons hideAccidentals />);
    const count = (html.match(/answer-btn/g) || []).length;
    assert.equal(count, 7);
  });
});

describe('NumberButtons', () => {
  it('renders correct range', () => {
    const html = render(<NumberButtons start={0} end={11} />);
    assert.ok(html.includes('answer-grid'));
    const count = (html.match(/answer-btn/g) || []).length;
    assert.equal(count, 12);
  });

  it('renders custom range', () => {
    const html = render(<NumberButtons start={1} end={5} />);
    const count = (html.match(/answer-btn/g) || []).length;
    assert.equal(count, 5);
  });
});

describe('IntervalButtons', () => {
  it('renders 12 interval buttons', () => {
    const html = render(<IntervalButtons />);
    assert.ok(html.includes('answer-grid'));
    const count = (html.match(/answer-btn/g) || []).length;
    assert.equal(count, 12);
  });
});

describe('SplitKeysigButtons', () => {
  it('renders 8 number buttons and 2 accidental buttons', () => {
    const html = render(<SplitKeysigButtons />);
    assert.ok(html.includes('answer-grid-stack'));
    // 8 numbers + 2 accidentals = 10 answer-btn total
    const count = (html.match(/answer-btn/g) || []).length;
    assert.equal(count, 10);
  });
});

describe('DegreeButtons', () => {
  it('renders 6 degree buttons (1st excluded)', () => {
    const html = render(<DegreeButtons />);
    assert.ok(html.includes('answer-grid'));
    const count = (html.match(/answer-btn/g) || []).length;
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
    assert.ok(html.includes('answer-grid'));
    const count = (html.match(/answer-btn/g) || []).length;
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
    assert.ok(html.includes('close-btn'));
    assert.ok(html.includes('mode-title'));
    assert.ok(html.includes('Semitone Math'));
    assert.ok(html.includes('\u00D7'));
  });

  it('hides close button when showBack is false', () => {
    const html = render(<ModeTopBar title='Test' showBack={false} />);
    assert.ok(html.includes('mode-top-bar'));
    assert.ok(html.includes('mode-title'));
    assert.ok(!html.includes('close-btn'));
  });

  it('renders description as static paragraph', () => {
    const html = render(
      <ModeTopBar title='Test' description='Some description' />,
    );
    assert.ok(html.includes('mode-description'));
    assert.ok(html.includes('Some description'));
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

describe('Tabs', () => {
  const practiceTabs = [
    {
      id: 'practice',
      label: 'Practice',
      content: <div class='test-practice'>P</div>,
    },
    {
      id: 'progress',
      label: 'Progress',
      content: <div class='test-progress'>G</div>,
    },
  ];

  it('renders tabs with practice active', () => {
    const html = render(
      <Tabs
        tabs={practiceTabs}
        activeTab='practice'
        onTabSwitch={() => {}}
      />,
    );
    assert.ok(html.includes('tabs'));
    assert.ok(html.includes('tab-btn active'));
    assert.ok(html.includes('tab-panel active'));
    assert.ok(html.includes('test-practice'));
  });

  it('renders tabs with progress active', () => {
    const html = render(
      <Tabs
        tabs={practiceTabs}
        activeTab='progress'
        onTabSwitch={() => {}}
      />,
    );
    // Only the progress panel should have 'active'
    const panels = [...html.matchAll(/class="tab-panel([^"]*)"/g)].map((m) =>
      m[1]
    );
    assert.strictEqual(panels.length, 2);
    assert.ok(
      !panels[0].includes('active'),
      'practice panel should not be active',
    );
    assert.ok(panels[1].includes('active'), 'progress panel should be active');
  });

  it('wires up ARIA attributes', () => {
    const html = render(
      <Tabs tabs={practiceTabs} activeTab='practice' onTabSwitch={() => {}} />,
    );
    assert.ok(html.includes('role="tablist"'));
    assert.ok(html.includes('role="tab"'));
    assert.ok(html.includes('role="tabpanel"'));
    assert.ok(html.includes('aria-selected="true"'));
    assert.ok(html.includes('aria-controls='));
    assert.ok(html.includes('aria-labelledby='));
  });
});

describe('PracticeCard', () => {
  it('renders status line', () => {
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
    assert.ok(html.includes('start A string'));
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
    assert.ok(html.includes('suggestion-card-header'));
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
  it('renders countdown, count, and close', () => {
    const html = render(
      <QuizSession
        timeLeft='42s'
        timerPct={65}
        count='5'
      />,
    );
    assert.ok(html.includes('quiz-session'));
    assert.ok(html.includes('quiz-countdown-bar'));
    assert.ok(html.includes('quiz-countdown-fill'));
    assert.ok(html.includes('width:65%'));
    assert.ok(html.includes('quiz-info-time'));
    assert.ok(html.includes('42s'));
    assert.ok(html.includes('quiz-info-count'));
    assert.ok(html.includes('5'));
    assert.ok(html.includes('close-btn'));
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
  it('renders heading, count, stats, and level progress bars', () => {
    const levelBars = [
      { id: 'e', label: 'E strings', colors: ['hsl(125,48,33)'] },
      { id: 'a', label: 'A string', colors: ['hsl(40,60,58)'] },
    ];
    const html = render(
      <RoundCompleteInfo
        heading='Great job!'
        count={10}
        correct='8 correct'
        levelBars={levelBars}
      />,
    );
    assert.ok(html.includes('round-complete'));
    assert.ok(html.includes('round-complete-progress'));
    assert.ok(html.includes('progress-bar-plain'));
    assert.ok(html.includes('E strings'));
    assert.ok(html.includes('A string'));
    assert.ok(html.includes('group-progress-bar'));
    assert.ok(html.includes('round-complete-heading'));
    assert.ok(html.includes('Great job!'));
    assert.ok(html.includes('round-complete-count'));
    assert.ok(html.includes('>10<'));
    assert.ok(html.includes('reps'));
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
  it('renders empty container with no entries', () => {
    const html = render(
      <SequentialSlots
        entries={[]}
        evaluated={null}
        correctTones={null}
      />,
    );
    assert.ok(html.includes('seq-slots-container'));
    // One placeholder slot when no entries (not evaluated)
    assert.ok(html.includes('seq-placeholder'));
  });

  it('renders filled slots before evaluation', () => {
    const html = render(
      <SequentialSlots
        entries={[{ display: 'C' }, { display: 'E' }]}
        evaluated={null}
        correctTones={null}
      />,
    );
    assert.ok(html.includes('filled'));
    assert.ok(html.includes('>C<'));
    assert.ok(html.includes('>E<'));
  });

  it('renders correct/wrong classes after evaluation', () => {
    const html = render(
      <SequentialSlots
        entries={[{ display: 'C' }, { display: 'E' }, { display: 'G' }]}
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
        entries={[{ display: 'C' }, { display: 'E' }]}
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
        entries={[{ display: 'C' }, { display: 'E' }]}
        evaluated={[
          { display: 'C', correct: true },
          { display: 'E', correct: true },
        ]}
        correctTones={['C', 'E']}
      />,
    );
    // Hidden correction row is always present for layout stability
    assert.ok(html.includes('seq-correct-row'));
    assert.ok(html.includes('visibility:hidden'));
  });

  it('shows correct-row when count mismatches', () => {
    // User entered 2 notes but chord has 3 — should show correct answer
    const html = render(
      <SequentialSlots
        entries={[{ display: 'C' }, { display: 'E' }]}
        evaluated={[
          { display: 'C', correct: true },
          { display: 'E', correct: true },
        ]}
        correctTones={['C', 'E', 'G']}
      />,
    );
    assert.ok(html.includes('seq-correct-row'));
  });

  it('renders correctTones without double-formatting', () => {
    // correctTones arrive already display-formatted (e.g. with ♯/♭ unicode).
    // SequentialSlots must render them as-is, not pass through displayNote().
    const html = render(
      <SequentialSlots
        entries={[{ display: 'D' }, { display: 'F' }]}
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

// ---------------------------------------------------------------------------
// SegmentedControl + SettingToggle
// ---------------------------------------------------------------------------

describe('SegmentedControl', () => {
  it('renders radiogroup with correct aria attributes', () => {
    const html = render(
      <SegmentedControl
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
        value='a'
        onChange={() => {}}
      />,
    );
    assert.ok(html.includes('role="radiogroup"'));
    assert.ok(html.includes('role="radio"'));
    assert.ok(html.includes('aria-checked="true"'));
    assert.ok(html.includes('aria-checked="false"'));
    assert.ok(html.includes('segmented-control'));
    assert.ok(html.includes('segmented-btn active'));
    assert.ok(html.includes('Alpha'));
    assert.ok(html.includes('Beta'));
  });
});

describe('SettingToggle', () => {
  it('renders label + segmented control with aria-labelledby linkage', () => {
    const html = render(
      <SettingToggle
        label='Notation'
        options={[
          { value: 'letter', label: 'Letter' },
          { value: 'solfege', label: 'Solfege' },
        ]}
        value='letter'
        onChange={() => {}}
      />,
    );
    assert.ok(html.includes('settings-field'));
    assert.ok(html.includes('Notation'));
    assert.ok(html.includes('aria-labelledby'));
    // The label id and the radiogroup's aria-labelledby should match
    const labelIdMatch = html.match(/id="(stl-\d+)"/);
    assert.ok(labelIdMatch, 'label should have an id');
    assert.ok(
      html.includes(`aria-labelledby="${labelIdMatch![1]}"`),
      'radiogroup should reference label id',
    );
  });
});

// ---------------------------------------------------------------------------
// ScreenLayout components
// ---------------------------------------------------------------------------

describe('ScreenLayout', () => {
  it('renders with screen-layout class', () => {
    const html = render(
      <ScreenLayout>
        <div>content</div>
      </ScreenLayout>,
    );
    assert.ok(html.includes('screen-layout'));
    assert.ok(html.includes('content'));
  });
});

describe('LayoutHeader', () => {
  it('renders with layout-header class', () => {
    const html = render(
      <LayoutHeader>
        <div>header</div>
      </LayoutHeader>,
    );
    assert.ok(html.includes('layout-header'));
    assert.ok(html.includes('header'));
  });
});

describe('LayoutMain', () => {
  it('renders with layout-main layout-main-scroll by default', () => {
    const html = render(
      <LayoutMain>
        <div>main</div>
      </LayoutMain>,
    );
    assert.ok(html.includes('layout-main'));
    assert.ok(html.includes('layout-main-scroll'));
  });

  it('renders with layout-main-fixed when scrollable=false', () => {
    const html = render(
      <LayoutMain scrollable={false}>
        <div>main</div>
      </LayoutMain>,
    );
    assert.ok(html.includes('layout-main'));
    assert.ok(html.includes('layout-main-fixed'));
    assert.ok(!html.includes('layout-main-scroll'));
  });
});

describe('LayoutFooter', () => {
  it('returns null when children is falsy', () => {
    const html = render(<LayoutFooter>{null}</LayoutFooter>);
    assert.equal(html, '');
  });

  it('renders with layout-footer when children provided', () => {
    const html = render(
      <LayoutFooter>
        <div>footer</div>
      </LayoutFooter>,
    );
    assert.ok(html.includes('layout-footer'));
    assert.ok(html.includes('footer'));
  });
});

describe('QuizStage', () => {
  it('renders prompt and response zones', () => {
    const html = render(
      <QuizStage
        prompt={<div>question</div>}
        response={<div>buttons</div>}
      />,
    );
    assert.ok(html.includes('quiz-stage'));
    assert.ok(html.includes('quiz-stage-prompt'));
    assert.ok(html.includes('quiz-stage-response'));
    assert.ok(html.includes('question'));
    assert.ok(html.includes('buttons'));
  });
});

describe('CenteredContent', () => {
  it('renders with centered-content class', () => {
    const html = render(
      <CenteredContent>
        <div>centered</div>
      </CenteredContent>,
    );
    assert.ok(html.includes('centered-content'));
    assert.ok(html.includes('centered'));
  });
});
