-- Enable Realtime for studio generation job tables so the global
-- in-flight indicator updates in <1s without polling load. Audio
-- overviews (podcasts) and studio exam predictions both flow through
-- the same user channel (notebook-updates-${userId}, filtered by user_id).
ALTER PUBLICATION supabase_realtime ADD TABLE audio_overviews;
ALTER PUBLICATION supabase_realtime ADD TABLE studio_exam_predictions;
