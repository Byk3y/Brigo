# Implementation Plan: Event-Driven Task System

This document outlines the "North Star" architecture for the Brigo Task & Reward system, moving from a monolithic RPC-based model to a decoupled, event-driven architecture.

## 1. Architectural Overview
The core shift is from **Direct Procedure Calls** (where the app asks for points) to **Activity Logging** (where the app reports progress and the backend determines rewards).

### The "Ledger" Pattern
*   **Activity Ledger**: A `user_activity_log` table that records raw, immutable events.
*   **Task Registry**: A `task_config` table for declarative rules (points, thresholds, timing).
*   **Reward History**: `pet_task_completions` tied to specific activity log entries via `ref_activity_id`.

---

## 2. Technical Milestones

### Phase 1: The Foundation (Schema Evolution)
Create the tables required for observability without changing existing logic.
*   **[NEW] `user_activity_log`**: `id`, `user_id`, `activity_type`, `metadata` (JSONB), `idempotency_key`, `created_at`.
*   **[NEW] `task_config`**: Stores game rules (e.g., `quiz_threshold: 0.8`).
*   **[MODIFY] `pet_task_completions`**: Add `ref_activity_id` (UUID, nullable for legacy support).

### Phase 2: The "Silent Ledger" (Observability)
Update the existing `award_task_points` RPC to perform a silent `INSERT` into `user_activity_log` on every call.
*   **Goal**: Build a paper trail of user behavior before switching logic.

### Phase 3: Event Hub & Modular Processors
Migrate logic from the RPC to modular functions triggered by activity logs.
*   **Processor: `reward_study_activity()`**: Handles Quiz, Flashcards, and Podcasts.
*   **Processor: `auto_secure_pet()`**: Automatically awards pet protection on activity.
*   **Processor: `streak_processor()`**: Updates last study date and increments streaks.

---

## 3. Implementation Guardrails

### Snappy UI (The Staging Pattern)
To maintain instant feedback in the app:
1.  Frontend calls `log_activity()` (RPC).
2.  DB inserts into `user_activity_log`.
3.  Logic runs synchronously within the same transaction.
4.  RPC returns the result of the rewards (points, stage) immediately.

### Production Safety
*   **Idempotency**: Every activity report must include a `request_id` or `idempotency_key` to prevent duplicate rewards on network retries.
*   **Dry Run Mode**: During development, processors can run in a "Dry Run" state where they log potential rewards without awarding them, allowing for comparison with the legacy system.
*   **Database Testing**: Implement `pgTAP` unit tests to verify point-award logic independently of the app.

---

## 4. Effort Estimation
*   **Schema Setup**: 1 Morning (Low Risk)
*   **Logic Migration**: 1-2 Days (Medium Risk)
*   **Frontend Refactor**: 1 Afternoon (Low Risk)
*   **Verification**: 1 Afternoon (Low Risk)

> [!IMPORTANT]
> **Rollout Recommendation**: Stabilize the current production build first. Begin Phase 1 (The Foundation) only after verifying the current version is healthy in the App Store.

## 5. Operational Considerations

### Storage Management
*   **Write Volume**: Every meaningful user action creates a log. Estimate ~1GB per 2.5 million events.
*   **Retention Policy**: Logs older than 90 days can be archived or deleted via a Supabase Cron job, as core state (points/streaks) is persisted separately.
*   **Indexing**: Mandatory indexes on `user_id` and `created_at` to maintain performance as the ledger grows.

### Risks & Mitigations
*   **Database Bloat**: Managed by the retention policy above.
*   **Hidden Logic**: Processors will be implemented as discrete PL/pgSQL functions rather than deeply nested triggers to ensure maintainability and observability.
*   **Performance**: Critical paths (Points) remain synchronous; heavy secondary paths (Analytics, non-critical Badges) can be deferred.
*   **Race Conditions**: Use `SELECT ... FOR UPDATE` in processors to ensure atomic calculations for streaks and point totals.
