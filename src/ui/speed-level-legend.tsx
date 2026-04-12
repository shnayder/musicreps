// Speed level legend — explains what progress bar colors mean.
// Used inside a modal triggered by tapping a progress bar, and on the
// speed check complete screen.

import { getCalibrationThresholds } from '../quiz-engine.ts';
import { Text } from './text.tsx';
import { Modal } from './modal.tsx';

/** Whether the tapped bar shows one segment per level or one per item. */
export type ProgressBarKind = 'multi-level' | 'single-level';

/** Default motor baseline (ms) used when no calibration has been run. */
const DEFAULT_BASELINE_MS = 1000;

function formatBaseline(baseline: number | null): {
  value: string;
  isDefault: boolean;
} {
  const b = baseline ?? DEFAULT_BASELINE_MS;
  return {
    value: (b / 1000).toFixed(1) + 's',
    isDefault: baseline === null,
  };
}

/**
 * Shared threshold table with baseline note below. Used in both the
 * progress-bar legend modal and the speed check complete screen.
 */
export function SpeedThresholdTable(
  { baseline }: { baseline: number | null },
) {
  const thresholds = getCalibrationThresholds(baseline ?? DEFAULT_BASELINE_MS);
  const fmt = formatBaseline(baseline);
  return (
    <div class='speed-threshold-table'>
      <table class='speed-legend-table'>
        <thead>
          <tr>
            <th></th>
            <th>Status</th>
            <th>Max time</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {thresholds.map((t) => (
            <tr key={t.label}>
              <td>
                <span
                  class='heatmap-swatch'
                  style={`background-color: var(${t.colorToken})`}
                />
              </td>
              <td>{t.label}</td>
              <td>
                {t.maxMs !== null
                  ? (t.maxMs / 1000).toFixed(1) + 's'
                  : '\u2014'}
              </td>
              <td>{t.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Text role='supporting' as='p' class='speed-baseline-note'>
        Response time baseline: {fmt.value}
        {fmt.isDefault && ' (default)'}
      </Text>
    </div>
  );
}

function contextLine(kind: ProgressBarKind): string {
  return kind === 'multi-level'
    ? 'The bar shows a segment for each level in this skill, showing how quickly you answer.'
    : 'The bar shows a segment for each item, showing how quickly you answer.';
}

/** Speed level legend: context line + threshold table. */
export function SpeedLevelLegend(
  { kind = 'single-level', baseline = null }: {
    kind?: ProgressBarKind;
    baseline?: number | null;
  },
) {
  return (
    <div class='speed-legend'>
      <Text role='body-secondary' as='p'>{contextLine(kind)}</Text>
      <SpeedThresholdTable baseline={baseline} />
    </div>
  );
}

/** Modal wrapping the speed level legend. */
export function SpeedLevelModal(
  { open, onClose, kind = 'single-level', baseline = null }: {
    open: boolean;
    onClose: () => void;
    kind?: ProgressBarKind;
    baseline?: number | null;
  },
) {
  return (
    <Modal title='Progress' open={open} onClose={onClose}>
      <SpeedLevelLegend kind={kind} baseline={baseline} />
    </Modal>
  );
}
