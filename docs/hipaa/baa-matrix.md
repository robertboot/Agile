# HIPAA Business Associate Agreement (BAA) Matrix

Source of truth for which third parties touch PHI and whether a BAA is in place. Update whenever a new vendor is added.

| Party | Role | BAA needed | Status | Notes |
|---|---|---|---|---|
| Supabase | Backend (Postgres, Auth, Storage, Edge Functions) | Yes | **TODO — sign on Team plan** | BAA is only available on the Team tier. Pro is not sufficient. Confirm region is US. |
| Apple — APNs | Push notifications | Apple does **not** sign BAAs | n/a | No PHI in push payloads. Use generic copy like "New visit recorded for patient." |
| Apple — iCloud Backup | iOS device backup | Apple does **not** sign BAAs | n/a | App container excluded from iCloud Backup via `NSFileProtectionComplete` + skip-backup attribute. |
| Apple — Sign in with Apple | Auth | n/a | Compliant | Only stores `sub` + relay email; not PHI in isolation. |
| Apple — App Store / TestFlight | Distribution | n/a | n/a | No PHI in screenshots, listing copy, or TestFlight build notes. |
| Google — FCM | Push notifications (Android) | Google does **not** sign consumer BAAs | n/a | No PHI in FCM payloads. |
| Google — Play Store / Internal Testing | Distribution | n/a | n/a | No PHI in screenshots, listing copy, or internal-testing release notes. |
| Google — Sign in with Google | Auth | n/a | Compliant | Only stores `sub` + email. |
| Google — Auto-backup | Android device backup | Google does **not** sign consumer BAAs | n/a | `android:allowBackup="false"` + `dataExtractionRules` excludes app data. |
| Transactional email | Magic links, exports | Yes | **TODO — choose Postmark vs AWS SES** | Both BAA-eligible. Pick before launch. |
| Sentry (crash reporter) | Telemetry | Yes if used | Deferred to v1.1 pending BAA | Not in Phase 1. Will use only with BAA + PHI redaction layer. |
| EAS (Expo build infra) | Builds binaries | No (no PHI in builds) | n/a | Builds receive code + assets, no patient data. |

## Procedure for adding a vendor

1. Determine if the vendor will receive or transmit PHI (broadly defined — see `intended-use.md`).
2. If yes: do not enable in production until BAA is signed and stored in `/docs/hipaa/baa-signed/` (gitignored — actual contracts).
3. Update this matrix with the row.
4. Update `/docs/runbooks/breach-response.md` if the new vendor changes the notification chain.

## Named officers (required under §164.308)

- **HIPAA Security Officer**: **TODO — designate**
- **HIPAA Privacy Officer**: **TODO — designate**

## Annual review

This matrix is reviewed every 12 months or when a vendor is added/removed. Last review: pending initial sign-off.
