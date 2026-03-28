# Architecture + Guides Quality Review

**Date:** 2026-03-11  
**Status:** Review (no implementation changes proposed)

## Scope

This review evaluates:

1. The current application architecture (code + build + testing boundaries)
2. The guidance layer (`guides/` and `CLAUDE.md`)
3. Where quality is already “clean, clear, correct-by-construction”
4. Where quality falls short, with only brief directional suggestions

---

## Executive Read

The project is strongest where it has **explicit structural constraints plus test
backing** (layer boundaries, pure state transitions, declarative mode contracts,
shared hooks/components). Those areas are unusually high quality for a solo app
and feel intentionally designed, not accidental.

Quality drops where the system has **two sources of truth** (notably architecture
counts and rendering paths), and where aspirational docs are rich but not yet
translated into measurable acceptance criteria. The result is “high-signal core,
fuzzy edges.”

---

## Where the quality level holds

## 1) Architecture boundaries are explicit and enforced

- The architecture is documented as layered with clear dependency direction,
  then backed by an architecture test that validates real imports, cycles,
  and layer violations.
- This is the clearest “correct-by-construction” property in the codebase:
  structure drift is caught automatically.

**Why this is high quality:**
- The rules are concrete, local, and machine-checkable.
- The docs and enforcement mechanism are aligned conceptually.

---

## 2) Logic/UI separation is real, not just rhetorical

- Core quiz flow relies on pure state transitions and testable helpers.
- Hooks wrap pure logic into reactive behavior; UI components are split into
  structural and control-level building blocks.
- Mode logic is predominantly pure and isolated from DOM concerns.

**Why this is high quality:**
- Makes behavior testable without rendering.
- Reduces accidental coupling between musical logic and interaction details.
- Supports incremental evolution of learner model and rendering.

---

## 3) Mode system has strong leverage via declarative definitions

- Most modes are registered through compact definitions interpreted by
  `GenericMode`, with shared keyboard/scope/stats/engine behavior.
- Specialized modes still have explicit escape hatches (`useController` style
  overrides and one handwritten mode where needed).

**Why this is high quality:**
- New mode surface area is constrained.
- Shared UX behavior is centralized, so consistency is easier to maintain.
- The architecture supports both standardization and justified specialization.

---

## 4) Guides are thoughtfully stratified by purpose

- `CLAUDE.md` plus `guides/` separate vision, enduring principles, current
  reference, and process.
- This reduces the common “everything is in one stale README” failure mode.

**Why this is high quality:**
- Good information architecture for humans.
- Strong onboarding signal for both people and coding agents.

---

## 5) Product tone and design intent are coherent

- Vision + design principles repeatedly emphasize calm, serious practice,
  minimal config, and data-first progress.
- The guidance coheres around one product identity rather than fragmented UI
  preferences.

**Why this is high quality:**
- Creates decision consistency across product, design, and engineering.
- Helps avoid gimmick drift.

---

## Where quality falls short

## 1) Some “single source of truth” claims are currently duplicated

There are still places where quality relies on discipline rather than strict
construction:

- Build-time HTML and runtime Preact both define overlapping structure in parts
  of the app.
- Architecture narrative has count mismatches (e.g., handwritten vs declarative
  mode totals) across docs and code comments.

**Impact:**
- Higher cognitive load during UI changes.
- Increased risk of subtle divergence between docs and reality.

**Directional suggestion:** continue collapsing duplicate descriptions of system
shape into one authoritative source where practical.

---

## 2) “Aspirational” guidance is strong, but not always operationalized

Vision and principles are excellent in tone and direction, but some quality bars
(beauty, clarity, confidence, usability polish) are not consistently translated
into measurable checks.

**Impact:**
- Harder to know when a change truly meets the intended quality level.
- Reviews may rely on taste more than shared criteria.

**Directional suggestion:** gradually convert key principles into lightweight,
repeatable review heuristics (especially for visual hierarchy and interaction
friction).

---

## 3) Guide cohesion is high, but synchronization burden is non-trivial

The documentation set is rich and useful, but broad. As architecture evolves,
keeping `CLAUDE.md`, `guides/architecture.md`, and code comments fully aligned
requires ongoing maintenance.

**Impact:**
- Drift risk increases with each architectural iteration.
- New contributors/agents may get mixed signals about what is current.

**Directional suggestion:** add a small recurring doc-sync pass tied to major
architecture changes.

---

## 4) Correctness is strongest in data/state layers, weaker in UX-level guarantees

The project has strong correctness discipline for transitions and dependencies,
but fewer explicit guarantees around interaction smoothness, visual consistency,
and ergonomic quality under real usage variance.

**Impact:**
- System can be internally correct while still feeling uneven in polish.

**Directional suggestion:** preserve the existing state-layer rigor while adding
similarly explicit expectations for UX quality at key touchpoints.

---

## Overall assessment

- **Clean:** High in architecture core (layering, purity, reuse).
- **Clear:** High in conceptual framing and guide taxonomy.
- **Correct-by-construction:** High for import boundaries and pure transitions;
  medium for documentation and rendering-source consistency; lower for
  measurable UX/polish guarantees.

In short: the foundation is excellent and unusually intentional. The remaining
quality gap is less about algorithmic correctness and more about reducing
source-of-truth duplication and making design quality criteria as enforceable as
architecture criteria.
