// Idle/practice tab components — rendered when the engine is not running.
// Includes practice configuration, level progress, about tab, and the
// IdlePracticeView that composes them.

import type { AdaptiveSelector, SuggestionLine } from '../types.ts';

import type { useLearnerModel } from '../hooks/use-learner-model.ts';
import type { useLevelScope } from '../hooks/use-level-scope.ts';
import type { useQuizEngine } from '../hooks/use-quiz-engine.ts';
import type { usePracticeSummary } from '../hooks/use-practice-summary.ts';

import {
  formatReviewDuration,
  progressBarColors,
  type ProgressSegment,
} from '../stats-display.ts';
import {
  LevelProgressCard,
  LevelToggles,
  PracticeConfig,
  SuggestionLines,
} from '../ui/practice-config.tsx';
import { StatsGrid, StatsLegend, StatsTable } from '../ui/stats.tsx';
import { SPEED_LEVELS } from '../speed-levels.ts';
import { Card, Section, Stack } from '../ui/layout.tsx';
import { PracticeTab } from '../ui/skill-screen.tsx';
import { Text } from '../ui/text.tsx';
import { RepeatMark } from '../ui/repeat-mark.tsx';

import type { SkillController, SkillDefinition } from './types.ts';
import { resolveGroupLabel } from './answer-utils.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute a suggestion line for single-level (no groups) modes. */
export function singleLevelSuggestion(
  selector: AdaptiveSelector,
  allItems: string[],
): SuggestionLine {
  const anySeen = allItems.some((id) => selector.getStats(id) !== null);
  if (!anySeen) return { verb: 'Start', levels: [] };
  // Check review before automatic: stale items need review even if all are
  // fast.  This matches the home-screen recommendation pipeline priority.
  if (selector.checkNeedsReview(allItems)) {
    return { verb: 'Review', levels: [] };
  }
  if (selector.checkAllAutomatic(allItems)) {
    return { verb: 'All items automatic! Practice something else', levels: [] };
  }
  return { verb: 'Practice', levels: [] };
}

// ---------------------------------------------------------------------------
// GroupPracticeContent — practice config for multi-level modes
// ---------------------------------------------------------------------------

/** Build practice content for multi-level modes (groups). */
export function GroupPracticeContent<Q>(
  { def, levelScopeResult }: {
    def: SkillDefinition<Q>;
    levelScopeResult: ReturnType<typeof useLevelScope>;
  },
) {
  const levelScope = def.scope.kind === 'levels' ? def.scope : null;
  if (!levelScope) return null;

  const levelLabels = levelScope.allLevelIds.map((id) => {
    const g = levelScope.levels.find((g) => g.id === id);
    return g ? resolveGroupLabel(g.label) : id;
  });

  return (
    <>
      <PracticeConfig
        mode={levelScopeResult.practiceMode}
        onModeChange={levelScopeResult.setPracticeMode}
        suggestedContent={
          <SuggestionLines lines={levelScopeResult.suggestionLines} />
        }
        customContent={
          <LevelToggles
            labels={levelLabels}
            levelIds={levelScope.allLevelIds}
            active={levelScopeResult.practiceMode === 'custom'
              ? levelScopeResult.enabledLevels
              : levelScopeResult.suggestedScope}
            onToggle={levelScopeResult.scopeActions.toggleLevel}
          />
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// LevelProgressCards — progress display for groups
// ---------------------------------------------------------------------------

/** Build level progress cards for the progress tab. */
export function LevelProgressCards<Q>(
  { def, learner, levelScopeResult }: {
    def: SkillDefinition<Q>;
    learner: ReturnType<typeof useLearnerModel>;
    levelScopeResult: ReturnType<typeof useLevelScope>;
  },
) {
  const levelScope = def.scope.kind === 'levels' ? def.scope : null;
  if (!levelScope) return null;
  return (
    <Stack gap='related' class='level-progress-cards'>
      {levelScope.allLevelIds.map((id) => {
        const g = levelScope.levels.find((g) => g.id === id);
        const itemIds = levelScope.getItemIdsForLevel(id);
        const colors = progressBarColors(learner.selector, itemIds);
        // Read speed + review timing from recommendation result (single source).
        const ls = levelScopeResult.recommendation.levelStatuses
          ?.find((s) => s.levelId === id);
        const sl = ls
          ? SPEED_LEVELS.find((l) => l.key === ls.speedLabel) ?? null
          : null;
        const pill = ls?.reviewInHours != null
          ? (ls.reviewStatus === 'soon' && ls.reviewInHours === 0
            ? 'Review soon'
            : `Review in ${formatReviewDuration(ls.reviewInHours)}`)
          : undefined;
        const skipReason = levelScopeResult.skippedLevels.get(id);
        const status = skipReason === 'mastered'
          ? 'known' as const
          : skipReason === 'deferred'
          ? 'skipped' as const
          : 'normal' as const;
        const label = g
          ? resolveGroupLabel(
            g.longLabel ?? g.label,
          )
          : id;
        return (
          <LevelProgressCard
            key={id}
            label={label}
            statusLabel={sl?.label}
            statusColor={sl?.colorToken}
            pill={pill}
            colors={colors}
            status={status}
            baseline={learner.motorBaseline}
            onToggleKnown={() =>
              skipReason === 'mastered'
                ? levelScopeResult.scopeActions.unskipLevel(id)
                : levelScopeResult.scopeActions.skipLevel(id, 'mastered')}
            onToggleSkip={() =>
              skipReason === 'deferred'
                ? levelScopeResult.scopeActions.unskipLevel(id)
                : levelScopeResult.scopeActions.skipLevel(id, 'deferred')}
          />
        );
      })}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// AboutTab — what you're automating + before/after + description
// ---------------------------------------------------------------------------

export function AboutTab(
  { description, aboutDescription, beforeAfter }: {
    description: string;
    aboutDescription?: string;
    beforeAfter: {
      before: string[] | (() => string[]);
      after: string | (() => string);
    };
  },
) {
  const beforeLines = typeof beforeAfter.before === 'function'
    ? beforeAfter.before()
    : beforeAfter.before;
  const after = typeof beforeAfter.after === 'function'
    ? beforeAfter.after()
    : beforeAfter.after;

  return (
    <Stack gap='section' class='about-tab'>
      <Section heading="What you're automating" gap='group'>
        <Text role='body-secondary' as='p'>
          {description}
        </Text>
        <div class='about-columns'>
          <Card variant='well' class='about-col'>
            <Stack gap='related'>
              <Text role='heading-subsection' as='div'>
                Before
              </Text>
              {beforeLines.map((line, i) => (
                <p key={i} class='about-col-text'>{line}</p>
              ))}
            </Stack>
          </Card>
          <Card class='about-col about-col-after'>
            <Stack gap='related'>
              <Text role='heading-subsection' as='div'>
                After
              </Text>
              <p class='about-col-text'>{after}</p>
            </Stack>
          </Card>
        </div>
      </Section>
      {aboutDescription && (
        <Section heading='Why automate this?' gap='group'>
          <Text role='body' as='p'>
            {aboutDescription}
          </Text>
        </Section>
      )}
      <Text role='status' as='p' class='text-hint'>
        Start practicing on the{' '}
        <RepeatMark size={16} class='about-tab-tip-icon' /> tab below.
      </Text>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// IdlePracticeView — main idle view composing practice + stats + progress
// ---------------------------------------------------------------------------

export function IdlePracticeView<Q>(
  {
    def,
    engine,
    learner,
    ctrl,
    levelScopeResult,
    ps,
    progressSegments,
    onCalibrate,
  }: {
    def: SkillDefinition<Q>;
    engine: ReturnType<typeof useQuizEngine>;
    learner: ReturnType<typeof useLearnerModel>;
    ctrl: SkillController<Q>;
    levelScopeResult: ReturnType<typeof useLevelScope> | null;
    ps: ReturnType<typeof usePracticeSummary>;
    progressSegments: ProgressSegment[];
    onCalibrate?: () => void;
  },
) {
  const hasGroups = def.scope.kind === 'levels' && levelScopeResult;
  const hasStats = def.stats.kind !== 'none' || !!ctrl.renderStats;
  const customItemCount = hasGroups &&
      levelScopeResult.practiceMode === 'custom'
    ? levelScopeResult.enabledItems.length
    : null;

  return (
    <PracticeTab
      onStart={engine.start}
      progressSegments={progressSegments}
      progressKind={hasGroups ? 'multi-level' : 'single-level'}
      progressBaseline={learner.motorBaseline}
      description={def.description}
      scopeValid={!levelScopeResult || levelScopeResult.enabledLevels.size > 0}
      validationMessage='Select at least one level'
      startLabel={customItemCount != null
        ? `Practice (${customItemCount} ${
          customItemCount === 1 ? 'item' : 'items'
        })`
        : undefined}
      practiceContent={hasGroups
        ? (
          <GroupPracticeContent
            def={def}
            levelScopeResult={levelScopeResult}
          />
        )
        : (
          <Stack gap='group' class='practice-config'>
            <Text role='heading-section'>
              Recommendation
            </Text>
            <SuggestionLines
              lines={[singleLevelSuggestion(learner.selector, def.allItems)]}
            />
          </Stack>
        )}
      statsHeading={hasStats ? 'Speed by item' : undefined}
      statsContent={
        <>
          {ctrl.renderStats ? ctrl.renderStats(ps.statsSel) : (
            <>
              {def.stats.kind === 'grid' && (
                <StatsGrid
                  selector={ps.statsSel}
                  colLabels={def.stats.colLabels}
                  getItemId={def.stats.getItemId}
                  notes={def.stats.notes}
                />
              )}
              {def.stats.kind === 'table' && (
                <StatsTable
                  selector={ps.statsSel}
                  rows={def.stats.getRows()}
                  fwdHeader={def.stats.fwdHeader}
                  revHeader={def.stats.revHeader}
                  fwd2Header={def.stats.fwd2Header}
                  rev2Header={def.stats.rev2Header}
                />
              )}
            </>
          )}
          {hasStats && <StatsLegend />}
        </>
      }
      progressExtra={hasGroups
        ? (
          <Section heading='Level progress' gap='group'>
            <LevelProgressCards
              def={def}
              learner={learner}
              levelScopeResult={levelScopeResult}
            />
          </Section>
        )
        : undefined}
      baseline={onCalibrate ? learner.motorBaseline : undefined}
      motorTaskType={def.motorTaskType}
      onCalibrate={onCalibrate}
      activeTab={ps.activeTab}
      onTabSwitch={ps.setActiveTab}
      aboutContent={
        <AboutTab
          description={def.description}
          aboutDescription={def.aboutDescription}
          beforeAfter={def.beforeAfter}
        />
      }
    />
  );
}
