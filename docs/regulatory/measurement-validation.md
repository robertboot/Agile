# Measurement Validation Protocol

Run this protocol before making clinical-accuracy claims, before App Store / Play Store submission, and any time the AR pipeline changes materially.

## Goals

1. Quantify measurement accuracy for area, perimeter, length, and width across the supported device matrix.
2. Document the device classes that meet documentation-grade accuracy (target: ±5% on area for 1–25 cm² wounds).
3. Identify Android devices that should display a "lower-confidence" badge.

## Phantoms

Use printed paper wound phantoms with known geometry:
- Circle: 1, 2, 5, 10, 25 cm² (compute analytic area).
- Square: 1, 4, 9, 16, 25 cm² (compute analytic area).
- Irregular polygon: 3 shapes traced from real clinical photos, areas measured by calibrated planimetry as ground truth.

Print on matte paper at 600 DPI to minimize specular highlights. Mount on a flat board for the planar runs and on a foam mannequin (heel, sacrum) for the curved-surface runs.

## Device matrix

**iOS** (LiDAR-equipped):
- iPhone 12 Pro
- iPhone 14 Pro
- iPhone 16 Pro (latest)
- iPad Pro M2 (most recent LiDAR iPad available at test time)

**Android — ToF-equipped**:
- Samsung Galaxy S22 Ultra
- Samsung Galaxy S24 Ultra (latest, if ToF retained)

**Android — Depth API only** (no dedicated depth sensor):
- Google Pixel 8
- Samsung Galaxy A54 (mid-range reference)

## Procedure

For each device × phantom × surface (planar / curved) combination:
1. Hold the device 40 cm from the phantom (typical clinical distance).
2. Capture three measurements; record all three.
3. Repeat at 30 cm and 60 cm to characterize distance sensitivity.
4. Record device model, OS version, AR tracking state, and reported confidence score.

Total runs: ~5 devices × ~10 phantoms × 2 surfaces × 3 distances × 3 replicates = ~900 measurements. Allocate one week.

## Acceptance criteria

| Metric | Target (iOS LiDAR) | Target (Android ToF) | Target (Android Depth API) |
|---|---|---|---|
| Area mean error | ≤ 5% | ≤ 5% | ≤ 10% |
| Area 95th percentile | ≤ 8% | ≤ 8% | ≤ 15% |
| Perimeter | ≤ 5% | ≤ 5% | ≤ 10% |

Devices that don't meet their target band display a "lower-confidence" badge in the app and a corresponding note on PDF exports.

## Report

Save the results to `/docs/regulatory/measurement-validation-results-YYYY-MM-DD.md` (or in a sealed PDF if shared with regulatory counsel). Include device list, raw data, statistical analysis, and the final per-device disposition.
