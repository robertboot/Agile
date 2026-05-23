# Intended Use Statement

> Agile is a documentation tool that assists licensed healthcare providers in recording wound photographs, measurements, and clinical observations at the point of care. It is intended to support clinical workflow and documentation requirements (including CMS pre-determination submissions). **It is not intended to diagnose, treat, cure, or prevent any disease, and is not a substitute for professional medical judgment.**

## What the app does

- Captures wound photographs.
- Measures wound dimensions (length, width, area, perimeter) using ARKit/LiDAR (iOS) or ARCore Depth API (Android), with measurement accuracy and confidence indicators displayed to the user.
- Allows the licensed provider to enter classification (etiology, acuity, stage/grade) and clinical observations (tissue composition, exudate, infection signs).
- Generates a documentation PDF suitable for attachment to insurance pre-determination submissions or inclusion in the medical record.
- Stores a longitudinal record of visits per wound.

## What the app does NOT do

- The app does **not** make diagnostic determinations.
- The app does **not** recommend or select treatment options.
- The app does **not** stage, grade, or classify wounds automatically — the licensed provider always inputs these.
- The app does **not** compute healing prognoses or risk scores.
- The app does **not** trigger alerts based on clinical findings.

## Regulatory posture

This positioning targets:
- **Non-device CDS** under the 21st Century Cures Act, OR
- **Class I Medical Device Data System (MDDS)** which is 510(k)-exempt under 21 CFR 880.6310, OR
- Functionality FDA exercises enforcement discretion over per the "Policy for Device Software Functions and Mobile Medical Applications" guidance.

WoundGenius and similar wound-documentation apps operate with comparable positioning.

## Required before App Store / Play Store submission

- Written regulatory counsel opinion confirming the classification. Budget $5–15k.
- Validation study against printed wound phantoms documenting measurement accuracy on both platforms across the supported device matrix. Protocol in `measurement-validation.md`.
- Intended-use statement displayed in-app on first launch and on every generated PDF.

## Failure modes that would change classification

If the app ever:
- Auto-classifies wounds or computes risk scores → likely Class II SaMD.
- Provides treatment recommendations → likely Class II SaMD.
- Is marketed as a measurement device "for diagnostic purposes" → likely 510(k) required.

Avoid these in v1. If they're desired in v2+, route through regulatory counsel first.
