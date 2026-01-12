# Predict Questions Feature - Implementation Plan

> **Feature Owner**: AI Agent  
> **Created**: 2026-01-12  
> **Status**: 🟡 In Progress  
> **Last Updated**: 2026-01-12


---

## 📋 Feature Overview

### What is this feature?
A new Studio feature that analyzes past exam papers uploaded as sources and predicts likely questions for upcoming exams. It generates a comprehensive text report with topic analysis and predicted questions with answers.

### Key Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Button Name | "Predict Questions" | Clear and direct |
| Output Format | Full-page text report | Simple v1, download later |
| Question Count | Mirrors past exam structure | If past exam has 10 MCQ + 5 theory, predictions follow same pattern |
| Includes Answers | Yes, inline | Complete study tool |
| Access Level | Pro feature | Uses existing `studio` quota |
| Edge Cases | Friendly prompt if no/insufficient sources | Don't block, let AI work with available content |

---

## 🗺️ Implementation Phases

### Legend
- ⬜ Not started
- 🟡 In progress
- ✅ Completed
- ⏸️ Blocked
- ❌ Skipped

---

## Phase 1: Database Schema
**Status**: ✅ Completed


### Tasks
- [x] **1.1** Create migration file `supabase/migrations/057_create_exam_predictions.sql`
  - [x] Create `studio_exam_predictions` table
  - [x] Add indexes for `notebook_id` and `user_id`
  - [x] Add RLS policies (notebook ownership pattern)
  - [x] Add trigger for `updated_at`


### Database Table Schema
```sql
CREATE TABLE studio_exam_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  title TEXT NOT NULL,
  report_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy (matches existing studio tables pattern)
ALTER TABLE studio_exam_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own predictions" ON studio_exam_predictions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM notebooks WHERE id = notebook_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete own predictions" ON studio_exam_predictions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM notebooks WHERE id = notebook_id AND user_id = auth.uid())
  );

CREATE POLICY "Service role can manage predictions" ON studio_exam_predictions
  FOR ALL USING (auth.role() = 'service_role');
```

### Files to Create/Modify
| File | Action | Status |
|------|--------|--------|
| `supabase/migrations/057_create_exam_predictions.sql` | Create | ✅ |


---

## Phase 2: Edge Function
**Status**: ✅ Completed


### Tasks
- [x] **2.1** Create `supabase/functions/generate-exam-prediction/index.ts`
  - [x] Set up authentication and authorization
  - [x] Implement rate limiting
  - [x] Implement quota checking (reuse `studio` type)
  - [x] Fetch notebook and materials
  - [x] Validate materials have past paper content
  - [x] Build LLM system prompt for prediction analysis
  - [x] Build LLM user prompt with material content
  - [x] Call LLM with retry logic
  - [x] Parse and validate response
  - [x] Insert prediction into database
  - [x] Increment quota
  - [x] Log usage
  - [x] Return success response

- [x] **2.2** Update `supabase/functions/_shared/llm-validation.ts`
  - [x] Add `validatePredictionResponse()` function
  - [x] Validate topics array structure
  - [x] Validate predictions array structure
  - [x] Sanitize all strings


### LLM Prompt Strategy

**System Prompt** should instruct the LLM to:
1. Analyze all past papers to identify patterns
2. Count topic frequency across papers
3. Detect question types and distribution
4. Generate predictions that mirror the exam structure
5. Provide complete answers for each prediction
6. Explain why each question is predicted (reasoning)

**Expected LLM Response Structure**:
```json
{
  "title": "Pharmacology 2026 Exam Predictions",
  "summary": {
    "papers_analyzed": 5,
    "exam_structure": {
      "mcq": 10,
      "short_answer": 5,
      "essay": 2
    }
  },
  "topics": [
    {
      "name": "Pharmacokinetics",
      "frequency": 5,
      "total_papers": 5,
      "likelihood": "high",
      "trend": "stable"
    }
  ],
  "predictions": [
    {
      "question": "Explain the difference between...",
      "answer": "The key differences are...",
      "topic": "Pharmacokinetics",
      "question_type": "short_answer",
      "confidence": "high",
      "reasoning": "This topic appeared in 5/5 past papers"
    }
  ]
}
```

### Files to Create/Modify
| File | Action | Status |
|------|--------|--------|
| `supabase/functions/generate-exam-prediction/index.ts` | Create | ✅ |
| `supabase/functions/_shared/llm-validation.ts` | Modify | ✅ |


---

## Phase 3: API Layer
**Status**: ✅ Completed


### Tasks
- [x] **3.1** Create `lib/api/examPredictionApi.ts`
  - [x] Define request/response interfaces
  - [x] Implement `generateExamPrediction()` function
  - [x] Handle errors with `handleError()`
  - [x] Preserve quota info in errors

- [x] **3.2** Create `lib/services/examPredictionService.ts`
  - [x] Implement `fetchByNotebook()` - Get predictions for a notebook
  - [x] Implement `fetchById()` - Get single prediction
  - [x] Implement `delete()` - Delete a prediction


### Files to Create/Modify
| File | Action | Status |
|------|--------|--------|
| `lib/api/examPredictionApi.ts` | Create | ✅ |
| `lib/services/examPredictionService.ts` | Create | ✅ |


---

## Phase 4: Types & Store
**Status**: ✅ Completed


### Tasks
- [x] **4.1** Update `lib/store/types.ts`
  - [x] Add `ExamPrediction` interface
  - [x] Add `PredictionTopic` interface
  - [x] Add `PredictedQuestion` interface

- [x] **4.2** Update `lib/hooks/useStudioContent.ts`
  - [x] Import examPredictionService
  - [x] Add `examPredictions` state
  - [x] Fetch predictions in `fetchContent()`
  - [x] Return predictions from hook


### TypeScript Interfaces
```typescript
export interface PredictionTopic {
  name: string;
  frequency: number;
  total_papers: number;
  likelihood: 'high' | 'medium' | 'low';
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface PredictedQuestion {
  question: string;
  answer: string;
  topic: string;
  question_type: 'mcq' | 'short_answer' | 'essay';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface ExamPrediction {
  id: string;
  notebook_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  title: string;
  report_data: {
    summary: {
      papers_analyzed: number;
      exam_structure: {
        mcq: number;
        short_answer: number;
        essay: number;
      };
    };
    topics: PredictionTopic[];
    predictions: PredictedQuestion[];
  } | null;
  error_message?: string;
  created_at: string;
  updated_at: string;
}
```

### Files to Create/Modify
| File | Action | Status |
|------|--------|--------|
| `lib/store/types.ts` | Modify | ✅ |
| `lib/hooks/useStudioContent.ts` | Modify | ✅ |


---

## Phase 5: UI Components
**Status**: ✅ Completed


### Tasks
- [x] **5.1** Update `lib/ThemeContext.tsx`
  - [x] Add `cardPrediction` color (purple: `#9333ea`)

- [x] **5.2** Update `lib/constants/loadingMessages.ts`
  - [x] Add `prediction` messages array

- [x] **5.3** Update `components/notebook/studio/GenerateOptionsSection.tsx`
  - [x] Add `onGeneratePrediction` prop
  - [x] Add "Predict Questions" `GenerateOption` button
  - [x] Update `GeneratingType` to include `'prediction'`

- [x] **5.4** Update `components/notebook/studio/GenerateOption.tsx`
  - [x] Add `'prediction'` to type union
  - [x] Add `cardPrediction` case in `getBackgroundColor()`

- [x] **5.5** Update `lib/hooks/useStudioGeneration.ts`
  - [x] Add `handleGeneratePrediction` function
  - [x] Import `generateExamPrediction` API
  - [x] Return handler from hook

- [x] **5.6** Update `components/notebook/studio/GeneratedMediaSection.tsx`
  - [x] Add `examPredictions` prop
  - [x] Add prediction to `MediaItem` type
  - [x] Render prediction items with bulb icon
  - [x] Add prediction generating state

- [x] **5.7** Update `lib/store/slices/notificationSlice.ts`
  - [x] Add `'prediction'` to `NotificationType`


### Files to Create/Modify
| File | Action | Status |
|------|--------|--------|
| `lib/ThemeContext.tsx` | Modify | ✅ |
| `lib/constants/loadingMessages.ts` | Modify | ✅ |
| `components/notebook/studio/GenerateOptionsSection.tsx` | Modify | ✅ |
| `components/notebook/studio/GenerateOption.tsx` | Modify | ✅ |
| `lib/hooks/useStudioGeneration.ts` | Modify | ✅ |
| `components/notebook/studio/GeneratedMediaSection.tsx` | Modify | ✅ |
| `lib/store/slices/notificationSlice.ts` | Modify | ✅ |


---

## Phase 6: Viewer Screen
**Status**: ✅ Completed


### Tasks
- [x] **6.1** Create `components/studio/PredictionViewer.tsx`
  - [x] Create header with title and close button
  - [x] Create summary section (papers analyzed, structure)
  - [x] Create topics section with frequency badges
  - [x] Create predictions list with Q&A format
  - [x] Style with theme colors
  - [x] Make scrollable

- [x] **6.2** Create `app/predictions/[id].tsx`
  - [x] Set up route with `useLocalSearchParams`
  - [x] Fetch prediction by ID
  - [x] Show loading state
  - [x] Show error state
  - [x] Render PredictionViewer

### Files to Create/Modify
| File | Action | Status |
|------|--------|--------|
| `components/studio/PredictionViewer.tsx` | Create | ✅ |
| `app/predictions/[id].tsx` | Create | ✅ |

---

---

## Phase 7: Integration & Polish
**Status**: ✅ Completed

### Tasks
- [x] **7.1** Update `components/notebook/StudioTab.tsx`
  - [x] Integrate `examPredictions` from `useStudioContent`
  - [x] Pass required params to `useStudioGeneration`
  - [X] Wire up props to `GenerateOptionsSection` and `GeneratedMediaSection`
- [x] **7.2** Test end-to-end flow
  - [x] Create notebook with past paper source
  - [x] Generate prediction
  - [x] Verify loading states
  - [x] Verify prediction appears in list
  - [x] Verify viewer opens correctly
- [x] **7.3** Edge case handling
  - [x] LLM returns invalid JSON (handled via `validatePredictionResponse`)
  - [x] Network error during generation (handled via `useStudioGeneration`)

---

## Phase 8: V2 Enhancements (Rich Predictions)
**Status**: ✅ Completed

### Tasks
- [x] **8.1** Prompt Optimization (Back-end)
  - [x] Implement Descriptive Reasoning (no more section numbers)
  - [x] Implement "Marking Scheme" format for essay answers
  - [x] Force LaTeX delimiters `$ ... $` for formulas
  - [x] Add multi-year trend analysis logic
- [x] **8.2** UI & Rendering Upgrades (Front-end)
  - [x] Install `react-native-markdown-display`
  - [x] Integrated Markdown renderer in `PredictionViewer.tsx`
  - [x] Added visual icons for topic trends (Rising, Stable, Cyclical)
  - [x] Improved layout for structured marking schemes

---

## 📊 Progress Tracking

### Overall Progress
| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Database Schema | ✅ | 100% |
| Phase 2: Edge Function | ✅ | 100% |
| Phase 3: API Layer | ✅ | 100% |
| Phase 4: Types & Store | ✅ | 100% |
| Phase 5: UI Components | ✅ | 100% |
| Phase 6: Viewer Screen | ✅ | 100% |
| Phase 7: Integration | ✅ | 100% |
| Phase 8: V2 Enhancements | ✅ | 100% |
| **Total** | ✅ | **100%** |

---

## 🎯 Definition of Done

- [x] User can click "Predict Questions" in Studio
- [x] System generates prediction based on notebook sources
- [x] Prediction appears in Generated Media section
- [x] User can open full prediction report
- [x] Report shows topics, frequencies, and predicted questions with answers
- [x] **V2**: Formulas are rendered correctly (standardized notation)
- [x] **V2**: Essays show a clear "Marking Scheme" structure
- [x] **V2**: Reasoning is human-descriptive (pattern-based)
- [x] Works on both light and dark themes
- [x] Tested manually end-to-end

---

*This document is now finalized. The Predict Questions feature is fully implemented with V2 rich enhancements.*

---

*This document should be updated as implementation progresses. Mark tasks as completed with ✅ and update the progress tables.*
