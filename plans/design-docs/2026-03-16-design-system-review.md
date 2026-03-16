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

## Recommended Sequencing

| Phase | Items | What it achieves |
|-------|-------|------------------|
| **A** | 1 (Recipes) + 2 (Spec template) + 3 (Review gate) | Process layer — makes principled design passes possible |
| **B** | 4 (Token completion) + 5 (CSS reorg) | Infrastructure — makes recipes reference concrete tokens |
| **C** | 6 (Component dedup) | Code quality |
| **D** | 7 (Visual regression) | Tooling |

Phase A is pure documentation — no code changes, but it transforms how design
work gets done. Phase B is the CSS infrastructure that makes A enforceable.

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
