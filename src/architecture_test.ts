import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ---------------------------------------------------------------------------
// Helpers: parse the import graph from source files
// ---------------------------------------------------------------------------

/** Resolve a relative import specifier against a source file path. */
function resolveImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null; // skip bare specifiers (preact, node:*)
  const fromDir = fromFile.replace(/\/[^/]+$/, '');
  const parts = [...fromDir.split('/'), ...specifier.split('/')];
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === '..') resolved.pop();
    else if (p !== '.') resolved.push(p);
  }
  return resolved.join('/');
}

/** Extract local src/ import targets from a source file's text. */
function parseImports(filePath: string, source: string): string[] {
  const deps: string[] = [];
  // Match: import ... from '...' and import '...' and export ... from '...'
  const re = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const resolved = resolveImport(filePath, m[1]);
    if (resolved && resolved.startsWith('src/')) deps.push(resolved);
  }
  return [...new Set(deps)];
}

/** Recursively collect all .ts/.tsx files under a directory. */
function walkSync(dir: string): string[] {
  const results: string[] = [];
  for (const entry of Deno.readDirSync(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      results.push(...walkSync(path));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('_test.ts')
    ) {
      results.push(path);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Build the dependency graph once, share across tests
// ---------------------------------------------------------------------------

interface DepGraph {
  edges: Map<string, string[]>; // file -> [dependency files]
}

function buildGraph(): DepGraph {
  const edges = new Map<string, string[]>();
  const files = walkSync('src');
  for (const absPath of files) {
    const relPath = absPath; // already relative (src/...)
    const source = Deno.readTextFileSync(absPath);
    const deps = parseImports(relPath, source);
    edges.set(relPath, deps);
  }
  return { edges };
}

const graph = buildGraph();

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

function findCycles(edges: Map<string, string[]>): string[][] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const k of edges.keys()) color.set(k, WHITE);

  const cycles: string[][] = [];

  function dfs(node: string, path: string[]) {
    color.set(node, GRAY);
    for (const dep of edges.get(node) ?? []) {
      if (!color.has(dep)) continue; // external or missing
      if (color.get(dep) === GRAY) {
        const cycleStart = path.indexOf(dep);
        cycles.push([...path.slice(cycleStart), dep]);
      } else if (color.get(dep) === WHITE) {
        dfs(dep, [...path, dep]);
      }
    }
    color.set(node, BLACK);
  }

  for (const node of edges.keys()) {
    if (color.get(node) === WHITE) dfs(node, [node]);
  }
  return cycles;
}

// ---------------------------------------------------------------------------
// Layer classification
// ---------------------------------------------------------------------------

type Layer =
  | 'foundation'
  | 'engine'
  | 'display'
  | 'mode-logic'
  | 'hooks'
  | 'ui'
  | 'mode-component'
  | 'app'
  | 'build-time'
  | 'tool';

const FOUNDATION = new Set([
  'src/types.ts',
  'src/music-data.ts',
  'src/adaptive.ts',
  'src/deadline.ts',
]);

const ENGINE = new Set([
  'src/quiz-engine-state.ts',
  'src/quiz-engine.ts',
]);

const DISPLAY = new Set([
  'src/stats-display.ts',
  'src/recommendations.ts',
  'src/mode-ui-state.ts',
  'src/quiz-fretboard-state.ts',
]);

const BUILD_TIME = new Set([
  'src/build-template.ts',
  'src/html-helpers.ts',
  'src/fretboard.ts',
  'src/styles.css',
]);

const APP = new Set([
  'src/app.ts',
  'src/navigation.ts',
  'src/settings.ts',
]);

const TOOL = new Set([
  'src/sim.ts',
]);

function classifyLayer(file: string): Layer {
  if (FOUNDATION.has(file)) return 'foundation';
  if (ENGINE.has(file)) return 'engine';
  if (DISPLAY.has(file)) return 'display';
  if (BUILD_TIME.has(file)) return 'build-time';
  if (APP.has(file)) return 'app';
  if (TOOL.has(file)) return 'tool';
  if (file.startsWith('src/hooks/')) return 'hooks';
  if (file.startsWith('src/ui/')) return 'ui';
  if (file.match(/src\/modes\/[^/]+\/logic\.ts$/)) return 'mode-logic';
  if (file.startsWith('src/modes/')) return 'mode-component';
  if (file === 'src/mode-utils.ts') return 'mode-logic';
  return 'app'; // fallback for unknown files
}

/** Extract mode name from a modes/ path, or null. */
function modeName(file: string): string | null {
  const m = file.match(/^src\/modes\/([^/]+)\//);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Architecture', () => {
  it('dependency graph has no cycles', () => {
    const cycles = findCycles(graph.edges);
    assert.deepEqual(
      cycles,
      [],
      `Circular dependencies found:\n${
        cycles.map((c) => '  ' + c.join(' → ')).join('\n')
      }`,
    );
  });

  it('modes do not import from other modes', () => {
    const violations: string[] = [];
    for (const [file, deps] of graph.edges) {
      const srcMode = modeName(file);
      if (!srcMode) continue;
      for (const dep of deps) {
        const depMode = modeName(dep);
        if (depMode && depMode !== srcMode) {
          violations.push(`${file} → ${dep}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      `Cross-mode imports found:\n${
        violations.map((v) => '  ' + v).join('\n')
      }`,
    );
  });

  it('hooks do not import from modes', () => {
    const violations: string[] = [];
    for (const [file, deps] of graph.edges) {
      if (!file.startsWith('src/hooks/')) continue;
      for (const dep of deps) {
        if (dep.startsWith('src/modes/')) {
          violations.push(`${file} → ${dep}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      formatViolations('hooks → modes', violations),
    );
  });

  it('ui components do not import from modes', () => {
    const violations: string[] = [];
    for (const [file, deps] of graph.edges) {
      if (!file.startsWith('src/ui/')) continue;
      for (const dep of deps) {
        if (dep.startsWith('src/modes/')) {
          violations.push(`${file} → ${dep}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      formatViolations('ui → modes', violations),
    );
  });

  it('hooks do not import from app layer', () => {
    const violations: string[] = [];
    for (const [file, deps] of graph.edges) {
      if (!file.startsWith('src/hooks/')) continue;
      for (const dep of deps) {
        if (APP.has(dep)) {
          violations.push(`${file} → ${dep}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      formatViolations('hooks → app', violations),
    );
  });

  it('ui components do not import from app layer', () => {
    const violations: string[] = [];
    for (const [file, deps] of graph.edges) {
      if (!file.startsWith('src/ui/')) continue;
      for (const dep of deps) {
        if (APP.has(dep)) {
          violations.push(`${file} → ${dep}`);
        }
      }
    }
    assert.deepEqual(violations, [], formatViolations('ui → app', violations));
  });

  it('foundation layer only imports from foundation', () => {
    const violations: string[] = [];
    for (const [file, deps] of graph.edges) {
      if (!FOUNDATION.has(file)) continue;
      for (const dep of deps) {
        if (!FOUNDATION.has(dep)) {
          violations.push(`${file} → ${dep}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      formatViolations('foundation → non-foundation', violations),
    );
  });

  it('engine layer only imports from foundation + engine', () => {
    const allowed = new Set([...FOUNDATION, ...ENGINE]);
    const violations: string[] = [];
    for (const [file, deps] of graph.edges) {
      if (!ENGINE.has(file)) continue;
      for (const dep of deps) {
        if (!allowed.has(dep)) {
          violations.push(`${file} → ${dep}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      formatViolations('engine → outside foundation+engine', violations),
    );
  });

  it('quiz-engine-state.ts has no dependencies beyond types.ts', () => {
    const deps = graph.edges.get('src/quiz-engine-state.ts') ?? [];
    const nonTypes = deps.filter((d) => d !== 'src/types.ts');
    assert.deepEqual(
      nonTypes,
      [],
      `quiz-engine-state.ts should be pure but imports: ${nonTypes.join(', ')}`,
    );
  });

  it('all src/ files are classified into a known layer', () => {
    const unclassified: string[] = [];
    for (const file of graph.edges.keys()) {
      const layer = classifyLayer(file);
      // classifyLayer falls back to 'app' — check it's intentional
      if (layer === 'app' && !APP.has(file) && !file.startsWith('src/modes/')) {
        unclassified.push(file);
      }
    }
    assert.deepEqual(
      unclassified,
      [],
      `Files not assigned to any layer:\n${
        unclassified.map((f) => '  ' + f).join('\n')
      }\nAdd them to a layer set in architecture_test.ts.`,
    );
  });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatViolations(label: string, violations: string[]): string {
  return `${label} violations:\n${violations.map((v) => '  ' + v).join('\n')}`;
}
