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

export function ButtonsTab({ tabId }: { tabId: string }) {
  return (
    <PreviewGrid>
      <Section title='Note Buttons (Grid)' tabId={tabId}>
        <NoteButtons />
      </Section>
      <Section title='Piano Note Buttons' tabId={tabId}>
        <PianoNoteButtons />
      </Section>
      <Section title='Interval Buttons' tabId={tabId}>
        <IntervalButtons />
      </Section>
      <Section title='Number Buttons (0–11)' tabId={tabId}>
        <NumberButtons start={0} end={11} />
      </Section>
      <Section title='Key Signature Buttons' tabId={tabId}>
        <KeysigButtons />
      </Section>
      <Section title='Degree Buttons' tabId={tabId}>
        <DegreeButtons />
      </Section>
      <Section title='Numeral Buttons' tabId={tabId}>
        <NumeralButtons />
      </Section>
    </PreviewGrid>
  );
}
