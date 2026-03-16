# Structural Recipe Components: ActionButton + Text

Add `ActionButton` and `Text` components that encode the type hierarchy and
button variant recipes into the component system. Migrate existing call sites.

Source: item 8 from
[design system review](../../design-docs/2026-03-16-design-system-review.md).

Assumes the CSS token completion plan is already done (shadow, transition,
opacity, font-weight tokens exist).

## Problem / Context

The design system has implicit recipes — subsection headers are always
sm/600/muted, primary actions are always filled green with shadow — but
components re-derive these independently via per-component CSS classes. There's
no way to say "subsection header" or "secondary action button" in JSX and get
the correct visual treatment automatically.

This leads to:
- 4 different class names for the same subsection-header recipe
- 5+ places manually composing action button classes
- New features re-deriving styling instead of composing from recipes

## Design

### ActionButton component

A thin wrapper that maps a `variant` prop to the correct CSS classes.

```tsx
// src/ui/action-button.tsx

import type { ComponentChildren } from 'preact';

export type ActionVariant = 'primary' | 'secondary';

export function ActionButton(
  { variant, children, onClick, disabled, class: extra, ...rest }: {
    variant: ActionVariant;
    children: ComponentChildren;
    onClick: () => void;
    disabled?: boolean;
    class?: string;
    [key: string]: unknown;
  },
) {
  const cls = variant === 'primary'
    ? 'page-action-btn page-action-primary'
    : 'page-action-btn page-action-secondary';
  const full = cls + (extra ? ' ' + extra : '');
  return (
    <button
      type='button'
      tabIndex={0}
      class={full}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
```

Key decisions:
- Reuses existing `.page-action-btn` + `.page-action-primary/secondary` CSS.
  No new CSS classes needed for the base variants.
- The `class` prop allows adding extra classes (e.g., `next-btn` for
  positioning, `page-action-correct` for feedback state).
- Spread `...rest` supports `aria-*`, `style`, `id`, etc.
- `StartButton` is a special case — it uses `.start-btn` (different CSS from
  `.page-action-btn`) and has a disabled state with an aria-describedby. It
  should stay as-is; it's already a single-purpose component. ActionButton
  covers the 5+ other action button sites.

### Text component

Maps a `role` prop to a CSS class that encodes the type hierarchy recipe.

```tsx
// src/ui/text.tsx

import type { ComponentChildren } from 'preact';

export type TextRole =
  | 'section-header'
  | 'subsection-header'
  | 'label'
  | 'secondary'
  | 'caption'
  | 'metric';

export function Text(
  { role, children, class: extra, as: Tag = 'span', ...rest }: {
    role: TextRole;
    children: ComponentChildren;
    class?: string;
    as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3';
    [key: string]: unknown;
  },
) {
  const cls = 'text-' + role + (extra ? ' ' + extra : '');
  return <Tag class={cls} {...rest}>{children}</Tag>;
}
```

Key decisions:
- `as` prop for element type (default `span`). Some roles want block elements
  (`div`, `h2`), others want inline (`span`).
- 6 roles cover the high-value part of the type hierarchy. `page-title`,
  `mode-title`, and `body` are omitted — they're one-off or default cases that
  don't benefit from abstraction.
- No `body` role — that's the default styling, no class needed.

### New CSS classes

Add to `src/styles.css` in a new section after the tokens (or at the start of
the utilities section):

```css
/* ==========================================================================
   TEXT ROLES (type hierarchy recipes)
   ========================================================================== */
.text-section-header {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text);
}
.text-subsection-header {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-muted);
}
.text-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-muted);
}
.text-secondary {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.text-caption {
  font-size: var(--text-xs);
  color: var(--color-text-light);
}
.text-metric {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--color-text);
}
```

These classes DO NOT replace the existing per-component classes. The migration
replaces the JSX element's class attribute, and the per-component CSS rule
becomes dead code that gets removed in the same step. Some per-component classes
have additional layout properties (margin, padding, display) beyond the type
recipe — those stay on a wrapper or get moved to a layout-specific class.

## Implementation Steps

### Step 1: Add ActionButton component

Create `src/ui/action-button.tsx` with the code above. No other changes.
Verify `deno task ok`.

### Step 2: Migrate action button call sites

Replace manual button construction with `<ActionButton>` at these sites:

**a) RoundCompleteActions** (`src/ui/mode-screen.tsx`)

Before:
```tsx
<button type='button' tabIndex={0}
  class='page-action-btn page-action-primary' onClick={onContinue}>
  Keep Going
</button>
<button type='button' tabIndex={0}
  class='page-action-btn page-action-secondary' onClick={onStop}>
  Stop
</button>
```
After:
```tsx
<ActionButton variant='primary' onClick={onContinue}>Keep Going</ActionButton>
<ActionButton variant='secondary' onClick={onStop}>Stop</ActionButton>
```

**b) SpeedCheckIntro** (`src/ui/speed-check.tsx`)

Before:
```tsx
<button type='button' tabIndex={0}
  class='calibration-action-btn' onClick={onStart}>
  Start
</button>
```
After:
```tsx
<ActionButton variant='primary' class='calibration-action-btn'
  onClick={onStart}>Start</ActionButton>
```

Note: keeps `calibration-action-btn` class for the extra layout styling
(centering, width). Only the base button treatment comes from ActionButton.
Actually, check the CSS — if `.calibration-action-btn` duplicates
`.page-action-btn` properties, remove the duplication and let ActionButton
handle it. If it only adds layout (width, margin), keep it as an extra class.

**c) SpeedCheckResults** (`src/ui/speed-check.tsx`)

Same pattern as (b):
```tsx
<ActionButton variant='primary' class='calibration-action-btn'
  onClick={() => onComplete(baseline)}>Done</ActionButton>
```

**d) BaselineInfo rerun button** (`src/ui/speed-check.tsx`)

Before:
```tsx
<button type='button' tabIndex={0}
  class='baseline-rerun-btn' onClick={onRun}>
  {btnLabel}
</button>
```
After:
```tsx
<ActionButton variant='secondary' class='baseline-rerun-btn'
  onClick={onRun}>{btnLabel}</ActionButton>
```

Keep `baseline-rerun-btn` for the size/layout overrides (smaller font, less
padding). Strip any color/weight properties from `.baseline-rerun-btn` CSS that
now duplicate `.page-action-secondary`.

**e) FeedbackDisplay next button** (`src/ui/quiz-ui.tsx`)

This one is trickier — it has dynamic feedback-state classes and a conditional
visibility style.

Before:
```tsx
let btnCls = 'next-btn page-action-btn page-action-primary';
if (correct === true) btnCls += ' page-action-correct';
else if (correct === false) btnCls += ' page-action-wrong';
// ...
<button type='button' class={btnCls} onClick={onNext}
  style={onNext ? undefined : { visibility: 'hidden' }}>
  {label}
</button>
```
After:
```tsx
let extraCls = 'next-btn';
if (correct === true) extraCls += ' page-action-correct';
else if (correct === false) extraCls += ' page-action-wrong';
// ...
<ActionButton variant='primary' class={extraCls} onClick={onNext!}
  style={onNext ? undefined : { visibility: 'hidden' }}>
  {label}
</ActionButton>
```

The `!` on `onNext!` is because ActionButton's onClick is non-optional, but
the button is hidden when onNext is undefined. Alternatively, pass a no-op:
`onClick={onNext ?? (() => {})}`.

**f) Suggestion card accept buttons** (`src/ui/mode-screen.tsx`)

Two instances — one inline in PracticeCard, one in standalone Recommendation.
Both:
```tsx
<ActionButton variant='secondary' class='suggestion-card-accept'
  onClick={onApply}>Accept</ActionButton>
```

Verify `deno task ok` after all migrations. Spot-check the app visually.

### Step 3: Clean up redundant CSS

After ActionButton migration, review these CSS rules for properties that now
duplicate `.page-action-btn` + `.page-action-primary/secondary`:

- `.calibration-action-btn` — check if it only adds layout or also duplicates
  button base styles. Remove duplicated properties.
- `.baseline-rerun-btn` — same check. It likely has size overrides to keep.
- `.suggestion-card-accept` — same check.

DO NOT remove these class names from CSS entirely if they still carry layout or
sizing rules. Only strip the properties that `.page-action-btn` already provides
(background, color, border, font-weight, border-radius, cursor, touch-action,
min-height).

### Step 4: Add Text component and CSS classes

Create `src/ui/text.tsx` with the code above. Add the `.text-*` CSS classes
to `src/styles.css`. Verify `deno task ok`.

### Step 5: Migrate Text call sites — subsection-header

Replace per-component subsection-header classes:

**a) BaselineInfo header** (`src/ui/speed-check.tsx`)

Before: `<div class='baseline-header'>Speed check</div>`
After: `<Text role='subsection-header' as='div'>Speed check</Text>`

Remove `.baseline-header` CSS rule (or strip it to layout-only if it has
margin/padding).

**b) Suggestion card header** (`src/ui/mode-screen.tsx`, 2 instances)

Before: `<div class='suggestion-card-header'>Suggestion</div>`
After: `<Text role='subsection-header' as='div' class='suggestion-card-header'>Suggestion</Text>`

Keep `.suggestion-card-header` if it has layout properties (margin-bottom,
etc.). Strip font-size/weight/color.

**c) Round complete overall label** (`src/ui/mode-screen.tsx`)

Before: `<div class='round-complete-overall-label'>Overall</div>`
After: `<Text role='subsection-header' as='div'>Overall</Text>`

Remove `.round-complete-overall-label` CSS or strip to layout-only.

### Step 6: Migrate Text call sites — label

**a) Toggle group labels** (`src/ui/scope.tsx`, 4 instances)

Before: `<span class='toggle-group-label'>Groups</span>`
After: `<Text role='label'>Groups</Text>`

Keep `.toggle-group-label` CSS only if it has layout beyond the type recipe.

**b) Settings label** (`src/ui/home-screen.tsx`)

Before: `<div class='settings-label'>Note names</div>`
After: `<Text role='label' as='div'>Note names</Text>`

**c) BaselineInfo label** (`src/ui/speed-check.tsx`)

Before: `<span class='baseline-label'>Response time</span>`
After: `<Text role='label'>Response time</Text>`

**d) Practice status prefix** (`src/ui/mode-screen.tsx`)

Before: `<span class='practice-status-prefix'>Status</span>`
After: `<Text role='label'>Status</Text>`

### Step 7: Migrate Text call sites — caption, metric, secondary

**caption:**

Before: `<div class='baseline-explanation'>Timing thresholds...</div>`
After: `<Text role='caption' as='div'>Timing thresholds are based on this measurement.</Text>`

Before: `<span class='baseline-default-tag'>(default)</span>`
After: `<Text role='caption'>(default)</Text>`

Keep `.baseline-default-tag` if it has italic or other non-type styling.

**metric:**

Before: `<span class='baseline-value'>{value}{tag && <>{tag}</>}</span>`
After: `<Text role='metric'>{value}{tag && <>{tag}</>}</Text>`

**secondary** (selective — only where it replaces a class that exactly matches
the secondary recipe):

Before: `<div class='baseline-explanation'>...</div>` (already migrated above)
Before: `<span class='suggestion-card-text'>{text}</span>`
After: `<Text role='secondary'>{text}</Text>`

### Step 8: Clean up dead CSS

After all migrations, audit the CSS for classes that are no longer referenced
in any JSX:

Check each removed class with `grep -r 'className' src/` to confirm it's dead.
Only remove rules where the entire selector is dead. If a class is still used
for layout but the type recipe properties were stripped in steps 3/5-7, the rule
stays.

Expected dead CSS candidates:
- `.baseline-header` (type properties only — remove if no layout)
- `.baseline-label` (type properties only)
- `.baseline-explanation` (type properties only — but check for margin)
- `.round-complete-overall-label` (type properties only)

### Step 9: Update guides

**`guides/design/visual-design.md`** — add a "Structural Components" section:

```markdown
## Structural Components

These Preact components encode design recipes so the correct visual
treatment is automatic.

### ActionButton

```tsx
import { ActionButton } from './ui/action-button.tsx';

<ActionButton variant='primary' onClick={start}>Practice</ActionButton>
<ActionButton variant='secondary' onClick={stop}>Stop</ActionButton>
```

Renders a `.page-action-btn` with the correct variant class. Use for all
flow-initiating and flow-stopping buttons. NOT for answer buttons, toggles,
close buttons, or tabs.

### Text

```tsx
import { Text } from './ui/text.tsx';

<Text role='subsection-header' as='div'>Speed check</Text>
<Text role='label'>Response time</Text>
<Text role='metric'>{value}</Text>
<Text role='caption'>Explanation text</Text>
```

Maps content role to the type hierarchy recipe. Use when an element's styling
should match a standard text role. NOT for quiz prompts, answer button text,
or one-off elements with their own sizing.
```

Also add the Type Hierarchy table from the design system review to the
Typography Scale section, referencing the Text component roles.

### Step 10: NOT in scope

These elements are deliberately NOT migrated:

- **StartButton** — already a dedicated component with its own CSS
  (`.start-btn`), disabled state, and aria-describedby. Different visual
  treatment from `.page-action-primary` (has shadow, different sizing).
- **Close buttons** (×) — navigation affordance, not an action button. Different
  interaction grammar.
- **Tab buttons** — WAI-ARIA tab pattern with role, aria-selected, tabindex
  management. Different component category.
- **Toggle buttons** — multi-select semantics with aria-pressed. Different
  interaction grammar.
- **Answer buttons** — quiz response semantics with feedback states. Completely
  different component.
- **Home mode cards** — card-level click targets, not buttons.
- **Quiz prompt text** — has its own responsive sizing (1.6rem on mobile).
- **Stats table text** — data table content, not semantic text roles.
- **Preview page headings** — dev-only page, not production UI.

## Files Modified

| File | Changes |
|------|---------|
| `src/ui/action-button.tsx` | **New** — ActionButton component |
| `src/ui/text.tsx` | **New** — Text component |
| `src/ui/mode-screen.tsx` | Migrate RoundCompleteActions, suggestion card accept, practice-status-prefix, suggestion-card-header, round-complete-overall-label |
| `src/ui/speed-check.tsx` | Migrate calibration buttons, BaselineInfo button, baseline-header, baseline-label, baseline-value, baseline-explanation |
| `src/ui/quiz-ui.tsx` | Migrate FeedbackDisplay next button |
| `src/ui/scope.tsx` | Migrate toggle-group-label (4 instances) |
| `src/ui/home-screen.tsx` | Migrate settings-label |
| `src/styles.css` | Add `.text-*` classes, clean up dead CSS |
| `guides/design/visual-design.md` | Document structural components |

## Testing

- `deno task ok` after each step
- Visual spot-check: compare Speed Check (intro, running, results),
  round-complete screen, practice card with recommendation, progress tab
  baseline info. All should look identical.
- Search for dead CSS: after step 8, grep for each removed class name across
  all source files to confirm no references remain.

## Implementation Notes (added after completion)
