# Typography System Redesign

> **Implementation deviations from this plan:**
> - 17 roles (not 16): `display-hero` moved to `metric-hero`, metric expanded
>   to 3 variants (hero, primary, info). 69 role properties (not 65).
> - `heading-subsection` size changed from sm → base during visual review.
> - `quiz-instruction` color changed from text-light → text-muted.
> - `metric-info` size is base (not in original plan).
> - See `guides/design/visual-design.md` for the authoritative role table.

## Context

The current typography system has 11 text roles named by appearance/position
(section-header, subsection-header, caption, etc.) plus ~15 bespoke CSS classes
that duplicate palette values. This makes it hard to change a role's recipe
without hunting for every bespoke user. The user wants a clean three-layer
system (palette → semantic roles → component mapping) organized by function,
paralleling how the color system works (47 semantic color tokens in `:root`,
all referenced by name).

## Three-Layer Architecture

```
Layer 1: Palette tokens (raw ingredients)
  --text-xs, --font-semibold, --leading-tight, --color-text, etc.
  Already exists. No changes needed.

Layer 2: Semantic role properties (what the text IS)
  --type-heading-page-size: var(--text-lg);
  --type-heading-page-weight: var(--font-semibold);
  --type-heading-page-leading: var(--leading-tight);
  --type-heading-page-color: var(--color-text);
  NEW. 4 custom properties per role, in :root.

Layer 3: Component mapping (where it's used)
  .mode-title { font-size: var(--type-heading-page-size); ... margin: 0; }
  .text-heading-page { font-size: var(--type-heading-page-size); ... }
  Both bespoke and .text-* classes reference Layer 2, never Layer 1.
```

## Semantic Roles (16 roles, 7 groups)

### Display — big, high-emphasis hero text

| Role | Size | Weight | Leading | Color | Extra |
|------|------|--------|---------|-------|-------|
| `display-brand` | 2xl | normal | tight | text | family: display |
| `display-hero` | 3xl | bold | none | brand | |

### Heading — structural hierarchy

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `heading-page` | lg | semibold | tight | text |
| `heading-section` | base | semibold | tight | text |
| `heading-subsection` | sm | semibold | tight | muted |

### Body — readable content

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `body` | base | normal | normal | text |
| `body-secondary` | sm | normal | snug | muted |

### Label — short functional identifiers

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `label` | sm | medium | none | muted |
| `label-tag` | xs | semibold | none | muted |

### Quiz — drill-specific content text

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `quiz-instruction` | base | semibold | normal | text-light |
| `quiz-prompt` | 2xl | semibold | tight | text |
| `quiz-response` | lg | semibold | none | text |
| `quiz-feedback` | xl | normal | none | text |

### Supporting — tertiary/helper text

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `supporting` | xs | normal | snug | text-light |

### Metric — data values

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `metric` | md | semibold | none | text |

### Status — state communication

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `status` | sm | normal | snug | text |

Status color is applied via variant CSS classes (not separate roles):
`.status-success { color: var(--color-success-text); }`
`.status-error { color: var(--color-error-text); }`
`.status-notice { color: var(--color-notice); }`
`.status-empty { color: var(--color-text-light); font-style: italic; }`

## Custom Property Count

- 16 roles x 4 properties (size, weight, leading, color) = 64
- 1 extra: `--type-display-brand-family` = 1
- **Total: 65 role-level custom properties**

## CSS Naming

- Role properties: `--type-{role}-{property}` (e.g., `--type-heading-page-size`)
- CSS classes: `.text-{role}` (e.g., `.text-heading-page`)
- TextRole type: `'heading-page' | 'quiz-prompt' | ...`

## Component Mapping

Every bespoke text class references role properties for typography, adds its
own layout (margin, padding, display, flex) only. **No typography overrides.**
Changing a role recipe in `:root` cascades to all bespoke users.

The "Non-type extras" column shows non-typography properties that the bespoke
class still owns. Color variants for status/feedback are semantic (the color
IS the meaning), not typography overrides.

### Home screen

| Bespoke class | Role | Non-type extras |
|---|---|---|
| `.home-title` | display-brand | margin, `::after` brand underline |
| `.home-tagline` | body-secondary | margin |
| `.track-accordion-header` | label-tag | flex layout, track color, interactive |
| `.home-mode-name` | heading-section | — |
| `.home-mode-desc` | body-secondary | — |
| `.skill-card-ba` | supporting | grid layout |
| `.active-skills-empty` | status + `.status-empty` | margin |
| `.all-skills-hint` | status + `.status-empty` | margin |
| `.active-skills-done` | status + `.status-success` | success-bg, padding |
| `.active-skill-track-pill` | label-tag | pill padding/radius, track color |
| `.skill-rec-header` | label-tag | notice color |
| `.version` | supporting | — |

### Mode screen

| Bespoke class | Role | Non-type extras |
|---|---|---|
| `.mode-title` | heading-page | margin |
| `.mode-description` | body-secondary | margin |
| `.settings-page-title` | heading-page | margin |
| `.suggestion-card-header` | heading-subsection | notice color |
| `.practice-section-header` | heading-section | — |

### Quiz screen

| Bespoke class | Role | Non-type extras |
|---|---|---|
| `.quiz-instruction` | quiz-instruction | margin |
| `.quiz-prompt` | quiz-prompt | `:empty` display rule |
| `.feedback` | quiz-feedback | `.correct`/`.incorrect` color, margin |
| `.hint` | body-secondary | margin |
| `.keyboard-hint` | body-secondary | pointer:fine media query |
| `.quiz-info-time` | body-secondary | tabular-nums |
| `.answer-input` | quiz-response | border, padding, disabled states |
| `.seq-slot` | quiz-response | border, component tokens |

### Round complete

| Bespoke class | Role | Non-type extras |
|---|---|---|
| `.round-complete-heading` | heading-page | margin |
| `.round-complete-count` | display-hero | — |
| `.round-complete-count-label` | body-secondary | margin |
| `.round-stat-line` | status | — |
| `.round-complete-context` | body-secondary | — |

### Interactive controls (deferred)

Answer buttons, action buttons, tabs, segmented controls, toggles, links,
close button — typography will be addressed in the controls follow-up.

## Migration from Current Roles

| Old role | New role |
|----------|----------|
| `page-title` | `display-brand` |
| `screen-title` | `heading-page` |
| `section-header` | `heading-section` |
| `subsection-header` | `heading-subsection` |
| `label` | `label` (unchanged name) |
| `prompt` | `quiz-prompt` |
| `instruction` | `quiz-instruction` |
| `secondary` | `body-secondary` |
| `caption` | `supporting` |
| `metric` | `metric` (unchanged name) |

## Key Design Decisions

**Zero typography overrides.** Every bespoke class uses its role's recipe
exactly — no size, weight, leading, or color overrides. This required three
visual simplifications:

1. **body-secondary and supporting use snug leading (1.4) instead of normal
   (1.5).** Small text reads fine at tighter leading. This eliminates overrides
   on tagline, mode-description, and skill-card stats.
2. **Round-complete heading uses heading-page as-is (lg/semibold).** Previously
   xl/bold. The celebration context (centered layout, 3xl display-hero below)
   provides the emphasis, not the heading size.
3. **Hint text uses body-secondary (sm/muted) instead of body (base/muted).**
   The hint sits below 2xl prompt and xl feedback — sm is plenty readable and
   improves hierarchy.
4. **No quiz-prompt mobile size override.** The responsive 2rem→1.6rem rule is
   removed. It will return as part of a systematic small-screen pass, not as a
   one-off override in one place.

**quiz-response = lg/semibold.** Matches `.seq-slot`, `.answer-input` text.
Answer BUTTON text (md/medium) is an interactive control, deferred.

**quiz-feedback color is dynamic.** The role defines typography (xl/normal).
Color switches via existing `.correct`/`.incorrect` modifier classes.

**Status is one role + color variants.** Status text (sm/normal/snug/text)
shares a single typography recipe. Color variants (success, error, notice,
empty) are CSS modifier classes, not separate roles.

**label-tag for badges and banners.** xs/semibold covers track pills, rec
banners, and similar small categorical labels. Color (track colors, notice)
is per-component, not a typography override.

## Implementation Steps

### 1. Add role properties to `:root` in styles.css
Add all 65 `--type-*` custom properties, organized by group. Keep palette
tokens (Layer 1) unchanged above.

### 2. Replace `.text-*` CSS classes
Replace the current 10 `.text-*` classes with 16 new ones. Each class
references only `--type-*` properties, never palette tokens directly.

### 3. Update TextRole type and Text component (text.tsx)
Replace the 10-member union with the 16 new role names. Component logic
(`'text-' + role`) still works — no code change needed beyond the type.

### 4. Refactor bespoke CSS classes
For each bespoke class in the component mapping tables above, replace
direct palette token references with `--type-*` role property references.
Keep layout/structural properties (margin, padding, display) as-is.

### 5. Update Text component call sites
Find all `<Text role="...">` usages and update from old role names to new.
Files: mode-screen.tsx, generic-mode.tsx, practice-config.tsx, speed-check.tsx,
scope.tsx, stats.tsx, home-screen.tsx, quiz-ui.tsx.

### 6. Update preview page (preview-tab-design-system.tsx)
Show all 16 roles organized by group. Update type scale, weight, and
line-height sections. Add status variant display.

### 7. Update visual-design.md
Rewrite Typography section to document three-layer architecture, all 16
roles with recipes, component mapping reference.

### 8. Run `deno task ok`
Verify lint, format, type-check, tests, and build all pass.

## Files to Modify

| File | Changes |
|---|---|
| `src/styles.css` | Add 65 role properties to `:root`; replace 10 `.text-*` classes with 16; refactor ~20 bespoke classes to reference `--type-*` |
| `src/ui/text.tsx` | Replace TextRole union (10 → 16 members) |
| `src/ui/mode-screen.tsx` | Update `<Text role="...">` calls |
| `src/declarative/generic-mode.tsx` | Update `<Text role="...">` calls |
| `src/ui/practice-config.tsx` | Update `<Text role="...">` calls |
| `src/ui/speed-check.tsx` | Update `<Text role="...">` calls |
| `src/ui/scope.tsx` | Update `<Text role="...">` calls |
| `src/ui/stats.tsx` | Update `<Text role="...">` calls |
| `src/ui/home-screen.tsx` | Update `<Text role="...">` calls |
| `src/ui/quiz-ui.tsx` | Update `<Text role="...">` calls |
| `src/ui/preview-tab-design-system.tsx` | Redesign typography sections |
| `guides/design/visual-design.md` | Rewrite typography documentation |
| `src/ui/components_test.tsx` | Update any test assertions on class names |

## Verification

1. `deno task ok` — lint, format, type-check, tests, build
2. Visual inspection of preview page `/preview` — all 16 roles render correctly
3. Visual inspection of app — home screen, mode screens, quiz flow, round
   complete all look unchanged (this is a refactor, not a visual change)
