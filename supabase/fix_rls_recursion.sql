-- ============================================================================
-- Fix Infinite Recursion in Communities RLS Policies
-- ============================================================================

-- 1. Упрощаем политику чтения group_members, чтобы избежать рекурсии
-- (просто разрешаем чтение всем аутентифицированным пользователям)
DROP POLICY IF EXISTS "Allow read group_members" ON public.group_members;
DROP POLICY IF EXISTS "Allow public read group members" ON public.group_members;
CREATE POLICY "Allow read group members" ON public.group_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. Обновляем политику чтения groups
DROP POLICY IF EXISTS "Allow read groups" ON public.groups;
DROP POLICY IF EXISTS "Allow public read groups" ON public.groups;
CREATE POLICY "Allow read groups" ON public.groups
  FOR SELECT USING (
    privacy_type IN ('open', 'closed')
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = id AND user_id = auth.uid()
    )
  );

-- 3. Обновляем политику чтения posts в группах
DROP POLICY IF EXISTS "Allow read posts" ON public.posts;
DROP POLICY IF EXISTS "Allow public read posts" ON public.posts;
CREATE POLICY "Allow read posts" ON public.posts
  FOR SELECT USING (
    group_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = posts.group_id
    )
  );
