// Global settings data helpers.

import { getUseSolfege, setUseSolfege } from './music-data.ts';

export type SettingsController = {
  getUseSolfege: () => boolean;
  setUseSolfege: (useSolfege: boolean) => void;
};

export function createSettingsController(
  options: { onNotationChange?: () => void },
): SettingsController {
  const onNotationChange: () => void = options.onNotationChange ||
    function (): void {};

  function setNotation(useSolfege: boolean): void {
    if (useSolfege === getUseSolfege()) return;
    setUseSolfege(useSolfege);
    onNotationChange();
  }

  return {
    getUseSolfege,
    setUseSolfege: setNotation,
  };
}
