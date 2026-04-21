#!/usr/bin/env -S deno run --allow-read
// Lint rule: label/longLabel functions in mode logic files must not return
// hardcoded note names (A–G) without going through displayNote().
//
// A group label like `() => 'E strings'` won't translate in solfège mode.
// It must be `() => displayNote('E') + ' strings'`.
//
// Detects: label/longLabel: () => '...' or label/longLabel: '...' where the
// string value starts with or contains a standalone note letter (A–G followed
// by space or ♯/♭).  Also handles arrow functions spanning two lines.

// Matches a note letter (A–G) that appears as an isolated word:
//   - at start of string or after a space
//   - followed by a space, end of string, or an accidental (#, b, ♯, ♭)
const BARE_NOTE_RE = /(?:^| )([A-G])(?= |$|[#b\u266F\u266D])/;

// Matches label/longLabel defined as an arrow function returning a string
// literal, or as a plain string property.  Captures the string content.
// Also matches when the string literal is on the NEXT line (multiline arrow).
const LABEL_STRING_RE =
  /\b(?:long)?label\s*:\s*(?:\(\s*\)\s*=>\s*)?[`'"]([^`'"]*)[`'"]/g;

// Matches label/longLabel with an arrow but no string on the same line
// (the string literal is expected on the next line).
const LABEL_ARROW_ONLY_RE = /\b(?:long)?label\s*:\s*\(\s*\)\s*=>\s*$/;

interface Violation {
  file: string;
  line: number;
  text: string;
  note: string;
}

const violations: Violation[] = [];

async function scanDir(dir: string): Promise<void> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      await scanDir(path);
    } else if (
      entry.isFile &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('_test.ts')
    ) {
      await scanFile(path);
    }
  }
}

async function scanFile(path: string): Promise<void> {
  const src = await Deno.readTextFile(path);
  const lines = src.split('\n');
  // Show path relative to repo root (strip leading absolute prefix)
  const rel = path.replace(/^.*\/src\//, 'src/');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check single-line label patterns.
    LABEL_STRING_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LABEL_STRING_RE.exec(line)) !== null) {
      const content = m[1] ?? '';
      const noteMatch = BARE_NOTE_RE.exec(content);
      if (noteMatch) {
        violations.push({
          file: rel,
          line: i + 1,
          text: line.trim(),
          note: noteMatch[1],
        });
      }
    }

    // Check multi-line: `label: () =>\n  'E strings'`.
    if (LABEL_ARROW_ONLY_RE.test(line) && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      const strMatch = /^[`'"]([^`'"]*)[`'"]/.exec(next);
      if (strMatch) {
        const noteMatch = BARE_NOTE_RE.exec(strMatch[1]);
        if (noteMatch) {
          violations.push({
            file: rel,
            line: i + 2, // report the string line
            text: next,
            note: noteMatch[1],
          });
        }
      }
    }
  }
}

const skillsDir = new URL('../src/skills', import.meta.url).pathname;
await scanDir(skillsDir);

if (violations.length > 0) {
  console.error(
    '\x1b[31mError\x1b[0m: Untranslated note names found in group labels.\n' +
      'Use displayNote() so labels update in solfège mode.\n',
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error(
      `    ^ note name '${v.note}' should be wrapped with displayNote()\n`,
    );
  }
  Deno.exit(1);
} else {
  console.log('lint:labels — no untranslated note names found');
}
