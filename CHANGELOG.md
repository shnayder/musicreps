# Changelog

## vNext

### New Features

- **Ukulele Speed Tap** — find every position of any note on the ukulele
  fretboard, parallel to the existing guitar Speed Tap skill
- **Per-skill daily reps** — each skill's header now shows today's reps for
  that skill, and the Progress tab's Overall section shows total reps and
  days practiced as side-by-side stat cards
- **Modal diatonic chords** — the Diatonic Chords skill now covers 6 musical
  modes (major, minor, dorian, mixolydian, lydian, phrygian). Forward answers
  require root + quality via two-tap input; reverse answers use degree numbers
  with the roman numeral shown as educational reinforcement. Stats display
  uses per-mode tabs. Note: existing diatonic chords progress is reset due to
  the item format change.

### Improvements

- **Update-available banner** — the app now shows a slide-in notification when
  a new OTA update has been downloaded and will apply on next restart
- **Relaxed "all automatic" threshold** — the Practice tab no longer nags you
  to keep practicing when one or two items are still catching up. Uses the
  same P10 speed percentile as the home-screen recommendation logic, and
  rephrases the suggestion to `Practice another skill — this one is automatic`

### Bug fixes

- **Solfège labels in Chord Spelling and other split-button modes** — answer
  buttons in Chord Spelling kept showing letter names (C, D, E…) even after
  toggling Solfège on, because the labels were precomputed once when the page
  loaded. The whole skill view now re-renders on notation change, so all note
  labels (button rows, prompts, stats) update everywhere
- **Two-tap timing for Key Signatures and Diatonic Chords** — forward-direction
  items in these skills require two button taps (number + ♯/♭ or note +
  quality), but the learner model was scoring them against single-tap timing
  thresholds, making them appear artificially slow and triggering unnecessary
  reviews. Response counts are now scaled correctly (with a special case for
  C major / A minor in Key Signatures, which auto-submit in one tap)
- **OTA updates broken on release/staging builds** — xcconfig files treated
  `//` in URLs as comments, silently truncating the OTA release base URL.
  Escaped with `$(/)$(/)` so the full URL reaches the native plugin
- **Skill tab spacing** — added breathing room below tab panel content so the
  last line (e.g. "Start practicing on the … tab below" on the Info tab) no
  longer sits flush against the bottom tab bar

## v1.1 (build 4) — 2026-04-22

### New Features

- **More chord shapes** — expanded guitar and ukulele chord shape sets
- **Speed check for chord shapes** — tap-based speed check for chord shapes and
  speed tap skills
- **Interval Math double-accidentals** — letter-correct spelling and
  double-accidental support (F##, Ebb)
- **Answer feedback** — visible text feedback after answering

### Improvements

- **Smarter item selection** — better spacing and review timing
- **Improved item ordering** — Avoid patterns that let your brain cheat instead of learning
- **Review scheduling** — "Review in Xh" countdown replaces vague "Review soon"
  label on progress cards
- **Fretboard accidentals** — randomize sharp/flat spelling each round to ensure you learn both.
- **Speed check polish** — fixed target dot, reserved prompt space, wrong-tap
  ring indicator
- **Visual refinements** — The app is prettier now.

### Bug Fixes

- Fix footer jump when "Last question" notice appears
- Fix recommendations suggesting later levels before earlier ones
- Fix review prompts for skills you just learned

## v1.0 (build 3) — 2026-04-14

Initial App Store release.
