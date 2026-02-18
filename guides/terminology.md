# Terminology

User-facing terms with specific meanings in this app. When writing UI copy,
prompts, or documentation, use these terms consistently.

The codebase may use different internal names (noted where applicable). The
terms here are what the **user sees**.

| Term | Meaning | Internal name | Why this word |
|------|---------|---------------|---------------|
| **speed check** | A quick exercise (~15s) measuring how fast you can answer without thinking. Used to calibrate speed thresholds to your device and reaction time. | `calibration`, `motorBaseline` | "Calibration" is technical jargon — users don't calibrate apps, they check their speed. "Speed check" is self-describing: you're checking how fast you are. |
| **fluent** | An item you can recall quickly and accurately right now (automaticity above threshold). Used in the progress bar: "5 / 78 fluent". | `automatic`, `automaticity` | "Mastered" implies permanent learning, but you'll forget by next session. "Fluent" captures speed + accuracy without claiming permanence — you can be fluent today and rusty tomorrow. |
| **sharps and flats** | The five notes between naturals (C#/Db, D#/Eb, F#/Gb, G#/Ab, A#/Bb). Used in the Notes toggle on fretboard and speed tap modes. | `.accidental`, `.note-btn.accidental`, `.note-row-accidentals` | "Accidentals" is music theory jargon. "Sharps and flats" is self-describing and beginner-friendly. CSS class names still use `accidental` internally. |
