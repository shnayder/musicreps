// Shared abcjs staff rendering — lazy-loads the library and renders ABC
// notation into an element. Used by GenericMode's built-in staff prompt.

// deno-lint-ignore no-explicit-any
let abcjs: any = null;

export async function ensureAbcjs(): Promise<void> {
  if (!abcjs) {
    abcjs = await import('abcjs');
  }
}

export function renderStaff(el: HTMLElement, abc: string): void {
  if (!abcjs) return;
  abcjs.renderAbc(el, abc, {
    staffwidth: 150,
    paddingtop: 0,
    paddingbottom: 0,
    paddingleft: 0,
    paddingright: 0,
    responsive: 'resize',
  });
}
