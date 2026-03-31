// Answer Buttons tab — all button variants and states.

import {
  DegreeButtons,
  IntervalButtons,
  NoteButtons,
  NumberButtons,
  NumeralButtons,
  SplitKeysigButtons,
  SplitNoteButtons,
} from './buttons.tsx';
import { ActionButton } from './action-button.tsx';
import { PreviewGrid, Section } from './preview-shared.tsx';

function AnswerButtonStates({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Answer Button States</h2>
      <PreviewGrid>
        <Section title='Default' tabId={tabId}>
          <button type='button' class='answer-btn' style={{ width: '80px' }}>
            C
          </button>
        </Section>
        <Section title='Correct' tabId={tabId}>
          <button
            type='button'
            class='answer-btn btn-feedback-correct'
            style={{ width: '80px' }}
          >
            C
          </button>
        </Section>
        <Section title='Wrong' tabId={tabId}>
          <button
            type='button'
            class='answer-btn btn-feedback-wrong'
            style={{ width: '80px' }}
          >
            D
          </button>
        </Section>
        <Section title='Reveal (correct answer)' tabId={tabId}>
          <button
            type='button'
            class='answer-btn btn-feedback-reveal'
            style={{ width: '80px' }}
          >
            C
          </button>
        </Section>
        <Section title='Disabled' tabId={tabId}>
          <button
            type='button'
            class='answer-btn'
            disabled
            style={{ width: '80px' }}
          >
            C
          </button>
        </Section>
      </PreviewGrid>
    </>
  );
}

function ActionButtonStates({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Action Button States</h2>
      <PreviewGrid>
        <Section title='Primary' tabId={tabId}>
          <ActionButton variant='primary' onClick={() => {}}>
            Practice
          </ActionButton>
        </Section>
        <Section title='Secondary' tabId={tabId}>
          <ActionButton variant='secondary' onClick={() => {}}>
            Stop
          </ActionButton>
        </Section>
        <Section title='Primary (disabled)' tabId={tabId}>
          <ActionButton variant='primary' onClick={() => {}} disabled>
            Disabled
          </ActionButton>
        </Section>
        <Section title='Correct result' tabId={tabId}>
          <button type='button' class='page-action-btn page-action-correct'>
            Keep Going
          </button>
        </Section>
        <Section title='Wrong result' tabId={tabId}>
          <button type='button' class='page-action-btn page-action-wrong'>
            Try Again
          </button>
        </Section>
      </PreviewGrid>
    </>
  );
}

function SequentialSlotStates({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Sequential Slot States</h2>
      <PreviewGrid>
        <Section title='All states' tabId={tabId}>
          <div class='seq-slots'>
            <span class='seq-slot'>_</span>
            <span class='seq-slot active'>_</span>
            <span class='seq-slot filled'>C</span>
            <span class='seq-slot correct'>E</span>
            <span class='seq-slot wrong'>D</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.7rem',
              color: 'var(--color-text-light)',
              marginTop: '0.25rem',
            }}
          >
            <span>empty</span>
            <span>active</span>
            <span>filled</span>
            <span>correct</span>
            <span>wrong</span>
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

function ToggleStates({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Toggle States</h2>
      <PreviewGrid>
        <Section title='String toggle (inactive / active)' tabId={tabId}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type='button' class='string-toggle'>1</button>
            <button type='button' class='string-toggle active'>2</button>
            <button type='button' class='string-toggle'>3</button>
          </div>
        </Section>
        <Section title='Distance toggle (inactive / active)' tabId={tabId}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type='button' class='distance-toggle'>0–4</button>
            <button type='button' class='distance-toggle active'>5–7</button>
            <button type='button' class='distance-toggle'>8–12</button>
          </div>
        </Section>
        <Section title='Level toggle (inactive / active)' tabId={tabId}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type='button' class='level-toggle-btn'>I</button>
            <button type='button' class='level-toggle-btn active'>II</button>
            <button type='button' class='level-toggle-btn'>III</button>
          </div>
        </Section>
      </PreviewGrid>
    </>
  );
}

export function ButtonsTab({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Answer Button Variants</h2>
      <PreviewGrid>
        <Section title='Note Buttons (12)' tabId={tabId}>
          <NoteButtons />
        </Section>
        <Section title='Note Buttons (naturals only)' tabId={tabId}>
          <NoteButtons hideAccidentals />
        </Section>
        <Section title='Interval Buttons' tabId={tabId}>
          <IntervalButtons />
        </Section>
        <Section title='Number Buttons (0–11)' tabId={tabId}>
          <NumberButtons start={0} end={11} />
        </Section>
        <Section title='Split Note Buttons (Chord Spelling)' tabId={tabId}>
          <SplitNoteButtons onAnswer={() => {}} />
        </Section>
        <Section title='Split Key Signature Buttons' tabId={tabId}>
          <SplitKeysigButtons />
        </Section>
        <Section title='Degree Buttons' tabId={tabId}>
          <DegreeButtons />
        </Section>
        <Section title='Numeral Buttons' tabId={tabId}>
          <NumeralButtons />
        </Section>
      </PreviewGrid>
      <AnswerButtonStates tabId={tabId} />
      <ActionButtonStates tabId={tabId} />
      <SequentialSlotStates tabId={tabId} />
      <ToggleStates tabId={tabId} />
    </>
  );
}
