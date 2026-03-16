# Design System Review: Top Improvement Opportunities

## Context

Music Reps has excellent design foundations — mature IA principles (17 of them),
well-documented visual design guide, 95%+ CSS token coverage, a declarative
component architecture, and solid iteration tooling. But there's a gap between
the principles layer (which is great) and the implementation layer (which is
good but ad-hoc). The result: features like Speed Check end up as "an
inconsistent mess" that gets cleaned up through dozens of incremental tweaks
("bigger... no, too big... more blue") rather than being derived correctly in
one principled pass.

The root cause isn't missing CSS variables — it's that there's no systematic
bridge from **brand/product promises → design principles → visual recipes →
implementation**. The principles say "content hierarchy follows interaction
priority" but don't tell you what font-size a subsection header gets. The design
guide catalogs individual tokens but doesn't compose them into reusable patterns.
The review checklist checks "did you use tokens?" but not "is the visual
hierarchy correct?"

This plan addresses the problem at three levels: process, system, and
infrastructure.

---

## 1. Visual Design Recipes — The Missing Bridge (High Impact)

### Problem

The design guides have two layers today:

- **Principles** (abstract): "Content hierarchy follows interaction priority,"
  "Label everything," "Minimize chrome during quiz"
- **Tokens** (concrete): `--text-sm: 0.85rem`, `--color-text-muted: hsl(30,3%,40%)`

What's missing is the **recipe layer** — the composable patterns that tell you:
"Given this content role, here's the exact visual treatment." Without recipes,
every feature re-derives its styling from scratch, leading to inconsistency and
tweaking cycles.

### What Exists Implicitly

The codebase already has implicit recipes. Section headers appear in 4+ forms,
but 3 are identical (sm/600/muted with different class names):

| Role | Size | Weight | Color | Current classes |
|------|------|--------|-------|-----------------|
| Page title | `--text-2xl` | 400 | `--color-text` | `.home-title` |
| Mode title | `--text-lg` | 600 | `--color-text` | `.mode-title` |
| Section header | `--text-base` | 600 | `--color-text` | `.practice-section-header` |
| Subsection header | `--text-sm` | 600 | `--color-text-muted` | `.baseline-header`, `.round-complete-overall-label`, `.suggestion-card-header` |
| Label | `--text-sm` | 500 | `--color-text-muted` | `.toggle-group-label`, `.settings-label` |
| Body | `--text-base` | 400 | `--color-text` | (default) |
| Secondary body | `--text-sm` | 400 | `--color-text-muted` | various |
| Caption | `--text-xs` | 400 | `--color-text-light` | `.baseline-explanation` |
| Metric value | `--text-md` | 600 | `--color-text` | `.baseline-value` |

Similarly, buttons have an implicit variant taxonomy:

| Variant | Role | Visual | Current classes |
|---------|------|--------|-----------------|
| Primary action | Initiate flow | Filled green, shadow, bold | `.start-btn`, `.page-action-primary` |
| Secondary action | Cancel/alternative | Outlined, muted | `.page-action-secondary`, `.stop-btn` |
| Answer | Quiz response | Outlined, equal weight | `.answer-btn`, `.note-btn` |
| Toggle | Multi-select filter | Surface bg, active = dark | `.string-toggle`, `.distance-toggle` |
| Text link | Tertiary nav | Muted text, underline on hover | `.text-link` |

And there's an implicit elevation scale:

| Level | Shadow | Usage |
|-------|--------|-------|
| Flat | none | Default surfaces |
| Raised | `0 1px 4px rgba(0,0,0,0.1)` | Pressed buttons |
| Card | `0 2px 8px rgba(0,0,0,0.12)` | CTAs, cards |
| Popover | `0 4px 12px rgba(0,0,0,0.12)` | Menus, overlays |

### Solution: Document Recipes in `visual-design.md`

Add three new sections to the visual design guide:

1. **Type Hierarchy** — content role → size + weight + color mapping (table
   above). When you need to render a section header, look up the recipe. No
   guessing.

2. **Button Variant Taxonomy** — role → visual treatment mapping. When you need
   a button, pick the variant. The interaction grammar principle (#14) demands
   this but it's not documented.

3. **Elevation Scale** — semantic levels → shadow values. Tokenize as
   `--shadow-sm/md/lg`.

4. **Info Hierarchy Pattern** — "label: value / explanation" pattern already
   described for BaselineInfo, but should be elevated to a reusable recipe for
   any metric display.

### Why This Matters

With recipes, redesigning Speed Check becomes deterministic:
- BaselineInfo header → subsection header recipe → `--text-sm`, 600, muted
- Baseline value → metric value recipe → `--text-md`, 600, text
- Explanation → caption recipe → `--text-xs`, light
- Run button → secondary action recipe → outlined, muted
- Calibration action buttons → primary action recipe → filled green

No tweaking. The recipe tells you the answer. Review checks whether you applied
the right recipe, not whether the font size "looks right."

**Files:** `guides/design/visual-design.md`

---

## 2. Design Spec Template for Visual Work (High Impact)

### Problem

The feature-process.md has excellent templates for product specs (question
formats, items, grouping) and implementation plans (data structures, steps,
files). But there's no template for **visual design work** — redesigning a
feature's appearance, cleaning up layout, improving information hierarchy.

When someone wants to fix Speed Check, the current process is:
1. Notice it looks wrong
2. Start tweaking CSS
3. Screenshot → feedback → tweak → repeat

There's no step that says "derive the correct design from principles before
touching code."

### Solution: Add a Visual Design Spec Template

Add to `feature-process.md`:

```markdown
### Visual Design Spec

Write when **redesigning or polishing a feature's visual appearance**. Typical
for layout cleanups, hierarchy improvements, or design system alignment.

#### Template

# {Feature} — Visual Design

## Current State
What it looks like now. Screenshot or description of issues.

## Content Hierarchy
List elements in interaction-priority order per state. For each element:
- Content role (from type hierarchy recipe)
- Visual treatment (derived from recipe)
- Spacing relationship to neighbors

## Component Composition
Which existing component patterns are composed:
- Button variant (primary/secondary/answer/toggle)
- Container type (card/section/inline)
- Info hierarchy (label-value-explanation)

## Deviations from Recipes
Any intentional departures from standard recipes, with rationale.

## States
Describe each state independently (principle #1).
```

### Why This Matters

This template forces the "derive before implementing" step. Speed Check
redesign becomes: list the content hierarchy → look up each element's recipe →
write down the composition → review the spec → then implement. One pass.

**Files:** `guides/feature-process.md`

---

## 3. Design Review Gate (High Impact)

### Problem

The current review checklist (`review-checklist.md`) has a "Visual design
consistency" section that checks infrastructure concerns: "No hardcoded colors,"
"Touch targets ≥ 44px," "Brand color only for CTAs." These are necessary but
insufficient.

What's missing: **"Is the visual hierarchy correct?"** Does the content ordering
match interaction priority? Is each text element using the right recipe? Are
related controls grouped? Is the information density appropriate?

The Layout & IA section of the checklist is closer, but it's checking structural
concerns (states distinct, controls grouped, labels present) rather than
evaluating whether the visual derivation from principles is correct.

### Solution: Add Design Derivation Checks

Add to the review checklist's Visual Design section:

- [ ] **Type hierarchy matches content role.** Each text element uses the
      documented recipe for its content role (heading, label, body, caption,
      metric). No ad-hoc font-size/weight/color combinations.
- [ ] **Button variants match interaction role.** Primary actions use primary
      styling, secondary use secondary, etc. No role confusion.
- [ ] **Elevation matches prominence.** Popovers above cards above flat
      surfaces. Shadow tokens used consistently.
- [ ] **Info hierarchy pattern applied.** Metric displays use "label: value /
      explanation" pattern with correct visual weight (value dominant, label
      quiet, explanation smallest).
- [ ] **Spacing follows rhythm.** Section gaps use `--space-5` or `--space-6`.
      No abrupt dense→empty transitions.

### Why This Matters

Makes the recipe layer enforceable. Review catches "this subsection header is
using `--text-base` instead of `--text-sm`" as a structural issue, not a
subjective aesthetic judgment.

**Files:** `.claude/commands/review-checklist.md`

---

## 4. CSS Token Completion (Medium Impact — Infrastructure)

These are the concrete token gaps that support the recipe layer. Without
tokenized shadows, transitions, and opacities, recipes can't reference them.

### 4a. Shadow/Elevation Tokens

5-6 `box-shadow` values hardcoded as inline `rgba()`. Define `--shadow-sm`,
`--shadow-md`, `--shadow-lg` in `:root`. Replace 6 usages.

### 4b. Transition Duration Tokens

19 `transition:` declarations with hardcoded durations. The same
`background 0.15s ease, color 0.15s ease, border-color 0.15s ease` appears 5+
times. Define `--transition-fast` (0.1s), `--transition-base` (0.15s),
`--transition-slow` (0.3s).

### 4c. Opacity Tokens

19 `opacity:` declarations with 5 values. Disabled state uses 0.5 in most
places but 0.4 for split-note buttons — same semantic state, different visual.
Define `--opacity-disabled`, `--opacity-dimmed`, `--opacity-pressed`. Normalize.

### 4d. Hardcoded Value Sweep

- `border-radius: 4px` → `var(--radius-sm)` on `.group-progress-bar`
- `font-size: 14px` → `var(--text-sm)` on `.group-skip-btn`
- Mobile quiz prompt `1.6rem` → derive from scale
- Touch target `44px` → `var(--size-touch-target)`

### 4e. Z-Index Scale

Only 2 values exist (1 and 100). Define `--z-raised`, `--z-popover`. Trivial.

### 4f. Font Weight Tokens

400/500/600 used consistently but not tokenized. Define `--font-normal`,
`--font-medium`, `--font-semibold` to complete the typography token set and
make recipes reference them.

**Files:** `src/styles.css`, `guides/design/visual-design.md`

---

## 5. CSS File Organization (Medium Impact)

### Problem

2194-line `styles.css` with inconsistent section boundaries. Finding where
toggle or calibration styles live requires scanning.

### Solution

Add structured table of contents and clear section delimiters. Group by concern:
Tokens → Base → Layout → Navigation → Settings → Practice/Scope → Quiz →
Answer Buttons → Feedback → Stats → Fretboard → Sequential → Utilities.

Keep as single file (esbuild inlines it). The goal is navigability.

**Files:** `src/styles.css`

---

## 6. Component Deduplication (Lower Impact)

Two real DRY violations:

**a)** `StatsSelector` type defined identically in `src/declarative/types.ts`
and `src/ui/stats.tsx`. Define once in `src/types.ts`.

**b)** Recommendation card JSX duplicated inside `PracticeCard` and as
standalone `Recommendation` component in `src/ui/mode-screen.tsx`. Compose.

**Files:** `src/ui/mode-screen.tsx`, `src/declarative/types.ts`, `src/ui/stats.tsx`

---

## 7. Visual Regression Diffing (Lower Impact)

### Problem

`ui-iterate` captures multi-version screenshots but has no pixel diff. Review
is manual side-by-side comparison.

### Solution

Add `pixelmatch` to `ui-iterate capture`. Compute diff image between new
version and previous. Include in review HTML with changed/unchanged badge.

**Files:** `scripts/ui-iterate.ts`

---

## 8. Structural Recipes — Built Into Components (High Impact)

### Problem

Items 1-3 above rely on documentation and review to ensure recipes are followed.
That works, but it means every developer must remember to look up the type
hierarchy, pick the right CSS class, and apply it correctly. The component
system itself doesn't enforce recipes — you can render a `<div>` with any
class you want.

The question: which recipes can be built into the component system so you just
say "secondary action button" or "subsection header" and get all the correct
visual treatment automatically?

### Current State

The component system is **class-based with no variant abstraction**:

- **Button components** (`NoteButtons`, `NumberButtons`, etc.) emit hardcoded CSS
  class names. They take interaction props (`onAnswer`, `feedback`) but zero
  styling props. The visual recipe is split between the component (which picks
  the class) and CSS (which defines the class).

- **Layout components** (`PracticeCard`, `ModeScreen`, `QuizArea`) are structural
  shells. `RoundCompleteActions` hardcodes `page-action-primary` and
  `page-action-secondary`. `StartButton` hardcodes `start-btn`. There's no way
  to say "give me a secondary action button here."

- **Text elements** emit per-component class names (`.baseline-header`,
  `.suggestion-card-header`, `.round-complete-overall-label`) that all resolve to
  the same CSS recipe (sm/600/muted). The recipe is correct in 3 of 4 cases, but
  it's accidental — each component independently chose the right values.

- **Mode definitions** (`ButtonsDef`) have no styling fields. A definition says
  `{ kind: 'note' }`, not `{ kind: 'note', variant: 'secondary' }`.

### What Can Be Structural

Three categories, ordered by leverage:

#### A. Action Button Component (High leverage, low effort)

**Today:** 5+ places manually compose button classes for primary/secondary
actions. `RoundCompleteActions` hardcodes both. `StartButton` hardcodes primary.
`BaselineInfo` hardcodes secondary. `SpeedCheckIntro`/`SpeedCheckResults`
hardcode primary for calibration.

**Proposed:** Single `ActionButton` component with a `variant` prop:

```tsx
type ActionVariant = 'primary' | 'secondary';

function ActionButton({ variant, label, onClick }: {
  variant: ActionVariant;
  label: string;
  onClick: () => void;
}) {
  const cls = variant === 'primary'
    ? 'page-action-btn page-action-primary'
    : 'page-action-btn page-action-secondary';
  return <button type="button" tabIndex={0} class={cls} onClick={onClick}>{label}</button>;
}
```

All action buttons across the app use this. The recipe (filled green vs outlined
muted, shadow, font weight, focus-visible, hover, active) is encoded once in
CSS and bound to the component. You can't accidentally create a primary-looking
button with secondary behavior.

**What it replaces:** Manual class composition in `RoundCompleteActions`,
`StartButton`, `BaselineInfo`, `SpeedCheckIntro`, `SpeedCheckResults`, and any
future action buttons.

**What it doesn't replace:** Answer buttons (`NoteButtons`, `NumberButtons`,
etc.) — these are a different category with their own feedback/narrowing
behavior. Toggle buttons — these have active/inactive state semantics.

#### B. Text Role Component (High leverage, medium effort)

**Today:** 15+ places emit text with per-component class names that all resolve
to one of ~8 type hierarchy recipes. Examples:

- `.baseline-header`, `.suggestion-card-header`, `.round-complete-overall-label`
  → all subsection-header recipe (sm/600/muted)
- `.toggle-group-label`, `.settings-label` → all label recipe (sm/500/muted)
- `.baseline-explanation` → caption recipe (xs/400/light)

Each component independently re-derives the same visual treatment.

**Proposed:** `Text` component with a `role` prop:

```tsx
type TextRole =
  | 'section-header'    // base/600/text
  | 'subsection-header' // sm/600/muted
  | 'label'             // sm/500/muted
  | 'body'              // base/400/text
  | 'secondary'         // sm/400/muted
  | 'caption'           // xs/400/light
  | 'metric';           // md/600/text

function Text({ role, children, class: extra }: {
  role: TextRole;
  children: ComponentChildren;
  class?: string;
}) {
  const cls = `text-${role}` + (extra ? ` ${extra}` : '');
  return <span class={cls}>{children}</span>;
}
```

CSS defines each role once:
```css
.text-subsection-header { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-muted); }
.text-label             { font-size: var(--text-sm); font-weight: 500; color: var(--color-text-muted); }
.text-caption           { font-size: var(--text-xs); font-weight: 400; color: var(--color-text-light); }
```

Then `BaselineInfo` changes from:
```tsx
<div class='baseline-header'>Speed check</div>
<span class='baseline-label'>Response time</span>
<div class='baseline-explanation'>Timing thresholds...</div>
```
to:
```tsx
<Text role='subsection-header'>Speed check</Text>
<Text role='label'>Response time</Text>
<Text role='caption'>Timing thresholds...</Text>
```

The visual treatment is now structural. You can't accidentally give a subsection
header the wrong font size — the component enforces it.

**Migration path:** Add `Text` component and the `.text-*` CSS classes. Migrate
components incrementally — new code uses `<Text>`, old code keeps working until
touched. No big-bang rewrite needed.

**What it doesn't replace:** Page title and mode title — these are one-off
elements that don't need abstraction. Quiz prompt text — this has its own
sizing/animation behavior.

#### C. Metric Display Component (Medium leverage, low effort)

**Today:** The "label: value / explanation" pattern appears in:
- `BaselineInfo` (speed-check.tsx) — "Response time: 1.0s / Timing thresholds..."
- Round complete stats (mode-screen.tsx) — "This round: 8/10 / Overall: mastered"
- Practice status (mode-screen.tsx) — status label + value

Each independently arranges label/value/explanation with per-component classes.

**Proposed:** `MetricDisplay` component:

```tsx
function MetricDisplay({ label, value, tag, explanation }: {
  label: string;
  value: string;
  tag?: ComponentChildren;       // e.g., "(default)" badge
  explanation?: string;
}) {
  return (
    <div class='metric-display'>
      <Text role='label'>{label}</Text>
      <Text role='metric'>{value}{tag && <> {tag}</>}</Text>
      {explanation && <Text role='caption'>{explanation}</Text>}
    </div>
  );
}
```

This composes `Text` (item B above) and encodes the info hierarchy pattern:
value visually dominant, label quiet, explanation smallest. Spacing between
elements is defined once in `.metric-display` CSS.

### What Should Stay Documentary (Not Structural)

- **Answer button styling** — already uniform via CSS class. The variants are
  feedback states (correct/wrong/reveal), not design variants. The component
  already handles this through `feedback` and `narrowing` props.

- **Toggle button styling** — has active/inactive/skipped/recommended states
  that are toggle-specific semantics, not generic button variants.

- **Elevation** — better as CSS tokens (`--shadow-sm/md/lg`) than as component
  props. Elevation is a property of the CSS class, not something you typically
  compose at the JSX level.

- **Spacing rhythm** — spacing between sections is a CSS layout concern, not a
  component concern. Tokenize via `--space-*` variables and enforce via review.

### Why This Matters

The documentary layer (items 1-3) establishes what the recipes ARE. The
structural layer (this item) makes them the path of least resistance. Together:

| Layer | Enforces | Catches errors |
|-------|----------|----------------|
| **Documentation** (visual-design.md) | Defines correct recipes | At spec-writing time |
| **Components** (ActionButton, Text, MetricDisplay) | Makes correct recipes the default | At coding time (wrong variant = TypeScript error) |
| **Review** (checklist) | Verifies recipes were applied correctly | At review time |

Without components: developer reads guide → picks class → reviewer checks.
With components: developer picks variant → component applies class → reviewer
verifies variant choice. The "pick the right class name from memory" step
disappears.

### Implementation Sketch

1. Add `ActionButton` component to `src/ui/buttons.tsx` (or new
   `src/ui/action-button.tsx`). Migrate `RoundCompleteActions`, `StartButton`,
   calibration buttons. ~30 min.

2. Add `Text` component to new `src/ui/text.tsx`. Add `.text-*` CSS classes.
   Migrate `BaselineInfo` as proof of concept. Leave other components for
   incremental migration. ~1 hr.

3. Add `MetricDisplay` to `src/ui/mode-screen.tsx` (composes `Text`). Migrate
   `BaselineInfo` metric section. ~30 min.

4. Update `visual-design.md` to reference the structural components alongside
   the CSS recipes: "Use `<Text role='subsection-header'>` or apply class
   `.text-subsection-header`."

**Files:** `src/ui/buttons.tsx` or new `src/ui/action-button.tsx`,
new `src/ui/text.tsx`, `src/ui/mode-screen.tsx`, `src/ui/speed-check.tsx`,
`src/styles.css`, `guides/design/visual-design.md`

---

## Recommended Sequencing

| Phase | Items | What it achieves |
|-------|-------|------------------|
| **A** | 1 (Recipes) + 2 (Spec template) + 3 (Review gate) | Process layer — defines what correct looks like |
| **B** | 8 (Structural recipes: ActionButton, Text, MetricDisplay) | Component layer — makes correct the default |
| **C** | 4 (Token completion) + 5 (CSS reorg) | Infrastructure — tokenizes remaining raw values |
| **D** | 6 (Component dedup) | Code quality |
| **E** | 7 (Visual regression) | Tooling |

Phase A defines the recipes in documentation. Phase B encodes the highest-value
recipes into components so they're structural, not just documentary. Phase C
completes the CSS token system so recipes can reference tokens rather than raw
values. Phases D-E are independent cleanup.

---

## Concrete Example: Speed Check Redesign (Using This System)

With the proposed system, fixing Speed Check would go:

1. **Write visual design spec** (template from item 2):
   - Content hierarchy: baseline header (subsection) → metric (label + value) →
     explanation (caption) → action (secondary button)
   - Each element's recipe looked up from type hierarchy
   - Component composition: info hierarchy pattern for metric display

2. **Implement in one pass** — recipes tell you exact tokens for each element.
   No ambiguity about font-size, weight, color, or spacing.

3. **Review against checklist** (item 3): reviewer verifies each element uses
   the correct recipe. Disagreements are about "is this element a subsection
   header or a label?" (a meaningful design question), not "should this be 14px
   or 13.6px?" (a tweaking question).

---

## Verification

- `deno task ok` passes after CSS changes (phases B-C)
- `deno task iterate` captures before/after for any visual changes
- Recipe documentation reviewed against actual CSS for accuracy
- Speed Check used as validation case: can it be redesigned in one principled
  pass using the new recipes?
