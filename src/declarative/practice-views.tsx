// Idle/practice tab components — rendered when the engine is not running.
// Includes practice configuration, level progress, about tab, and the
// IdlePracticeView that composes them.

import type { AdaptiveSelector, SuggestionLine } from '../types.ts';

import type { useLearnerModel } from '../hooks/use-learner-model.ts';
import type { useGroupScope } from '../hooks/use-group-scope.ts';
import type { useQuizEngine } from '../hooks/use-quiz-engine.ts';
import type { usePracticeSummary } from '../hooks/use-practice-summary.ts';

import { formatReviewDuration, progressBarColors } from '../stats-display.ts';
import {
  LevelProgressCard,
  LevelToggles,
  PracticeConfig,
  SuggestionLines,
} from '../ui/practice-config.tsx';
import { StatsGrid, StatsLegend, StatsTable } from '../ui/stats.tsx';
import { SPEED_LEVELS } from '../speed-levels.ts';
import { Card, Section, Stack } from '../ui/layout.tsx';
import { PracticeTab } from '../ui/mode-screen.tsx';
import { Text } from '../ui/text.tsx';
import { RepeatMark } from '../ui/repeat-mark.tsx';

import type { ModeController, ModeDefinition } from './types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a group label that may be a string or a function. */
export function resolveGroupLabel(label: string | (() => string)): string {
  return typeof label === 'function' ? label() : label;
}

/** Compute a suggestion line for single-level (no groups) modes. */
export function singleLevelSuggestion(
  selector: AdaptiveSelector,
  allItems: string[],
): SuggestionLine {
  const anySeen = allItems.some((id) => selector.getStats(id) !== null);
  if (!anySeen) return { verb: 'Start', levels: [] };
  if (selector.checkAllAutomatic(allItems)) {
    return { verb: 'All items automatic! Practice something else', levels: [] };
  }
  if (selector.checkNeedsReview(allItems)) {
    return { verb: 'Review', levels: [] };
  }
  return { verb: 'Practice', levels: [] };
}

// ---------------------------------------------------------------------------
// GroupPracticeContent — practice config for multi-level modes
// ---------------------------------------------------------------------------

/** Build practice content for multi-level modes (groups). */
export function GroupPracticeContent<Q>(
  { def, groupScopeResult }: {
    def: ModeDefinition<Q>;
    groupScopeResult: ReturnType<typeof useGroupScope>;
  },
) {
  const groupScope = def.scope.kind === 'groups' ? def.scope : null;
  if (!groupScope) return null;

  const groupLabels = groupScope.allGroupIds.map((id) => {
    const g = groupScope.groups.find((g) => g.id === id);
    return g ? resolveGroupLabel(g.label) : id;
  });

  return (
    <>
      <PracticeConfig
        mode={groupScopeResult.practiceMode}
        onModeChange={groupScopeResult.setPracticeMode}
        suggestedContent={
          <SuggestionLines lines={groupScopeResult.suggestionLines} />
        }
        customContent={
          <LevelToggles
            labels={groupLabels}
            groupIds={groupScope.allGroupIds}
            active={groupScopeResult.practiceMode === 'custom'
              ? groupScopeResult.enabledGroups
              : groupScopeResult.suggestedScope}
            onToggle={groupScopeResult.scopeActions.toggleGroup}
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
  { def, learner, groupScopeResult }: {
    def: ModeDefinition<Q>;
    learner: ReturnType<typeof useLearnerModel>;
    groupScopeResult: ReturnType<typeof useGroupScope>;
  },
) {
  const groupScope = def.scope.kind === 'groups' ? def.scope : null;
  if (!groupScope) return null;
  return (
    <Stack gap='related' class='level-progress-cards'>
      {groupScope.allGroupIds.map((id) => {
        const g = groupScope.groups.find((g) => g.id === id);
        const itemIds = groupScope.getItemIdsForGroup(id);
        const colors = progressBarColors(learner.selector, itemIds);
        // Read speed + review timing from recommendation result (single source).
        const ls = groupScopeResult.recommendation.levelStatuses
          ?.find((s) => s.groupId === id);
        const sl = ls
          ? SPEED_LEVELS.find((l) => l.key === ls.speedLabel) ?? null
          : null;
        const pill = ls?.reviewInHours != null
          ? (ls.reviewStatus === 'soon'
            ? 'Review soon'
            : `Review in ${formatReviewDuration(ls.reviewInHours)}`)
          : undefined;
        const skipReason = groupScopeResult.skippedGroups.get(id);
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
            onToggleKnown={() =>
              skipReason === 'mastered'
                ? groupScopeResult.scopeActions.unskipGroup(id)
                : groupScopeResult.scopeActions.skipGroup(id, 'mastered')}
            onToggleSkip={() =>
              skipReason === 'deferred'
                ? groupScopeResult.scopeActions.unskipGroup(id)
                : groupScopeResult.scopeActions.skipGroup(id, 'deferred')}
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
  { def, engine, learner, ctrl, groupScopeResult, ps, onCalibrate }: {
    def: ModeDefinition<Q>;
    engine: ReturnType<typeof useQuizEngine>;
    learner: ReturnType<typeof useLearnerModel>;
    ctrl: ModeController<Q>;
    groupScopeResult: ReturnType<typeof useGroupScope> | null;
    ps: ReturnType<typeof usePracticeSummary>;
    onCalibrate?: () => void;
  },
) {
  const hasGroups = def.scope.kind === 'groups' && groupScopeResult;
  const hasStats = def.stats.kind !== 'none' || !!ctrl.renderStats;
  const customItemCount = hasGroups &&
      groupScopeResult.practiceMode === 'custom'
    ? groupScopeResult.enabledItems.length
    : null;

  return (
    <PracticeTab
      onStart={engine.start}
      scopeValid={!groupScopeResult || groupScopeResult.enabledGroups.size > 0}
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
            groupScopeResult={groupScopeResult}
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
              groupScopeResult={groupScopeResult}
            />
          </Section>
        )
        : undefined}
      baseline={onCalibrate ? learner.motorBaseline : undefined}
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
