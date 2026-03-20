/**
 * Capture a visual history snapshot — a handful of key screenshots plus metadata.
 * Skips if HEAD hasn't changed since the last snapshot.
 *
 * Usage:
 *   npx tsx scripts/capture-visual-history.ts                        # auto-skip if no new commits
 *   npx tsx scripts/capture-visual-history.ts --force                # capture even if HEAD unchanged
 *   npx tsx scripts/capture-visual-history.ts --backfill-ghpages <gh-pages-commit> --preview <dir> [--note "..."]
 */

import { execSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface Config {
  description: string;
  archiveDir: string;
  screenshots: string[];
}

function loadConfig(): Config {
  const raw = readFileSync(path.join(__dirname, 'visual-history.json'), 'utf8');
  return JSON.parse(raw) as Config;
}

function expandHome(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME ?? '/tmp', p.slice(2));
  }
  return p;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function git(cmd: string, cwd = REPO_DIR): string {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf8' }).trim();
}

interface CommitInfo {
  hash: string;
  short: string;
  date: string; // YYYY-MM-DD
  subject: string;
  branch: string;
}

function getCommitInfo(ref: string, cwd = REPO_DIR): CommitInfo {
  const hash = git(`rev-parse ${ref}`, cwd);
  const short = git(`rev-parse --short ${ref}`, cwd);
  const isoDate = git(`log -1 --format=%ci ${ref}`, cwd);
  const date = isoDate.split(' ')[0]; // YYYY-MM-DD
  const subject = git(`log -1 --format=%s ${ref}`, cwd);
  let branch = 'detached';
  try {
    branch = git('branch --show-current', cwd);
  } catch { /* detached HEAD */ }
  return { hash, short, date, subject, branch };
}

// ---------------------------------------------------------------------------
// Snapshot capture
// ---------------------------------------------------------------------------

function captureScreenshots(
  wanted: string[],
  outDir: string,
  cwd: string,
): void {
  mkdirSync(outDir, { recursive: true });
  const only = wanted.join(',');
  const cmd = `npx tsx scripts/take-screenshots.ts --ci --only "${only}" --dir "${outDir}"`;
  console.log(`Running: ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });

  // The --only filter uses substring matching, so extra screenshots may sneak
  // in (e.g. "home" matches "home-starred"). Remove any we didn't ask for.
  const wantedSet = new Set(wanted.map((n) => `${n}.jpg`));
  for (const file of readdirSync(outDir)) {
    if (file.endsWith('.jpg') && !wantedSet.has(file)) {
      unlinkSync(path.join(outDir, file));
      console.log(`  Removed extra: ${file}`);
    }
  }
}

interface SnapshotMeta {
  commit: string;
  commitShort: string;
  date: string;
  subject: string;
  capturedAt: string;
  branch?: string;
  note?: string;
  screenshots: string[];
}

function writeMeta(dir: string, meta: SnapshotMeta): void {
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
}

// ---------------------------------------------------------------------------
// Archive index
// ---------------------------------------------------------------------------

function regenerateIndex(archiveDir: string): void {
  const entries = readdirSync(archiveDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}_/.test(d.name))
    .map((d) => d.name)
    .sort()
    .reverse();

  const lines: string[] = [
    '# Music Reps — Visual History\n',
    '| Date | Commit | Subject | Screenshots |',
    '|------|--------|---------|-------------|',
  ];

  for (const name of entries) {
    const metaPath = path.join(archiveDir, name, 'meta.json');
    if (!existsSync(metaPath)) continue;
    const meta: SnapshotMeta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const imgs = readdirSync(path.join(archiveDir, name)).filter(
      (f) => f.endsWith('.jpg') || f.endsWith('.png'),
    );
    const note = meta.note ? ` — ${meta.note}` : '';
    lines.push(
      `| ${meta.date} | \`${meta.commitShort}\` | ${meta.subject}${note} | ${imgs.length} images |`,
    );
  }

  lines.push('');
  writeFileSync(path.join(archiveDir, 'index.md'), lines.join('\n'));
  console.log(`Archive index updated: ${archiveDir}/index.md`);
}

// ---------------------------------------------------------------------------
// Last snapshot check
// ---------------------------------------------------------------------------

function getLastSnapshotCommit(archiveDir: string): string | null {
  if (!existsSync(archiveDir)) return null;
  const dirs = readdirSync(archiveDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}_/.test(d.name))
    .map((d) => d.name)
    .sort();
  if (dirs.length === 0) return null;
  const lastMeta = path.join(archiveDir, dirs[dirs.length - 1], 'meta.json');
  if (!existsSync(lastMeta)) return null;
  const meta: SnapshotMeta = JSON.parse(readFileSync(lastMeta, 'utf8'));
  return meta.commit;
}

// ---------------------------------------------------------------------------
// Backfill from gh-pages
// ---------------------------------------------------------------------------

/** Extract a screenshot blob from a gh-pages commit directly (no rebuild). */
function extractFromGhPages(
  ghPagesCommit: string,
  previewPath: string,
  screenshotName: string,
  outDir: string,
): boolean {
  const blobPath = `${previewPath}/screenshots/${screenshotName}.jpg`;
  try {
    const buf = execSync(
      `git show ${ghPagesCommit}:${blobPath}`,
      { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
    );
    writeFileSync(path.join(outDir, `${screenshotName}.jpg`), buf);
    return true;
  } catch {
    return false;
  }
}

/**
 * Backfill a snapshot by extracting screenshots from a gh-pages preview commit.
 *
 * Usage: --backfill-ghpages <gh-pages-commit> --preview <preview-dir-name>
 *        [--note "..."] [--source-commit <hash>]
 *
 * The source commit (the original feature branch commit) is auto-detected from
 * data-version in the preview's index.html if not provided.
 */
function backfillFromGhPages(
  ghPagesCommit: string,
  previewName: string,
  note: string,
  sourceCommitOverride: string | null,
  config: Config,
  archiveDir: string,
): void {
  const previewPath = `preview/${previewName}`;

  // Detect source commit from data-version in the preview HTML
  let sourceShort = sourceCommitOverride ?? '';
  if (!sourceShort) {
    try {
      const html = git(`show ${ghPagesCommit}:${previewPath}/index.html`);
      const match = html.match(/data-version="([^"]+)"/);
      if (match) sourceShort = match[1].split(' ')[0];
    } catch { /* no index.html */ }
  }

  // Resolve the source commit to get date and subject
  let date: string;
  let subject: string;
  let fullHash: string;
  try {
    fullHash = git(`rev-parse ${sourceShort}`);
    const info = getCommitInfo(sourceShort);
    date = info.date;
    subject = info.subject;
  } catch {
    // Source commit might not exist locally (e.g. force-pushed branch).
    // Fall back to the gh-pages commit date.
    const ghDate = git(`log -1 --format=%ci ${ghPagesCommit}`);
    date = ghDate.split(' ')[0];
    subject = `Preview: ${previewName}`;
    fullHash = sourceShort || 'unknown';
  }

  const dirName = `${date}_${sourceShort || ghPagesCommit.slice(0, 8)}`;
  const snapshotDir = path.join(archiveDir, dirName);

  if (existsSync(snapshotDir)) {
    console.log(`Snapshot already exists: ${snapshotDir}`);
    return;
  }

  mkdirSync(snapshotDir, { recursive: true });
  console.log(
    `Backfilling from gh-pages ${ghPagesCommit.slice(0, 8)} → ${previewName}...`,
  );

  const extracted: string[] = [];
  for (const name of config.screenshots) {
    if (extractFromGhPages(ghPagesCommit, previewPath, name, snapshotDir)) {
      extracted.push(name);
      console.log(`  ${name}.jpg`);
    } else {
      console.log(`  ${name}.jpg — not found, skipping`);
    }
  }

  if (extracted.length === 0) {
    console.log('No screenshots found. Removing empty snapshot dir.');
    rmSync(snapshotDir, { recursive: true, force: true });
    return;
  }

  writeMeta(snapshotDir, {
    commit: fullHash,
    commitShort: sourceShort || ghPagesCommit.slice(0, 8),
    date,
    subject,
    capturedAt: new Date().toISOString(),
    note,
    screenshots: extracted,
  });

  console.log(`Backfill snapshot saved to ${snapshotDir} (${extracted.length} images)`);
  regenerateIndex(archiveDir);
}

// ---------------------------------------------------------------------------
// Normal capture at HEAD
// ---------------------------------------------------------------------------

function captureHead(
  force: boolean,
  config: Config,
  archiveDir: string,
): void {
  const info = getCommitInfo('HEAD');
  const snapshotDir = path.join(archiveDir, `${info.date}_${info.short}`);

  // Skip if no new commits
  if (!force) {
    const lastCommit = getLastSnapshotCommit(archiveDir);
    if (lastCommit === info.hash) {
      console.log(
        `No new commits since last snapshot (${info.short}). Skipping.`,
      );
      return;
    }
  }

  if (existsSync(snapshotDir)) {
    console.log(`Snapshot already exists: ${snapshotDir}`);
    return;
  }

  console.log(
    `Capturing visual history snapshot for ${info.short} (${info.date})...`,
  );

  captureScreenshots(config.screenshots, snapshotDir, REPO_DIR);

  writeMeta(snapshotDir, {
    commit: info.hash,
    commitShort: info.short,
    date: info.date,
    subject: info.subject,
    capturedAt: new Date().toISOString(),
    branch: info.branch,
    screenshots: config.screenshots,
  });

  console.log(`Snapshot saved to ${snapshotDir}`);
  regenerateIndex(archiveDir);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function getArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

function main(): void {
  const args = process.argv.slice(2);
  const config = loadConfig();
  const archiveDir = expandHome(config.archiveDir);
  mkdirSync(archiveDir, { recursive: true });

  const force = args.includes('--force');

  if (args.includes('--backfill-ghpages')) {
    const ghCommit = getArg(args, '--backfill-ghpages');
    const preview = getArg(args, '--preview');
    if (!ghCommit || !preview) {
      console.error(
        'Usage: --backfill-ghpages <gh-pages-commit> --preview <dir-name> [--note "..."] [--source-commit <hash>]',
      );
      process.exit(1);
    }
    const note = getArg(args, '--note') ?? 'Backfilled from gh-pages';
    const sourceCommit = getArg(args, '--source-commit');
    backfillFromGhPages(ghCommit, preview, note, sourceCommit, config, archiveDir);
  } else {
    captureHead(force, config, archiveDir);
  }
}

main();
