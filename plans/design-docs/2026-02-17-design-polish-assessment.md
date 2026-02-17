# Design Polish Assessment

**Date:** 2026-02-17
**Status:** Assessment / prioritized recommendations
**Context:** The visual design overhaul (2026-02-14 through 2026-02-16) established
a solid design system — CSS custom properties, spacing/typography tokens, warm
neutral palette, sage brand color, accessible heatmap, phase-driven visibility.
This document assesses where we are now and prioritizes the next wave of polish
to move from "clean and functional" toward "distinctive and polished."

---

## Current State Summary

### What works well

- **Color system architecture.** 40+ CSS custom properties across 6 categories.
  Sage brand is distinctive and cohesive. Semantic colors (success/error/focus)
  are sacrosanct and never confused with brand. Warm neutral chrome avoids
  sterile wireframe feel.
- **Heatmap scale.** Terracotta-to-sage sequential scale is colorblind-safe,
  readable in grayscale, and aesthetically intentional (bright ends, faded
  middle).
- **Spacing and typography tokens.** 6 spacing tokens + 7 type tokens cover all
  needs without ad-hoc values. Consistent application throughout.
- **Interactive states.** Hover/active/focus-visible are distinct and snappy.
  Touch targets meet 48px minimum. Transitions are 0.1–0.15s (responsive without
  being jarring).
- **Phase-driven visibility.** Quiz state cleanly hides irrelevant chrome. The
  drill-first aesthetic principle is implemented at the CSS level.
- **Accessibility.** WCAG AA contrast, focus-visible keyboard support,
  prefers-reduced-motion, no red/green sole differentiators.

### The gap

Despite a solid system, the actual visual experience reads as **clean wireframe
with a green button**. Specific symptoms:

- **Almost everything is white or light gray.** The sage color only appears on
  CTAs and active toggles. During a quiz, users see white buttons with gray
  borders on a gray card on a gray background. There's very little color or
  visual interest.
- **No visual personality.** System fonts, flat surfaces, no icons, no
  animations. Could be any web app. The vision calls for "warm practice space"
  but the implementation delivers "neutral utility."
- **The quiz loop feels flat.** Users spend 90%+ of their time in the
  question → answer → feedback cycle, and each of those moments is visually
  minimal: plain text prompt, white buttons, colored text feedback.
- **Home screen is a text list.** First impression is plain white cards with
  text. No progress indicators, no color coding, no visual hierarchy beyond
  font weight.
- **State transitions are instant.** Phase changes (idle → active → round
  complete) are show/hide with no animation, making the app feel static.

---

## Prioritized Recommendations

### Tier 1: Core loop and first impression (highest impact)

#### 1. Answer button treatment during quiz

**Why:** This is the single highest-leverage surface — users look at and interact
with answer buttons hundreds of times per session.

**Current:** White background (`#fff`), `2px solid` gray border, gray hover.
Functional but visually identical to a form input.

**Options to explore:**
- Subtle colored background tint (very light sage, or warm cream) instead of
  pure white
- Soft shadow or inset border that makes buttons feel "pressable" / tactile
- Brief visual pulse on the correct answer button after answering (not just the
  feedback text — the button itself flashes green)
- Consider whether the accidental-note buttons (which already use
  `--color-surface-accent`) hint at a pattern worth extending

**Constraint:** Must not slow down rapid-fire drilling. Animations must be fast
(< 200ms) and not block interaction.

#### 2. Feedback moment

**Why:** Correct/incorrect is the emotional peak of each interaction. Currently
it's just colored text (`✓ Correct!` in green, `✗ Wrong` in red at 1.5rem).
This is where users feel either satisfaction or the sting of getting it wrong.

**Options to explore:**
- Brief background wash on the quiz area (light green for correct, light red for
  incorrect) that fades over ~300ms
- The correct answer button highlights green so users always see which button was
  right (especially useful on wrong answers)
- Feedback text could be bolder / larger — it currently competes with the
  quiz prompt (`2rem`) at only `1.5rem`
- Wrong-answer buttons could briefly flash their border red

**Constraint:** Must feel instant, not animated. Users answer every 1–3 seconds.

#### 3. Home screen personality

**Why:** First screen users see. Sets the tone for the entire app. Currently a
plain list of white cards with text.

**Options to explore:**
- Colored left-border accent on each mode card (could reflect progress via
  heatmap colors, or use group-specific hues)
- Tiny progress indicator per mode (colored dot, mini bar, or fraction like
  "12/78") showing mastery level
- Give mode group labels ("Fretboard," "Theory," etc.) more visual weight —
  they're currently tiny uppercase text that's easy to miss
- Consider a subtle branded header treatment (not a full "hero" but something
  more than just "Fretboard Trainer" in bold text)

**Constraint:** Must stay fast to scan. Users should be able to tap into their
mode within 1-2 seconds.

#### 4. Practice card visual hierarchy

**Why:** The main idle-state surface. Contains status, recommendation, scope
toggles, and the start CTA all in one undifferentiated gray box.

**Options to explore:**
- Subtle section dividers or spacing zones within the card (status area →
  recommendation → scope → CTA)
- Give the recommendation area a distinct visual treatment (light amber/gold
  strip, since recommendations already use orange elsewhere)
- Status area could use color-coded indicators (mastered items in sage,
  learning items in a warm amber)
- The start button already has brand treatment but the card could do more to
  draw the eye toward it

### Tier 2: Polish and reward moments

#### 5. Round-complete screen

**Why:** Users see this after every 60-second round. Natural moment for
satisfaction or motivation. Currently centered text with three numbers and two
buttons.

**Options to explore:**
- Stat numbers colored based on performance (sage/green for good, neutral for
  average)
- "Keep Going" CTA could match the Start button treatment (shadow, brand color)
  — it currently does have brand color but lacks the shadow/depth
- Consider a subtle heading treatment or visual flourish
- The three stats (correct, median time, fluent) could be in small "cards" or
  have background treatment instead of floating text

#### 6. Countdown bar visibility

**Why:** Currently a 4px line that depletes left to right. Functionally correct
but nearly invisible.

**Options to explore:**
- Slightly taller (6–8px) with rounded ends
- More gradual color transition: sage → amber → red (not just sage → red at
  the 10-second mark)
- Subtle pulsing or glow effect in the final seconds

#### 7. Progress tab stats

**Why:** The heatmap grids are the primary way users see their mastery. Currently
bare colored cells in a table.

**Options to explore:**
- Rounded corners on stats cells (they have `border-radius: 4px` but the table
  border-collapse may override this)
- Summary indicator above the grid ("47/78 mastered" or a mini progress bar)
- Hover/tap tooltip showing exact stats for each cell
- Better legend placement (currently uses the `.heatmap-legend` class but
  visibility depends on JS)

#### 8. Mode screen header

**Why:** Currently just a `←` arrow and text title. Functional but generic.

**Options to explore:**
- Subtle brand accent on the mode title (colored underline, background tint)
- One-line status visible in the header area ("3/6 strings mastered")

### Tier 3: Distinctive details

#### 9. Background depth

**Why:** Pure white body on light gray `html` is flat. A very subtle gradient or
warm tint could add depth.

**Options to explore:**
- Very subtle vertical gradient (white → barely-warm at the bottom)
- During active quiz phase, slightly more contrast between the quiz card
  background and the surrounding area

#### 10. Phase transition animations

**Why:** Phase changes (idle → calibration → active → round-complete → idle) are
instant show/hide. Makes the app feel static and mechanical.

**Options to explore:**
- 100–150ms fade for phase transitions
- Quiz area could slide/fade in when a round starts
- Must respect `prefers-reduced-motion`

#### 11. Heading typography

**Why:** System font stack is practical but generic. A single distinctive heading
font would immediately separate the app from "default web app."

**Options to explore:**
- Import one font for headings only (quiz prompt, home title, mode title)
- Keep system fonts for body/buttons (performance + familiarity)
- This is arguably the single easiest way to add distinctive personality
- Weight: consider the tradeoff of one more HTTP request vs. visual identity

#### 12. Settings modal refinement

**Why:** Works fine but feels basic compared to the rest of the app.

**Options to explore:**
- Better visual hierarchy between setting groups
- Active toggle state could feel more "switch-like"

---

## Recommended Starting Point

If picking 2–3 items to do first, I'd recommend:

1. **Answer buttons + feedback treatment** (#1 + #2) — core loop, highest
   time-spent surface, most impactful on how the app *feels*
2. **Home screen personality** (#3) — first impression, sets the tone
3. **Heading typography** (#11) — highest ratio of visual impact to
   implementation effort

These three together would shift the app from "clean utility" to "this has a
point of view" without touching the architecture or adding complexity.

---

## Design values to preserve

Whatever changes we make should maintain:

- **Drill-first aesthetic** — nothing distracts from the question/answer loop
- **Warmth over sterility** — any additions should feel warm, not flashy
- **Speed** — no animations that slow down rapid-fire drilling
- **Accessibility** — contrast ratios, touch targets, reduced-motion support
- **Information density** — stats should be scannable, not decorative
- **Calm, coach-like tone** — show data, not words. No gamification or cheering.
