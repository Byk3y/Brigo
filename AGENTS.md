# AGENTS.md - Project Context for Codex

## Project Overview

Brigo is a study companion app built with Expo/React Native. It uses Supabase for backend (database, auth, edge functions, realtime), Zustand for state management, and a pet gamification system to drive daily study habits.

## Tech Stack

- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **State**: Zustand with 13+ slices and persist middleware
- **Backend**: Supabase (Postgres, RLS, RPCs, Edge Functions, Realtime)
- **Auth**: Supabase Auth (email magic links, Google, Apple Sign-In)
- **Notifications**: Expo Notifications + Supabase Edge Function (push-reminders)
- **Fonts**: Nunito (Bold, SemiBold, Medium, Regular), Outfit (Bold, SemiBold, Medium, Regular, Light), SpaceGrotesk
- **Analytics**: Custom analytics service

## Supabase MCP Access

Codex has access to the Supabase MCP server configured in `.mcp.json`. Use it to:
- **Query the live database** via `mcp__supabase__execute_sql` (project ID: `tunjjtfnvtscgmuxjkng`)
- **Apply migrations** via `mcp__supabase__apply_migration`
- **List tables, migrations, extensions** via respective MCP tools
- **Deploy edge functions** via `mcp__supabase__deploy_edge_function`

Always use `execute_sql` for read queries and investigation. Use `apply_migration` for DDL changes (CREATE TABLE, CREATE FUNCTION, ALTER TABLE, etc.).

### Verify DB assumptions during planning, not implementation

When planning work that touches the database, run these MCP checks **before finalizing the plan** — not after writing code. Assumptions about schema shape, Realtime, or indexes that turn out to be wrong force mid-implementation rework and risk shipping queries that silently return nothing.

- **Column existence.** For every column referenced in a new `.select()`, `.eq()`, `.gt()`, `.order()`, etc., confirm it exists:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='<table>' AND column_name='<col>';
  ```
  Don't assume `updated_at` exists because a sibling table has it. Don't assume a column's nullability or type — check.
- **Realtime publication membership.** Before adding any `.on('postgres_changes', { table: 'X' })` subscription, confirm `X` is in the publication:
  ```sql
  SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';
  ```
  If it's missing, include `ALTER PUBLICATION supabase_realtime ADD TABLE <x>;` as a planned migration — don't discover it after writing the subscription.
- **Indexes.** For any new query path that filters or joins on columns, confirm an index exists with `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='<table>';`. If missing and the query is hot, plan the index migration.
- **RLS.** If inserting/updating from the client, verify the RLS policy allows the write with the expected auth role. Don't assume service_role paths work from the client.

These checks take under a minute in the plan phase and prevent the class of failures where a query compiles, runs, and returns empty — silently breaking a feature.

## Key Architecture

### Database
- **profiles**: User data, streak, freezes, push tokens, timezone, meta (JSONB)
- **pet_states**: Pet stage/points/name/mood per user (100 points per stage, 3 stages)
- **pet_tasks / pet_task_completions**: Daily + foundational tasks with points
- **user_activity_log**: Event-driven activity logging with idempotency
- **task_config**: Task validation rules and thresholds
- RLS enforced on all tables. RPCs use SECURITY DEFINER with `SET search_path = public`.

### Streak System
- `increment_streak(user_id, timezone)` — called via processor chain when user studies
- `check_streak_reset(user_id, timezone)` — called on app open to detect missed days
- `apply_streak_freeze(user_id, timezone)` — manual freeze from UI
- `last_streak_date` on profiles is the source of truth for "did user study today"
- 3 freezes per month, auto-refill tracked via `last_freeze_reset` (YYYYMM)

### Activity Chain
```
User action → taskService.logActivity() → log_activity RPC
  → process_activity_rewards()
    → processor_study_rewards() (points)
    → processor_pet_security() (streak + secure_pet)
      → PERFORM increment_streak()
```

### State Management (Zustand Slices)
- `userSlice` — profile, streak, freezes
- `petSlice` — pet state, points, stage
- `taskSlice` — daily/foundational tasks, progress, timezone
- `notebookSlice` — notebooks, materials, sync

## Conventions

- Migrations in `supabase/migrations/` numbered sequentially (e.g., `071_fix_streak_auto_freeze.sql`)
- Services in `lib/services/` — one per domain (userService, taskService, petService, etc.)
- Hooks in `hooks/` — custom React hooks
- Components in `components/` — organized by feature (pet-sheet/, home/, etc.)
- RPC functions: `p_` prefix for parameters, `v_` prefix for local variables
- All RPCs return JSONB with `success` boolean

## Build Setup (bare workflow)

Expo config lives in `app.json`. All builds use a single bundle ID `com.brigo.ai` (App Store / Play Store / TestFlight all share it). EAS profiles (`development`, `preview`, `production`) only differ in env vars and distribution channel, not in bundle ID.

**Why `app.json` and not `app.config.js`:** `eas.json` uses `appVersionSource: "local"` with `autoIncrement: "buildNumber"` / `"versionCode"`. EAS's auto-increment writes back to the version file on every build, which only works against static JSON — switching to `app.config.js` causes `autoIncrement option is not supported when using app.config.js` and the build is rejected before it queues. If you ever need dynamic config, switch `eas.json` to `appVersionSource: "remote"` first (versions move to EAS-server-side state) and then `app.config.js` becomes safe.

**This is a bare workflow project.** The `android/` and `ios/` directories ARE the source of truth for native config — `.easignore` keeps them in EAS uploads, `.gitignore` keeps them out of git. The widget extension lives in `ios/BrigoWidget/` (Swift files, local-only, not in git).

A consequence: **changing `ios.bundleIdentifier` or `android.package` in `app.json` does nothing.** EAS prints this warning on build:
```
Specified value for "android.package" in app.json is ignored because an
android directory was detected in the project. EAS Build will use the value
found in the native code.
```
To change a bundle ID for real, edit `android/app/build.gradle` (`applicationId`) and `ios/Brigo.xcodeproj/project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`). The widget target's bundle ID lives in the same Xcode project.

### Side-by-side variants are not configured

A previous attempt to add `Brigo Dev` / `Brigo Preview` variants (different bundle IDs, dark icon) was reverted because the bare-workflow native folders override the Expo config. To revisit: do native-code surgery — Gradle product flavors with `applicationIdSuffix` for Android, additional Xcode build configurations with bundle ID overlays for iOS. Until that's done, dev installs share `com.brigo.ai` and overwrite TestFlight / Play Store installs.

### Adaptive icon

`assets/adaptive-icon.png` is the foreground at ~66% scale on a transparent canvas (so launchers can apply circle/squircle masks cleanly). The original edge-to-edge file is preserved at `assets/adaptive-icon.original.png`. `assets/icon-dark.png` exists but is unused — leftover from the abandoned variant attempt.

### OTA updates (`expo-updates`)

OTA is wired via `expo-updates` against EAS Update channels (`development` / `preview` / `production`) mapped per-profile in `eas.json`. To push a JS-only update to the binary in users' hands: `eas update --branch production --message "..."`.

**Bare workflow does NOT support `runtimeVersion` policies** (e.g. `{ "policy": "appVersion" }`) — EAS Build rejects with `runtime version policies are not supported. You must set your runtime version manually.` The runtime version must be a literal string.

**Maintenance contract for version bumps:** the runtime version is duplicated in FOUR places that must stay in sync:
1. `app.json` `expo.version` (source of truth, bumped manually or by EAS auto-increment of `buildNumber`/`versionCode` only — `version` itself is manual)
2. `app.json` `expo.runtimeVersion` (literal string, e.g. `"1.2.6"`)
3. `ios/Brigo/Supporting/Expo.plist` → `EXUpdatesRuntimeVersion`
4. `android/app/src/main/AndroidManifest.xml` → `expo.modules.updates.EXPO_RUNTIME_VERSION` meta-data tag

When bumping the version (e.g. 1.2.5 → 1.2.6), update all four values together before the next production build. Mismatched runtime versions cause OTA updates to be silently rejected on already-installed builds.

### Day-to-day workflow

- **Dev iteration:** `eas build --profile development --platform android` (or `ios`, or `all`) — installs `Brigo` (overwriting any production install on that device). Then `npx expo start --dev-client` → JS reloads instantly with real native runtime + new architecture. Rebuild only needed when native modules / config plugins / SDK change.
- **Production builds:** `eas build --profile production --platform <ios|android>` → goes to TestFlight / Play Store as today.

To kick off both platforms in parallel:
```bash
EAS_SKIP_VERSION_CHECK=1 eas build --profile development --platform all --non-interactive --no-wait
```
