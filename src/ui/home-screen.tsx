// Home screen: tabbed view with Active (starred) and All Skills tabs.
// Active tab shows starred skills; All Skills tab shows track accordions.

import type { ComponentChildren } from 'preact';
import { useCallback, useMemo, useState } from 'preact/hooks';
import { MODE_DESCRIPTIONS, MODE_NAMES, TRACKS } from '../mode-catalog.ts';
import { SkillIcon } from './icons.tsx';
import type { SettingsController } from '../types.ts';
import type { AppConfig } from '../app-config.ts';
import {
  type ModeProgress,
  useHomeProgress,
} from '../hooks/use-home-progress.ts';
import type { SkillRecommendation } from '../home-recommendations.ts';
import { Text } from './text.tsx';
import { CloseButton, Tabs } from './mode-screen.tsx';
import { GroupProgressBar } from './scope.tsx';

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
// TrackPill — colored track label badge
// ---------------------------------------------------------------------------

export function TrackPill(
  { trackId, label }: { trackId: string; label: string },
) {
  return <span class={`active-skill-track-pill pill-${trackId}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
// SkillCardHeader — icon + name/desc block, with optional track pill
// ---------------------------------------------------------------------------

export function SkillCardHeader(
  { modeId, trackId, trackLabel }: {
    modeId: string;
    trackId?: string;
    trackLabel?: string;
  },
) {
  const name = MODE_NAMES[modeId] || modeId;
  const desc = MODE_DESCRIPTIONS[modeId] || '';
  return (
    <span class='skill-card-header'>
      <SkillIcon modeId={modeId} />
      <span class='skill-card-header-text'>
        {trackId && trackLabel && (
          <TrackPill trackId={trackId} label={trackLabel} />
        )}
        <span class='home-mode-name'>{name}</span>
        <span class='home-mode-desc'>{desc}</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// SegmentedControl — exclusive multi-option picker (radio group pattern)
// ---------------------------------------------------------------------------

export type SegmentOption<T extends string> = { value: T; label: string };

let segmentedControlCounter = 0;

export function SegmentedControl<T extends string>(
  { options, value, onChange, 'aria-labelledby': labelledBy }: {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    'aria-labelledby'?: string;
  },
) {
  const prefix = useMemo(() => 'sc-' + segmentedControlCounter++, []);

  function handleKeyDown(e: KeyboardEvent, current: T) {
    const vals = options.map((o) => o.value);
    const idx = vals.indexOf(current);
    let next = idx;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (idx - 1 + vals.length) % vals.length;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (idx + 1) % vals.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = vals.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    onChange(vals[next]);
    requestAnimationFrame(() => {
      (document.getElementById(
        prefix + '-' + vals[next],
      ) as HTMLElement | null)?.focus();
    });
  }

  return (
    <div
      class='segmented-control'
      role='radiogroup'
      aria-labelledby={labelledBy}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          id={prefix + '-' + opt.value}
          type='button'
          role='radio'
          aria-checked={value === opt.value}
          tabIndex={value === opt.value ? 0 : -1}
          class={'segmented-btn' + (value === opt.value ? ' active' : '')}
          onClick={() => onChange(opt.value)}
          onKeyDown={(e) => handleKeyDown(e, opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingToggle — labelled SegmentedControl for settings fields
// ---------------------------------------------------------------------------

let settingToggleLabelCounter = 0;

export function SettingToggle<T extends string>(
  { label, options, value, onChange }: {
    label: string;
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
  },
) {
  const labelId = useMemo(() => 'stl-' + settingToggleLabelCounter++, []);
  return (
    <div class='settings-field'>
      <Text role='label' as='div' id={labelId}>{label}</Text>
      <SegmentedControl
        options={options}
        value={value}
        onChange={onChange}
        aria-labelledby={labelId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillCard — a single mode button with before/after contrast and star toggle
// ---------------------------------------------------------------------------

export function SkillCard(
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
      <SkillCardHeader modeId={modeId} />
      {progress && (
        <div class='skill-card-progress'>
          <GroupProgressBar colors={progress.groupColors} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveSkillCard — full card for the Active Skills section (with track pill)
// ---------------------------------------------------------------------------

function ActiveSkillCard(
  {
    modeId,
    trackLabel,
    onToggleStar,
    onSelectMode,
    progress,
    rec,
  }: {
    modeId: string;
    trackLabel: string;
    onToggleStar: (modeId: string) => void;
    onSelectMode: (modeId: string) => void;
    progress?: ModeProgress;
    rec?: { detail: string };
  },
) {
  const name = MODE_NAMES[modeId] || modeId;
  const track = TRACKS.find((t) => t.skills.includes(modeId));
  const trackId = track?.id || 'core';
  const hasRec = !!rec?.detail;

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
      {hasRec && (
        <div class={`skill-rec-banner track-accent-${trackId}`}>
          <div class='skill-rec-header'>Suggestion</div>
          <Text role='secondary' as='div'>{rec!.detail}</Text>
        </div>
      )}
      <div class='skill-card-body'>
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
        <SkillCardHeader
          modeId={modeId}
          trackId={trackId}
          trackLabel={trackLabel}
        />
        {progress && (
          <div class='skill-card-progress'>
            <GroupProgressBar colors={progress.groupColors} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveSkillsList — content for the Active tab (no wrapper/header)
// ---------------------------------------------------------------------------

function ActiveSkillsList(
  { starred, onToggleStar, onSelectMode, progress, recommendations }: {
    starred: Set<string>;
    onToggleStar: (modeId: string) => void;
    onSelectMode: (modeId: string) => void;
    progress: Map<string, ModeProgress>;
    recommendations: SkillRecommendation[];
  },
) {
  if (starred.size === 0) {
    return (
      <p class='active-skills-empty'>
        Star skills in the <strong>All Skills</strong> tab to add them here.
      </p>
    );
  }

  // Build lookup: modeId → recommendation
  const recMap = new Map<string, SkillRecommendation>();
  for (const rec of recommendations) recMap.set(rec.modeId, rec);

  // Partition: recommended skills (in rank order) first, then remaining
  // starred skills in definition order.
  type Entry = {
    modeId: string;
    trackId: string;
    trackLabel: string;
    rec?: SkillRecommendation;
  };
  const recommended: Entry[] = [];
  const remaining: Entry[] = [];

  const trackFor = (modeId: string) =>
    TRACKS.find((t) => t.skills.includes(modeId));

  // Recommended skills in rank order
  for (const rec of recommendations) {
    if (starred.has(rec.modeId)) {
      const track = trackFor(rec.modeId);
      recommended.push({
        modeId: rec.modeId,
        trackId: track?.id || 'core',
        trackLabel: track?.label ?? '',
        rec,
      });
    }
  }

  // Remaining starred skills in definition order
  for (const track of TRACKS) {
    for (const modeId of track.skills) {
      if (starred.has(modeId) && !recMap.has(modeId)) {
        remaining.push({ modeId, trackId: track.id, trackLabel: track.label });
      }
    }
  }

  const ordered = [...recommended, ...remaining];

  // "All done" state: starred skills exist but no recommendations
  const allDone = recommendations.length === 0 && starred.size > 0;

  return (
    <div class='active-skills-list'>
      {allDone && (
        <p class='active-skills-done'>
          All your starred skills are automatic. Nice work! Star new skills in
          {' '}
          <strong>All Skills</strong> to keep going.
        </p>
      )}
      {ordered.map(({ modeId, trackLabel, rec }) => (
        <ActiveSkillCard
          key={modeId}
          modeId={modeId}
          trackLabel={trackLabel}
          onToggleStar={onToggleStar}
          onSelectMode={onSelectMode}
          progress={progress.get(modeId)}
          rec={rec?.detail ? { detail: rec.detail } : undefined}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrackSection — collapsible accordion section for a skill track
// ---------------------------------------------------------------------------

export function TrackSection(
  { trackId, label, isExpanded, onToggle, children }: {
    trackId: string;
    label: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: ComponentChildren;
  },
) {
  return (
    <div class='track-accordion'>
      <button
        type='button'
        class={`track-accordion-header track-group-${trackId}`}
        aria-expanded={isExpanded}
        onClick={onToggle}
      >
        <span class='track-accordion-chevron'>
          {isExpanded ? '\u25BE' : '\u25B8'}
        </span>
        {label}
      </button>
      {isExpanded && <div class='track-accordion-body'>{children}</div>}
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
        <CloseButton
          ariaLabel='Close'
          onClick={onClose}
        />
      </div>

      <section class='settings-section'>
        <h2 class='settings-section-title'>General</h2>
        <SettingToggle
          label='Note names'
          options={[
            { value: 'letter', label: 'A B C' },
            { value: 'solfege', label: 'Do Re Mi' },
          ]}
          value={useSolfege ? 'solfege' : 'letter'}
          onChange={(v) => {
            const sol = v === 'solfege';
            settings.setUseSolfege(sol);
            setUseSolfege(sol);
          }}
        />
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
        <TrackSection
          key={track.id}
          trackId={track.id}
          label={track.label}
          isExpanded={accordion[track.id] !== false}
          onToggle={() => onToggleExpand(track.id)}
        >
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
        </TrackSection>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen — top-level component with Active / All Skills tabs
// ---------------------------------------------------------------------------

type HomeTab = 'active' | 'all';

function loadInitialTab(): HomeTab {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved === 'active' || saved === 'all') return saved;
  } catch (_) { /* expected */ }
  return loadStarredSkills().size > 0 ? 'active' : 'all';
}

// ---------------------------------------------------------------------------
// HomeHeader / HomeFooter — top/bottom chrome for the home screen
// ---------------------------------------------------------------------------

function HomeHeader({ isNativeApp }: { isNativeApp?: boolean }) {
  return (
    <div class={`home-header${isNativeApp ? ' sr-only' : ''}`}>
      <h1 class='home-title'>Music Reps</h1>
      {!isNativeApp && (
        <p class='home-tagline'>
          Instant recall for music fundamentals. You know the
          theory&#x2009;&mdash;&#x2009;now make it automatic.
        </p>
      )}
    </div>
  );
}

function HomeFooter(
  { version, onSettings }: { version: string; onSettings: () => void },
) {
  return (
    <div class='home-footer'>
      <button
        type='button'
        class='home-settings-btn text-link'
        onClick={onSettings}
      >
        Settings
      </button>
      <span class='version'>{version}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeSkillTabs — Active / All Skills tabbed content
// ---------------------------------------------------------------------------

function HomeSkillTabs(
  {
    tab,
    onChangeTab,
    starred,
    accordion,
    onToggleStar,
    onToggleExpand,
    onSelectMode,
    progress,
    recommendations,
  }: {
    tab: HomeTab;
    onChangeTab: (t: HomeTab) => void;
    starred: Set<string>;
    accordion: Record<string, boolean>;
    onToggleStar: (modeId: string) => void;
    onToggleExpand: (trackId: string) => void;
    onSelectMode: (modeId: string) => void;
    progress: Map<string, ModeProgress>;
    recommendations: SkillRecommendation[];
  },
) {
  return (
    <Tabs
      tabs={[
        {
          id: 'active',
          label: `Active${starred.size > 0 ? ` (${starred.size})` : ''}`,
          content: (
            <ActiveSkillsList
              starred={starred}
              onToggleStar={onToggleStar}
              onSelectMode={onSelectMode}
              progress={progress}
              recommendations={recommendations}
            />
          ),
        },
        {
          id: 'all',
          label: 'All Skills',
          content: (
            <AllSkillsList
              accordion={accordion}
              starred={starred}
              onToggleExpand={onToggleExpand}
              onToggleStar={onToggleStar}
              onSelectMode={onSelectMode}
              progress={progress}
            />
          ),
        },
      ]}
      activeTab={tab}
      onTabSwitch={onChangeTab}
    />
  );
}

// ---------------------------------------------------------------------------
// HomeScreen — top-level component
// ---------------------------------------------------------------------------

export function HomeScreen(
  { onSelectMode, settings, appConfig, version, isNativeApp }: {
    onSelectMode: (modeId: string) => void;
    settings: SettingsController;
    appConfig: AppConfig;
    version: string;
    isNativeApp?: boolean;
  },
) {
  const [starred, setStarred] = useState(loadStarredSkills);
  const { progress, recommendations } = useHomeProgress(starred);
  const [accordion, setAccordion] = useState(loadAccordionState);
  const [showSettings, setShowSettings] = useState(false);
  const [useSolfege, setUseSolfege] = useState(() => settings.getUseSolfege());
  const [tab, setTab] = useState<HomeTab>(loadInitialTab);

  const handleToggleStar = useCallback((modeId: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      next.has(modeId) ? next.delete(modeId) : next.add(modeId);
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
      <HomeHeader isNativeApp={isNativeApp} />

      <HomeSkillTabs
        tab={tab}
        onChangeTab={handleChangeTab}
        starred={starred}
        accordion={accordion}
        onToggleStar={handleToggleStar}
        onToggleExpand={handleToggleExpand}
        onSelectMode={onSelectMode}
        progress={progress}
        recommendations={recommendations}
      />

      <HomeFooter
        version={version}
        onSettings={() => {
          setUseSolfege(settings.getUseSolfege());
          setShowSettings(true);
        }}
      />
    </div>
  );
}
