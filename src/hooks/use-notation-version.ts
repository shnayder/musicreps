// useNotationVersion — triggers re-render when solfège/letter setting changes.
// Returns a version counter that increments on each change, suitable for
// inclusion in useMemo dependency arrays.

import { useEffect, useState } from 'preact/hooks';
import { getNotationVersion, subscribeNotation } from '../music-data.ts';

export function useNotationVersion(): number {
  const [v, setV] = useState(getNotationVersion);
  useEffect(() => subscribeNotation(() => setV(getNotationVersion())), []);
  return v;
}
