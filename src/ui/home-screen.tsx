// Home screen: tabbed view with Active (starred), All Skills, and Settings tabs.
// Active tab shows starred skills; All Skills tab shows track accordions;
// Settings tab shows inline settings panel.

import type { ComponentChildren } from 'preact';
import { useCallback, useMemo, useState } from 'preact/hooks';
import { SKILL_DESCRIPTIONS, SKILL_NAMES, TRACKS } from '../skill-catalog.ts';
import { type DevPanelData, getDevPanelData } from '../dev-panel.ts';
import { getGlobalEffort, toLocalDateString } from '../effort.ts';
import { SkillIcon } from './icons.tsx';
import { Pill } from './pill.tsx';
import type { SettingsController } from '../types.ts';
import { storage } from '../storage.ts';
import {
  buildExport,
  detectBackend,
  downloadExport,
  exportFilename,
} from '../export-data.ts';
import type { AppConfig } from '../app-config.ts';
import {
  type SkillProgress,
  useHomeProgress,
} from '../hooks/use-home-progress.ts';
import type { ProgressSegment } from '../stats-display.ts';
import type { SkillRecommendation } from '../home-recommendations.ts';
import {
  CloseButton,
  TabBar,
  type TabDef,
  TabIcon,
  TabPanels,
  useTabsPrefix,
} from './skill-screen.tsx';
import { GroupProgressBar } from './scope.tsx';
import {
  LayoutFooter,
  LayoutHeader,
  LayoutMain,
  ScreenLayout,
} from './screen-layout.tsx';
import { Bar, Section, Stack } from './layout.tsx';
import { EffortStatsLine } from './effort-stats.tsx';
import { Text } from './text.tsx';

// ---------------------------------------------------------------------------
// storage persistence for starred skills
// ---------------------------------------------------------------------------

const STARRED_KEY = 'starredSkills';
const ACCORDION_KEY = 'trackAccordionState';

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

/** Clean up legacy storage keys.  Call after initStorage() + migration. */
export function cleanupLegacyKeys(): void {
  for (const key of ['selectedTracks', 'homeTab']) {
    try {
      storage.removeItem(key);
    } catch (_) { /* expected */ }
    try {
      globalThis.localStorage?.removeItem(key);
    } catch (_) { /* expected */ }
  }
}

// ---------------------------------------------------------------------------
// TrackPill — colored track label badge
// ---------------------------------------------------------------------------

export function TrackPill(
  { label }: { label: string },
) {
  return <Pill variant='track'>{label}</Pill>;
}

// ---------------------------------------------------------------------------
// SkillCardHeader — icon + name/desc block, with optional track pill
// ---------------------------------------------------------------------------

export function SkillCardHeader(
  { skillId, trackLabel, progress }: {
    skillId: string;
    trackLabel?: string;
    progress?: SkillProgress;
  },
) {
  const name = SKILL_NAMES[skillId] || skillId;
  const desc = SKILL_DESCRIPTIONS[skillId] || '';
  return (
    <Bar gap='group' class='skill-card-header'>
      <SkillIcon skillId={skillId} />
      <Stack gap='group' class='skill-card-content'>
        <Stack gap='micro' class='skill-card-title-block'>
          <Text role='heading-card' as='span'>{name}</Text>
          {trackLabel && <TrackPill label={trackLabel} />}
          {!trackLabel && desc && (
            <Text role='body-secondary' as='span'>{desc}</Text>
          )}
        </Stack>
        {progress && progress.segments.length > 0 && (
          <GroupProgressBar segments={progress.segments} />
        )}
      </Stack>
    </Bar>
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
  { skillId, isStarred, onToggleStar, onSelectSkill, progress }: {
    skillId: string;
    isStarred: boolean;
    onToggleStar: (skillId: string) => void;
    onSelectSkill: (skillId: string) => void;
    progress?: SkillProgress;
  },
) {
  const name = SKILL_NAMES[skillId] || skillId;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectSkill(skillId);
      }
    },
    [skillId, onSelectSkill],
  );

  return (
    <div
      class='home-skill-btn skill-card'
      data-skill={skillId}
      role='button'
      tabIndex={0}
      onClick={() => onSelectSkill(skillId)}
      onKeyDown={handleKeyDown}
    >
      <button
        type='button'
        class={`skill-card-star${isStarred ? ' starred' : ''}`}
        aria-label={isStarred ? `Unstar ${name}` : `Star ${name}`}
        aria-pressed={isStarred}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(skillId);
        }}
      >
        {isStarred ? '\u2605' : '\u2606'}
      </button>
      <SkillCardHeader skillId={skillId} progress={progress} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveSkillCard — full card for the Active Skills section (with track pill)
// ---------------------------------------------------------------------------

function ActiveSkillCard(
  {
    skillId,
    trackLabel,
    onToggleStar,
    onSelectSkill,
    progress,
    rec,
  }: {
    skillId: string;
    trackLabel: string;
    onToggleStar: (skillId: string) => void;
    onSelectSkill: (skillId: string) => void;
    progress?: SkillProgress;
    rec?: { cueLabel: string; detail: string };
  },
) {
  const name = SKILL_NAMES[skillId] || skillId;
  const hasRec = !!rec?.detail;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectSkill(skillId);
      }
    },
    [skillId, onSelectSkill],
  );

  return (
    <div
      class={`home-skill-btn skill-card active-skill-card${
        hasRec ? ' has-rec' : ''
      }`}
      data-skill={skillId}
      role='button'
      tabIndex={0}
      onClick={() => onSelectSkill(skillId)}
      onKeyDown={handleKeyDown}
    >
      <div class='skill-card-body'>
        <button
          type='button'
          class='skill-card-star starred'
          aria-label={`Unstar ${name}`}
          aria-pressed
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(skillId);
          }}
        >
          {'\u2605'}
        </button>
        <Bar gap='group' class='skill-card-header'>
          <SkillIcon skillId={skillId} />
          <Stack gap='group' class='skill-card-content'>
            <Stack gap='micro' class='skill-card-title-block'>
              <Text role='heading-card' as='span'>{name}</Text>
              <TrackPill label={trackLabel} />
            </Stack>
            {hasRec && (
              <span class='skill-rec-hint'>
                <strong>{rec!.cueLabel}</strong>
                {rec!.detail !== rec!.cueLabel &&
                  (rec!.detail.startsWith(rec!.cueLabel)
                    ? ` ${rec!.detail.slice(rec!.cueLabel.length).trimStart()}`
                    : ` \u2014 ${rec!.detail}`)}
              </span>
            )}
            {progress &&
              (progress.segments.length > 0 ||
                progress.activeLevelCount > 0) &&
              (
                <GroupProgressBar
                  segments={progress.segments.length > 0
                    ? progress.segments
                    : notStartedSegments(progress.activeLevelCount)}
                />
              )}
          </Stack>
        </Bar>
      </div>
    </div>
  );
}

/** Grey placeholder segments for not-started progress bars. */
function notStartedSegments(count: number): ProgressSegment[] {
  return Array.from(
    { length: count },
    () => ({ color: 'var(--heatmap-none)', weight: 1 }),
  );
}

// ---------------------------------------------------------------------------
// ActiveSkillsList — content for the Active tab (no wrapper/header)
// ---------------------------------------------------------------------------

function ActiveSkillsList(
  { starred, onToggleStar, onSelectSkill, progress, recommendations }: {
    starred: Set<string>;
    onToggleStar: (skillId: string) => void;
    onSelectSkill: (skillId: string) => void;
    progress: Map<string, SkillProgress>;
    recommendations: SkillRecommendation[];
  },
) {
  if (starred.size === 0) {
    return (
      <Stack gap='group'>
        <Text role='heading-section' as='h2'>Active Skills</Text>
        <Text role='status' as='p' class='text-hint'>
          Star the skills you want to automate in <strong>All Skills</strong>.
        </Text>
      </Stack>
    );
  }

  // Build lookup: skillId → recommendation
  const recMap = new Map<string, SkillRecommendation>();
  for (const rec of recommendations) recMap.set(rec.skillId, rec);

  // Partition: recommended skills (in rank order) first, then remaining
  // starred skills in definition order.
  type Entry = {
    skillId: string;
    trackId: string;
    trackLabel: string;
    rec?: SkillRecommendation;
  };
  const recommended: Entry[] = [];
  const remaining: Entry[] = [];

  const trackFor = (skillId: string) =>
    TRACKS.find((t) => t.skills.includes(skillId));

  // Recommended skills in rank order
  for (const rec of recommendations) {
    if (starred.has(rec.skillId)) {
      const track = trackFor(rec.skillId);
      recommended.push({
        skillId: rec.skillId,
        trackId: track?.id || 'core',
        trackLabel: track?.label ?? '',
        rec,
      });
    }
  }

  // Remaining starred skills in definition order
  for (const track of TRACKS) {
    for (const skillId of track.skills) {
      if (starred.has(skillId) && !recMap.has(skillId)) {
        remaining.push({ skillId, trackId: track.id, trackLabel: track.label });
      }
    }
  }

  const ordered = [...recommended, ...remaining];

  // "All done" state: starred skills exist but no recommendations
  const allDone = recommendations.length === 0 && starred.size > 0;

  return (
    <Stack gap='group'>
      <Text role='heading-section' as='h2'>Active Skills</Text>
      {allDone && (
        <p class='active-skills-done'>
          All your starred skills are automatic. Nice work! Star new skills in
          {' '}
          <strong>All Skills</strong> to keep going.
        </p>
      )}
      {ordered.map(({ skillId, trackLabel, rec }) => (
        <ActiveSkillCard
          key={skillId}
          skillId={skillId}
          trackLabel={trackLabel}
          onToggleStar={onToggleStar}
          onSelectSkill={onSelectSkill}
          progress={progress.get(skillId)}
          rec={rec?.detail
            ? { cueLabel: rec.cueLabel, detail: rec.detail }
            : undefined}
        />
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// TrackSection — collapsible accordion section for a skill track
// ---------------------------------------------------------------------------

export function TrackSection(
  { label, isExpanded, onToggle, children }: {
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
        class='track-accordion-header'
        aria-expanded={isExpanded}
        onClick={onToggle}
      >
        <span class='track-accordion-chevron'>
          {isExpanded ? '\u25BE' : '\u25B8'}
        </span>
        {label}
      </button>
      {isExpanded && (
        <Stack gap='group' class='track-accordion-body'>{children}</Stack>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsAboutLegal — about/legal links for settings panel
// ---------------------------------------------------------------------------

function mailto(
  email: string,
  subject: string,
  body: string,
): string {
  const qs = new URLSearchParams({ subject, body }).toString();
  return `mailto:${email}?${qs}`;
}

function SettingsAboutLegal(
  { appConfig, version }: { appConfig: AppConfig; version: string },
) {
  const contactBody =
    `Hi,\n\n[What would you like to tell us?]\n\n---\nBuild: ${version}\n`;
  return (
    <>
      <Section heading='About'>
        <div class='settings-link-list'>
          {appConfig.contactEmail && (
            <a
              class='text-link'
              href={mailto(
                appConfig.contactEmail,
                'Music Reps — feedback',
                contactBody,
              )}
            >
              Contact
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
          <span class='settings-meta'>Build {version}</span>
        </div>
      </Section>

      <Section heading='Legal'>
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
      </Section>
    </>
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
    <Stack gap='component' class='settings-page'>
      <Section heading='Preferences'>
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
      </Section>

      <SettingsAboutLegal appConfig={appConfig} version={version} />

      {onOpenDev && (
        <Section heading='Developer'>
          <div class='settings-link-list'>
            <button type='button' class='text-link' onClick={onOpenDev}>
              Dev panel
            </button>
          </div>
        </Section>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// DevPage — dev stats page (same conditional-render pattern as SettingsPage)
// ---------------------------------------------------------------------------

function DevPage(
  { version, onClose }: { version: string; onClose: () => void },
) {
  const [data] = useState<DevPanelData>(getDevPanelData);

  const handleExport = useCallback(() => {
    const backend = detectBackend();
    const now = new Date();
    const payload = buildExport({ appVersion: version, backend, now });
    downloadExport(payload, exportFilename(version, now));
  }, [version]);

  return (
    <ScreenLayout>
      <LayoutMain>
        <Stack gap='component' class='settings-page'>
          <div class='settings-page-header'>
            <CloseButton ariaLabel='Close' onClick={onClose} />
            <Text role='heading-page' as='h1' class='page-heading'>Dev</Text>
          </div>

          <DevSection title='Global'>
            <DevStatRow label='Total reps' value={data.totalReps} />
            <DevStatRow label='Days active' value={data.daysActive} />
          </DevSection>

          <DevSection title='Per Mode'>
            <DevTable
              headers={['Mode', 'Reps', 'Items']}
              rows={data.modeEfforts.map((m) => [
                SKILL_NAMES[m.id] || m.id,
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

          <DevSection title='Export'>
            <div class='settings-link-list'>
              <button type='button' class='text-link' onClick={handleExport}>
                Export data
              </button>
            </div>
          </DevSection>
        </Stack>
      </LayoutMain>
    </ScreenLayout>
  );
}

function DevSection(
  { title, children }: { title: string; children: ComponentChildren },
) {
  return <Section heading={title}>{children}</Section>;
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
  { accordion, starred, onToggleExpand, onToggleStar, onSelectSkill, progress }:
    {
      accordion: Record<string, boolean>;
      starred: Set<string>;
      onToggleExpand: (trackId: string) => void;
      onToggleStar: (skillId: string) => void;
      onSelectSkill: (skillId: string) => void;
      progress: Map<string, SkillProgress>;
    },
) {
  return (
    <Stack gap='group'>
      <Text role='heading-section' as='h2'>All Skills</Text>
      <Text role='status' as='p' class='text-hint'>
        Star the skills you want to automate.
      </Text>
      {TRACKS.map((track) => (
        <TrackSection
          key={track.id}
          label={track.label}
          isExpanded={accordion[track.id] !== false}
          onToggle={() => onToggleExpand(track.id)}
        >
          {track.skills.map((skillId) => (
            <SkillCard
              key={skillId}
              skillId={skillId}
              isStarred={starred.has(skillId)}
              onToggleStar={onToggleStar}
              onSelectSkill={onSelectSkill}
              progress={progress.get(skillId)}
            />
          ))}
        </TrackSection>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen — top-level component with bottom nav: Active / All Skills / About / Settings
// ---------------------------------------------------------------------------

export type HomeTab = 'active' | 'all' | 'about' | 'settings';

// ---------------------------------------------------------------------------
// HomeHeader — title + tagline shown in the fixed header area
// ---------------------------------------------------------------------------

const TAB_TITLES: Partial<Record<HomeTab, string>> = {
  settings: 'Settings',
  about: 'About',
};

function HomeHeader(
  { tab, repsToday, totalReps, daysActive }: {
    tab: HomeTab;
    repsToday: number;
    totalReps: number;
    daysActive: number;
  },
) {
  const pageTitle = TAB_TITLES[tab];
  if (pageTitle) {
    return (
      <div class='home-header'>
        <Text role='heading-page' as='h1' class='page-heading'>
          {pageTitle}
        </Text>
      </div>
    );
  }
  return (
    <div class='home-header'>
      <EffortStatsLine
        repsToday={repsToday}
        totalReps={totalReps}
        daysActive={daysActive}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeAboutTab — in-app intro: what this is, how it works, getting started
// ---------------------------------------------------------------------------

function HomeAboutTab() {
  return (
    <Stack gap='component' class='settings-page'>
      <Section heading='What is Music Reps?'>
        <Text role='body' as='p'>
          Music Reps trains instant recall of music fundamentals, closing the
          gap between{' '}
          <em>&ldquo;give me a second, I know this&rdquo;</em>&thinsp; and{' '}
          <em>&ldquo;already moving on.&rdquo;</em>
        </Text>
        <Text role='body' as='p'>
          There are likely musical skills you can do with some hesitation and
          mental effort: say locating the G on the B string of your guitar, or
          figuring out what key has 4 flats, or listing the notes in an Em7
          chord. Doing reps makes them automatic, so you can focus on playing.
        </Text>
      </Section>

      <Section heading='How it works'>
        <ul class='home-about-list'>
          <li>
            <strong>Fast drills, many reps.</strong>{' '}
            Each skill asks rapid-fire questions to make the knowledge you
            already have automatic.
          </li>
          <li>
            <strong>Speed is the goal.</strong>{' '}
            When your response time drops from eight seconds to under one,
            you&rsquo;ve stopped counting and started knowing.
          </li>
          <li>
            <strong>Spaced repetition.</strong>{' '}
            The app focuses on what you haven&rsquo;t mastered and brings back
            material before you forget it.
          </li>
          <li>
            <strong>No instrument needed.</strong>{' '}
            Use commuting, waiting, or any other spare minutes to advance your
            playing.
          </li>
          <li>
            <strong>A few minutes at a time.</strong>{' '}
            Designed for short sessions &mdash; two to five minutes, a few times
            a day, over months and years.
          </li>
        </ul>
      </Section>

      <Section heading='Getting started'>
        <ul class='home-about-list'>
          <li>
            Browse <strong>All Skills</strong>{' '}
            to see what&rsquo;s available. Star the ones you want to work on.
          </li>
          <li>
            Your starred skills appear on the <strong>Active</strong>{' '}
            tab with recommendations for what to practice next.
          </li>
          <li>
            Track your speed and coverage in each skill&rsquo;s{' '}
            <strong>Progress</strong> tab.
          </li>
        </ul>
      </Section>
    </Stack>
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
    onSelectSkill,
    onToggleStar,
    onToggleExpand,
    onOpenDev,
  }: {
    starred: Set<string>;
    accordion: Record<string, boolean>;
    progress: Map<string, SkillProgress>;
    recommendations: SkillRecommendation[];
    settings: SettingsController;
    appConfig: AppConfig;
    version: string;
    useSolfege: boolean;
    setUseSolfege: (v: boolean) => void;
    onSelectSkill: (skillId: string) => void;
    onToggleStar: (skillId: string) => void;
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
            onSelectSkill={onSelectSkill}
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
            onSelectSkill={onSelectSkill}
            progress={progress}
          />
        </>
      ),
    },
    {
      id: 'about',
      label: <TabIcon icon='about' text='About' />,
      content: <HomeAboutTab />,
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
  { onSelectSkill, settings, appConfig, showDevLink, version }: {
    onSelectSkill: (skillId: string) => void;
    settings: SettingsController;
    appConfig: AppConfig;
    showDevLink?: boolean;
    version: string;
  },
) {
  const [starred, setStarred] = useState(loadStarredSkills);
  const { progress, recommendations } = useHomeProgress(starred);
  const [accordion, setAccordion] = useState(loadAccordionState);
  const [showDev, setShowDev] = useState(false);
  const [useSolfege, setUseSolfege] = useState(() => settings.getUseSolfege());
  const [tab, setTab] = useState<HomeTab>(
    () => (starred.size > 0 ? 'active' : 'all'),
  );
  const globalEffort = useMemo(getGlobalEffort, [progress]);
  const prefix = useTabsPrefix();

  const handleToggleStar = useCallback((skillId: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      next.has(skillId) ? next.delete(skillId) : next.add(skillId);
      saveStarredSkills(next);
      return next;
    });
  }, []);

  const handleChangeTab = useCallback((t: HomeTab) => {
    setTab(t);
    if (t === 'settings') setUseSolfege(settings.getUseSolfege());
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
    onSelectSkill,
    onToggleStar: handleToggleStar,
    onToggleExpand: handleToggleExpand,
    onOpenDev: showDevLink ? () => setShowDev(true) : undefined,
  });

  if (showDev) {
    return <DevPage version={version} onClose={() => setShowDev(false)} />;
  }

  return (
    <ScreenLayout class='home-screen-layout'>
      <LayoutHeader>
        <HomeHeader
          tab={tab}
          repsToday={globalEffort.dailyReps[toLocalDateString(new Date())] ?? 0}
          totalReps={globalEffort.totalReps}
          daysActive={globalEffort.daysActive}
        />
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
          class='skill-nav'
        />
      </LayoutFooter>
    </ScreenLayout>
  );
}
