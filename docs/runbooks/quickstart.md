# Quickstart — testing the dev build

Three independent test paths. Pick whichever you can run today.

---

## Path A — Test the Supabase schema locally (no Mac required)

Verifies migrations, RLS policies, and the data model. Runs entirely on your laptop.

**Install once:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — required by the Supabase local stack.
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started): `brew install supabase/tap/supabase` (Mac) / `scoop install supabase` (Windows) / native binary on Linux.

**Run:**
```bash
git clone https://github.com/robertboot/Agile.git
cd Agile
supabase start             # launches Postgres + Studio in Docker
supabase db reset          # applies every migration + RLS policy
```

You'll get URLs in the terminal output:
- Studio: <http://127.0.0.1:54323> — click through every table, run SQL queries, watch RLS in action.
- API: <http://127.0.0.1:54321> — for direct API testing.
- Inbucket: <http://127.0.0.1:54324> — magic links sent by Supabase Auth land here.

**Verify RLS:**
1. In Studio → SQL editor, create a test user: `SELECT auth.uid();` returns null when logged out.
2. Try inserting a row into `patients` while logged out → fails (RLS blocks).
3. Promote the user to `role = 'provider'` in `profiles` → insert succeeds.

When done: `supabase stop`.

---

## Path B — Run the migration scripts against your CSVs

Verifies the spreadsheet-to-database mapping. Requires Path A running.

**Setup:**
1. Place the historic CSVs in `data/` (gitignored — never enters git):
   ```
   data/Reps List.csv
   data/Registered Providers.csv
   data/All Orders.csv
   ```
2. Copy `.env.example` to `.env` and fill in the local Supabase keys (visible in `supabase status` output).
3. `pnpm install` at the repo root.

**Run dry-runs:**
```bash
pnpm migrate:reps             # writes nothing — produces a reconciliation report
pnpm migrate:providers        # writes nothing
pnpm migrate:assignments      # writes nothing
```

The scripts skip obvious test rows (names with "Test", `5555555555` phones, etc.) and report row-by-row outcomes. Fix any "failed" rows manually in your CSV copy before committing.

**Commit for real:**
```bash
pnpm migrate:reps -- --commit
pnpm migrate:providers -- --commit
pnpm migrate:assignments -- --commit
```

Verify in Studio: tables `profiles` (filter by role) and `rep_provider_assignments` should be populated.

---

## Path C — Run the iOS AR module on a LiDAR phone

Verifies the actual measurement pipeline. **This is the highest-value test** because it's the only one that proves the technical core works.

**Requirements:**
- macOS with **Xcode 16+** (free from the App Store).
- An iPhone with LiDAR: **iPhone 12 Pro / 13 Pro / 14 Pro / 15 Pro / 16 Pro / 16 Pro Max**, or an **iPad Pro 2020+**. Non-Pro iPhones will boot the app but the "Measure" button is disabled.
- A free Apple ID for personal-device provisioning (no $99 Developer Program required for sideloading).
- [`pnpm`](https://pnpm.io/installation) ≥ 9 and [Node](https://nodejs.org) ≥ 20.

**Setup:**
```bash
git clone https://github.com/robertboot/Agile.git
cd Agile
pnpm install

cd apps/mobile
npx expo prebuild --platform ios   # generates ios/Agile.xcworkspace from app.config.ts
```

**Build on device:**
```bash
open ios/Agile.xcworkspace
```

In Xcode:
1. Select your iPhone as the run destination.
2. In the project settings → Signing & Capabilities → choose your Apple ID team. Xcode will auto-generate a provisioning profile.
3. On the iPhone, after install: Settings → General → VPN & Device Management → Trust the developer.
4. Hit ⌘R.

**On the device:**
1. Home screen shows depth-support status. On a LiDAR iPhone you'll see "LiDAR: yes" and an enabled "Measure wound" button.
2. Tap **Measure wound** → ARKit screen opens.
3. Aim at a printed wound phantom or any flat surface ≈30 cm away.
4. Tap once to set the wound plane (you'll see confidence climb).
5. Drag a finger around the perimeter to trace.
6. Tap **Save** → results screen shows area / length / width / perimeter / confidence.

**What to expect:**
- Area within ±5% of ground truth for printed phantoms at 30–60 cm.
- Confidence ≥ 80% (green) under good lighting + steady hands.
- Perimeter slightly higher than length+width math would predict — that's intentional; we sum 3D distances to preserve curvature.

**Run the polygon-math unit tests** (any Mac, no device):
```bash
# In Xcode: ⌘U on the WoundMeasurementModule test scheme.
# Or from the command line:
xcodebuild test -workspace apps/mobile/ios/Agile.xcworkspace \
  -scheme WoundMeasurementModule \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
```

The shared JSON fixtures at `packages/shared/src/test-fixtures/polygon-math.json` will all pass. The same fixtures will drive the Kotlin tests once Android lands.

---

## Common gotchas

- **Expo Go won't work.** This app uses a custom native module (the ARKit code). You must use Expo's **dev client** built via `expo prebuild` + Xcode, not Expo Go.
- **First prebuild is slow** (~5 min) because CocoaPods has to fetch ExpoModulesCore + dependencies.
- **Camera permission** is asked on first launch. Deny → measurement disabled; reset under Settings → Agile → Camera.
- **No backend yet?** The app boots fine without `EXPO_PUBLIC_SUPABASE_URL` set — measurement still works, just nothing persists. The home screen's "Backend configured: no" badge is your signal.
- **Bundle ID conflicts**: if `com.agile.woundcare.dev` is already in your Apple Developer account, change it in `apps/mobile/app.config.ts` before prebuild.

## When you hit something weird

Drop the error into a new commit in this branch and ping me. The most common breakage is Expo + native-module version mismatches; the fix is usually `npx expo install --fix`.
