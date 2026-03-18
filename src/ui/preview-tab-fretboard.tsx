// Fretboard tab — fretboard SVG previews with quiz-active and heatmap coloring.

import { FretboardPreview, PreviewGrid, Section } from './preview-shared.tsx';

export function FretboardTab({ tabId: _tabId }: { tabId: string }) {
  return (
    <PreviewGrid>
      <Section title='Fretboard — Quiz Active'>
        <FretboardPreview
          colorCircles={(root) => {
            const set = (s: number, f: number, fill: string) => {
              const c = root.querySelector(
                `circle.fb-pos[data-string="${s}"][data-fret="${f}"]`,
              ) as SVGElement | null;
              if (c) c.style.fill = fill;
            };
            set(5, 3, 'hsl(50, 100%, 50%)');
            set(4, 5, 'hsl(125, 48%, 33%)');
          }}
        />
      </Section>
      <Section title='Fretboard — Progress Heatmap'>
        <FretboardPreview
          colorCircles={(root) => {
            const mastery: Array<[number, number, string]> = [
              [5, 0, 'hsl(125, 48%, 33%)'],
              [5, 1, 'hsl(80, 35%, 40%)'],
              [5, 2, 'hsl(125, 48%, 33%)'],
              [5, 3, 'hsl(80, 35%, 40%)'],
              [5, 5, 'hsl(125, 48%, 33%)'],
              [5, 7, 'hsl(60, 40%, 46%)'],
              [5, 8, 'hsl(80, 35%, 40%)'],
              [5, 9, 'hsl(125, 48%, 33%)'],
              [5, 10, 'hsl(60, 40%, 46%)'],
              [5, 12, 'hsl(80, 35%, 40%)'],
              [4, 0, 'hsl(80, 35%, 40%)'],
              [4, 2, 'hsl(60, 40%, 46%)'],
              [4, 3, 'hsl(125, 48%, 33%)'],
              [4, 5, 'hsl(48, 50%, 52%)'],
              [4, 7, 'hsl(60, 40%, 46%)'],
              [4, 8, 'hsl(40, 60%, 58%)'],
              [4, 9, 'hsl(48, 50%, 52%)'],
              [4, 10, 'hsl(80, 35%, 40%)'],
              [4, 12, 'hsl(60, 40%, 46%)'],
              [3, 0, 'hsl(60, 40%, 46%)'],
              [3, 2, 'hsl(40, 60%, 58%)'],
              [3, 3, 'hsl(48, 50%, 52%)'],
              [3, 5, 'hsl(40, 60%, 58%)'],
              [3, 7, 'hsl(48, 50%, 52%)'],
              [3, 8, 'hsl(40, 60%, 58%)'],
              [3, 10, 'hsl(60, 40%, 46%)'],
              [3, 12, 'hsl(40, 60%, 58%)'],
            ];
            for (const [s, f, fill] of mastery) {
              const c = root.querySelector(
                `circle.fb-pos[data-string="${s}"][data-fret="${f}"]`,
              ) as SVGElement | null;
              if (c) c.style.fill = fill;
            }
          }}
        />
      </Section>
    </PreviewGrid>
  );
}
