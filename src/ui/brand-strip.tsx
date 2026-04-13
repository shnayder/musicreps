// Persistent brand strip shown at the top of every web screen. Hidden on
// native (iOS) via the .native-app body class. Mounted once into
// #brand-strip from app.ts so it survives screen switches without re-render.

import { RepeatMark } from './repeat-mark.tsx';
import { Text } from './text.tsx';

export function BrandStrip() {
  // Intentionally not an <h1>: per-screen titles own the primary heading, so
  // the wordmark renders as a plain div to avoid multiple level-1 headings
  // fighting for screen-reader navigation.
  return (
    <>
      <div class='brand-strip-title' aria-label='Music Reps'>
        <RepeatMark size={28} class='brand-strip-mark' aria-hidden='true' />
        Music Reps
      </div>
      <Text role='body-secondary' as='p' class='brand-strip-tagline'>
        Make music fundamentals automatic so you can focus on playing.
      </Text>
    </>
  );
}
