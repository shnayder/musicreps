// SegmentedControl — exclusive multi-option picker (radio group pattern).
// Extracted from home-screen.tsx for shared use across practice config,
// settings, and other toggle UIs.

import { useMemo } from 'preact/hooks';
import { Text } from './text.tsx';

// ---------------------------------------------------------------------------
// SegmentedControl
// ---------------------------------------------------------------------------

export type SegmentOption<T extends string> = { value: T; label: string };

let segmentedControlCounter = 0;

export function SegmentedControl<T extends string>(
  { options, value, onChange, 'aria-labelledby': labelledBy }: {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    'aria-labelledby'?: string;
  },
) {
  const prefix = useMemo(() => 'sc-' + segmentedControlCounter++, []);

  function handleKeyDown(e: KeyboardEvent, current: T) {
    const vals = options.map((o) => o.value);
    const idx = vals.indexOf(current);
    let next = idx;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (idx - 1 + vals.length) % vals.length;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (idx + 1) % vals.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = vals.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    onChange(vals[next]);
    requestAnimationFrame(() => {
      (document.getElementById(
        prefix + '-' + vals[next],
      ) as HTMLElement | null)?.focus();
    });
  }

  return (
    <div
      class='segmented-control'
      role='radiogroup'
      aria-labelledby={labelledBy}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          id={prefix + '-' + opt.value}
          type='button'
          role='radio'
          aria-checked={value === opt.value}
          tabIndex={value === opt.value ? 0 : -1}
          class={'segmented-btn' + (value === opt.value ? ' active' : '')}
          onClick={() => onChange(opt.value)}
          onKeyDown={(e) => handleKeyDown(e, opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingToggle — labelled SegmentedControl for settings fields
// ---------------------------------------------------------------------------

let settingToggleLabelCounter = 0;

export function SettingToggle<T extends string>(
  { label, options, value, onChange }: {
    label: string;
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
  },
) {
  const labelId = useMemo(() => 'stl-' + settingToggleLabelCounter++, []);
  return (
    <div class='settings-field'>
      <Text role='label' as='div' id={labelId}>{label}</Text>
      <SegmentedControl
        options={options}
        value={value}
        onChange={onChange}
        aria-labelledby={labelId}
      />
    </div>
  );
}
