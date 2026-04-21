// Fixture builders for E2E tests.
// Helpers to construct localStorage payloads for common test scenarios.

/** All mode IDs — used to seed _visited keys so first-visit onboarding
 *  doesn't interfere with tests that expect the Practice tab. */
const ALL_MODE_IDS = [
  'fretboard',
  'ukulele',
  'speedTap',
  'noteSemitones',
  'intervalSemitones',
  'semitoneMath',
  'intervalMath',
  'keySignatures',
  'scaleDegrees',
  'diatonicChords',
  'chordSpelling',
  'guitarChordShapes',
  'ukuleleChordShapes',
];

/**
 * Build a motor baseline entry. Seeding this skips the calibration prompt.
 * The taskType is 'note-button' for all current modes.
 * Also seeds _visited keys for all modes to bypass first-visit onboarding.
 */
export function buildMotorBaseline(
  value: number,
  taskType = 'note-button',
): Record<string, string> {
  const visited: Record<string, string> = {};
  for (const id of ALL_MODE_IDS) visited[`${id}_visited`] = '1';
  return { [`motorBaseline_${taskType}`]: String(value), ...visited };
}

/**
 * Build enabled-groups localStorage entries for a group-based mode.
 */
export function buildEnabledLevels(
  storageKey: string,
  groups: (string | number)[],
): Record<string, string> {
  return {
    [storageKey]: JSON.stringify(groups),
    [`${storageKey}_skipped`]: JSON.stringify([]),
  };
}
