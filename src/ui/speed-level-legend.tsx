// Speed level legend — explains what progress bar colors mean.
// Used inside a modal triggered by tapping a progress bar.

import { SPEED_LEVELS } from '../speed-levels.ts';
import { Text } from './text.tsx';
import { Modal } from './modal.tsx';

/** Whether the tapped bar shows one segment per level or one per item. */
export type ProgressBarKind = 'multi-level' | 'single-level';

function contextLine(kind: ProgressBarKind): string {
  return kind === 'multi-level'
    ? 'The bar shows a segment for each level in this skill, showing how quickly you answer.'
    : 'The bar shows a segment for each item, showing how quickly you answer.';
}

/** Speed level legend table (no modal wrapper). */
export function SpeedLevelLegend(
  { kind = 'single-level' }: { kind?: ProgressBarKind },
) {
  return (
    <div class='speed-legend'>
      <Text role='body-secondary' as='p'>{contextLine(kind)}</Text>
      <table class='speed-legend-table'>
        <thead>
          <tr>
            <th></th>
            <th>Status</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {SPEED_LEVELS.map((level) => (
            <tr key={level.key}>
              <td>
                <span
                  class='heatmap-swatch'
                  style={`background-color: var(${level.colorToken})`}
                />
              </td>
              <td>{level.label}</td>
              <td>{level.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Modal wrapping the speed level legend. */
export function SpeedLevelModal(
  { open, onClose, kind = 'single-level' }: {
    open: boolean;
    onClose: () => void;
    kind?: ProgressBarKind;
  },
) {
  return (
    <Modal title='Progress' open={open} onClose={onClose}>
      <SpeedLevelLegend kind={kind} />
    </Modal>
  );
}
