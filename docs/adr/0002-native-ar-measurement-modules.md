# ADR 0002: Native AR measurement modules (one entry point, two implementations)

Date: 2026-05-23
Status: Accepted

## Context

The wound measurement screen requires depth-sensor AR — ARKit + LiDAR on iOS, ARCore Depth API on Android. Cross-platform AR libraries (`viro-react`, abandoned; `@react-native-three`, immature; Flutter AR plugins, limited) don't expose the depth API and tracking-state granularity we need for clinical-grade measurement.

## Decision

Implement the measurement screen as a single React Native native module called `WoundMeasurementModule`, with **separate Swift (ARKit) and Kotlin (ARCore) implementations**. The module exposes one entry point — `measureWound(): Promise<MeasurementResult>` — that returns the same JSON shape on both platforms. Everything else in the app (lists, forms, sync, export) stays in shared TypeScript.

## Rationale

1. Direct access to platform depth APIs without an abstraction layer that might drop the next OS feature.
2. Polygon math (shoelace, PCA, perimeter) is implemented once per language and unit-tested with **identical fixtures** in both, so both platforms produce the same numerical answer on the same input.
3. The native UI for tracing the wound is shown via a full-screen native view, which gives us platform-idiomatic gesture handling for the trace.
4. React Native code stays platform-agnostic and easy to test in Jest.

## Trade-offs accepted

- Two implementations to maintain. Mitigated by keeping the math identical, tests aligned, and the public API surface narrow (one method).
- AR module changes require native dev environments (Xcode / Android Studio) rather than just Metro.

## Consequences

- TS bridge: `apps/mobile/src/native/WoundMeasurementModule.ts`.
- iOS sources: `apps/mobile/modules/ios/WoundMeasurementModule/`.
- Android sources: `apps/mobile/modules/android/WoundMeasurementModule/`.
- Shared math test fixtures: `packages/shared/src/test-fixtures/polygon-math.json` (to be created when the modules are implemented).

## Future

If a cross-platform AR library matures enough to handle clinical-grade depth sampling, revisit and migrate. Not expected within v1 / v1.1.
