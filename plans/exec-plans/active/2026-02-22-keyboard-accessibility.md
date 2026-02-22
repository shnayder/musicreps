# Plan: Keyboard Accessibility

## Context

The app has a solid foundation for keyboard use: all interactive elements are
`<button>` elements (not divs), a global `:focus-visible` rule exists
(`styles.css:1497-1513`), and the quiz engine already supports comprehensive
keyboard shortcuts during active play (letters for notes, numbers for
semitones, Space/Enter to advance, Escape to stop).

The gaps are:

1. **Focus indicators** — the global outline is clipped or invisible on some
   elements (e.g., active toggle buttons have brand-colored background matching
   the brand-colored outline).
2. **Focus management** — screen transitions (home↔mode, quiz start/stop,
   round-complete) leave focus stranded on hidden elements.
3. **Settings modal** — no focus trap, no focus restoration on close.
4. **Tab pattern** — Practice/Progress tabs lack ARIA roles and arrow-key
   navigation.
5. **Toggle state** — toggle buttons don't communicate their on/off state
   programmatically (`aria-pressed`).
6. **Fretboard hover cards** — progress heatmap info is mouse-only (no keyboard
   access to hover cards on SVG circles).

## Strategy

Six incremental chunks, each independently shippable. Each chunk builds on the
previous but can be paused without leaving the app in a broken state. CSS-only
changes come first (lowest risk), then behavioral focus management, then ARIA
attributes.

---

## Chunk 1: Universal Focus Indicators (CSS only)

**Goal**: Visible keyboard focus on every interactive element in the app.

**File**: `src/styles.css`

Add targeted `:focus-visible` rules after the existing block at line 1513.
Principle: `outline-offset: -2px` for compact elements; `outline-color: white`
for elements with brand-colored backgrounds where the default outline is
invisible.

```css
/* Toggle buttons — inset outline, white on active state */
.string-toggle:focus-visible,
.distance-toggle:focus-visible,
.notes-toggle:focus-visible {
  outline-offset: -2px;
}
.string-toggle.active:focus-visible,
.distance-toggle.active:focus-visible,
.notes-toggle.active:focus-visible {
  outline-color: white;
}

/* Tab buttons */
.mode-tab:focus-visible {
  outline-offset: -2px;
}

/* Answer buttons */
.answer-btn:focus-visible,
.note-btn:focus-visible {
  outline-offset: -2px;
}

/* Round-complete buttons */
.round-complete-continue:focus-visible {
  outline-color: white;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4);
}
.round-complete-stop:focus-visible {
  outline-offset: -2px;
}

/* Back button, close buttons */
.mode-back-btn:focus-visible,
.quiz-header-close:focus-visible {
  outline-offset: -2px;
}

/* Stats toggle */
.stats-toggle-btn:focus-visible {
  outline-offset: -2px;
}
.stats-toggle-btn.active:focus-visible {
  outline-color: white;
}

/* Settings modal */
.settings-close-btn:focus-visible {
  outline-offset: 2px;
}
.settings-toggle-btn:focus-visible {
  outline-offset: -2px;
}
.settings-toggle-btn.active:focus-visible {
  outline-color: white;
}

/* Home screen gear, recommendation, baseline, run buttons */
.home-settings-btn:focus-visible,
.practice-rec-btn:focus-visible,
.baseline-run-btn:focus-visible {
  outline-offset: 2px;
}
```

**Verification**: Tab through every screen — home, each mode idle/practice/progress, settings modal, active quiz, round-complete. Every focused button must have a visible indicator.

---

## Chunk 2: Focus Management on Screen Transitions

**Goal**: When navigating between screens, move focus to a sensible target so
keyboard users are never stranded on a hidden element.

**Files**: `src/navigation.ts`, `src/hooks/use-phase-class.ts`

### 2a. Home → Mode (`switchTo`)

After the mode is activated and visible, focus the `.start-btn`:

```ts
function switchTo(modeId: string): void {
  // ... existing show/hide/activate logic ...

  requestAnimationFrame(() => {
    const modeEl = document.getElementById('mode-' + modeId);
    const target = modeEl?.querySelector('.start-btn') as HTMLElement | null;
    if (target) target.focus();
  });
}
```

### 2b. Mode → Home (`navigateHome`)

Focus the mode button that was selected, so the user returns to their place in
the list. Capture `currentModeId` before clearing it:

```ts
function navigateHome(): void {
  const previousModeId = currentModeId;
  // ... existing deactivate/show logic ...

  requestAnimationFrame(() => {
    if (previousModeId && homeScreen) {
      const btn = homeScreen.querySelector(
        `.home-mode-btn[data-mode="${previousModeId}"]`
      ) as HTMLElement | null;
      if (btn) btn.focus();
    }
  });
}
```

### 2c. Phase transitions (quiz stop, round-complete)

Extend `usePhaseClass` to accept an optional focus-target map and move focus
when the phase changes:

```ts
export function usePhaseClass(
  container: HTMLElement,
  phase: EnginePhase | 'calibration',
  focusTargets?: Partial<Record<EnginePhase | 'calibration', string>>,
): void {
  useEffect(() => {
    // ... existing class logic ...

    if (focusTargets) {
      const selector = focusTargets[phase];
      if (selector) {
        requestAnimationFrame(() => {
          const el = container.querySelector(selector) as HTMLElement | null;
          el?.focus();
        });
      }
    }
  }, [phase, container]);
}
```

Each mode component passes:

```ts
usePhaseClass(container, calibrating ? 'calibration' : engine.state.phase, {
  idle: '.start-btn',
  'round-complete': '.round-complete-continue',
});
```

This focuses the Start Quiz button when the quiz stops (phase → idle) and the
Keep Going button when a round ends.

**Verification**: Tab to a home mode button → Enter → focus lands on Start
Quiz. Press Escape from idle → focus returns to the home mode button. Start a
quiz → press Escape → focus moves to Start Quiz. Complete a round → focus is on
Keep Going.

---

## Chunk 3: Settings Modal Focus Trap and Restoration

**Goal**: Tab cycles within the settings modal; focus restores on close.

**File**: `src/settings.ts`

### 3a. ARIA attributes

```ts
modal.setAttribute('role', 'dialog');
modal.setAttribute('aria-modal', 'true');
modal.setAttribute('aria-label', 'Settings');
```

### 3b. Focus on open + restore on close

```ts
let previousFocus: HTMLElement | null = null;

function open(): void {
  updateToggleState();
  overlay.classList.add('open');
  previousFocus = document.activeElement as HTMLElement | null;
  (closeBtn as HTMLElement).focus();
}

function close(): void {
  overlay.classList.remove('open');
  if (previousFocus) {
    previousFocus.focus();
    previousFocus = null;
  }
}
```

### 3c. Focus trap

```ts
function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const focusable = modal.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
```

Attach on open, remove on close:

```ts
function open(): void {
  // ... existing ...
  modal.addEventListener('keydown', trapFocus);
}
function close(): void {
  modal.removeEventListener('keydown', trapFocus);
  // ... existing ...
}
```

**Verification**: Open settings → focus on close button. Tab wraps between
close → A B C → Do Re Mi → close. Shift+Tab wraps in reverse. Escape → focus
returns to Settings gear button.

---

## Chunk 4: Tab Navigation with ARIA Tab Pattern

**Goal**: Practice/Progress tabs follow WAI-ARIA Tabs pattern — arrow keys
switch tabs, Tab key enters the panel.

**File**: `src/ui/mode-screen.tsx`

Update `TabbedIdle`:

1. Tab container: `role="tablist"`
2. Each tab: `role="tab"`, `aria-selected`, `aria-controls`, roving
   `tabIndex` (active tab = 0, inactive = -1)
3. Tab panels: `role="tabpanel"`, matching `id`
4. Arrow key handler: Left/Right switches and focuses the other tab

```tsx
export function TabbedIdle(
  { activeTab, onTabSwitch, practiceContent, progressContent, modeId }: {
    activeTab: 'practice' | 'progress';
    onTabSwitch: (tab: 'practice' | 'progress') => void;
    practiceContent: ComponentChildren;
    progressContent: ComponentChildren;
    modeId?: string;
  },
) {
  const tabs = ['practice', 'progress'] as const;
  const prefix = modeId ? `${modeId}-` : '';

  function handleTabKeyDown(
    e: KeyboardEvent,
    current: typeof tabs[number],
  ) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = current === 'practice' ? 'progress' : 'practice';
      onTabSwitch(next);
      requestAnimationFrame(() => {
        const container = (e.target as HTMLElement).parentElement;
        const nextBtn = container?.querySelector(
          `[data-tab="${next}"]`
        ) as HTMLElement;
        nextBtn?.focus();
      });
    }
  }

  return (
    <>
      <div class='mode-tabs' role='tablist'>
        {tabs.map(tab => (
          <button
            type='button'
            role='tab'
            aria-selected={activeTab === tab}
            aria-controls={`${prefix}tabpanel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            class={'mode-tab' + (activeTab === tab ? ' active' : '')}
            data-tab={tab}
            onClick={() => onTabSwitch(tab)}
            onKeyDown={(e) => handleTabKeyDown(e, tab)}
          >
            {tab === 'practice' ? 'Practice' : 'Progress'}
          </button>
        ))}
      </div>
      <div
        id={`${prefix}tabpanel-practice`}
        role='tabpanel'
        class={'tab-content tab-practice' +
          (activeTab === 'practice' ? ' active' : '')}
      >
        {practiceContent}
      </div>
      <div
        id={`${prefix}tabpanel-progress`}
        role='tabpanel'
        class={'tab-content tab-progress' +
          (activeTab === 'progress' ? ' active' : '')}
      >
        {progressContent}
      </div>
    </>
  );
}
```

Each mode component passes `modeId` to avoid duplicate IDs (10 mode screens
coexist in the DOM).

**Verification**: Tab to Practice tab → Right arrow → Progress tab activates
and receives focus. Left arrow → Practice tab comes back. Tab from tab row
enters the panel content.

---

## Chunk 5: Toggle Buttons `aria-pressed`

**Goal**: Communicate toggle state programmatically via `aria-pressed`.

**Files**: `src/ui/scope.tsx`, `src/ui/stats.tsx`, `src/settings.ts`

Add `aria-pressed={active.has(i)}` (or equivalent) to every toggle button:

- `GroupToggles`: `aria-pressed={active.has(i)}`
- `StringToggles`: `aria-pressed={active.has(i)}`
- `NoteFilter`: `aria-pressed={naturalActive}` / `aria-pressed={accActive}`
- `NotesToggles`: `aria-pressed={active.has(n)}`
- `StatsToggle`: `aria-pressed={active === 'retention'}` / `aria-pressed={active === 'speed'}`
- Settings notation toggle (imperative DOM): `btn.setAttribute('aria-pressed', String(isActive))` in `updateToggleState()`

All these buttons already work with Enter/Space since they are `<button>`
elements. This is purely about communicating state.

**Verification**: Tab to any toggle → check `aria-pressed` matches visual
state → press Enter → verify `aria-pressed` updates.

---

## Chunk 6: Fretboard Hover Cards for Keyboard Users (DEFERRED)

**Status**: Deferred — the fretboard hover cards are informational-only and
lower priority. Implement later if keyboard users request it.

**Goal**: Make fretboard progress heatmap hover cards accessible via keyboard
focus on SVG position circles.

**Files**: `src/modes/fretboard/fretboard-mode.tsx`, `src/styles.css`

### 6a. Make progress fretboard circles focusable

In `setupHoverCard`, add `tabindex="0"` and `role="button"` to each `.fb-pos`
circle (only on the progress fretboard, not the quiz fretboard):

```ts
wrapper.querySelectorAll<SVGElement>('.fb-pos').forEach(circle => {
  circle.setAttribute('tabindex', '0');
  circle.setAttribute('role', 'button');
  // aria-label with note name + position
  const s = parseInt(circle.getAttribute('data-string')!);
  const f = parseInt(circle.getAttribute('data-fret')!);
  const q = fb.parseFretboardItem(s + '-' + f);
  circle.setAttribute('aria-label',
    displayNote(q.currentNote) + ', ' +
    displayNote(instrument.stringNames[s]) + ' string fret ' + f
  );
});
```

### 6b. Add focus/blur handlers

Extract the card-positioning logic from `onOver` into a shared `showCard(el)`
function, then add `focusin`/`focusout` listeners:

```ts
function showCard(el: Element) {
  // ... shared positioning + content logic from onOver ...
}

function onFocus(e: FocusEvent) {
  const el = e.target as Element;
  if (el.classList.contains('fb-pos') && card) showCard(el);
}

function onBlur(e: FocusEvent) {
  const el = e.target as Element;
  if (el.classList.contains('fb-pos') && card) card.classList.remove('visible');
}

svg.addEventListener('focusin', onFocus);
svg.addEventListener('focusout', onBlur);
```

### 6c. SVG circle focus style

```css
.fb-pos:focus-visible {
  stroke: var(--color-brand);
  stroke-width: 2;
  outline: none; /* outline doesn't render consistently on SVG */
}
```

### Tab order concern

Guitar has 78 circles, ukulele has 52. Tabbing through all of them is slow but
acceptable because: (a) they are only in the Progress tab (not default view),
(b) the hover card is informational, and (c) users can Tab past the fretboard
quickly. If this proves tedious in practice, a follow-up could add roving
tabindex with arrow-key grid navigation within the SVG.

**Verification**: Progress tab in guitar/ukulele mode → Tab into the SVG →
focus visible on a circle → hover card appears with note + mastery info → Tab
to next circle → card updates → Tab out → card disappears.

---

## Implementation Order

```
Chunk 1: Focus indicators        (CSS only — zero risk)
   ↓
Chunk 2: Focus on transitions    (navigation.ts, use-phase-class.ts, mode components)
   ↓
Chunk 3: Settings focus trap     (settings.ts — independent, could parallelize with 2)
   ↓
Chunk 4: Tab ARIA pattern        (mode-screen.tsx + all mode components pass modeId)
   ↓
Chunk 5: Toggle aria-pressed     (scope.tsx, stats.tsx, settings.ts — small adds)
   ↓
Chunk 6: Fretboard hover cards   (fretboard-mode.tsx, styles.css — most complex, lowest priority)
```

Chunks 1–2 have the broadest impact and should ship first. Chunks 4–5 are
ARIA polish. Chunk 6 only affects 2 of 10 modes and is the most complex.

## Out of Scope

- **Screen reader live regions** (`aria-live`): This plan focuses on keyboard
  operability, not full screen reader support. Live announcements for quiz
  feedback would be a separate effort.
- **Skip links**: Not needed — there is no repeated navigation header blocking
  content access.
- **Keyboard shortcut hints in the UI**: The quiz already shows hint text
  ("Tap anywhere or press Space for next"). Adding visible shortcut indicators
  to idle screens would clutter the mobile-first UI and can be revisited
  separately.

## Critical Files

| File | Changes |
|------|---------|
| `src/styles.css` | Focus indicator rules (chunk 1), SVG focus style (chunk 6) |
| `src/navigation.ts` | Focus on home↔mode transitions (chunk 2) |
| `src/hooks/use-phase-class.ts` | Optional focus-target map on phase change (chunk 2) |
| `src/ui/mode-screen.tsx` | ARIA tab pattern for TabbedIdle (chunk 4) |
| `src/ui/scope.tsx` | `aria-pressed` on toggle buttons (chunk 5) |
| `src/ui/stats.tsx` | `aria-pressed` on StatsToggle (chunk 5) |
| `src/settings.ts` | Focus trap, restore, ARIA dialog, `aria-pressed` (chunks 3, 5) |
| `src/modes/fretboard/fretboard-mode.tsx` | Focusable SVG circles + focus handlers (chunk 6) |
| All 10 mode `.tsx` files | Pass `modeId` to TabbedIdle (chunk 4), pass focus targets to `usePhaseClass` (chunk 2) |
