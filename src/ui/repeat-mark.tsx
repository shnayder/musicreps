// Brand logo mark — end-repeat sign (dots + thin barline + thick barline).
// Fill-based SVG with variable size; inherits color via currentColor.
// Separate from icons.tsx which contains Lucide stroke icons for skill modes.

export function RepeatMark(
  { size = 24, class: cls }: { size?: number; class?: string },
) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={String(size)}
      height={String(size)}
      viewBox='0 0 24 24'
      fill='currentColor'
      stroke='none'
      aria-hidden='true'
      class={cls}
    >
      <circle cx='7' cy='8.5' r='2.5' />
      <circle cx='7' cy='15.5' r='2.5' />
      <rect x='13' y='2' width='2' height='20' />
      <rect x='18' y='2' width='4' height='20' />
    </svg>
  );
}
