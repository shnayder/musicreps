# Home Screen Phase 1: Focus Control

## Problem / Context

The home screen uses track chip filters to show/hide skill groups. This hides
skills in a collapsed "Other skills" section and forces Core to always be
selected. Phase 1 of the home screen recommendations spec replaces this with:

- Accordion sections per track (collapsible, nothing hidden)
- Star/unstar toggle on each skill card (persisted, cross-track working set)
- "Active Skills" section at top showing starred skills with track chips
- Rename "Core" → "Music theory", add "Reading music" track with Key Signatures
- Remove `alwaysSelected` concept and "Other skills" collapsed section

Spec: `plans/product-specs/active/2026-03-13-home-screen-recommendations-spec.md`

## Design

### Data changes (`src/music-data.ts`)

**Track definitions:**
- Rename `core` track: `label: 'Core'` → `label: 'Music theory'`
- Remove `alwaysSelected: true` from core track
- Remove `keySignatures` from core's `skills` array
- Add new track after core:
  ```ts
  { id: 'reading', label: 'Reading music', skills: ['keySignatures'] }
  ```
- Add `--color-track-reading` CSS variable

**Type change:** Remove `alwaysSelected?` from `Track` type (defined in
`music-data.ts` line 135).

### State shape (`src/ui/home-screen.tsx`)

**Remove:** `selectedTracks` localStorage key, `loadSelectedTracks`,
`saveSelectedTracks`, `TrackChips`, `OtherTracks` components.

**Add:** Two new localStorage keys:
- `starredSkills` — `string[]` of mode IDs (e.g., `["fretboard", "keySignatures"]`)
- `trackAccordionState` — `Record<string, boolean>` mapping track ID to
  expanded/collapsed. Default: all expanded.

**New state hooks/helpers:**
- `loadStarredSkills(): Set<string>` — load from localStorage, filter to valid
  mode IDs
- `saveStarredSkills(Set<string>): void`
- `loadAccordionState(): Record<string, boolean>` — default all expanded
- `saveAccordionState(Record<string, boolean>): void`

### Component structure (`src/ui/home-screen.tsx`)

Replace `TrackChips` + `TrackSkillsList` + `OtherTracks` with:

```
HomeScreen
  ├─ ActiveSkills         (starred skills, or empty prompt)
  │   └─ ActiveSkillCard  (card + filled star + track chip label)
  └─ TrackAccordion[]     (one per track)
      ├─ accordion header (track name, expand/collapse toggle)
      └─ SkillCard[]      (existing card + star icon overlay)
```

**SkillCard changes:**
- Add star icon button (☆/★) in top-right corner
- Star button needs `onClick` with `e.stopPropagation()` to prevent card
  navigation
- 44×44px minimum tap target per spec

**ActiveSkillCard:**
- Same content as SkillCard but adds a small track chip label (e.g., "Guitar")
- Ordering: iterate TRACKS in definition order, show starred skills in that
  order

**TrackAccordion:**
- Clickable header with track name + expand/collapse chevron (▸/▾)
- Uses CSS transition for smooth collapse (or native `<details>`/`<summary>`)

### CSS changes (`src/styles.css`)

**Remove:**
- `.track-selection-header` and its `::after` rule
- `.track-chips`, `.track-chip`, `.track-chip.active`, all `.track-chip.active.track-*`
- `.home-other-skills`, its `summary`, `::before`, `[open]` rules

**Add:**
- `.track-accordion` — wrapper for each track section
- `.track-accordion-header` — clickable header with chevron
- `.track-accordion-body` — collapsible content area
- `.active-skills` — section wrapper
- `.active-skills-empty` — empty state prompt text
- `.active-skill-card` — card variant in Active section
- `.active-skill-track-chip` — small track label chip on active cards
- `.skill-card-star` — star toggle button (positioned top-right, 44×44px target)
- `.skill-card-star.starred` — filled star state
- `--color-track-reading` — color for Reading music track
- `.track-group-reading` — track label color
- `.skill-card[data-track='reading']` — card accent color

**Modify:**
- `.home-group-label` — reuse for accordion headers (or replace with new class)

### localStorage migration

On first load with new code:
- `selectedTracks` key can be ignored (no migration needed per spec)
- New `starredSkills` defaults to empty `[]`
- New `trackAccordionState` defaults to all expanded
- Consider clearing `selectedTracks` on first load to avoid confusion

## Implementation Steps

### Step 1: Track data changes

**Files:** `src/music-data.ts`, `src/styles.css`

1. Rename core track label: `'Core'` → `'Music theory'`
2. Remove `alwaysSelected: true` from core track
3. Remove `'keySignatures'` from core's skills array
4. Add `reading` track: `{ id: 'reading', label: 'Reading music', skills: ['keySignatures'] }`
5. Remove `alwaysSelected?` from `Track` type
6. Add `--color-track-reading` CSS variable (pick a color — suggest a muted
   purple/indigo to distinguish from existing warm/cool palette)
7. Add `.track-group-reading` and `.skill-card[data-track='reading']` rules

**Verify:** `deno task ok` passes. Dev server shows "Music theory" and "Reading
music" as separate sections with Key Signatures under Reading music.

### Step 2: Replace track chips with accordion sections

**Files:** `src/ui/home-screen.tsx`, `src/styles.css`

1. Remove `TrackChips` component, `loadSelectedTracks`, `saveSelectedTracks`,
   `STORAGE_KEY`, and the `handleToggle` callback
2. Remove `OtherTracks` component
3. Remove "Select tracks" header from HomeScreen render
4. Add `loadAccordionState`/`saveAccordionState` helpers
5. Add `TrackAccordion` component: header (track label + chevron) + collapsible
   body with skill cards
6. Replace the `selectedTracks`/`deselectedTracks` split in HomeScreen with a
   single TRACKS.map rendering `TrackAccordion` for each
7. Add accordion CSS; remove track-chip and other-skills CSS

**Verify:** All tracks show as collapsible accordions. Expand/collapse persists
across refresh. All skill cards navigate correctly.

### Step 3: Add star toggle to skill cards

**Files:** `src/ui/home-screen.tsx`, `src/styles.css`

1. Add `loadStarredSkills`/`saveStarredSkills` helpers
2. Add `starred` state to HomeScreen using `useState(loadStarredSkills)`
3. Add `handleToggleStar(modeId)` callback with `stopPropagation`
4. Modify `SkillCard` to accept `isStarred` and `onToggleStar` props
5. Render star icon button (☆/★) in top-right corner of each card
6. Add `.skill-card-star` CSS with 44×44px tap target, positioned top-right

**Verify:** Stars toggle visually. Starred state persists across refresh.
Tapping the star does NOT navigate to the mode. Tapping the rest of the card
still navigates.

### Step 4: Add Active Skills section

**Files:** `src/ui/home-screen.tsx`, `src/styles.css`

1. Add `ActiveSkillCard` component — shows filled star, mode name/icon, small
   track chip label
2. Add `ActiveSkills` component — renders starred skills ordered by track
   definition order, or shows empty prompt if none starred
3. Render `ActiveSkills` between header and accordion sections in HomeScreen
4. Add CSS for `.active-skills`, `.active-skill-card`,
   `.active-skill-track-chip`, `.active-skills-empty`

**Verify:** Starring a skill in an accordion section makes it appear in Active
Skills. Unstarring removes it. Empty state shows prompt text. Cards in Active
section navigate to the mode. Order matches track definition order.

### Step 5: Clean up and polish

**Files:** `src/ui/home-screen.tsx`, `src/styles.css`

1. Remove any dead CSS from the old track chip / other skills patterns
2. Clear legacy `selectedTracks` from localStorage on load (one-time cleanup)
3. Visual polish: check spacing between sections, accordion animation, star icon
   sizing
4. Verify keyboard accessibility: accordion headers and star buttons are
   focusable, have aria attributes

**Verify:** Full manual walkthrough. `deno task ok` passes.

## Files Modified

| File                    | Changes                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `src/music-data.ts`     | Rename core, remove alwaysSelected, add reading track, fix type |
| `src/ui/home-screen.tsx`| Replace chips with accordions, add star/active section          |
| `src/styles.css`        | Remove chip/other CSS, add accordion/star/active CSS            |

## Risks and Tricky Parts

1. **Star button vs card tap target.** The star must intercept clicks without
   triggering card navigation. Need `e.stopPropagation()` on the star button's
   `onClick`. The star's 44×44px target overlaps the card's right padding where
   the current chevron (`›`) lives — the chevron should probably move or be
   removed from starred cards in the Active section.

2. **Accordion implementation choice.** Native `<details>`/`<summary>` gives
   free expand/collapse but limited animation control. A manual div-based
   approach gives smooth height transitions but more code. Recommend starting
   with `<details>`/`<summary>` (consistent with the existing `OtherTracks`
   pattern) and upgrading to animated divs only if the UX feels jarring.

3. **Track color for "Reading music".** Need to pick a color that works in both
   the track label and the card accent. The existing palette uses warm gray
   (core), warm orange (guitar), and cool teal (ukulele). A muted
   purple/indigo would provide good contrast.

4. **Navigation focus restoration.** `navigateHome()` in `navigation.ts`
   restores focus to `.home-mode-btn[data-mode="..."]`. This selector will still
   work since SkillCard still uses `data-mode`. But if the user launched from
   the Active section, focus should ideally return there. This is minor polish —
   the current behavior (focusing the card in its track section) is acceptable
   for Phase 1.

5. **Screenshot manifest.** `scripts/screenshot-manifest.ts` may need updating
   if the home screen state names changed, but grep shows no track-specific
   references there — should be fine.

6. **No test file changes expected.** The home screen is not currently
   unit-tested (it's a UI component). Manual verification is the primary testing
   strategy. The `deadline_test.ts` file references `Track` and
   `alwaysSelected` — need to check and update if so.

## Testing

- **Manual:** Full walkthrough of star/unstar, accordion expand/collapse,
  Active section population, empty state, card navigation, keyboard nav
- **Persistence:** Refresh browser after starring skills and collapsing
  accordions — state should be preserved
- **Migration:** Clear localStorage, load app — should show all accordions
  expanded, no skills starred, prompt text in Active section
- **`deno task ok`:** All lint, type check, format, tests, and build pass

## Implementation Notes (added after completion)

### What was done

Implemented all 5 steps as planned. Key components: `TrackAccordion` (collapsible
per-track sections), `SkillCard` (with star toggle), `ActiveSkillCard` (with
track pill above title), `ActiveSkills` (ordered starred skills section with
background). Extracted `SettingsPage` and `SettingsAboutLegal` from `HomeScreen`
to stay under 100-line function limit.

### Deviations from plan

- Used `<div role="button">` instead of `<button>` for skill cards to avoid
  invalid nested `<button>` elements (star button inside card).
- Removed card chevrons entirely (rather than repositioning) after UI review.
- Active skill cards show full content (description + before/after) instead of
  the originally planned compact format, with a pill-style track label above
  the title.
- Active Skills section uses a subtle background (`--color-surface`) for visual
  separation instead of just whitespace.
- "Music theory" track color bumped from near-gray to warm brown for better
  visual identity.
