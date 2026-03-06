// Home screen: track-based skill tree with before/after contrast cards.
// Replaces the static build-time button list with a Preact component.

import { useCallback, useState } from 'preact/hooks';
import {
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
  MODE_NAMES,
  TRACKS,
} from '../music-data.ts';
import type { Track } from '../music-data.ts';
import { SkillIcon } from './icons.tsx';

// ---------------------------------------------------------------------------
// localStorage persistence for selected tracks
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'selectedTracks';

function loadSelectedTracks(): Set<string> {
  const allIds = new Set(TRACKS.map((t) => t.id));
  const alwaysIds = TRACKS.filter((t) => t.alwaysSelected).map((t) => t.id);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        // Sanitize: keep only known track IDs, ensure alwaysSelected present
        const loaded = new Set(arr.filter((id: string) => allIds.has(id)));
        for (const id of alwaysIds) loaded.add(id);
        if (loaded.size > 0) return loaded;
      }
    }
  } catch (_) { /* expected */ }
  // Default: all tracks selected
  return new Set(allIds);
}

function saveSelectedTracks(selected: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
  } catch (_) { /* expected */ }
}

// ---------------------------------------------------------------------------
// TrackChips — pill buttons for track selection
// ---------------------------------------------------------------------------

function TrackChips(
  { tracks, selected, onToggle }: {
    tracks: Track[];
    selected: Set<string>;
    onToggle: (id: string) => void;
  },
) {
  return (
    <div class='track-chips'>
      {tracks.map((track) => {
        const isActive = selected.has(track.id);
        const cls = `track-chip track-${track.id}${isActive ? ' active' : ''}`;
        return (
          <button
            type='button'
            key={track.id}
            class={cls}
            onClick={() => onToggle(track.id)}
            aria-pressed={isActive}
            disabled={track.alwaysSelected}
          >
            {track.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillCard — a single mode button with before/after contrast
// ---------------------------------------------------------------------------

function SkillCard(
  { modeId, trackId, onSelectMode }: {
    modeId: string;
    trackId: string;
    onSelectMode: (modeId: string) => void;
  },
) {
  const name = MODE_NAMES[modeId] || modeId;
  const desc = MODE_DESCRIPTIONS[modeId] || '';
  const ba = MODE_BEFORE_AFTER[modeId];

  return (
    <button
      type='button'
      class='home-mode-btn skill-card'
      data-mode={modeId}
      data-track={trackId}
      tabIndex={0}
      onClick={() => onSelectMode(modeId)}
    >
      <span class='skill-card-header'>
        <SkillIcon modeId={modeId} />
        <span class='skill-card-header-text'>
          <span class='home-mode-name'>{name}</span>
          <span class='home-mode-desc'>{desc}</span>
        </span>
      </span>
      {ba && (
        <div class='skill-card-ba'>
          <span class='skill-card-before'>{ba.before}</span>
          <span class='skill-card-arrow'>&rarr;</span>
          <span class='skill-card-after'>{ba.after}</span>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TrackSkillsList — track header + its skill cards in order
// ---------------------------------------------------------------------------

function TrackSkillsList(
  { track, onSelectMode }: {
    track: Track;
    onSelectMode: (modeId: string) => void;
  },
) {
  return (
    <div class='track-skills-list'>
      <div class={`home-group-label track-group-${track.id}`}>
        {track.label}
      </div>
      {track.skills.map((modeId) => (
        <SkillCard
          key={modeId}
          modeId={modeId}
          trackId={track.id}
          onSelectMode={onSelectMode}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OtherTracks — collapsed <details> for deselected tracks
// ---------------------------------------------------------------------------

function OtherTracks(
  { tracks, onSelectMode }: {
    tracks: Track[];
    onSelectMode: (modeId: string) => void;
  },
) {
  if (tracks.length === 0) return null;

  return (
    <details class='home-other-skills'>
      <summary>Other skills</summary>
      {tracks.map((track) => (
        <TrackSkillsList
          key={track.id}
          track={track}
          onSelectMode={onSelectMode}
        />
      ))}
    </details>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen — top-level component
// ---------------------------------------------------------------------------

export function HomeScreen(
  { onSelectMode, onOpenSettings, version }: {
    onSelectMode: (modeId: string) => void;
    onOpenSettings: () => void;
    version: string;
  },
) {
  const [selected, setSelected] = useState(loadSelectedTracks);

  const handleToggle = useCallback((id: string) => {
    // Can't deselect alwaysSelected tracks
    const track = TRACKS.find((t) => t.id === id);
    if (track?.alwaysSelected) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSelectedTracks(next);
      return next;
    });
  }, []);

  const selectedTracks = TRACKS.filter((t) => selected.has(t.id));
  const deselectedTracks = TRACKS.filter((t) => !selected.has(t.id));

  return (
    <div class='home-content'>
      <div class='home-header'>
        <h1 class='home-title'>Music Reps</h1>
        <p class='home-tagline'>
          Instant recall for music fundamentals. You know the
          theory&#x2009;&mdash;&#x2009;now make it automatic.
        </p>
      </div>

      <div class='track-selection-header'>Select tracks</div>
      <TrackChips
        tracks={TRACKS}
        selected={selected}
        onToggle={handleToggle}
      />

      <div class='home-modes'>
        {selectedTracks.map((track) => (
          <TrackSkillsList
            key={track.id}
            track={track}
            onSelectMode={onSelectMode}
          />
        ))}

        <OtherTracks tracks={deselectedTracks} onSelectMode={onSelectMode} />
      </div>

      <div class='home-footer'>
        <a
          class='home-settings-btn text-link'
          href='#settings'
          role='button'
          onClick={(e: Event) => {
            e.preventDefault();
            onOpenSettings();
          }}
        >
          Settings
        </a>
        <span class='version'>{version}</span>
      </div>
    </div>
  );
}
