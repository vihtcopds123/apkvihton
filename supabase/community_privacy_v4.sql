-- ============================================================================
-- Communities V4: hide_members and hide_photos privacy settings
-- ============================================================================

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS hide_members BOOLEAN DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS hide_photos BOOLEAN DEFAULT false;
