# ADR 0001: React Native over Flutter for the mobile app

Date: 2026-05-23
Status: Accepted

## Context

We need a cross-platform mobile app (iOS + Android, equal priority) that captures wound photographs and computes wound measurements via depth-sensor AR (ARKit/LiDAR on iOS, ARCore Depth API on Android). We also have a Phase 2 web portal that will be Next.js + TypeScript.

## Decision

Use React Native (via Expo SDK 51+ with EAS) for the mobile app, with native modules in Swift (iOS) and Kotlin (Android) for the AR measurement screen. Reject Flutter.

## Rationale

1. **Code sharing with the Phase 2 portal.** Mobile and web are both TypeScript. Zod schemas, validation, the typed Supabase client, and PDF template specs live in `/packages/shared` and are reused across both. Flutter creates a Dart silo with no portal reuse.
2. **Supabase first-class JS support.** `@supabase/supabase-js` is the canonical SDK; Flutter has `supabase-flutter` but lags behind in features.
3. **Hiring pool.** React Native + TypeScript engineers are easier to hire than Flutter + Dart.
4. **AR pipeline is platform-specific either way.** Both React Native and Flutter require native bridges for ARKit/ARCore. We're not giving up cross-platform code reuse — only the AR measurement screen is per-platform; everything else (auth, lists, forms, sync, export) is shared TypeScript.
5. **App Store / Play Store review.** Both stacks ship to both stores routinely; no review advantage either way.

## Trade-offs accepted

- React Native UI performance is below Flutter and below native. For a clinical documentation app this is acceptable; we're not building animation-heavy software.
- React Native has more dependency churn than Flutter; we'll pin versions and update on a release cadence rather than continuously.
- Two native modules to maintain (one per platform) is the same in both stacks.

## Consequences

- AR module skeletons live at `apps/mobile/modules/ios/WoundMeasurementModule/` and `apps/mobile/modules/android/WoundMeasurementModule/`.
- All non-AR code lives in shared TypeScript under `apps/mobile/src/`.
- Phase 2 portal at `apps/web/` (Next.js) will import from `packages/shared` directly.
