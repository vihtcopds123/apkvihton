-- ============================================================================
-- Fix community_news RLS policies to allow deletion and management
-- ============================================================================

-- Drop old news policies
DROP POLICY IF EXISTS "community_news_read_members" ON public.community_news;
DROP POLICY IF EXISTS "community_news_write_owner" ON public.community_news;
DROP POLICY IF EXISTS "Allow read news" ON public.community_news;
DROP POLICY IF EXISTS "Allow manage news" ON public.community_news;

-- 1. Policy to read news (Allow all authenticated users)
CREATE POLICY "Allow read news" ON public.community_news
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. Policy to manage news (insert, update, delete) for group owner & admins
CREATE POLICY "Allow manage news" ON public.community_news
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = community_news.community_id
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
  );
