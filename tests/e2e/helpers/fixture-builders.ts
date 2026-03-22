// Fixture builders for E2E tests.
// Helpers to construct localStorage payloads for common test scenarios.

/**
 * Build a motor baseline entry. Seeding this skips the calibration prompt.
 * The taskType is 'note-button' for all current modes.
 */
export function buildMotorBaseline(
  value: number,
  taskType = 'note-button',
): Record<string, string> {
  return { [`motorBaseline_${taskType}`]: String(value) };
}

/**
 * Build enabled-groups localStorage entries for a group-based mode.
 */
export function buildEnabledGroups(
  storageKey: string,
  groups: number[],
): Record<string, string> {
  return {
    [storageKey]: JSON.stringify(groups),
    [`${storageKey}_skipped`]: JSON.stringify([]),
  };
}
