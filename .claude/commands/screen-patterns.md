Screen and layout pattern guidance for designing new UI and reviewing changes.

## Reference

Read `guides/design/screen-patterns.md` for the full system: three-act loop,
zone model, content placement framework, layout techniques, density management.

Also read `guides/design/layout-and-ia.md` for the 17 enduring UX principles
that the screen patterns guide references by number.

## Mode

Parse `$ARGUMENTS`:

- **Empty, or a feature/screen name** → design mode
- **"review"** or a commit range → review mode

## Design mode

When the user is designing a new screen, adding a feature, or improving layout:

1. **Identify the phase.** Does this content belong in Configure (idle), Drill
   (active), or Reflect (round-complete)? Apply the density rule: if it makes
   the drill phase denser, it is almost certainly in the wrong place.
2. **Apply the zone model.** Is this chrome (header), content (main), or an
   action (footer)? Content in the wrong zone breaks the placement contract.
3. **If idle phase, pick the tab.** Practice tab = configures the next session.
   Progress tab = shows historical performance. A new tab is a high bar.
4. **Check container placement.** New practice config goes inside the existing
   PracticeCard, not beside it. New stats features slot into the Progress tab's
   modular layout.
5. **Apply layout techniques:**
   - Quiz stage: prompt on top, response on bottom, within thumb reach
   - Card containment: one card = one decision group
   - Chromatic answers: two-row piano layout
   - Main zone: scrollable in idle, fixed in active
   - Viewport queries: structural layout only, never component internals
6. **Check anti-patterns:** scope controls in Progress tab? Stats during
   drilling? Actions in header? New tab for content that fits an existing tab?
7. Present the placement as: content → phase → zone → container.

## Review mode

When reviewing screen or layout changes on a branch or diff:

1. Identify what changed (new content area, layout restructure, or phase
   behavior change).
2. Run the checklist:
   - **Phase fit**: Is the content in the right phase for its user need? Nothing
     non-essential added to the active phase?
   - **Zone compliance**: Chrome in header, content in main, actions in footer?
   - **Density rule**: Idle can be dense; active must be sparse; round-complete
     should decompress?
   - **Scroll behavior**: Idle scrolls, active does not. If active-phase content
     requires scrolling, the content needs reduction.
   - **Card containment**: Configuration grouped in PracticeCard? No split
     logical groups across card boundaries?
   - **Viewport discipline**: No viewport-conditional component sizing? Media
     queries only for structural layout and typography?
   - **Tab discipline**: No new tabs unless the content has a genuinely different
     primary intention?
   - **Transition feel**: Does the phase shift feel right — lights dimming for
     drill, exhale for round-complete?
3. Report findings organized as: correct, warnings, issues.
