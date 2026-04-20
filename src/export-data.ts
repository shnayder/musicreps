// Snapshot of all persisted app state (localStorage / Capacitor Preferences)
// as a downloadable JSON file.  Primarily a dev/debug affordance; format is
// kept deliberately close to raw storage so a future importer can round-trip.

import { isNative, type KVStorage, storage } from './storage.ts';

export type ExportBackend = 'web' | 'native';

export type ExportPayload = {
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  backend: ExportBackend;
  keyCount: number;
  data: Record<string, unknown>;
};

export function buildExport(opts: {
  appVersion: string;
  backend: ExportBackend;
  now?: Date;
  source?: KVStorage;
}): ExportPayload {
  const src = opts.source ?? storage;
  const now = opts.now ?? new Date();
  const keys = [...src.keys()].sort();
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const raw = src.getItem(key);
    if (raw === null) continue;
    data[key] = parseValue(raw);
  }
  return {
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    appVersion: opts.appVersion,
    backend: opts.backend,
    keyCount: keys.length,
    data,
  };
}

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function exportFilename(appVersion: string, now: Date): string {
  const stamp = formatTimestamp(now);
  const safe = sanitizeVersion(appVersion);
  const suffix = safe ? `${safe}-` : '';
  return `musicreps-export-${suffix}${stamp}.json`;
}

function sanitizeVersion(v: string): string {
  return v.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function detectBackend(): ExportBackend {
  return isNative() ? 'native' : 'web';
}

export function downloadExport(
  payload: ExportPayload,
  filename: string,
): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
