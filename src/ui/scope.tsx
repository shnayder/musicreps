// Scope control components: toggle groups for selecting practice scope.
// Used in idle screens to let users pick strings, distance groups, note types.

import { Fragment } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { GroupStatus } from '../types.ts';
import { displayNote } from '../music-data.ts';
import { getSpeedFreshnessColor } from '../stats-display.ts';

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
// GroupSkipMenu — ⋯ popover with Learn / Know / Skip options
// ---------------------------------------------------------------------------

/** Custom event to close all other open GroupSkipMenus. */
const CLOSE_EVENT = 'groupskipmenu:close';

function GroupSkipMenu(
  { index, label, currentStatus, onSkip, onUnskip }: {
    index: number;
    label: string;
    currentStatus: 'learn' | GroupStatus;
    onSkip: (index: number, reason: GroupStatus) => void;
    onUnskip: (index: number) => void;
  },
) {
  const [open, setOpen] = useState(false);
  const idRef = useRef(index);
  idRef.current = index;

  const openMenu = useCallback(() => {
    // Close any other open menu first.
    document.dispatchEvent(
      new CustomEvent(CLOSE_EVENT, { detail: index }),
    );
    setOpen(true);
  }, [index]);

  // Close on click-outside, Escape, or another menu opening.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = () => setOpen(false);
    const onOtherMenu = (e: Event) => {
      if ((e as CustomEvent).detail !== idRef.current) setOpen(false);
    };
    // Use rAF so the click that opened the menu doesn't immediately close it.
    const rafId = requestAnimationFrame(() => {
      document.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      document.addEventListener(CLOSE_EVENT, onOtherMenu);
    });
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener(CLOSE_EVENT, onOtherMenu);
    };
  }, [open]);

  const select = useCallback(
    (status: 'learn' | GroupStatus) => {
      if (status === 'learn') onUnskip(index);
      else onSkip(index, status);
      setOpen(false);
    },
    [index, onSkip, onUnskip],
  );

  const items: { key: 'learn' | GroupStatus; label: string }[] = [
    { key: 'learn', label: 'Learn this' },
    { key: 'mastered', label: 'I know this' },
    { key: 'deferred', label: 'Skip for now' },
  ];

  return (
    <div class='group-skip-menu-wrap'>
      <button
        type='button'
        tabIndex={0}
        class={'group-skip-btn' + (open ? ' open' : '')}
        title={`Options for ${label}`}
        aria-label={`Options for ${label}`}
        aria-expanded={open}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else openMenu();
        }}
      >
        {'\u22EF'}
      </button>
      {open && (
        <div
          class='group-skip-menu'
          onClick={(e: MouseEvent) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              type='button'
              key={item.key}
              onClick={() => select(item.key)}
            >
              <span class='menu-check'>
                {item.key === currentStatus ? '\u2713' : ''}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupProgressToggles — vertical group rows with toggle + progress bar
// ---------------------------------------------------------------------------

export function GroupProgressToggles(
  { groups, active, onToggle, selector, skipped, onSkip, onUnskip }: {
    groups: { label: string; itemIds: string[] }[];
    active: ReadonlySet<number>;
    onToggle: (index: number) => void;
    selector: {
      getSpeedScore(id: string): number | null;
      getFreshness(id: string): number | null;
    };
    skipped?: ReadonlyMap<number, GroupStatus>;
    onSkip?: (index: number, reason: GroupStatus) => void;
    onUnskip?: (index: number) => void;
  },
) {
  const hasMenu = !!(onSkip && onUnskip);
  return (
    <div
      class={'group-progress-toggles' + (hasMenu ? ' has-skip' : '')}
    >
      {groups.map((g, i) => {
        const isSkipped = skipped?.has(i) ?? false;
        const skipReason = skipped?.get(i);
        const currentStatus: 'learn' | GroupStatus = skipReason ?? 'learn';
        const items = g.itemIds.map((id) => {
          const sp = selector.getSpeedScore(id);
          const fr = selector.getFreshness(id);
          const auto = (sp !== null && fr !== null) ? sp * fr : null;
          return { id, auto, color: getSpeedFreshnessColor(sp, fr) };
        });
        items.sort((a, b) => (b.auto ?? -1) - (a.auto ?? -1));
        return (
          <Fragment key={i}>
            <button
              type='button'
              tabIndex={0}
              class={'distance-toggle' +
                (active.has(i) ? ' active' : '') +
                (isSkipped ? ' skipped' : '')}
              aria-pressed={active.has(i)}
              data-group={String(i)}
              disabled={isSkipped}
              onClick={() => onToggle(i)}
            >
              {g.label}
            </button>
            <div
              class={'group-progress-bar' + (isSkipped ? ' skipped' : '')}
            >
              {items.map((item) => (
                <div
                  class='group-bar-slice'
                  key={item.id}
                  style={`background:${item.color}`}
                />
              ))}
            </div>
            {hasMenu && (
              <GroupSkipMenu
                index={i}
                label={g.label}
                currentStatus={currentStatus}
                onSkip={onSkip}
                onUnskip={onUnskip}
              />
            )}
          </Fragment>
        );
      })}
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
