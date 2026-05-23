# Android WoundMeasurementModule

Native ARCore implementation. Exposes `measureWound()` to React Native.

## Files to add when scaffolding the module

Run `pnpm expo prebuild` to generate the Android project, then add under `android/app/src/main/java/com/agile/woundcare/measurement/`:

- `WoundMeasurementModule.kt` — React Native bridge (`ReactContextBaseJavaModule`).
- `MeasurementActivity.kt` — Full-screen activity hosting the AR session.
- `ARMeasurementSession.kt` — ARCore session lifecycle + Depth API sampling.
- `PolygonMath.kt` — Mirror of the iOS Swift math. Identical test fixtures.
- `WoundPlaneFitter.kt` — PCA on depth points → best-fit plane.
- `MeasurementComposeOverlay.kt` — Jetpack Compose overlay (instructions, confidence badge, save).

## Requirements

- minSdkVersion 29 (Android 10)
- Device must support ARCore (`com.google.ar.core` meta-data in AndroidManifest).
- Depth API support: most ARCore-supported phones via motion stereo + ML. Optional ToF integration on supported devices.

## Pipeline (high level)

1. Start ARCore `Session` with `Config.DepthMode.AUTOMATIC`.
2. Sample `Frame.acquireDepthImage16Bits` at the user's ROI; fit a wound plane via PCA.
3. User traces polygon with finger; unproject each touch to world space using depth; project onto wound plane.
4. Same math as iOS (shoelace, perimeter, PCA principal axes).
5. Capture photos via CameraX. EXIF stripped before returning.
6. Return `MeasurementResult` JSON to React Native.

## Accuracy notes

- ARCore Depth API without ToF: ~5–10% error at typical clinical distances. Display a "lower-confidence" badge.
- With ToF (Samsung S20+/Note 10+/S21+/S22 Ultra, Huawei P30 Pro): comparable accuracy to iOS LiDAR.
- Reference-object recalibration fallback for users without reliable depth.

## NOT IMPLEMENTED YET

This is a skeleton folder. The Kotlin sources need to be written. The bridge contract (TypeScript side) is at `apps/mobile/src/native/WoundMeasurementModule.ts`.
