# Practice Tab Boilerplate Deduplication

Date: 2026-02-22
Status: Proposal
Context: Retro from the practice tab IA redesign (PR #99)

## Problem

A pure UI restructuring (reorganizing PracticeCard zones, removing a prop,
changing labels) required touching all 10 mode files. The practice tab layout
should be a detail of the shared component layer, not repeated in every mode.

Each mode repeats three blocks of near-identical code:

1. **`useMemo` calling `computePracticeSummary`** -- identical except for
   `itemNoun` and whether recommendation comes from `useGroupScope` or is null
2. **`<PracticeCard>` JSX** -- identical prop mapping (`summary.statusLabel`,
   `summary.showMastery ? summary.masteryText : undefined`, etc.), only the
   `scope` children vary
3. **`<TabbedIdle>` wrapper** -- identical structure wrapping practice +
   progress tabs

## What varies vs. what doesn't

| Aspect                            | Varies? | How                                              |
| --------------------------------- | ------- | ------------------------------------------------ |
| `summary` -> `PracticeCard` props | No      | Identical in all 10 modes                        |
| `computePracticeSummary` call     | Barely  | `itemNoun` and recommendation source             |
| `scope` children                  | Yes     | none / GroupToggles / StringToggles+NoteFilter   |
| `recommendation` source           | Yes     | null, useGroupScope, or fretboard-custom         |
| TabbedIdle structure              | No      | Identical wrapper                                |

## Suggested approach

The modes already have a `ScopeSpec` type that describes the scope shape
declaratively (`'none' | 'groups' | 'fretboard' | 'note-filter'`). The missing
piece is a hook that bridges from scope spec to practice card props, absorbing
the three duplicated blocks.

```
usePracticeTab(engine, learner, scopeSpec, itemNoun)
  -> { practiceContent, activeTab, setActiveTab }
```

Internally this hook would:

1. Call `computePracticeSummary` (routing recommendation from the right source)
2. Render the correct scope controls from the scope spec
3. Map summary to PracticeCard props
4. Return ready-to-use `practiceContent` for TabbedIdle

Each mode would go from ~30 lines of practice-tab boilerplate to:

```typescript
const { practiceContent, activeTab, setActiveTab } = usePracticeTab(
  engine, learner, scopeSpec, 'positions',
);
```

Mode files stay focused on what's actually unique: question presentation,
answer buttons, and key handling.

## Open questions

- Should the progress tab content also be absorbed, or kept per-mode? Most
  modes render BaselineInfo + StatsToggle + StatsTable/StatsGrid, but fretboard
  renders a heatmap SVG.
- The fretboard mode computes custom recommendation text (with note-filter
  logic). This either needs a callback parameter or stays outside the hook.
- `useGroupScope` is already a shared hook for 6 modes. The new hook would
  compose with it rather than replace it.

## Scope

This is an engineering workstream change (hooks + component structure). Design
identified it because layout changes shouldn't fan out to 10 files.
