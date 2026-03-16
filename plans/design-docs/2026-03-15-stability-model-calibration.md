# Stability Model Calibration

**Date:** 2026-03-15
**Status:** Exploratory — collecting real-world feel before tuning further

## Context

The stability model was revised to use freshness-modulated growth instead of
speed-modulated growth. The key change:

```
growthFactor = 1 + growthMax * (1 - freshness)
newStability = oldStability * growthFactor
```

- **Speed** tracks "how fast are you?" (EWMA) — independent axis
- **Stability** tracks "how long will you stay this fast?" (half-life of
  retention)

Speed no longer affects stability growth. What matters is whether you were
correct and how fresh the item was when reviewed. Reviewing a due item
(freshness ~0.5) is stronger evidence of retention than reviewing something you
just saw.

Current parameters: `initialStability=4h`, `growthMax=0.9`, target ~15
well-spaced reviews to reach `maxStability=336h` (14 days).

## Open question: within-session frequency

The model currently gives near-zero stability growth for within-session reps
(freshness ≈ 1.0). This means 1 rep and 10 reps in a session produce nearly
identical stability. Is that right?

### The cramming scenario

10 correct, speeding-up trials in one session. Stability stays ~4h. At 12h out,
freshness ≈ 0.13 ("stale"). Is that too harsh?

**Arguments for the current model (yes, cramming fades fast):**

- The spacing effect is one of the most robust findings in learning science.
  Massed practice gives short-term performance but poor long-term retention.
- 10 trials in 10 minutes is genuinely less durable than 10 trials spread over
  days.
- The model correctly penalizes cramming relative to spaced practice.

**Arguments that it's too harsh:**

- 10 successful, speeding-up trials isn't nothing. You built a motor pattern.
  You probably haven't completely lost it — you'd be faster on relearning.
- ACT-R's base-level activation model gives credit for frequency, not just
  spacing.
- Procedural/motor skills are more durable than declarative facts.

**Possible fix:** a small within-session frequency bonus:

```
// Within-session: 5% per intra-session rep instead of zero growth
growthFactor = 1 + 0.05
```

After 10 reps: `4h * 1.05^9 ≈ 6.2h`, freshness at 12h ≈ 0.27 (still "due" but
not "stale"). Feels more realistic.

**Decision:** leave it alone for now and see how it feels in real use.

## Literature anchors

### Half-life regression (Duolingo, Settles & Meeder 2016)

Trained on millions of real reviews for language vocab. Found initial half-lives
of a few hours to ~1 day for new items, growing with successful spaced reviews.
Our 4h initial stability is in that ballpark, but they were modeling declarative
recall (word meaning), not procedural automaticity.

Key finding: half-life depends on number of prior exposures, time since last
exposure, and item difficulty. We could add an exposure-count term to our
initial stability.

### FSRS (Free Spaced Repetition Scheduler)

The modern Anki algorithm, trained on hundreds of millions of reviews. Key
findings:

- Initial stability varies by item difficulty, ranging from ~0.5 to ~4 days
- Default growth multiplier is ~1.5x per successful review at the due point —
  close to our 1.45x
- Their parameters are trained on real data and could serve as anchors

Main difference: FSRS models declarative recall; our items may be more durable
(procedural).

### ACT-R base-level activation

Anderson's cognitive architecture models memory strength as a function of both
recency and frequency. More practice raises the baseline even without spacing.
This is the piece our model is missing for cramming — it has no frequency
component for initial stability.

### Procedural vs declarative retention

Motor/procedural skills ("riding a bike") are more durable than declarative
facts once acquired. But the speed component (automaticity) does decay, just
more slowly. This is a point in favor of longer half-lives for our use case
compared to pure flashcard systems.

### Spacing effect

One of the most robust findings in psychology. Massed practice produces
short-term performance gains but poor long-term retention relative to the same
number of trials spread over time.

## Calibration approaches (without our own data)

1. **Anchor to FSRS defaults.** Initial stability ~1-4 days, growth ~1.5x at
   due point. We're close.

2. **Add exposure-count term** (Duolingo-style). Half-life depends on number of
   prior exposures, not just spacing. Would address the cramming gap.

3. **Self-calibration via returning-after-break.** If you come back after days
   and answer fast, self-correction handles it. The real question is whether the
   model's *predictions* match reality. A "practice log" feature could record
   predictions vs actual performance for later analysis.

## Diagnostic sessions

- `freshness-v3` — current formula with session-based patterns (twice-daily,
  daily, every-other-day, cramming, ideal-spaced, etc.)
