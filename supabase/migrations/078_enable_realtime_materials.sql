-- Phase B: Enable Realtime for materials table so the client receives
-- UPDATE events when individual materials transition to 'processed' or
-- 'failed'. Previously only notebooks had Realtime — multi-material
-- notebooks couldn't reflect per-material failures without a manual refresh.
ALTER PUBLICATION supabase_realtime ADD TABLE materials;
