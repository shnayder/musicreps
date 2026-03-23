// Home screen: tabbed view with Active (starred), All Skills, and Settings tabs.
// Active tab shows starred skills; All Skills tab shows track accordions;
// Settings tab shows inline settings panel.

import type { ComponentChildren } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { MODE_DESCRIPTIONS, MODE_NAMES, TRACKS } from '../mode-catalog.ts';
import { type DevPanelData, getDevPanelData } from '../dev-panel.ts';
import { SkillIcon } from './icons.tsx';
import type { SettingsController } from '../types.ts';
import { storage } from '../storage.ts';
import type { AppConfig } from '../app-config.ts';
import {
  type ModeProgress,
  useHomeProgress,
} from '../hooks/use-home-progress.ts';
import type { SkillRecommendation } from '../home-recommendations.ts';
import { Text } from './text.tsx';
import {
  CloseButton,
  TabBar,
  type TabDef,
  TabIcon,
  TabPanels,
  useTabsPrefix,
} from './mode-screen.tsx';
import { GroupProgressBar } from './scope.tsx';
import {
  LayoutFooter,
  LayoutHeader,
  LayoutMain,
  ScreenLayout,
} from './screen-layout.tsx';

// ---------------------------------------------------------------------------
// storage persistence for starred skills
// ---------------------------------------------------------------------------

const STARRED_KEY = 'starredSkills';
const ACCORDION_KEY = 'trackAccordionState';
const TAB_KEY = 'homeTab';

function loadStarredSkills(): Set<string> {
  const allModeIds = new Set(TRACKS.flatMap((t) => t.skills));
  try {
    const raw = storage.getItem(STARRED_KEY);
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
    storage.setItem(STARRED_KEY, JSON.stringify([...starred]));
  } catch (_) { /* expected */ }
}

function loadAccordionState(): Record<string, boolean> {
  const trackIds = new Set(TRACKS.map((t) => t.id));
  try {
    const raw = storage.getItem(ACCORDION_KEY);
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
    storage.setItem(ACCORDION_KEY, JSON.stringify(state));
  } catch (_) { /* expected */ }
}

// Clean up legacy selectedTracks key (one-time migration)
try {
  storage.removeItem('selectedTracks');
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

// Shared SegmentedControl extracted to its own file.
// Import for local use + re-export for backward compat.
import { SettingToggle } from './segmented-control.tsx';
export {
  SegmentedControl,
  type SegmentOption,
  SettingToggle,
} from './segmented-control.tsx';

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
          <Text role='body-secondary' as='div'>{rec!.detail}</Text>
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
// SettingsAboutLegal — about/legal links for settings panel
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

// ---------------------------------------------------------------------------
// SettingsPanel — inline settings content for the Settings tab
// ---------------------------------------------------------------------------

export function SettingsPanel(
  { settings, appConfig, version, useSolfege, setUseSolfege, onOpenDev }: {
    settings: SettingsController;
    appConfig: AppConfig;
    version: string;
    useSolfege: boolean;
    setUseSolfege: (v: boolean) => void;
    onOpenDev?: () => void;
  },
) {
  return (
    <div class='settings-page'>
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

      {onOpenDev && (
        <section class='settings-section'>
          <button type='button' class='text-link' onClick={onOpenDev}>
            Dev panel
          </button>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DevPage — dev stats page (same conditional-render pattern as SettingsPage)
// ---------------------------------------------------------------------------

function DevPage({ onClose }: { onClose: () => void }) {
  const [data] = useState<DevPanelData>(getDevPanelData);
  return (
    <div class='settings-page'>
      <div class='settings-page-header'>
        <h1 class='settings-page-title'>Dev</h1>
        <CloseButton ariaLabel='Close' onClick={onClose} />
      </div>

      <DevSection title='Global'>
        <DevStatRow label='Total reps' value={data.totalReps} />
        <DevStatRow label='Days active' value={data.daysActive} />
      </DevSection>

      <DevSection title='Per Mode'>
        <DevTable
          headers={['Mode', 'Reps', 'Items']}
          rows={data.modeEfforts.map((m) => [
            MODE_NAMES[m.id] || m.id,
            String(m.totalReps),
            `${m.itemsStarted}/${m.totalItems}`,
          ])}
        />
      </DevSection>

      {data.recentDays.length > 0 && (
        <DevSection title='Recent Days'>
          <DevTable
            headers={['Date', 'Reps']}
            rows={data.recentDays.map((d) => [d.date, String(d.count)])}
          />
        </DevSection>
      )}
    </div>
  );
}

function DevSection(
  { title, children }: { title: string; children: ComponentChildren },
) {
  return (
    <section class='settings-section'>
      <h2 class='settings-section-title'>{title}</h2>
      {children}
    </section>
  );
}

function DevStatRow({ label, value }: { label: string; value: number }) {
  return (
    <div class='dev-stat-row'>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DevTable(
  { headers, rows }: { headers: string[]; rows: string[][] },
) {
  return (
    <table class='dev-table'>
      <thead>
        <tr>
          {headers.map((h, i) => <th key={i} class={i > 0 ? 'num' : ''}>{h}
          </th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci} class={ci > 0 ? 'num' : ''}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
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
// HomeScreen — top-level component with bottom nav: Active / All Skills / Settings
// ---------------------------------------------------------------------------

export type HomeTab = 'active' | 'all' | 'settings';

function loadInitialTab(): HomeTab {
  try {
    const saved = storage.getItem(TAB_KEY);
    if (saved === 'active' || saved === 'all' || saved === 'settings') {
      return saved;
    }
  } catch (_) { /* expected */ }
  return loadStarredSkills().size > 0 ? 'active' : 'all';
}

// ---------------------------------------------------------------------------
// HomeHeader — title + tagline that scrolls with content
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
      <p class='all-skills-hint'>
        Tap the &#x2606; on a skill to add it to your <strong>Active</strong>
        {' '}
        list.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// useHomeTabs — build tab definitions for the home screen bottom nav
// ---------------------------------------------------------------------------

function useHomeTabs(
  {
    starred,
    accordion,
    progress,
    recommendations,
    settings,
    appConfig,
    version,
    useSolfege,
    setUseSolfege,
    onSelectMode,
    onToggleStar,
    onToggleExpand,
    onOpenDev,
  }: {
    starred: Set<string>;
    accordion: Record<string, boolean>;
    progress: Map<string, ModeProgress>;
    recommendations: SkillRecommendation[];
    settings: SettingsController;
    appConfig: AppConfig;
    version: string;
    useSolfege: boolean;
    setUseSolfege: (v: boolean) => void;
    onSelectMode: (modeId: string) => void;
    onToggleStar: (modeId: string) => void;
    onToggleExpand: (trackId: string) => void;
    onOpenDev?: () => void;
  },
): TabDef<HomeTab>[] {
  return [
    {
      id: 'active',
      label: <TabIcon icon='active-skills' text='Active' />,
      content: (
        <>
          <ActiveSkillsList
            starred={starred}
            onToggleStar={onToggleStar}
            onSelectMode={onSelectMode}
            progress={progress}
            recommendations={recommendations}
          />
        </>
      ),
    },
    {
      id: 'all',
      label: <TabIcon icon='all-skills' text='All Skills' />,
      content: (
        <>
          <AllSkillsList
            accordion={accordion}
            starred={starred}
            onToggleExpand={onToggleExpand}
            onToggleStar={onToggleStar}
            onSelectMode={onSelectMode}
            progress={progress}
          />
        </>
      ),
    },
    {
      id: 'settings',
      label: <TabIcon icon='settings' text='Settings' />,
      content: (
        <SettingsPanel
          settings={settings}
          appConfig={appConfig}
          version={version}
          useSolfege={useSolfege}
          setUseSolfege={setUseSolfege}
          onOpenDev={onOpenDev}
        />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// HomeScreen — top-level component
// ---------------------------------------------------------------------------

export function HomeScreen(
  { onSelectMode, settings, appConfig, showDevLink, version, isNativeApp }: {
    onSelectMode: (modeId: string) => void;
    settings: SettingsController;
    appConfig: AppConfig;
    showDevLink?: boolean;
    version: string;
    isNativeApp?: boolean;
  },
) {
  const [starred, setStarred] = useState(loadStarredSkills);
  const { progress, recommendations } = useHomeProgress(starred);
  const [accordion, setAccordion] = useState(loadAccordionState);
  const [showDev, setShowDev] = useState(false);
  const [useSolfege, setUseSolfege] = useState(() => settings.getUseSolfege());
  const [tab, setTab] = useState<HomeTab>(loadInitialTab);
  const prefix = useTabsPrefix();

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
    if (t === 'settings') setUseSolfege(settings.getUseSolfege());
    try {
      storage.setItem(TAB_KEY, t);
    } catch (_) { /* expected */ }
  }, [settings]);

  const handleToggleExpand = useCallback((trackId: string) => {
    setAccordion((prev) => {
      const next = { ...prev, [trackId]: !prev[trackId] };
      saveAccordionState(next);
      return next;
    });
  }, []);

  const tabs = useHomeTabs({
    starred,
    accordion,
    progress,
    recommendations,
    settings,
    appConfig,
    version,
    useSolfege,
    setUseSolfege,
    onSelectMode,
    onToggleStar: handleToggleStar,
    onToggleExpand: handleToggleExpand,
    onOpenDev: showDevLink ? () => setShowDev(true) : undefined,
  });

  if (showDev) {
    return <DevPage onClose={() => setShowDev(false)} />;
  }

  return (
    <ScreenLayout class='home-screen-layout'>
      <LayoutHeader>
        <HomeHeader isNativeApp={isNativeApp} />
      </LayoutHeader>
      <LayoutMain>
        <div class='home-content'>
          <TabPanels tabs={tabs} activeTab={tab} prefix={prefix} />
        </div>
      </LayoutMain>
      <LayoutFooter>
        <TabBar
          tabs={tabs}
          activeTab={tab}
          onTabSwitch={handleChangeTab}
          prefix={prefix}
          class='mode-nav'
        />
      </LayoutFooter>
    </ScreenLayout>
  );
}
