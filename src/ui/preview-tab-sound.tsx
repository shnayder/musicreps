// Preview tab: 24 note buttons (2 octaves) wired to Web Audio synthesis.

import { NOTES } from '../music-data.ts';
import { playNote } from '../note-sound.ts';
import { PreviewGrid, Section } from './preview-shared.tsx';

function NoteRow({ octave }: { octave: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 'var(--gap-related)',
      }}
    >
      {NOTES.map((n) => (
        <button
          key={`${n.name}${octave}`}
          type='button'
          class='answer-btn'
          style={{ aspectRatio: 'auto', padding: '12px 0' }}
          onClick={() => playNote(n.num, octave)}
        >
          {n.name}
          {octave}
        </button>
      ))}
    </div>
  );
}

export function SoundTab({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Note Sound Spike</h2>
      <p>
        Web Audio API guitar-like synthesis. Tap to play — should feel instant.
      </p>
      <PreviewGrid>
        <Section title='Octave 3 (C3–B3)' tabId={tabId}>
          <NoteRow octave={3} />
        </Section>
        <Section title='Octave 4 (C4–B4)' tabId={tabId}>
          <NoteRow octave={4} />
        </Section>
      </PreviewGrid>
    </>
  );
}
