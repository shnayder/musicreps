# Product Spec: Friendlier Skill Level Names

## Context

Level names appear throughout the app — in recommendations ("Review E e, D G ♯♭"), level toggles, progress cards, and home screen banners. Many are terse abbreviations that make sense to an experienced musician but are unfriendly to newcomers. Two improvements:

1. **Long names** for contexts with space (recommendations, progress cards, home banners)
2. **Cleaned-up short names** for compact contexts (custom setup toggles)

## Current inventory & proposed names

### Guitar Fretboard

| Current | Short (toggles) | Long (recs, progress) |
|---------|------------------|-----------------------|
| E e | E strings | High & low E strings |
| A | A string | A string |
| D | D string | D string |
| G | G string | G string |
| B | B string | B string |
| E A ♯♭ + D G ♯♭ + B e ♯♭ | *(regrouped below)* | |

**Accidental regrouping** (data is per-item, so groups can change freely):

| New group | Short | Long |
|-----------|-------|------|
| E e ♯/♭ (strings 5, 0) | E ♯/♭ | E strings ♯/♭ |
| A D ♯/♭ (strings 4, 3) | A D ♯/♭ | A & D strings ♯/♭ |
| G B ♯/♭ (strings 2, 1) | G B ♯/♭ | G & B strings ♯/♭ |

### Ukulele Fretboard

| Current | Short | Long |
|---------|-------|------|
| G | G string | G string |
| C | C string | C string |
| E | E string | E string |
| A | A string | A string |
| G C ♯♭ | G C ♯/♭ | G & C strings ♯/♭ |
| E A ♯♭ | E A ♯/♭ | E & A strings ♯/♭ |

### Key Signatures

One mode covering both major and minor — labels must distinguish them.

**Major** (regrouped from 5 levels to 2):

| Current | Short | Long |
|---------|-------|------|
| C G F / D B♭ / A E♭ | Major 0–3 ♯/♭ | Major keys (0–3 ♯/♭) |
| E A♭ / B D♭ F♯ | Major 4+ ♯/♭ | Major keys (4+ ♯/♭) |

**Minor** (unchanged count, improved labels):

| Current | Short | Long |
|---------|-------|------|
| Am Em Dm ... (0–3 ♯♭) | Minor 0–3 ♯/♭ | Minor keys (0–3 ♯/♭) |
| ... (4+ ♯♭) | Minor 4+ ♯/♭ | Minor keys (4+ ♯/♭) |

### Semitone Math

| Current | Short | Long |
|---------|-------|------|
| ±1–2 | ±1–2 | 1–2 semitones apart |
| ±3–4 | ±3–4 | 3–4 semitones apart |
| ±5–6 | ±5–6 | 5–6 semitones apart |
| ±7–8 | ±7–8 | 7–8 semitones apart |
| ±9–11 | ±9–11 | 9–11 semitones apart |

### Interval Math

| Current | Short | Long |
|---------|-------|------|
| m2 M2 | m2 M2 | Seconds (m2, M2) |
| m3 M3 | m3 M3 | Thirds (m3, M3) |
| P4 TT | P4 TT | Fourth & tritone (P4, TT) |
| P5 m6 | P5 m6 | Fifth & minor 6th (P5, m6) |
| M6 m7 M7 | M6 m7 M7 | Sixths & sevenths (M6, m7, M7) |

### Scale Degrees

| Current | Short | Long |
|---------|-------|------|
| 4th,5th | 4th, 5th | 4th & 5th degrees |
| 3rd,7th | 3rd, 7th | 3rd & 7th degrees |
| 2nd,6th | 2nd, 6th | 2nd & 6th degrees |

### Diatonic Chords

| Current | Short | Long |
|---------|-------|------|
| I,IV,V | I IV V | Primary chords (I, IV, V) |
| ii,vi | ii vi | Secondary chords (ii, vi) |
| iii,vii° | iii vii° | Tertiary chords (iii, vii°) |

### Chord Spelling

| Group | Current label | Short | Long |
|-------|---------------|-------|------|
| 0: major | maj | maj | Major triads |
| 1: minor | m | m | Minor triads |
| 2: dom7 | 7 | 7 | Dominant 7th |
| 3: maj7 | maj7 | maj7 | Major 7th |
| 4: min7 | m7 | m7 | Minor 7th |
| 5: dim, aug, halfdim | dim, aug, m7b5 | dim, aug, m7♭5 | Diminished, augmented & half-dim |
| 6: sus2, sus4, 6 | sus2, sus4, 6 | sus2, sus4, 6 | Suspended & 6th chords |

### Speed Tap

| Current | Short | Long |
|---------|-------|------|
| Natural notes | Naturals | Natural notes |
| Sharps & flats | ♯/♭ | Sharps & flats |

### Note ↔ Semitones / Interval ↔ Semitones

No groups (scope: none) — no changes needed.

## UI surfaces affected

| Surface | Context | Uses |
|---------|---------|------|
| Custom setup toggles | Compact buttons | **Short** name |
| Suggestion lines ("Review X, Y") | Practice card, suggested mode | **Long** name |
| Home screen rec banner | Skill card on home | **Long** name |
| Level progress cards | Progress tab headers | **Long** name |
| Recommendation text (flat) | Practice card summary | **Long** name |

## Architecture note

Each group currently has a single `label` (string or `() => string`). This needs to become two: `label` (short, for toggles) and `longLabel` (for everywhere else). The `resolveGroupLabel()` in `use-group-scope.ts` needs a variant, and UI call sites choose which to use.

## Consistency note

Use ♯/♭ (with slash) consistently for "sharps and/or flats" everywhere — toggles, long labels, recommendations. Current codebase has a mix of "♯♭", "♯/♭", "♯ & ♭". Standardize on **♯/♭**.
