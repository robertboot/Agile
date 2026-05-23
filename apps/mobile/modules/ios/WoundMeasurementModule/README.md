# iOS WoundMeasurementModule

Native ARKit + LiDAR implementation. Exposes `measureWound()` to React Native.

## Files to add when scaffolding the module

Run `pnpm expo prebuild` to generate the iOS project, then add to `ios/Agile.xcworkspace`:

- `WoundMeasurementModule.swift` — React Native bridge (`RCT_EXTERN_MODULE`).
- `ARMeasurementSession.swift` — ARKit session lifecycle, LiDAR depth sampling, polygon trace UI.
- `PolygonMath.swift` — shoelace area, perimeter, PCA length/width. Unit-tested.
- `WoundPlaneFitter.swift` — PCA on depth points → best-fit plane for projection.
- `WoundMeasurementView.swift` — SwiftUI overlay (instructions, confidence badge, save button).

## Requirements

- iOS 16.0+
- `ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)` must return `true` (LiDAR-only). Non-LiDAR devices fail fast with `MEASUREMENT_DEPTH_UNSUPPORTED`.

## Pipeline (high level)

1. Start `ARWorldTrackingConfiguration` with `sceneReconstruction = .meshWithClassification` and `frameSemantics = [.sceneDepth, .smoothedSceneDepth]`.
2. Detect a planar region in the user's ROI; fit a wound plane via PCA on `sceneDepth` points.
3. User traces polygon with finger; unproject each touch to world space using the depth map; project onto wound plane.
4. Compute area (shoelace on 2D projected coords), perimeter (sum of 3D edge lengths), length/width (PCA principal axes).
5. Capture overview + closeup photos via `AVCaptureSession`. EXIF stripped before returning.
6. Return `MeasurementResult` JSON to React Native.

## Validation

Unit tests for `PolygonMath` go in `WoundMeasurementModuleTests` with fixtures matching the Android Kotlin tests exactly. Integration validation is done via printed-phantom protocol — see `/docs/regulatory/measurement-validation.md`.

## NOT IMPLEMENTED YET

This is a skeleton folder. The Swift sources need to be written. The bridge contract (TypeScript side) is at `apps/mobile/src/native/WoundMeasurementModule.ts`.
