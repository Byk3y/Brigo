-- Convert flashcard sets and quizzes into DB-backed generation jobs.
-- Before this change, generate-studio-content awaited the full LLM response
-- before inserting anything, so there was no persistent trace during
-- generation. The client's "Analyzing..." card died on navigation and the
-- global in-flight indicator couldn't light up for these types.
--
-- After this migration the edge function will INSERT a pending parent row
-- immediately (status='processing'), return the id to the client, and
-- UPDATE the row to 'completed'/'failed' once the background LLM work
-- finishes. Children (studio_flashcards, studio_quiz_questions) remain
-- inserted only on success.

-- studio_flashcard_sets
ALTER TABLE studio_flashcard_sets
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN error_message text;

UPDATE studio_flashcard_sets sfs
SET user_id = n.user_id
FROM notebooks n
WHERE sfs.notebook_id = n.id AND sfs.user_id IS NULL;

ALTER TABLE studio_flashcard_sets ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_studio_flashcard_sets_user_id
  ON studio_flashcard_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_flashcard_sets_user_status
  ON studio_flashcard_sets(user_id, status);

-- studio_quizzes
ALTER TABLE studio_quizzes
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN error_message text,
  ALTER COLUMN total_questions DROP NOT NULL;

UPDATE studio_quizzes sq
SET user_id = n.user_id
FROM notebooks n
WHERE sq.notebook_id = n.id AND sq.user_id IS NULL;

ALTER TABLE studio_quizzes ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_studio_quizzes_user_id
  ON studio_quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_quizzes_user_status
  ON studio_quizzes(user_id, status);

-- Realtime publication so client subscriptions fire on INSERT/UPDATE.
ALTER PUBLICATION supabase_realtime ADD TABLE studio_flashcard_sets;
ALTER PUBLICATION supabase_realtime ADD TABLE studio_quizzes;
