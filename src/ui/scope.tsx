// Scope control components: toggle groups for selecting practice scope.
// Used in idle screens to let users pick strings, distance groups, note types.

import { displayNote } from '../music-data.ts';

// ---------------------------------------------------------------------------
// GroupToggles — distance group toggles (e.g., +1 to +3, +4 to +6)
// ---------------------------------------------------------------------------

export function GroupToggles(
  { labels, active, onToggle }: {
    labels: string[];
    active: ReadonlySet<number>;
    onToggle: (index: number) => void;
  },
) {
  return (
    <div class='toggle-group'>
      <span class='toggle-group-label'>Groups</span>
      <div class='distance-toggles'>
        {labels.map((label, i) => (
          <button
            type='button'
            tabIndex={0}
            key={i}
            class={'distance-toggle' + (active.has(i) ? ' active' : '')}
            aria-pressed={active.has(i)}
            data-group={String(i)}
            onClick={() => onToggle(i)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StringToggles — string toggles for fretboard modes
// ---------------------------------------------------------------------------

export function StringToggles(
  { stringNames, active, onToggle }: {
    stringNames: string[];
    active: ReadonlySet<number>;
    onToggle: (index: number) => void;
  },
) {
  return (
    <div class='toggle-group'>
      <span class='toggle-group-label'>Strings</span>
      <div class='string-toggles'>
        {stringNames.map((name, i) => (
          <button
            type='button'
            tabIndex={0}
            key={i}
            class={'string-toggle' + (active.has(i) ? ' active' : '')}
            aria-pressed={active.has(i)}
            data-string={String(i)}
            data-string-note={name}
            onClick={() => onToggle(i)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoteFilter — natural / sharps & flats toggle
// ---------------------------------------------------------------------------

export function NoteFilter(
  { mode, onChange }: {
    mode: 'natural' | 'sharps-flats' | 'all' | 'none';
    onChange: (mode: string) => void;
  },
) {
  const naturalActive = mode === 'natural' || mode === 'all';
  const accActive = mode === 'sharps-flats' || mode === 'all';

  function toggle(which: 'natural' | 'sharps-flats') {
    if (which === 'natural') {
      if (naturalActive && accActive) onChange('sharps-flats');
      else if (naturalActive) onChange(accActive ? 'sharps-flats' : 'none');
      else onChange(accActive ? 'all' : 'natural');
    } else {
      if (accActive && naturalActive) onChange('natural');
      else if (accActive) onChange(naturalActive ? 'natural' : 'none');
      else onChange(naturalActive ? 'all' : 'sharps-flats');
    }
  }

  return (
    <div class='toggle-group'>
      <span class='toggle-group-label'>Notes</span>
      <div class='notes-toggles'>
        <button
          type='button'
          tabIndex={0}
          class={'notes-toggle' + (naturalActive ? ' active' : '')}
          aria-pressed={naturalActive}
          data-notes='natural'
          onClick={() => toggle('natural')}
        >
          natural
        </button>
        <button
          type='button'
          tabIndex={0}
          class={'notes-toggle' + (accActive ? ' active' : '')}
          aria-pressed={accActive}
          data-notes='sharps-flats'
          onClick={() => toggle('sharps-flats')}
        >
          sharps &amp; flats
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotesToggles — note scope display (shows which notes are included)
// ---------------------------------------------------------------------------

export function NotesToggles(
  { notes, active, onToggle }: {
    notes: string[];
    active: Set<string>;
    onToggle: (note: string) => void;
  },
) {
  return (
    <div class='toggle-group'>
      <span class='toggle-group-label'>Notes</span>
      <div class='notes-toggles'>
        {notes.map((n) => (
          <button
            type='button'
            tabIndex={0}
            key={n}
            class={'notes-toggle' + (active.has(n) ? ' active' : '')}
            aria-pressed={active.has(n)}
            data-note={n}
            onClick={() => onToggle(n)}
          >
            {displayNote(n)}
          </button>
        ))}
      </div>
    </div>
  );
}
