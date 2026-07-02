-- ============================================================================
-- Add by_group column to posts table to allow publishing on behalf of community
-- ============================================================================

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS by_group BOOLEAN DEFAULT false;
