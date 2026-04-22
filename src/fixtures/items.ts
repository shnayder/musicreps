// Representative currentItemId per mode, used for screenshot fixtures.

export const defaultItems: Record<string, string> = {
  fretboard: '5-8',
  ukulele: '0-5',
  noteSemitones: 'C:fwd',
  intervalSemitones: 'P4:fwd',
  semitoneMath: 'C+3',
  intervalMath: 'C+m3',
  keySignatures: 'D:fwd',
  scaleDegrees: 'C:3:fwd',
  diatonicChords: 'C:IV:fwd',
  chordSpelling: 'C:major',
  speedTap: 'C',
  ukuleleSpeedTap: 'C',
  guitarChordShapes: 'A:minor',
  ukuleleChordShapes: 'C:major',
  // Reverse direction for bidirectional modes
  noteSemitones_rev: 'C:rev',
  intervalSemitones_rev: 'P4:rev',
  keySignatures_rev: 'D:rev',
  scaleDegrees_rev: 'C:3:rev',
  diatonicChords_rev: 'C:IV:rev',
};
