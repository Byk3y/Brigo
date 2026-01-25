## Status Update: Phase 1 Completed ✅

The primary notification blocker (broken database trigger) has already been fixed and verified.

### [Component Name] Database (Supabase)
- **Status: COMPLETED**
- **Action:** Updated `invoke_push_reminders()` to use `net.http_post`.
- **Verified:** Manual invocation confirmed 200 OK and successfully dispatched 5 notifications in debug mode.

### [Component Name] App Configuration
- **Status: COMPLETED**
- **Action:** Added `remote-notification` to `UIBackgroundModes` in `app.json`.

---

## Phase 2 & 3: Proposed Optimization Plan

### Phase 2: Smart Tasks & Targeted Notifications

#### [MODIFY] Database Migration: Task Refactor
Remove "Rate an audio overview" from the daily recurring pool and move it to foundational (one-time) tasks.

```sql
-- Move task to foundational
UPDATE public.pet_tasks 
SET task_type = 'foundational', display_order = 50, title = 'Rate your first podcast', description = 'Give a thumbs up or down to any podcast to help us improve.'
WHERE task_key = 'audio_feedback_given';

-- Rename remaining tasks to use 'podcast'
UPDATE public.pet_tasks SET title = 'Generate your first podcast' WHERE task_key = 'generate_audio_overview';
UPDATE public.pet_tasks SET title = 'Listen to a podcast' WHERE task_key = 'listen_audio_overview';

-- Refine Quiz Task: Perfection is overkill
UPDATE public.pet_tasks 
SET title = 'Ace a quiz (80%+)', 
    description = 'Score 80% or higher on any quiz.' 
WHERE task_key = 'quiz_perfect_score';

-- CRITICAL: Update Pet Protection (secure_pet) trigger
-- The auto-save logic in award_task_points checks for specific keys.
-- We must ensure it still recognizes study activity correctly.
-- [Fix to be included in migration: update secure_pet validation to 80% threshold]

-- Update get_daily_tasks selection logic
-- 1. Exclude 'audio_feedback_given' from the random rotation pool.
-- 2. Ensure task pool checks use 'v_has_podcast' naming for clarity internally.
```

#### [MODIFY] Edge Function: `push-reminders`
Modify the notification logic to:
1.  Call `get_daily_tasks` for each user.
2.  Identify "High-Value" uncompleted study tasks (Flashcards, Quizzes, Podcasts).
3.  Inject a specific study-focused message if a task is found.
4.  **Empty State Logic**: Add a check for notebook count. If a user has 0 notebooks, send "Onboarding/Creation" nudges (e.g., *"Nova is lonely! Add your first material to get started."*) instead of study reminders.

### Phase 4: Persona & Personalization

#### [MODIFY] Edge Function: Persona & Personalization
1.  **Name Fallback Logic**: 
    - Attempt to use `profiles.first_name`.
    - If `first_name` is null/empty (common with Apple "Hide My Email" signups), use a randomized pool of friendly general terms: *"superstar"*, *"friend"*, or simply *"there"*.
2.  **Streak-Saver Priority**: Promote `loss_aversion` to Priority #1 in `selectCategory`.
3.  **Task-Specific Messaging**: Add specific templates for "Study 15 Minutes" progress.

### Phase 3: Global Renaming (Audio Overview -> Podcast)

#### [x] UI Components & Strings
- **Status: COMPLETED**
- **Action:** Replaced "Audio Overview" with "Podcast" in `StudioTab`, `GeneratedMediaSection`, `GenerateOptionsSection`.

#### [MODIFY] Database Schema (Labels only)
Update `pet_tasks`, `notifications`, and any other tables that store "Audio Overview" as a display string. Note: Column/Table names like `audio_overviews` will remain for database stability unless a full migration is requested.

#### [MODIFY] Documentation
Finalize terminology in `task_definitions_spec.md` and `pet_growth_prd.md`.

## Verification Plan

### Automated Tests
-   Verify `get_daily_tasks` return payload for user with 0 notebooks (should contain onboarding tasks).
-   Verify `get_daily_tasks` for user with 1+ notebooks (should contain relevant study tasks).
-   Verify `push-reminders` correctly maps task keys to appropriate message templates.
-   Check `AwardTaskPoints` RPC handles the new 80% quiz score threshold accurately.

### Manual Verification
1.  **Phase 2 (Smart Tasks):** Login as a new user, confirm pet task list shows "Foundational" onboarding tasks. Add material/audio, confirm "Rate" task appears as foundational.
2.  **Phase 3 (Renaming):** Search the app for "Audio Overview", confirm all instances are now "Podcast".
3.  **Phase 4 (Persona):** Trigger a debug notification for an account with no first name; confirm it uses a fallback like "superstar".
4.  **Quiz Logic:** Take a quiz and score 85%; confirm "Ace a quiz" task completes. Take a quiz and score 60%; confirm it does NOT complete.
