// Shared dev-server helper for E2E tests and scripts.
// Spawns a Deno dev server on the requested port and resolves once it's listening.

import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

export function startServer(
  port: number,
): { proc: ChildProcess; portReady: Promise<number> } {
  const proc = spawn(
    'deno',
    [
      'run',
      '--allow-net',
      '--allow-read',
      '--allow-run',
      '--allow-env',
      'main.ts',
      `--port=${port}`,
    ],
    { cwd: PROJECT_ROOT, stdio: 'pipe' },
  );
  const portReady = new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Server did not start within 10s')),
      10_000,
    );
    proc.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString();
      const m = msg.match(/Listening on http:\/\/[\w.]+:(\d+)/);
      if (m) {
        clearTimeout(timeout);
        resolve(parseInt(m[1], 10));
      } else {
        process.stderr.write(msg);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code) reject(new Error(`Server exited with code ${code}`));
    });
  });
  return { proc, portReady };
}
