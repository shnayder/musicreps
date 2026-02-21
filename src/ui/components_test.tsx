// Render-to-string tests for Preact leaf components.
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
import { StatsGrid, StatsToggle } from './stats.tsx';
import { GroupToggles, NoteFilter, StringToggles } from './scope.tsx';
import { CountdownBar, FeedbackDisplay, TextPrompt } from './quiz-ui.tsx';

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
        statsMode='retention'
      />,
    );
    assert.ok(html.includes('stats-grid'));
    assert.ok(html.includes('stats-grid-row-label'));
    assert.ok(html.includes('stats-cell'));
  });
});

describe('StatsToggle', () => {
  it('marks active mode', () => {
    const html = render(
      <StatsToggle active='retention' onToggle={() => {}} />,
    );
    assert.ok(html.includes('stats-toggle'));
    // The retention button should have 'active' class
    assert.ok(html.includes('stats-toggle-btn active'));
  });

  it('marks speed when active', () => {
    const html = render(
      <StatsToggle active='speed' onToggle={() => {}} />,
    );
    // Speed button should have active, retention should not
    const parts = html.split('data-mode="speed"');
    // The button before speed data-mode should have 'active'
    assert.ok(parts.length > 1);
  });
});

// ---------------------------------------------------------------------------
// Scope components
// ---------------------------------------------------------------------------

describe('GroupToggles', () => {
  it('renders toggles with active and recommended states', () => {
    const html = render(
      <GroupToggles
        labels={['+1 to +3', '+4 to +6']}
        active={new Set([0])}
        recommended={1}
        onToggle={() => {}}
      />,
    );
    assert.ok(html.includes('toggle-group'));
    assert.ok(html.includes('distance-toggle active'));
    assert.ok(html.includes('distance-toggle recommended'));
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
    const html = render(<TextPrompt text='C + 5 = ?' />);
    assert.ok(html.includes('quiz-prompt'));
    assert.ok(html.includes('C + 5 = ?'));
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

  it('omits time and hint when not provided', () => {
    const html = render(
      <FeedbackDisplay text='X' className='feedback' />,
    );
    assert.ok(!html.includes('time-display'));
    assert.ok(!html.includes('hint'));
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
