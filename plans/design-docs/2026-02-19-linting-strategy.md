# Linting Strategy Review

**Date:** 2026-02-19 **Status:** Discussion / not yet decided

## Current State

No linting or formatting tools. Conventions enforced by documentation
(`guides/coding-style.md`) and the manual review checklist (~153 items).

## Options Considered

### Option A: Biome (if staying on Node build path)

- Single binary, zero config complexity
- Linting + formatting in one tool
- 449+ rules; covers all high-value checks
- Works on both .js and .ts files
- Add via `npm install -D @biomejs/biome`

### Option B: `deno lint` + `deno fmt` (if consolidating on Deno)

- Zero extra dependencies — built into the runtime
- ~123 rules; covers all high-value checks for this codebase
- `deno fmt` replaces Prettier
- `deno check` adds TypeScript type-checking (currently absent)
- `deno test` replaces `npx tsx --test`
- One tool, one config file (`deno.json`)

## High-Value Rules (both tools have these)

| Need                | Rule                                           |
| ------------------- | ---------------------------------------------- |
| Unused vars/imports | `no-unused-vars`, `no-unused-imports`          |
| `const` over `let`  | `prefer-const` / `useConst`                    |
| Ban `var`           | `no-var` / `noVar`                             |
| `===` over `==`     | `eqeqeq` / `noDoubleEquals`                    |
| No `debugger`       | `no-debugger` / `noDebugger`                   |
| No `console.log`    | `no-console` / `noConsoleLog`                  |
| No fallthrough      | `no-fallthrough` / `noFallthroughSwitchClause` |
| No self-assign      | `no-self-assign` / `noSelfAssign`              |
| No unreachable code | `no-unreachable`                               |

## What Stays in the Review Checklist

These conventions can't be expressed as lint rules:

- Immutable state transitions (`{ ...state, field }`)
- Container-scoped DOM queries (not `document.querySelector`)
- Factory naming (`createXxx()`)
- localStorage key namespacing
- Mode plugin interface completeness
- Consolidate-before-expanding progression

## Sandbox Findings (Deno)

Deno is not pre-installed but installs via `npm install -g deno`.

**Network issue:** The Claude web sandbox uses an egress proxy with a custom CA.
Deno's own TLS stack doesn't honor `NODE_EXTRA_CA_CERTS`. Fix:

```
export DENO_TLS_CA_STORE=system
```

This tells Deno to use the system cert store (which includes the proxy CA). With
this set, all Deno commands work: `deno lint`, `deno fmt`, `deno test`,
`deno run main.ts --build`.

**Test results:**

| Command                    | Status | Notes                                         |
| -------------------------- | ------ | --------------------------------------------- |
| `deno lint`                | works  | Found real issues (unused param, empty catch) |
| `deno fmt --check`         | works  | Detected formatting diffs                     |
| `deno check`               | works  | Type-checked .ts files                        |
| `deno run main.ts --build` | works  | Built successfully                            |
| `deno test --no-check`     | works  | 105 steps, 0 failures                         |

## Node Build Path Assessment

`main.ts` (Deno, 70 lines) and `build.ts` (Node, 730 lines) share the core via
`assembleHTML()` from `build-template.ts`. They diverge on:

- esbuild invocation (Deno.Command vs JS API)
- File I/O (Deno vs node:fs)
- `build.ts` has ~450 lines of moments page generation not in `main.ts`
- CI uses the Node path (`npx tsx build.ts`)

Migration to Deno-only would require:

1. Moving moments generation into the Deno build script
2. Swapping CI from `actions/setup-node` to `denoland/setup-deno`
3. Adding `DENO_TLS_CA_STORE=system` to Claude web environment config

## Recommendation

If consolidating on Deno: use `deno lint` + `deno fmt` + `deno check`. If
keeping dual paths: use Biome.

Either way, the lint rules to enable are the same — the high-value table above.
The Deno path has the advantage of also enabling type checking via `deno check`,
which catches the class of bug LLMs are worst at (subtle type mismatches).
