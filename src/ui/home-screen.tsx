// Home screen: tabbed view with Active (starred) and All Skills tabs.
// Active tab shows starred skills; All Skills tab shows track accordions.

import { useCallback, useState } from 'preact/hooks';
import {
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
  MODE_NAMES,
  TRACKS,
} from '../music-data.ts';
import type { Track } from '../music-data.ts';
import { SkillIcon } from './icons.tsx';
import type { SettingsController } from '../types.ts';
import type { AppConfig } from '../app-config.ts';
import {
  type ModeProgress,
  useHomeProgress,
} from '../hooks/use-home-progress.ts';

// ---------------------------------------------------------------------------
// localStorage persistence for starred skills
// ---------------------------------------------------------------------------

const STARRED_KEY = 'starredSkills';
const ACCORDION_KEY = 'trackAccordionState';
const TAB_KEY = 'homeTab';

function loadStarredSkills(): Set<string> {
  const allModeIds = new Set(TRACKS.flatMap((t) => t.skills));
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.filter((id: string) => allModeIds.has(id)));
      }
    }
  } catch (_) { /* expected */ }
  return new Set();
}

function saveStarredSkills(starred: Set<string>): void {
  try {
    localStorage.setItem(STARRED_KEY, JSON.stringify([...starred]));
  } catch (_) { /* expected */ }
}

function loadAccordionState(): Record<string, boolean> {
  const trackIds = new Set(TRACKS.map((t) => t.id));
  try {
    const raw = localStorage.getItem(ACCORDION_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const state: Record<string, boolean> = {};
        for (const id of trackIds) state[id] = obj[id] !== false;
        return state;
      }
    }
  } catch (_) { /* expected */ }
  // Default: all expanded
  const state: Record<string, boolean> = {};
  for (const id of trackIds) state[id] = true;
  return state;
}

function saveAccordionState(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(ACCORDION_KEY, JSON.stringify(state));
  } catch (_) { /* expected */ }
}

// Clean up legacy selectedTracks key (one-time migration)
try {
  localStorage.removeItem('selectedTracks');
} catch (_) { /* expected */ }

// ---------------------------------------------------------------------------
// SkillProgressBar — colored segments showing per-group progress
// ---------------------------------------------------------------------------

function SkillProgressBar({ colors }: { colors: string[] }) {
  return (
    <div class='group-progress-bar'>
      {colors.map((color, i) => (
        <div class='group-bar-slice' key={i} style={`background:${color}`} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillCard — a single mode button with before/after contrast and star toggle
// ---------------------------------------------------------------------------

function SkillCard(
  { modeId, trackId, isStarred, onToggleStar, onSelectMode, progress }: {
    modeId: string;
    trackId: string;
    isStarred: boolean;
    onToggleStar: (modeId: string) => void;
    onSelectMode: (modeId: string) => void;
    progress?: ModeProgress;
  },
) {
  const name = MODE_NAMES[modeId] || modeId;
  const desc = MODE_DESCRIPTIONS[modeId] || '';
  const ba = MODE_BEFORE_AFTER[modeId];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectMode(modeId);
      }
    },
    [modeId, onSelectMode],
  );

  return (
    <div
      class='home-mode-btn skill-card'
      data-mode={modeId}
      data-track={trackId}
      role='button'
      tabIndex={0}
      onClick={() => onSelectMode(modeId)}
      onKeyDown={handleKeyDown}
    >
      <button
        type='button'
        class={`skill-card-star${isStarred ? ' starred' : ''}`}
        aria-label={isStarred ? `Unstar ${name}` : `Star ${name}`}
        aria-pressed={isStarred}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(modeId);
        }}
      >
        {isStarred ? '\u2605' : '\u2606'}
      </button>
      <span class='skill-card-header'>
        <SkillIcon modeId={modeId} />
        <span class='skill-card-header-text'>
          <span class='home-mode-name'>{name}</span>
          <span class='home-mode-desc'>{desc}</span>
        </span>
      </span>
      {ba && (
        <div class='skill-card-ba'>
          <span class='skill-card-before'>{ba.before()}</span>
          <span class='skill-card-arrow'>&rarr;</span>
          <span class='skill-card-after'>{ba.after()}</span>
        </div>
      )}
      {progress && (
        <div class='skill-card-progress'>
          <SkillProgressBar colors={progress.groupColors} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveSkillCard — full card for the Active Skills section (with track pill)
// ---------------------------------------------------------------------------

function ActiveSkillCard(
  { modeId, trackLabel, onToggleStar, onSelectMode, progress }: {
    modeId: string;
    trackLabel: string;
    onToggleStar: (modeId: string) => void;
    onSelectMode: (modeId: string) => void;
    progress?: ModeProgress;
  },
) {
  const name = MODE_NAMES[modeId] || modeId;
  const desc = MODE_DESCRIPTIONS[modeId] || '';
  const ba = MODE_BEFORE_AFTER[modeId];
  const track = TRACKS.find((t) => t.skills.includes(modeId));
  const trackId = track?.id || 'core';

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectMode(modeId);
      }
    },
    [modeId, onSelectMode],
  );

  return (
    <div
      class='home-mode-btn skill-card active-skill-card'
      data-mode={modeId}
      data-track={trackId}
      role='button'
      tabIndex={0}
      onClick={() => onSelectMode(modeId)}
      onKeyDown={handleKeyDown}
    >
      <button
        type='button'
        class='skill-card-star starred'
        aria-label={`Unstar ${name}`}
        aria-pressed
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(modeId);
        }}
      >
        {'\u2605'}
      </button>
      <span class='skill-card-header'>
        <SkillIcon modeId={modeId} />
        <span class='skill-card-header-text'>
          <span class={`active-skill-track-pill pill-${trackId}`}>
            {trackLabel}
          </span>
          <span class='home-mode-name'>{name}</span>
          <span class='home-mode-desc'>{desc}</span>
        </span>
      </span>
      {ba && (
        <div class='skill-card-ba'>
          <span class='skill-card-before'>
            {ba.before()}
          </span>
          <span class='skill-card-arrow'>&rarr;</span>
          <span class='skill-card-after'>
            {ba.after()}
          </span>
        </div>
      )}
      {progress && (
        <div class='skill-card-progress'>
          <SkillProgressBar colors={progress.groupColors} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveSkillsList — content for the Active tab (no wrapper/header)
// ---------------------------------------------------------------------------

function ActiveSkillsList(
  { starred, onToggleStar, onSelectMode, progress }: {
    starred: Set<string>;
    onToggleStar: (modeId: string) => void;
    onSelectMode: (modeId: string) => void;
    progress: Map<string, ModeProgress>;
  },
) {
  // Order starred skills by track definition order
  const orderedStarred: { modeId: string; trackLabel: string }[] = [];
  for (const track of TRACKS) {
    for (const modeId of track.skills) {
      if (starred.has(modeId)) {
        orderedStarred.push({ modeId, trackLabel: track.label });
      }
    }
  }

  if (orderedStarred.length === 0) {
    return (
      <p class='active-skills-empty'>
        Star skills in the <strong>All Skills</strong> tab to add them here.
      </p>
    );
  }

  return (
    <div class='active-skills-list'>
      {orderedStarred.map(({ modeId, trackLabel }) => (
        <ActiveSkillCard
          key={modeId}
          modeId={modeId}
          trackLabel={trackLabel}
          onToggleStar={onToggleStar}
          onSelectMode={onSelectMode}
          progress={progress.get(modeId)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrackAccordion — collapsible track section
// ---------------------------------------------------------------------------

function TrackAccordion(
  {
    track,
    isExpanded,
    starred,
    onToggleExpand,
    onToggleStar,
    onSelectMode,
    progress,
  }: {
    track: Track;
    isExpanded: boolean;
    starred: Set<string>;
    onToggleExpand: (trackId: string) => void;
    onToggleStar: (modeId: string) => void;
    onSelectMode: (modeId: string) => void;
    progress: Map<string, ModeProgress>;
  },
) {
  return (
    <div class='track-accordion'>
      <button
        type='button'
        class={`track-accordion-header track-group-${track.id}`}
        aria-expanded={isExpanded}
        onClick={() => onToggleExpand(track.id)}
      >
        <span class='track-accordion-chevron'>
          {isExpanded ? '\u25BE' : '\u25B8'}
        </span>
        {track.label}
      </button>
      {isExpanded && (
        <div class='track-accordion-body'>
          {track.skills.map((modeId) => (
            <SkillCard
              key={modeId}
              modeId={modeId}
              trackId={track.id}
              isStarred={starred.has(modeId)}
              onToggleStar={onToggleStar}
              onSelectMode={onSelectMode}
              progress={progress.get(modeId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsPage — settings screen (extracted for function length limit)
// ---------------------------------------------------------------------------

function SettingsAboutLegal(
  { appConfig, version }: { appConfig: AppConfig; version: string },
) {
  return (
    <div>
      <section class='settings-section'>
        <h2 class='settings-section-title'>About</h2>
        <div class='settings-link-list'>
          {appConfig.contactEmail && (
            <a class='text-link' href={`mailto:${appConfig.contactEmail}`}>
              Contact: {appConfig.contactEmail}
            </a>
          )}
          {appConfig.supportUrl && (
            <a
              class='text-link'
              href={appConfig.supportUrl}
              target='_blank'
              rel='noopener noreferrer'
            >
              Support
            </a>
          )}
          <div class='settings-meta'>Build number: {version}</div>
        </div>
      </section>

      <section class='settings-section'>
        <h2 class='settings-section-title'>Legal</h2>
        <div class='settings-link-list'>
          {appConfig.termsUrl && (
            <a
              class='text-link'
              href={appConfig.termsUrl}
              target='_blank'
              rel='noopener noreferrer'
            >
              Terms &amp; conditions
            </a>
          )}
          {appConfig.privacyUrl && (
            <a
              class='text-link'
              href={appConfig.privacyUrl}
              target='_blank'
              rel='noopener noreferrer'
            >
              Privacy policy
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

function SettingsPage(
  { settings, appConfig, version, useSolfege, setUseSolfege, onClose }: {
    settings: SettingsController;
    appConfig: AppConfig;
    version: string;
    useSolfege: boolean;
    setUseSolfege: (v: boolean) => void;
    onClose: () => void;
  },
) {
  return (
    <div class='settings-page'>
      <div class='settings-page-header'>
        <h1 class='settings-page-title'>Settings</h1>
        <button
          type='button'
          class='settings-close-btn'
          aria-label='Close'
          onClick={onClose}
        >
          &times;
        </button>
      </div>

      <section class='settings-section'>
        <h2 class='settings-section-title'>General</h2>
        <div class='settings-field'>
          <div class='settings-label'>Note names</div>
          <div class='settings-toggle-group'>
            <button
              type='button'
              class={`settings-toggle-btn${useSolfege ? '' : ' active'}`}
              aria-pressed={!useSolfege}
              onClick={() => {
                settings.setUseSolfege(false);
                setUseSolfege(false);
              }}
            >
              A B C
            </button>
            <button
              type='button'
              class={`settings-toggle-btn${useSolfege ? ' active' : ''}`}
              aria-pressed={useSolfege}
              onClick={() => {
                settings.setUseSolfege(true);
                setUseSolfege(true);
              }}
            >
              Do Re Mi
            </button>
          </div>
        </div>
      </section>

      <SettingsAboutLegal appConfig={appConfig} version={version} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AllSkillsList — content for the All Skills tab
// ---------------------------------------------------------------------------

function AllSkillsList(
  { accordion, starred, onToggleExpand, onToggleStar, onSelectMode, progress }:
    {
      accordion: Record<string, boolean>;
      starred: Set<string>;
      onToggleExpand: (trackId: string) => void;
      onToggleStar: (modeId: string) => void;
      onSelectMode: (modeId: string) => void;
      progress: Map<string, ModeProgress>;
    },
) {
  return (
    <div class='home-modes'>
      <p class='all-skills-hint'>
        Tap the &#x2606; on a skill to add it to your <strong>Active</strong>
        {' '}
        list.
      </p>
      {TRACKS.map((track) => (
        <TrackAccordion
          key={track.id}
          track={track}
          isExpanded={accordion[track.id] !== false}
          starred={starred}
          onToggleExpand={onToggleExpand}
          onToggleStar={onToggleStar}
          onSelectMode={onSelectMode}
          progress={progress}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen — top-level component with Active / All Skills tabs
// ---------------------------------------------------------------------------

type HomeTab = 'active' | 'all';

function HomeScreenTabs(
  { tab, starredCount, onChangeTab }: {
    tab: HomeTab;
    starredCount: number;
    onChangeTab: (t: HomeTab) => void;
  },
) {
  return (
    <div class='home-tabs' role='tablist'>
      <button
        type='button'
        role='tab'
        class={`home-tab${tab === 'active' ? ' active' : ''}`}
        aria-selected={tab === 'active'}
        onClick={() => onChangeTab('active')}
      >
        Active{starredCount > 0 ? ` (${starredCount})` : ''}
      </button>
      <button
        type='button'
        role='tab'
        class={`home-tab${tab === 'all' ? ' active' : ''}`}
        aria-selected={tab === 'all'}
        onClick={() => onChangeTab('all')}
      >
        All Skills
      </button>
    </div>
  );
}

function HomeTabContent(
  {
    tab,
    starred,
    accordion,
    progress,
    onToggleStar,
    onToggleExpand,
    onSelectMode,
  }: {
    tab: HomeTab;
    starred: Set<string>;
    accordion: Record<string, boolean>;
    progress: Map<string, ModeProgress>;
    onToggleStar: (modeId: string) => void;
    onToggleExpand: (trackId: string) => void;
    onSelectMode: (modeId: string) => void;
  },
) {
  if (tab === 'active') {
    return (
      <ActiveSkillsList
        starred={starred}
        onToggleStar={onToggleStar}
        onSelectMode={onSelectMode}
        progress={progress}
      />
    );
  }
  return (
    <AllSkillsList
      accordion={accordion}
      starred={starred}
      onToggleExpand={onToggleExpand}
      onToggleStar={onToggleStar}
      onSelectMode={onSelectMode}
      progress={progress}
    />
  );
}

function loadInitialTab(): HomeTab {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved === 'active' || saved === 'all') return saved;
  } catch (_) { /* expected */ }
  return loadStarredSkills().size > 0 ? 'active' : 'all';
}

// ---------------------------------------------------------------------------
// HomeScreen — top-level component
// ---------------------------------------------------------------------------

export function HomeScreen(
  { onSelectMode, settings, appConfig, version }: {
    onSelectMode: (modeId: string) => void;
    settings: SettingsController;
    appConfig: AppConfig;
    version: string;
  },
) {
  const progress = useHomeProgress();
  const [starred, setStarred] = useState(loadStarredSkills);
  const [accordion, setAccordion] = useState(loadAccordionState);
  const [showSettings, setShowSettings] = useState(false);
  const [useSolfege, setUseSolfege] = useState(() => settings.getUseSolfege());
  const [tab, setTab] = useState<HomeTab>(loadInitialTab);

  const handleToggleStar = useCallback((modeId: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(modeId)) next.delete(modeId);
      else next.add(modeId);
      saveStarredSkills(next);
      return next;
    });
  }, []);

  const handleChangeTab = useCallback((t: HomeTab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch (_) { /* expected */ }
  }, []);

  const handleToggleExpand = useCallback((trackId: string) => {
    setAccordion((prev) => {
      const next = { ...prev, [trackId]: !prev[trackId] };
      saveAccordionState(next);
      return next;
    });
  }, []);

  if (showSettings) {
    return (
      <SettingsPage
        settings={settings}
        appConfig={appConfig}
        version={version}
        useSolfege={useSolfege}
        setUseSolfege={setUseSolfege}
        onClose={() => setShowSettings(false)}
      />
    );
  }

  return (
    <div class='home-content'>
      <div class='home-header'>
        <h1 class='home-title'>Music Reps</h1>
        <p class='home-tagline'>
          Instant recall for music fundamentals. You know the
          theory&#x2009;&mdash;&#x2009;now make it automatic.
        </p>
      </div>

      <HomeScreenTabs
        tab={tab}
        starredCount={starred.size}
        onChangeTab={handleChangeTab}
      />

      <HomeTabContent
        tab={tab}
        starred={starred}
        accordion={accordion}
        progress={progress}
        onToggleStar={handleToggleStar}
        onToggleExpand={handleToggleExpand}
        onSelectMode={onSelectMode}
      />

      <div class='home-footer'>
        <button
          type='button'
          class='home-settings-btn text-link'
          onClick={() => {
            setUseSolfege(settings.getUseSolfege());
            setShowSettings(true);
          }}
        >
          Settings
        </button>
        <span class='version'>{version}</span>
      </div>
    </div>
  );
}
