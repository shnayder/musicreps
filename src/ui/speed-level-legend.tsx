// Speed level legend — explains what progress bar colors mean.
// Used inside a modal triggered by tapping a progress bar.

import { SPEED_LEVELS } from '../speed-levels.ts';
import { Text } from './text.tsx';
import { Modal } from './modal.tsx';

/** Speed level legend table (no modal wrapper). */
export function SpeedLevelLegend() {
  return (
    <div class='speed-legend'>
      <Text role='body-secondary' as='p'>
        Each color shows how quickly you recall an item.
      </Text>
      <table class='speed-legend-table'>
        <thead>
          <tr>
            <th></th>
            <th>Level</th>
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
  { open, onClose }: { open: boolean; onClose: () => void },
) {
  return (
    <Modal title='Speed Levels' open={open} onClose={onClose}>
      <SpeedLevelLegend />
    </Modal>
  );
}
