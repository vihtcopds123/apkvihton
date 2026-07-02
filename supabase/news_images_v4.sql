-- ============================================================================
-- Add images column to community_news table to support news photo attachments
-- ============================================================================

ALTER TABLE public.community_news ADD COLUMN IF NOT EXISTS images TEXT[];
