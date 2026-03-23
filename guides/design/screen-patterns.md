# Screen & Layout Patterns

Patterns for specific screens and reusable layout techniques.

## Screen Patterns

### Home Screen

Full-screen mode selector. Title uses `--font-display` (DM Serif Display) with
a 32×3px green accent bar beneath it (`.home-title::after`).

Mode cards have a 3px green (`--color-brand`) left border, `--radius-md`, 1px
`--color-border-lighter` border, and a right-facing chevron (`::after`
pseudo-element). Card title is `--text-base` semibold; description is
`--text-sm` muted.

Section labels use `--text-sm`, bold, `--color-text-muted`, Title Case (no
`text-transform`). A thin horizontal rule extends from the label text to the
right edge via `::after` with `flex: 1`. Groups are spaced 2rem apart.

Footer: "Settings" as a text link (`.text-link`), version right-aligned,
separated by 1px `--color-border-lighter` rule.

### Text Link

Reusable `.text-link` class for inline link-styled interactive elements. Muted
color, no border/background, underline on hover. 44px min-height for touch
targets.

### Mode Top Bar

Each mode screen has a simple top bar: ← back button + mode title. Hidden during
active quiz and calibration phases.

### Practice Card

Consolidated single card containing: mastery status → suggestion card →
scope toggles → Practice CTA. Uses `--color-bg` background, `--radius-md`.
When a recommendation exists, a gold suggestion card (`.suggestion-card`)
appears at the top of the Practice Settings zone with an "Accept" button
that pre-fills the scope toggles.

### Quiz Session Info

During active quiz: full-width countdown bar (4px, depletes over 60s, turns gold
in last 10s) + single compact info row (context, time, count, × close).

### Quiz Area

Active quiz area gets `--color-surface` background via phase class on the mode
screen container. Lighter border (1px `--color-border-lighter`) and reduced
padding during active state.

### Round Complete Stats

Three stats in a row: correct (x/y), median time, fluent (x/y). Round number in
heading.

## Layout Patterns

### Vertical centering for quiz content

Quiz content should center vertically in the available viewport height to
prevent top-stacking on larger screens. The quiz area container uses flex
column with `justify-content: center` and a min-height.

```css
.quiz-area {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100dvh - <header-height>);
}
```

**Rationale:** On phones the content fills naturally, but on tablets and
desktop the quiz prompt and buttons stack at the top with large empty space
below. Centering creates balanced whitespace above and below. The countdown
bar and session info stay pinned at the top as flex-shrink: 0 chrome.

### Stat card surface

Round-complete stats and similar summary blocks should live inside a card
surface to provide visual containment.

```css
background: var(--color-bg);
border: 1px solid var(--color-border-lighter);
border-radius: var(--radius-lg);
padding: var(--space-5);
max-width: 360px;
margin: 0 auto;
```

### Two-row answer layout

Modes with 12 answers that map to the chromatic scale use a two-row layout:
top row for "accidental" items (5 buttons), bottom row for "natural" items
(7 buttons). The 14-column grid from `.note-buttons` is the reference
implementation; interval mode follows the same shell.

**Rationale:** The piano mental model is already established by the note
buttons. Intervals map 1:1 to semitones, so the same spatial layout
reinforces the semitone-to-interval association.

### Viewport queries vs. component sizing

Component-level sizing (grids, max-widths) should not vary by viewport width.
Components may render in different contexts — the component preview page, a
screenshot viewport, or the actual app — so viewport-conditional sizing creates
mismatches. Use the container's own `max-width` constraint instead.

Reserve `@media` viewport queries for **structural layout** (body padding, phase
margins) and **typography scaling**, not for component internals.
