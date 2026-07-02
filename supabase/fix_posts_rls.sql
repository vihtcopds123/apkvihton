-- ============================================================================
-- Fix Posts RLS Policies to Allow Community Owner/Admin Management
-- ============================================================================

DROP POLICY IF EXISTS "Allow update/delete own posts" ON public.posts;
DROP POLICY IF EXISTS "Allow update/delete own posts or wall owner" ON public.posts;

CREATE POLICY "Allow update/delete own posts or wall owner" ON public.posts
  FOR ALL
  USING (
    auth.uid() = author_id 
    OR auth.uid() = wall_id 
    OR (
      group_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_id
        AND (
          g.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = g.id 
            AND gm.user_id = auth.uid() 
            AND gm.role IN ('admin', 'moderator')
          )
        )
      )
    )
  );
