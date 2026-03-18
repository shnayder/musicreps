# Componentize Logical UI Elements

**Goal:** Extract every logical UI concept into a named component, per the
principle added to `guides/coding-style.md`. This enables isolated rendering
in preview, easier visual iteration, and testability.

## Clear Cases — definitely should be components

These are duplicated patterns or clearly named design concepts currently
inlined:

| # | Component to create | Where today | File(s) |
|---|---|---|---|
| 1 | `CloseButton` ✓ | Inline `×` button | `mode-screen.tsx` (ModeTopBar, QuizSession), `home-screen.tsx` (SettingsPage) |
| 2 | `TabButton` ✓ | Inline tab button with active state | `mode-screen.tsx` (TabbedIdle), `home-screen.tsx` (HomeScreenTabs) |
| 3 | `TabPanel` ✓ | Inline tabpanel with conditional active class | `mode-screen.tsx` (TabbedIdle), 3 repetitions |
| 4 | `AboutTab` — skipped | About tab is a design stub; needs design before componentizing. Also: `speed-tap-mode.tsx` should be subsumed into generic-mode first (engineering debt). Dead CSS: `.mode-before-after` and friends. | `generic-mode.tsx`, `speed-tap-mode.tsx` |
| 5 | `SkillCardHeader` ✓ | Icon + text header | `home-screen.tsx` (SkillCard and ActiveSkillCard) |
| 6 | `TrackPill` ✓ | `<span class='active-skill-track-pill pill-${trackId}'>` | `home-screen.tsx` (ActiveSkillCard) |
| 7 | `StatsDisplay` — skipped | Single callsite, not duplicated. Real fix is subsuming speed-tap into generic-mode first. | `generic-mode.tsx` (IdlePracticeView) |
| 8 | Fix `PracticeCard` ✓ | Uses inline `recBlock` instead of `<Recommendation>` | `mode-screen.tsx` |

## Less Clear Cases — defer or decide

These have some hesitation; flag when reached:

| # | Candidate | Hesitation |
|---|---|---|
| A | `SettingsSection` | Three `<section class='settings-section'>` blocks — structural wrapper, not a design concept |
| B | `TogglePair` / `BinaryToggle` | Only in SettingsPage; may not generalize |
| C | `StatusDisplay` (label+value row) | BaselineInfo and PracticeCard versions share structure but different semantics |
| D | `DefaultTag` | Single-use `(default)` label — may be too small to be worth it |
| E | Progress bar slices | `SkillProgressBar` already exists; just use it more consistently instead of creating more |

## Process

Work through the clear cases in order. For each:
1. Create the component in the appropriate `src/ui/` file
2. Replace all existing inline usages
3. Add to preview page if it has interesting visual states
4. Run `deno task ok` to verify

After clear cases: revisit the less-clear list and decide with user.
