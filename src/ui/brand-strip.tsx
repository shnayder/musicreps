// Persistent brand strip shown at the top of every web screen. Hidden on
// native (iOS) via the .native-app body class. Mounted once into
// #brand-strip from app.ts so it survives screen switches without re-render.

import { RepeatMark } from './repeat-mark.tsx';
import { Text } from './text.tsx';

export function BrandStrip() {
  return (
    <>
      <h1 class='brand-strip-title'>
        <RepeatMark size={28} class='brand-strip-mark' />
        Music Reps
      </h1>
      <Text role='body-secondary' as='p' class='brand-strip-tagline'>
        Make music fundamentals automatic so you can focus on playing.
      </Text>
    </>
  );
}
