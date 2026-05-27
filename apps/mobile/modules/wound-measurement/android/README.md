# Android wound-measurement module (next sprint)

Mirror of the iOS implementation:
- `WoundMeasurementModule.kt` — Expo Module bridge
- `ARMeasurementSession.kt` — ARCore session, Depth API sampling
- `ARMeasurementActivity.kt` — full-screen activity with Compose overlay
- `PolygonMath.kt` — math, ports the Swift logic line-for-line
- `WoundPlaneFitter.kt` — PCA + plane fit
- `Tests/PolygonMathTest.kt` — exercises the same JSON fixtures used by iOS

Shared test fixtures live at `packages/shared/src/test-fixtures/polygon-math.json`.
Both platforms must produce numerically identical results within the per-case tolerance.

ARCore notes:
- minSdkVersion 29.
- Use `Config.DepthMode.AUTOMATIC` and `Frame.acquireDepthImage16Bits()`.
- ToF-equipped devices (Samsung S2x Ultra, Note 10+, Huawei P30 Pro) get higher confidence.
- For devices without reliable depth, fall back to reference-object scaling (next sprint).
