# Monetization: Freemium Daily Rep Limit + RevenueCat Subscriptions

## Context

Music Reps needs a monetization strategy for iOS/Android. The goal is to charge
something without optimizing to extract maximum revenue. The chosen model: free
daily reps (generous limit), subscription for unlimited. Web stays free.

**Why this model:** The app's value is in repetition — a daily limit directly
correlates with value delivered. Casual users stay free, serious practitioners
pay. No feature fragmentation (all modes available to everyone).

**Why RevenueCat:** Cross-platform subscription management via a single
Capacitor plugin. Handles receipt validation, entitlement caching (works
offline), grace periods, and billing retry. Free under $2.5k MRR. The
alternative (direct StoreKit 2 + Google Play Billing) would be weeks of
platform-specific work.

## Strategy Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Gate mechanism | Daily rep limit (200 free/day) | Correlates with value; generous enough for real practice |
| Pricing | ~$4/month, ~$25/year, ~$45 lifetime | Niche training tool pricing; lifetime avoids subscription fatigue |
| Web | Always free | Web drives discovery |
| "Support the dev" | No | <2% conversion typical; soft paywall is more honest and effective |
| When to show paywall | At round boundaries (start or end) | User finishes their 60s round uninterrupted; limit checked before next round starts |

## Architecture

### Key Insight: Everything Already Exists

- **Daily rep counting** — `incrementDailyReps()` in `src/effort.ts` already
  tracks per-date counts in `effort_daily` storage key
- **Single choke point** — `processSubmitAnswer()` in
  `src/hooks/use-engine-actions.ts` is where every answer passes through
- **Phase-based UI** — existing `.phase-idle`, `.phase-active`,
  `.phase-round-complete` CSS system handles screen states
- **Capacitor detection** — `isNativeApp` flag already threaded through app
- **Both platforms** — `@capacitor/ios` (8.1.0) and `@capacitor/android` (8.3.0)
  already in `package.json`

### Data Flow

```
Round ends → engineRoundComplete() → check isLimitReached()
                                     → no:  "Keep Going" resumes normally
                                     → yes: phase='limit-reached' → PaywallScreen

Quiz starts → engine.start() → check isLimitReached()
                               → no:  normal start
                               → yes: phase='limit-reached' → PaywallScreen
```

The limit is checked at **round boundaries** only — never mid-round. A user who
hits rep 200 partway through a 60s round finishes that round normally. The
paywall appears where "Keep Going" / next round would normally begin.

## Implementation Plan

### Phase 1: Entitlement Module (no UI changes)

**New file: `src/entitlement.ts`**

Core logic, separated from RevenueCat SDK:

- `initEntitlement(isNative: boolean)` — reads cached premium state from storage
- `refreshEntitlement(): Promise<void>` — calls RevenueCat
  `Purchases.getCustomerInfo()`, updates cached boolean
- `getEntitlementStatus(): EntitlementStatus` — returns `{ tier: 'premium' }` or
  `{ tier: 'free', repsUsed, repsLimit, limitReached }`
- `isLimitReached(): boolean` — quick check for the engine
- `isPremium(): boolean` — for UI display

On web or when premium: `isLimitReached()` always returns `false`. Uses
`getDailyReps()` from `effort.ts` (already exported) and `toLocalDateString()`
(already exported) to read today's count.

RevenueCat import uses dynamic import with string concatenation (same pattern as
`storage.ts` for `@capacitor/preferences`) to hide from Deno's static analyzer.

Dev override: `premium_override` storage key, settable from dev panel.

**URL parameter for limit override:** `?limit=N` overrides the daily cap for
testing. `?limit=5` lets you hit the paywall after 5 reps instead of 200.
Parsed once at boot in `app.ts`, passed to `initEntitlement()`. Only active
when `premium_override` is set to `'free'` or on native — ignored on web in
normal mode (since web has no paywall). This avoids the slow cycle of answering
200 questions just to test the limit flow.

**New file: `src/entitlement_test.ts`**

Tests pure logic using injectable `DailyRepsStore` pattern from `effort.ts`.
Three cases: web (always premium), native-premium (unlimited), native-free
(limit math). No RevenueCat dependency.

### Phase 2: Engine Integration

**Modify: `src/types.ts`**

Add `'limit-reached'` to `EnginePhase` union:
```typescript
export type EnginePhase =
  | 'idle'
  | 'active'
  | 'round-complete'
  | 'limit-reached';
```

**Modify: `src/quiz-engine-state.ts`**

Add pure transition function:
```typescript
export function engineLimitReached(state: EngineState): EngineState {
  return { ...state, phase: 'limit-reached' };
}
```

**Check at two round-boundary points:**

1. **On round start (`engine.start()`)** — if the limit is already reached when
   the user taps "Practice", transition to `'limit-reached'` instead of
   `'active'`. This prevents starting a round you can't finish.

2. **On "Keep Going" (`engine.continueQuiz()`)** — after a round completes, if
   the limit has been reached during that round, transition to
   `'limit-reached'` instead of starting the next round.

`processSubmitAnswer()` is **not** modified — reps are counted as before via
`incrementDailyReps()`, but the limit check does not interrupt mid-round.

**Audit all `phase` switch/check sites** — search for `switch.*phase` and
`phase ===` to ensure `'limit-reached'` is handled (or falls through safely) in
every location. Key files: `generic-mode.tsx`, `use-phase-class.ts`,
`mode-ui-state.ts`, `quiz-engine.ts`.

### Phase 3: Paywall UI + Limit-Aware UI

#### 3a: Paywall Screen

**New file: `src/ui/paywall.tsx`**

`PaywallScreen` component, rendered when phase is `'limit-reached'`. Uses
existing layout components:
- `CenteredContent` for vertical centering
- `ActionButton` with primary/secondary variants
- Existing CSS variables (`--color-overlay-surface`, `--brand-600`)

Content:
- Daily progress: "200/200 reps today"
- Encouragement: "Nice work! You've hit your daily free limit."
- Subscription options (fetched from RevenueCat `Purchases.getOfferings()`)
- "Restore Purchases" button (required for App Store review)
- "Done for today" dismiss → navigates home
- Links to terms/privacy (required for App Store review)

On successful purchase: calls `refreshEntitlement()`, then
`engine.continueQuiz()`.

**Modify: `src/declarative/generic-mode.tsx`**

Add phase branch alongside the existing `round-complete` check:
```tsx
if (phase === 'limit-reached') {
  return <PaywallScreen onDismiss={engine.stop} onUnlocked={() => {
    refreshEntitlement().then(() => engine.continueQuiz());
  }} />;
}
```

#### 3b: Limit-Aware UI Throughout the App (non-paywall surfaces)

The paywall screen is the gate, but several other surfaces need to reflect the
free tier and daily progress:

**Home screen "reps today" stat** (`src/ui/home-screen.tsx`):
- Show "X / 200 reps today" (or just "X reps today" for premium)
- When limit approached (e.g. >80%), change color/icon to warn
- When limit reached, show as maxed out (e.g. red/orange)
- **Tappable** — tapping opens the paywall/upgrade UI directly from home

**Skill practice tabs** (idle phase, before starting a round):
- When limit reached: replace "Practice" button with "Upgrade" or
  "Unlock Unlimited" that opens the paywall
- Show a brief message: "Daily limit reached — come back tomorrow or upgrade"
- When limit is close (e.g. <20 reps remaining): show remaining count near the
  start button as a gentle heads-up

**About text** (skill about tab or app-level about):
- Mention the free tier: "Free: 200 reps/day. Upgrade for unlimited practice."
- Keep it factual, not pushy

**Modify: `src/styles.css`**

Add styles for:
- `.phase-limit-reached` visibility (mirrors `.phase-round-complete`)
- Paywall card layout, subscription option buttons, progress indicator
- Limit-warning color states for the home screen reps stat
- Disabled/replaced practice button styling

### Phase 4: App Boot + RevenueCat SDK

**Modify: `src/app.ts`**

After `initStorage()`, add:
```typescript
initEntitlement(isNativeApp);
if (isNativeApp) {
  import('@revenuecat/purchases-' + 'capacitor').then(({ Purchases }) => {
    Purchases.configure({ apiKey: RC_API_KEY });
  }).catch(() => {});
  refreshEntitlement(); // fire-and-forget
}
```

**Modify: `package.json`**

Add dependency: `"@revenuecat/purchases-capacitor": "^11.0.0"`

Verify compatibility with Capacitor 8.1.0 before starting.

### Phase 5: Settings Integration

**Modify: `src/ui/home-screen.tsx`**

Add subscription section to settings panel (only on native):
- Current tier display: "Premium" or "Free (X/200 reps today)"
- "Manage Subscription" button → opens RevenueCat management URL or paywall
- "Restore Purchases" link

### Phase 6: RevenueCat Dashboard Setup (non-code)

- Create RevenueCat project
- Configure iOS app (bundle ID `com.musicreps.app`) + Android
- Create entitlement: `premium`
- Create offerings with packages: monthly, yearly, lifetime
- Set up App Store Connect products (consumable → non-renewing for lifetime,
  auto-renewable for monthly/yearly)
- Add API key to app config

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/entitlement.ts` | **New** | Entitlement checking + RevenueCat wrapper |
| `src/entitlement_test.ts` | **New** | Unit tests for entitlement logic |
| `src/ui/paywall.tsx` | **New** | Paywall screen component |
| `src/types.ts` | Modify | Add `'limit-reached'` to `EnginePhase` |
| `src/quiz-engine-state.ts` | Modify | Add `engineLimitReached` transition |
| `src/hooks/use-engine-actions.ts` | Modify | Limit check at round start + continue |
| `src/declarative/generic-mode.tsx` | Modify | Render `PaywallScreen` for new phase |
| `src/app.ts` | Modify | Init entitlement + RevenueCat SDK on boot |
| `src/styles.css` | Modify | Paywall + limit-aware styles |
| `src/ui/home-screen.tsx` | Modify | Reps stat, subscription settings |
| `package.json` | Modify | Add RevenueCat dependency |

## Testing

Testing subscriptions is inherently tricky — you can't test real purchases
without store infrastructure, but you also can't ship untested payment flows.
The strategy: layer multiple test mechanisms so every scenario is covered
without requiring a real credit card.

### Mechanism 1: Dev Override (you, during development)

A `premium_override` storage key, togglable from the existing DevPage
(`src/ui/home-screen.tsx`). Three states:

| Value | Behavior |
|-------|----------|
| `'premium'` | Force premium — never hit paywall (default for dev) |
| `'free'` | Force free tier — always enforce daily limit, even on web |
| unset | Normal behavior (web=free, native=check RevenueCat) |

**Why `'free'` on web matters:** This lets you test the entire paywall flow
(limit counter → paywall screen → dismiss) in the browser with `deno task dev`,
without needing a native build. The paywall's "Subscribe" buttons won't work
(no store), but layout/flow/dismiss logic can be fully exercised.

Add to DevPage: a 3-way toggle for "Entitlement override" and a "Reset daily
reps" button that clears today's count from `effort_daily`. This gives you a
fast cycle: reset → answer N → see paywall → repeat. Combined with `?limit=5`
URL param, you can see the paywall after just 5 reps.

### Mechanism 2: RevenueCat Sandbox (you + testers, on device)

RevenueCat provides sandbox environments for both platforms:

- **iOS**: Apple's StoreKit sandbox (auto-renewing subs renew in minutes, not
  months). Enable via Xcode scheme → StoreKit Configuration → sandbox. Create
  sandbox test accounts in App Store Connect.
- **Android**: Google Play test tracks. Add tester Gmail addresses in Play
  Console → License Testing. Purchases are free.

RevenueCat's dashboard shows sandbox vs production transactions separately.

**RevenueCat also supports a "Promotional" entitlement** — you can grant premium
to any app user ID from the dashboard without any purchase. Useful for:
- Granting access to beta testers
- Testing the "already premium" flow on a fresh install
- Debugging entitlement refresh issues

### Mechanism 3: TestFlight / Internal Testing (testers)

For people you want to give access to:

- **iOS TestFlight**: Upload a build, invite testers by email. They install via
  TestFlight app. StoreKit sandbox is automatic — testers can "purchase" without
  real charges. Subs renew on an accelerated schedule (monthly → every 5min).
- **Android Internal Testing**: Upload to Play Console internal test track.
  Invite testers by email or Google Group. License testers get free purchases.
- **Web**: Send them the GitHub Pages URL. Web is always free — no paywall
  testing possible, but they can use the full app.

For testers who should **not** see the paywall at all (e.g., feedback testers
who just need to evaluate the app), grant them premium via RevenueCat's
dashboard.

### Mechanism 4: Automated Tests (CI)

`src/entitlement_test.ts` covers the pure logic:
- Web platform → always returns premium (no paywall on web, ever)
- Native + premium entitlement → unlimited reps
- Native + free tier → correct limit math (199 reps = not reached, 200 = reached)
- Custom limit via URL param → overrides default (e.g. `?limit=5`)
- Daily reset → new day resets counter to 0
- Dev override → forces the expected tier regardless of platform

No RevenueCat SDK in tests — the entitlement module separates pure logic
(limit checking) from SDK calls (purchase/restore). Tests inject a mock
`DailyRepsStore` (same pattern as `effort_test.ts`).

### Test Matrix

| Scenario | How to test | Where |
|----------|-------------|-------|
| Paywall never shows on web | `deno task dev`, answer 200+ questions | Browser |
| Paywall shows at limit | Override `'free'` + `?limit=5`, do a round | Browser |
| Paywall layout/styling | Override `'free'` + `?limit=5`, do a round | Browser |
| "Done for today" dismiss | Hit limit, tap dismiss, verify home screen | Browser |
| Subscribe flow (UI) | iOS simulator + StoreKit sandbox | Xcode |
| Subscribe flow (real) | TestFlight + sandbox account | Device |
| Restore purchases | Sandbox purchase on device A, restore on device B | Devices |
| Premium → no limit | RevenueCat dashboard grant, verify unlimited | Device |
| Offline premium | Purchase, airplane mode, relaunch, verify unlimited | Device |
| Daily reset | Use `?limit=5`, hit limit day 1, verify 0/200 on day 2 | Any |
| Round boundary | Hit limit mid-round, verify round finishes | Browser |
| Existing user upgrade | Use app (free), purchase mid-session, continue | Device |

### Developing Without Hitting the Paywall

Three options depending on context:

1. **Web (`deno task dev`)**: Paywall code never activates — `isNativeApp` is
   false, `isLimitReached()` returns false. Zero friction, normal development.
2. **Native with override**: Set `premium_override` → `'premium'` in DevPage.
   Persists in storage across app restarts.
3. **Native with RevenueCat grant**: From RevenueCat dashboard, grant your test
   user the `premium` entitlement. No code changes needed.

## Verification Checklist

1. `deno task test` — entitlement tests pass, existing tests unaffected
2. `deno task check` — no type errors from new `EnginePhase` variant
3. `deno task ok` — full suite passes
4. `deno task dev` — web: no paywall ever (even with 200+ reps)
5. `deno task dev` — override `'free'` + `?limit=5`: paywall at round boundary
6. `deno task dev` — override `'free'` + `?limit=5`: practice tab shows "Upgrade"
7. `deno task dev` — home screen reps stat is tappable, changes color near limit
8. iOS simulator — StoreKit sandbox purchase completes, entitlement grants
9. TestFlight build — external tester can install and hit paywall

## Risks

- **`EnginePhase` widening**: Adding `'limit-reached'` may cause exhaustiveness
  errors in switch statements. Audit all phase-checking code before proceeding.
- **RevenueCat + Capacitor 8 compatibility**: Verify the plugin version supports
  Capacitor 8.1.0 before installing.
- **App Store review**: Paywall must show prices, have "Restore Purchases", and
  link to terms/privacy policy.
