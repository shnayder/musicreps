// Screen layout: enforces the three-zone structure (header/main/footer).
//
// Every screen in the app should use ScreenLayout to get consistent
// positioning:
// - Header: fixed to top, never scrolls
// - Main: fills remaining space, scrollable or not depending on state
// - Footer: fixed to bottom, never scrolls
//
// This replaces ad-hoc CSS positioning (position: fixed, margin-top: auto,
// padding-bottom: 64px) with structural components.

import type { ComponentChildren } from 'preact';

// ---------------------------------------------------------------------------
// ScreenLayout — outer flex container filling the viewport
// ---------------------------------------------------------------------------

export function ScreenLayout(
  { children, class: extra }: {
    children: ComponentChildren;
    class?: string;
  },
) {
  const cls = 'screen-layout' + (extra ? ' ' + extra : '');
  return <div class={cls}>{children}</div>;
}

// ---------------------------------------------------------------------------
// LayoutHeader — fixed to top, does not scroll
// ---------------------------------------------------------------------------

export function LayoutHeader(
  { children, class: extra }: {
    children: ComponentChildren;
    class?: string;
  },
) {
  const cls = 'layout-header' + (extra ? ' ' + extra : '');
  return <div class={cls}>{children}</div>;
}

// ---------------------------------------------------------------------------
// LayoutMain — content area between header and footer
// ---------------------------------------------------------------------------

export function LayoutMain(
  { children, scrollable = true, class: extra }: {
    children: ComponentChildren;
    /** Whether the main area scrolls. Default true (info screens).
     *  Set false for active practice (quiz, round complete). */
    scrollable?: boolean;
    class?: string;
  },
) {
  const cls = 'layout-main' +
    (scrollable ? ' layout-main-scroll' : ' layout-main-fixed') +
    (extra ? ' ' + extra : '');
  return <div class={cls}>{children}</div>;
}

// ---------------------------------------------------------------------------
// LayoutFooter — fixed to bottom, does not scroll
// ---------------------------------------------------------------------------

export function LayoutFooter(
  { children, class: extra }: {
    children: ComponentChildren;
    class?: string;
  },
) {
  if (!children) return null;
  const cls = 'layout-footer' + (extra ? ' ' + extra : '');
  return <div class={cls}>{children}</div>;
}
