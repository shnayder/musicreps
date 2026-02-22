import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ---------------------------------------------------------------------------
// Build the dependency graph via `deno info --json`
// ---------------------------------------------------------------------------

const PROJECT_ROOT = new URL('..', import.meta.url).pathname.replace(
  /\/$/,
  '',
);
const FILE_PREFIX = `file://${PROJECT_ROOT}/`;

interface DepGraph {
  edges: Map<string, string[]>; // file -> [dependency files]
}

function buildGraph(): DepGraph {
  const result = new Deno.Command('deno', {
    args: ['info', '--json', 'src/app.ts'],
    cwd: PROJECT_ROOT,
    stdout: 'piped',
    stderr: 'piped',
  }).outputSync();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr);
    throw new Error(`deno info failed: ${stderr}`);
  }

  const data = JSON.parse(new TextDecoder().decode(result.stdout));
  const edges = new Map<string, string[]>();

  for (const mod of data.modules) {
    const spec: string = mod.specifier;
    if (!spec.startsWith(FILE_PREFIX + 'src/')) continue;
    const src = spec.slice(FILE_PREFIX.length);
    const deps: string[] = [];

    for (const d of mod.dependencies ?? []) {
      for (const key of ['code', 'type']) {
        const val = d[key];
        if (
          val && typeof val === 'object' && 'specifier' in val &&
          val.specifier.startsWith(FILE_PREFIX + 'src/')
        ) {
          deps.push(val.specifier.slice(FILE_PREFIX.length));
        }
      }
    }

    edges.set(src, [...new Set(deps)]);
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

  it('display layer only imports from foundation + display', () => {
    const allowed = new Set([...FOUNDATION, ...DISPLAY]);
    const violations: string[] = [];
    for (const [file, deps] of graph.edges) {
      if (!DISPLAY.has(file)) continue;
      for (const dep of deps) {
        if (!allowed.has(dep)) {
          violations.push(`${file} → ${dep}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      formatViolations('display → outside foundation+display', violations),
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
      if (
        layer === 'app' && !APP.has(file) && !file.startsWith('src/modes/')
      ) {
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
