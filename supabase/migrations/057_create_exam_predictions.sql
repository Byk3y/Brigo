-- ============================================================================
-- MIGRATION 057: Create Exam Predictions Table
-- ============================================================================
-- Creates table for AI-predicted exam questions and topic analysis
-- Includes comprehensive RLS policies for security
-- ============================================================================

-- ============================================================================
-- STUDIO EXAM PREDICTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS studio_exam_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  title TEXT NOT NULL,
  report_data JSONB, -- Stores topic analysis and predicted questions
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast notebook and user lookups
CREATE INDEX IF NOT EXISTS idx_exam_predictions_notebook 
  ON studio_exam_predictions(notebook_id);
CREATE INDEX IF NOT EXISTS idx_exam_predictions_user 
  ON studio_exam_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_predictions_created 
  ON studio_exam_predictions(created_at DESC);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE studio_exam_predictions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Users can view predictions for notebooks they own
CREATE POLICY "Users can view own predictions" ON studio_exam_predictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notebooks 
      WHERE notebooks.id = studio_exam_predictions.notebook_id 
        AND notebooks.user_id = auth.uid()
    )
  );

-- Users can delete their own predictions
CREATE POLICY "Users can delete own predictions" ON studio_exam_predictions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM notebooks 
      WHERE notebooks.id = studio_exam_predictions.notebook_id 
        AND notebooks.user_id = auth.uid()
    )
  );

-- Service role can manage all predictions (for Edge Functions)
CREATE POLICY "Service can manage predictions" ON studio_exam_predictions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER update_exam_predictions_updated_at BEFORE UPDATE ON studio_exam_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE studio_exam_predictions IS 'AI-predicted exam questions and topic analysis from past papers';
