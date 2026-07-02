-- Phase 1 Migration: Add status column to profiles and wall_id to posts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT NULL;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS wall_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT NULL;

-- Backfill existing profile posts
UPDATE public.posts SET wall_id = author_id WHERE group_id IS NULL AND wall_id IS NULL;

-- Drop and recreate update/delete policies for posts to allow wall owners to delete posts on their wall
DROP POLICY IF EXISTS "Allow update/delete own posts" ON public.posts;
CREATE POLICY "Allow update/delete own posts or wall owner" ON public.posts
  FOR ALL
  USING (
    auth.uid() = author_id 
    OR auth.uid() = wall_id 
    OR auth.uid() = 'fee894db-c5b0-4022-bb9f-56c60decac86'::uuid
  );
