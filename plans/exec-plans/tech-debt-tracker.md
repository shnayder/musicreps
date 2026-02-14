# Technical debt tracker

## Add entries when
- a feature implementation plan deliberately creates tech debt
- code review identifies an issue that we choose not to immediately fix
- periodic overall system reviews identify issues that can be improved

## Organize by "interest rate"
- ugliness or inefficiency that's encapsulated away has LOW interest rate -- it doesn't cause issues elsewhere.
    - e.g. a long function whose implementation is hard to read and understand and could be refactored.
- problems that get worse linearly as the system grows have MEDIUM interest rate. 
    - e.g. externalizing UI strings. The effort for cleanup is roughly proportional to the number of strings in the codebase.
- Problems that get worse quadratically or worse have HIGH interest rate. 
    - e.g. if there were multiple representations of musical notes, code everywhere would have deal with all of them and test all combinations.

## The list
1. LOW - `gh` doesn't work in Claude web environment, so we have to curl instead (appears fixable now: https://dev.to/oikon/run-gh-command-in-claude-code-on-the-web-2kp3)
1. LOW — `deno` isn't set up in the Claude web environment, so we have to support `node` too.
1. LOW — `formatElapsedTime` is duplicated in `quiz-engine.js` and `quiz-speed-tap.js`. Extract to a shared utility to prevent future divergence.
1. MEDIUM — Chord Spelling timing is broken: uses DEFAULT_CONFIG unmodified, so multi-note entries (3-4 taps) can never reach "automatic" on the heatmap. With a 400ms baseline, automaticityTarget = 1200ms, but even perfect 3-note entry takes ~1.5s → speedScore ≈ 0.4 → item never shows as green. Fix: response-count scaling (see layout-ia-fixes plan Phase 2a).
1. MEDIUM — Speed Tap duplicates ~400 of ~740 lines from the shared engine (calibration, session tracking, chrome show/hide, progress, keyboard routing). Should use `createQuizEngine` following the Chord Spelling pattern. Fix: layout-ia-fixes plan Phase 2b.
1. LOW — Fretboard mode uses CSS `order: -1` hack and `quiz-active` class toggle for SVG positioning. Should use the standard `beforeQuizArea` slot without special-case CSS. Fix: layout-ia-fixes plan Phase 3.
