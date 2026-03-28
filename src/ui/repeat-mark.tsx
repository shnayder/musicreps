// Brand logo mark — end-repeat sign matching static/app-icon.svg geometry.
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
      viewBox='0 0 1024 1024'
      fill='currentColor'
      stroke='none'
      aria-hidden='true'
      class={cls}
    >
      <circle cx='350.6' cy='366.9' r='76.8' />
      <circle cx='350.6' cy='674.1' r='76.8' />
      <rect x='554.7' y='136.5' width='68.3' height='768' />
      <rect x='682.7' y='136.5' width='136.5' height='768' />
    </svg>
  );
}
