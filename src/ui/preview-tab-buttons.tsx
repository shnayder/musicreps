// Answer Buttons tab — all button variants in a grid.

import {
  DegreeButtons,
  IntervalButtons,
  KeysigButtons,
  NoteButtons,
  NumberButtons,
  NumeralButtons,
  PianoNoteButtons,
} from './buttons.tsx';
import { PreviewGrid, Section } from './preview-shared.tsx';

export function ButtonsTab({ tabId: _tabId }: { tabId: string }) {
  return (
    <PreviewGrid>
      <Section title='Note Buttons (Grid)'>
        <NoteButtons />
      </Section>
      <Section title='Piano Note Buttons'>
        <PianoNoteButtons />
      </Section>
      <Section title='Interval Buttons'>
        <IntervalButtons />
      </Section>
      <Section title='Number Buttons (0–11)'>
        <NumberButtons start={0} end={11} />
      </Section>
      <Section title='Key Signature Buttons'>
        <KeysigButtons />
      </Section>
      <Section title='Degree Buttons'>
        <DegreeButtons />
      </Section>
      <Section title='Numeral Buttons'>
        <NumeralButtons />
      </Section>
    </PreviewGrid>
  );
}
