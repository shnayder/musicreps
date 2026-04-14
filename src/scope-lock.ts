// Pure freeze/unfreeze state for the active scope.
//
// The quiz engine must keep the set of "levels being practiced" stable across
// a single round, even though the recommendation system may re-suggest a
// different set as the user answers questions (each correct/wrong response
// bumps `selector.version`, which re-computes recommendations). Without
// locking, the user can see the button set and the item pool shift mid-round,
// which is disorienting and changes what they're being asked.
//
// The lock works as a simple "capture-on-rising-edge, clear-on-falling-edge"
// latch. While locked, `readScope` returns the captured snapshot regardless
// of how the live value changes underneath. Re-locking while already locked
// is a no-op — the snapshot keeps its original value for the entire locked
// interval.

export type ScopeLock<T> = {
  locked: boolean;
  snapshot: T | null;
};

export function createScopeLock<T>(): ScopeLock<T> {
  return { locked: false, snapshot: null };
}

/** Compute the next lock state given the desired `locked` flag and the
 *  current live value. Pure — does not mutate `prev`. */
export function nextScopeLockState<T>(
  prev: ScopeLock<T>,
  locked: boolean,
  live: T,
): ScopeLock<T> {
  if (locked === prev.locked) return prev;
  if (locked) return { locked: true, snapshot: live };
  return { locked: false, snapshot: null };
}

/** Read the effective scope: captured snapshot if locked, else live. */
export function readScope<T>(lock: ScopeLock<T>, live: T): T {
  return lock.locked && lock.snapshot !== null ? lock.snapshot : live;
}
