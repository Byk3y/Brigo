✅ PRODUCT REQUIREMENTS DOCUMENT (PRD) — Pet Growth System (Stage 1 MVP)

Brigo — Pet Engagement & Daily Task System

⸻

1. Overview

The Pet Growth System is designed to increase user engagement in Brigo by giving users a virtual study companion (the “Pet”) that levels up as they complete tasks.

This PRD defines the Stage 1 MVP, using static PNGs only, a bottom sheet UI, and a simple points system that rewards exploration and daily use of the app.

This document does not include future Lottie animations, emotional systems, or advanced interactions — only what is required for a functional MVP.

⸻

2. Goals

Primary Goals
	•	Motivate users to return daily
	•	Teach users how to use Brigo (foundational tasks)
	•	Reward consistent studying behavior (daily tasks)
	•	Provide clear progression via pet evolution (Stage 1 → Stage 2 → Stage 3…)

Secondary Goals
	•	Prepare the system for future emotional states & animations
	•	Support scalable task definitions for future gamified features

⸻

3. Pet Structure (MVP)

3.1 Pet Visuals
	•	Static PNG only
	•	One PNG per stage (Stage 1 = single PNG)
	•	No animations, expressions, or reactions
	•	Displayed in two locations:
	•	Home Screen (above the task list)
	•	Bottom Sheet (“Grow Your Pet” view)

3.2 Pet Interaction
	•	Tapping the pet opens the Grow Your Pet Bottom Sheet
	•	No other interactive behaviors or responses required

3.3 Pet Progression
	•	Stage 1: 0–100 points
	•	Stage 2: 100–200 points
	•	Stage 3: 200–300 points
	•	Stage appearance updates when entering a new stage
	•	No animation during transitions
	•	Pet always displays using the PNG for current stage

⸻

4. Task System

Two categories of tasks:

⸻

4.1 Foundational Tasks (One-Time Tasks)

Purpose: Teach user how Brigo works
These appear only during Stage 1 until completed.

List of Foundational Tasks

Task	Description	Points
Name your pet	User edits pet name	+1
Add your first study material	Add PDF, image, text, or link	+1
Generate your first podcast	Use Studio → Podcast	+2

Completion Behavior:
	•	Once a foundational task is completed, it disappears permanently.
	•	If the user completes all foundational tasks before reaching 100 points, only daily tasks remain visible.

⸻

4.2 Daily Tasks (Recurring Tasks)

Purpose: Encourage daily usage and studying.

Every day, the user receives three tasks:

Daily Task Structure
	•	1–2 points for small tasks
	•	4 points for a “hero task”

Daily Task Pool (MVP)

Task	Description	Points
Study 5 flashcards	User completes 5 flashcards from any set	+1
Study for 15 minutes	Timer tracks continuous study	+2
Listen to a podcast	User plays generated audio	+1
Maintain daily streak	Awarded automatically when streak increments	+4

Rules
	•	Daily tasks reset every 24 hours at local midnight
	•	Tasks show in bottom sheet under Grow Your Pet
	•	Completed tasks show with a ✓ checkmark and grayed-out icon
	•	Points award instantly upon completion

⸻

5. Point System

5.1 Earning Points

Points are earned via:
	•	Foundational tasks
	•	Daily tasks

5.2 Total Required per Stage
	•	Stage 1: 0–100 points
	•	Stage 2: 100–200 points
	•	Stage 3: 200–300 points

5.3 Using Points
	•	Points fill the pet’s growth bar
	•	Once threshold is passed, pet automatically upgrades shape/PNG

⸻

6. Bottom Sheet UI (Grow Your Pet)

Matches your reference screenshot exactly.

UI Sections
	1.	Pet PNG (centered, large)
	2.	Pet name + edit button
	3.	Growth bar
	4.	Points until next evolution
	5.	Foundational Tasks (if incomplete)
	6.	Daily Tasks (3 items)

Task Item Design
	•	Checkbox-style icon
	•	Task title
	•	Points displayed in small text (e.g., +2 points)
	•	If completed:
	•	Icon shows yellow ✓
	•	Text grayed out

⸻

7. Pet State Tracking (MVP Database Logic)

7.1 Required Tables

Table: pet_states
Stores stage, name, and points.

Column	Type	Purpose
user_id	UUID	Primary key, one pet per user
name	text	Editable by user
current_stage	int	Stage 1, 2, 3…
current_points	int	0–100, then 100–200, etc
mood	text	Pet mood: 'happy', 'neutral', or 'sad'
created_at	timestamp	—
updated_at	timestamp	—

Table: pet_tasks
Defines all tasks (foundational + daily).

Table: pet_task_completions
Tracks user progress per day.

⸻

8. Task Completion Logic (MVP)

8.1 How the app knows when a task is done

Each task links to a trigger event in the app:

Task	Trigger
Name your pet	update_pet_name() mutation
Add study material	Material row created
Generate podcast	Podcast completed
Study flashcards	Flashcard completion count increments
Study for 15 minutes	Study timer reaches 15m
Listen to podcast	Podcast playback event fired
Maintain streak	Streak table increments

When a trigger occurs →
We check if the task is eligible →
If yes → Mark as completed + award points.

8.2 Daily Refresh

Every midnight local time:
	•	Daily tasks reset
	•	Foundational tasks stay completed
	•	Points remain

⸻

9. Analytics (Optional, not MVP)

A future table pet_engagement_logs can store usage signals.

⸻

10. Out of Scope (Future Versions)

Not included in Stage 1 MVP:
	•	Lottie animations
	•	Emotional states (happy/sad)
	•	Chat reactions from the pet
	•	User-customizable skins
	•	Pet inventory
	•	Multi-task stages
	•	Streak boosters or badges

The system is designed so these features can be added later without rewriting the foundation.

⸻

✅ PRD Updated Successfully

If you’d like, next steps are:

“Generate File 2” → Task Definitions Specification

“Generate File 3” → Engineering Implementation & Best Practices Guide

Just tell me which one to generate next.