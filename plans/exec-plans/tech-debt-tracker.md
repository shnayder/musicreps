# Technical debt tracker

## Add entries when

- a feature implementation plan deliberately creates tech debt
- code review identifies an issue that we choose not to immediately fix
- periodic overall system reviews identify issues that can be improved

## Organize by "interest rate"

- ugliness or inefficiency that's encapsulated away has LOW interest rate -- it
  doesn't cause issues elsewhere.
  - e.g. a long function whose implementation is hard to read and understand and
    could be refactored.
- problems that get worse linearly as the system grows have MEDIUM interest
  rate.
  - e.g. externalizing UI strings. The effort for cleanup is roughly
    proportional to the number of strings in the codebase.
- Problems that get worse quadratically or worse have HIGH interest rate.
  - e.g. if there were multiple representations of musical notes, code
    everywhere would have deal with all of them and test all combinations.

## The list

1. LOW - `gh` doesn't work in Claude web environment, so we have to curl instead
   (appears fixable now:
   https://dev.to/oikon/run-gh-command-in-claude-code-on-the-web-2kp3)
1. LOW — `deno` isn't set up in the Claude web environment, so we have to
   support `node` too.
1. MEDIUM — Global state (notation mode) isn't automatically propagated to
   inactive modes. `engine.attach()` now manually refreshes buttons + stats, but
   each new global setting requires remembering to add refresh logic there.
   Consider a lightweight observer pattern for global settings, or at minimum a
   centralized `refreshNotation(container)` function to replace the ad-hoc
   "click active stats toggle" approach duplicated between `attach()` and
   `onNotationChange`.

## Fixed (2026-02)

1. ~~LOW — `formatElapsedTime` duplication~~ — removed with Speed Tap engine
   migration.
1. ~~MEDIUM — Chord Spelling timing broken for multi-note entries~~ — fixed via
   response-count scaling in adaptive selector + deadline tracker.
1. ~~MEDIUM — Speed Tap duplicated ~400 lines from shared engine~~ — migrated to
   `createQuizEngine`, reduced from 739 → 274 lines.
1. ~~LOW — Fretboard CSS `order: -1` hack~~ — now uses standard `beforeQuizArea`
   slot.
