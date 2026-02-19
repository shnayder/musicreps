# Engineering Backlog

Owner: engineering workstream Branch: workstream/engineering

## Active

- Fretboard quiz: need a "finish this question" state when timer runs out

## Bugs

- BUG: notes <-> semitones: A# not accepted for 10 — said "Bb"
- BUG: speed tap doesn't seem to have warmup
- BUG: interval/note <-> semitones warmup has too many options
- BUG: 6# not getting recognized in key signatures mode

## Backlog

- NIT: notes <-> semitones keyboard: if answer is C and I type C, don't wait for
  accidental — mark it correct immediately
- Key signatures: use unicode sharp and flat symbols (check throughout app)
- Key signatures: keyboard mode for multi-char input needs cleanup
- Scale degrees: keyboard answers are 1st, 2nd, etc but expects 1,2,3 — be
  clearer from UI
- Diatonic chords: keyboard I, ii, iii not working. Need design if supporting.
- Diatonic chords: response should match options (A#/Bb vs "Bb major")
- Chord spelling: if wrong note, flash red and re-enter vs keep going
- Chord spelling: reverse direction
- Too much copy+paste between quizzes — more shared structure needed
- Consider switching from EWMA to median over recent window (RTs log-normal)
- RT variability goes down as you get better — use as progress measure
- Explain recall stats, hint whether low values due to forgetting or slow speed
- Fretboard speed check should test all notes including accidentals
- Notes <-> semitones speed check should reuse fretboard speed check
- Speed check: show feedback (flash green/red)
- Chord spelling speed check: show progress indicators
- Use musical key signature notation instead of "E major" for scale degrees
- Handle minor keys in scale degrees
- Show actual music notation for key signatures (not just "3 flats")
