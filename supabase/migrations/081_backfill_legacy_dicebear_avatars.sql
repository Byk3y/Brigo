-- Rewrite legacy remote DiceBear SVG URLs on profiles.avatar_url to the
-- `dicebear://<style>/<seed>` scheme used by getAvatarSvg. React Native's
-- <Image> can't render SVG, so rows still holding the old URL format
-- rendered as blank circles on friend avatars. The client was also patched
-- to parse these URLs defensively; this migration cleans the stored values.

UPDATE public.profiles
SET avatar_url = 'dicebear://'
  || (regexp_match(avatar_url, '^https?://api\.dicebear\.com/[^/]+/([^/]+)/svg\?(?:.*&)?seed=([^&]+)'))[1]
  || '/'
  || (regexp_match(avatar_url, '^https?://api\.dicebear\.com/[^/]+/([^/]+)/svg\?(?:.*&)?seed=([^&]+)'))[2]
WHERE avatar_url ~ '^https?://api\.dicebear\.com/[^/]+/[^/]+/svg\?(?:.*&)?seed=[^&]+';
