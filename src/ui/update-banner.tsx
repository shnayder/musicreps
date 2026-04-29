// UpdateBanner — "Update available" notification using SlideOverlay.
// Slides in from the top edge with brand coloring.

import { SlideOverlay } from './slide-overlay.tsx';

export function UpdateBanner(
  { visible, onDismiss }: {
    visible: boolean;
    onDismiss: () => void;
  },
) {
  return (
    <SlideOverlay
      open={visible}
      onClose={onDismiss}
      origin='top'
      ariaLabel='Update available'
    >
      <div class='update-banner'>
        <span>Update available — restart to apply</span>
      </div>
    </SlideOverlay>
  );
}
