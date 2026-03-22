# Practice Screen Redesign — Implementation Plan

**Spec:** [practice-plan.md](../../product-specs/active/2026-03-17-practice-plan.md)

## Approach

Build components in isolation on the preview page with mock data, verify they
compose correctly, then wire up to real state. This lets us iterate on visual
design before touching app logic.

---

## Phase 0: Prep — Move display strings to mode definitions

Move product/UI strings out of `music-data.ts` into mode definitions.
`music-data.ts` should only contain music theory data.

**Steps:**
1. Add `title`, `description`, `beforeAfter`, and `icon` fields to
   `ModeDefinition` type (some already exist — `name`, `description`,
   `beforeAfter` are there; `icon` is new).
2. Move `MODE_NAMES`, `MODE_DESCRIPTIONS`, `MODE_BEFORE_AFTER` out of
   `music-data.ts`. Each mode definition already has `name`/`description`/
   `beforeAfter` — just make sure the home screen and build template read from
   the definitions instead of the old maps.
3. Move `TRACKS` to a UI-layer file (e.g., `src/tracks.ts` or alongside home
   screen).
4. Eliminate duplicate title strings in `build-template.ts`.
5. Add richer level display names to mode definitions for suggestion text
   (e.g., `longLabel: "Low E and high E strings"` alongside existing `label:
   "E e"`).

**Verify:** `deno task ok` passes, preview page still works, home screen renders
correctly.

---

## Phase 1: New components — preview-first with mock data

Build each new component, add it to the preview page, iterate on visual design.

### 1a. SkillHeader

Replace `ModeTopBar` (title + description) with:
- Title + CloseButton (reuse existing)
- `GroupProgressBar` (reuse existing — same bar as home screen)
- No subtitle (moved to About tab)

Preview with mock progress data for a few states (empty, partial, near-complete).

### 1b. ResponsiveNav

Bottom tab bar on mobile, top tabs on desktop.
- Three tabs: Practice, Progress, About
- Icons: logo variant, bar-graph, info-circle (add to `icons.tsx`)
- CSS breakpoint at 768px switches layout
- Reuse WAI-ARIA pattern from existing `Tabs` component

Preview at both widths. Existing `Tabs` component is a good starting point —
may be able to extend it rather than replace it.

### 1c. PracticeConfigHeader

- Section label ("Practice setup" or similar — TBD)
- `SegmentedControl` for Suggested / Custom (reuse existing component from
  `home-screen.tsx` — may need to extract to shared location first)

### 1d. SuggestionLines

Renders structured recommendation data as separate lines:
```
Review E string
Start A string
```

Input: array of `{ verb: string, levels: string[] }`. Pure display component.

Preview with several mock scenarios: single suggestion, multiple, review-only,
expand-only, mixed.

### 1e. LevelToggles

Simplified version of current `GroupProgressToggles` — just on/off buttons for
each level, no progress bars, no skip menu.
- Level label + toggle state
- Item count summary below: "24 items selected"

Preview with mock level list (8 guitar string groups, some on, some off).

### 1f. LevelProgressCard

For the Progress tab. Each level gets a card:
```
┌─────────────────────────────────────┐
│ E string        [Review] pill   ✓ ✗ │
│ ████████░░░░░░░░  progress bar      │
└─────────────────────────────────────┘
```

- Level label + recommendation pill (reuse/adapt existing `Recommendation`)
- `GroupProgressBar` (reuse existing)
- Check/X icons for "I know this" / "Skip" (tap to toggle, three states:
  normal → known → skipped)

Preview with mock data showing all three states.

**End of Phase 1:** All new components visible on preview page with mock data.
Screenshot and review before proceeding.

---

## Phase 2: Assemble — compose into full layouts in preview

Build the complete tab layouts on the preview page, still with mock data.

### 2a. Practice tab — Suggested mode

```
SkillHeader
  PracticeConfigHeader (Suggested selected)
    SuggestionLines
  ActionButton ("Practice")
ResponsiveNav
```

### 2b. Practice tab — Custom mode

```
SkillHeader
  PracticeConfigHeader (Custom selected)
    LevelToggles + item count
  ActionButton ("Practice")
ResponsiveNav
```

### 2c. Practice tab — Single-level skill

```
SkillHeader
  ActionButton ("Practice")
ResponsiveNav
```

### 2d. Progress tab

```
SkillHeader
  StatsGrid / StatsTable (existing)
  LevelProgressCard × N (new)
  StatsLegend (existing)
  BaselineInfo (existing)
ResponsiveNav
```

Preview all four layouts. Verify visual hierarchy, spacing, mobile vs desktop.

**End of Phase 2:** Full screen mockups on preview page. Screenshot and review.

---

## Phase 3: Data layer — structured recommendations + dual scope

Refactor the data layer before wiring up components.

### 3a. Structured recommendation output

`buildRecommendationText` currently returns a flat string. Refactor to:
- New function returns `Array<{ verb: string, levelLabels: string[] }>` (or
  similar structured type)
- Old `buildRecommendationText` becomes a thin wrapper that joins for
  backward compat (home screen suggestion banners still use it)
- `SuggestionLines` component consumes the structured data directly

### 3b. Dual scope state

- `useGroupScope` currently manages one set of enabled groups
- Add a `practiceMode: 'suggested' | 'custom'` state (persisted per skill)
- Custom mode: reads/writes the existing scope state (unchanged)
- Suggested mode: computes scope on the fly from recommendation engine output,
  does not touch stored custom selections
- Switching modes does not stomp either state

### 3c. Recommendation-to-scope bridge

In Suggested mode, the recommendation output determines which groups are
enabled for the session. Need a function that takes recommendation output and
returns `Set<number>` of group indices to practice.

**Verify:** Tests pass, recommendation output matches before/after for existing
behavior.

---

## Phase 4: Wire up — replace current UI with new components

### 4a. Replace ModeTopBar with SkillHeader

- Swap in SkillHeader across all modes
- Pass progress data from existing `useHomeProgress` / `computeProgressForMode`
- Remove subtitle from header, ensure it appears on About tab

### 4b. Replace Tabs with ResponsiveNav

- Swap tab component in `PracticeTab` / `ModeScreen`
- CSS for bottom nav on mobile, top on desktop
- Preserve tab state behavior

### 4c. Replace PracticeCard with new Practice tab layout

- Detect single-level vs multi-level from mode definition
- Single-level: just ActionButton
- Multi-level: PracticeConfigHeader + mode-specific content
  - Suggested: SuggestionLines from structured recommendation data
  - Custom: LevelToggles with dual scope state
- Wire ActionButton to start session with appropriate scope

### 4d. Add LevelProgressCards to Progress tab

- Render below existing stats, above speed check
- Wire check/X to existing skip/unskip handlers (currently in
  `useGroupScope`)
- Show recommendation pills from `computeRecommendations` output

### 4e. Extract SegmentedControl

Currently lives in `home-screen.tsx`. Extract to `src/ui/segmented-control.tsx`
so both home screen and practice config can use it. (Could do this earlier in
Phase 1c if it helps.)

**Verify:** `deno task ok`, manual testing of all modes, preview page still
works.

---

## Phase 5: Polish + cleanup

- Remove old `PracticeCard`, `GroupProgressToggles` from practice tab (they
  still exist on Progress tab via `LevelProgressCard`)
- Remove `MODE_NAMES` / `MODE_DESCRIPTIONS` / `MODE_BEFORE_AFTER` from
  `music-data.ts` if fully migrated
- Update preview page to show new layouts instead of / in addition to old ones
- Run `/review`

---

## Open questions

- **Practice config section label** — "Practice setup"? "What to practice"?
  Something else? Try a few in preview.
- **Action button stickiness** — spec says content shouldn't scroll for now.
  Revisit if it does.
- **SegmentedControl extraction timing** — Phase 1c or earlier? Depends on
  whether it needs changes for the new context.
- **Logo icon variant** — Need to design a small version of the logo for the
  Practice nav tab. Could be a simple repeat/loop symbol.
