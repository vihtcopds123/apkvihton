-- ============================================================================
-- Communities V3: Detailed Settings, Closed/Private Groups, Discussions, Photo Albums
-- ============================================================================

-- 1. Добавляем настройки приватности и стены в таблицу groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS privacy_type TEXT CHECK (privacy_type IN ('open', 'closed', 'private')) DEFAULT 'open';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS wall_type TEXT CHECK (wall_type IN ('open', 'restricted', 'closed')) DEFAULT 'open';

-- 2. Обновляем ограничения на роли в group_members, добавляя роль 'moderator'
ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_role_check;
ALTER TABLE public.group_members ADD CONSTRAINT group_members_role_check CHECK (role IN ('member', 'moderator', 'admin', 'owner'));

-- 3. Создаем таблицу для заявок в закрытые группы
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read group_join_requests" ON public.group_join_requests;
CREATE POLICY "Allow read group_join_requests" ON public.group_join_requests
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_join_requests.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Allow insert group_join_requests" ON public.group_join_requests;
CREATE POLICY "Allow insert group_join_requests" ON public.group_join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete group_join_requests" ON public.group_join_requests;
CREATE POLICY "Allow delete group_join_requests" ON public.group_join_requests
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_join_requests.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin', 'owner')
    )
  );

-- 4. Создаем таблицы для Обсуждений (Discussions)
CREATE TABLE IF NOT EXISTS public.group_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read group_discussions" ON public.group_discussions;
CREATE POLICY "Allow read group_discussions" ON public.group_discussions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_discussions.group_id
        AND (g.privacy_type IN ('open', 'closed') OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Allow insert group_discussions" ON public.group_discussions;
CREATE POLICY "Allow insert group_discussions" ON public.group_discussions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id
        AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow update/delete own group_discussions" ON public.group_discussions;
CREATE POLICY "Allow update/delete own group_discussions" ON public.group_discussions
  FOR ALL USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_discussions.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('moderator', 'admin', 'owner')
    )
  );

-- Таблица ответов в обсуждениях
CREATE TABLE IF NOT EXISTS public.group_discussion_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID REFERENCES public.group_discussions(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_discussion_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read group_discussion_comments" ON public.group_discussion_comments;
CREATE POLICY "Allow read group_discussion_comments" ON public.group_discussion_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_discussions gd
      JOIN public.groups g ON gd.group_id = g.id
      WHERE gd.id = group_discussion_comments.discussion_id
        AND (g.privacy_type IN ('open', 'closed') OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Allow insert group_discussion_comments" ON public.group_discussion_comments;
CREATE POLICY "Allow insert group_discussion_comments" ON public.group_discussion_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_discussions gd
      JOIN public.group_members gm ON gd.group_id = gm.group_id
      WHERE gd.id = discussion_id AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow update/delete own group_discussion_comments" ON public.group_discussion_comments;
CREATE POLICY "Allow update/delete own group_discussion_comments" ON public.group_discussion_comments
  FOR ALL USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.group_discussions gd
      JOIN public.group_members gm ON gd.group_id = gm.group_id
      WHERE gd.id = group_discussion_comments.discussion_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('moderator', 'admin', 'owner')
    )
  );

-- 5. Создаем фотоальбомы и расширяем таблицу public.photos
CREATE TABLE IF NOT EXISTS public.group_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read group_albums" ON public.group_albums;
CREATE POLICY "Allow read group_albums" ON public.group_albums
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_albums.group_id
        AND (g.privacy_type IN ('open', 'closed') OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Allow insert group_albums" ON public.group_albums;
CREATE POLICY "Allow insert group_albums" ON public.group_albums
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('moderator', 'admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Allow delete/update group_albums" ON public.group_albums;
CREATE POLICY "Allow delete/update group_albums" ON public.group_albums
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_albums.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin', 'owner')
    )
  );

-- Добавляем ссылки в таблицу photos
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES public.group_albums(id) ON DELETE SET NULL;

-- Обновляем RLS политики для public.photos, чтобы учитывать приватность групп
DROP POLICY IF EXISTS "Allow public read photos" ON public.photos;
CREATE POLICY "Allow read photos" ON public.photos
  FOR SELECT USING (
    group_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = photos.group_id
        AND (g.privacy_type IN ('open', 'closed') OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Allow auth upload photos" ON public.photos;
CREATE POLICY "Allow insert photos" ON public.photos
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = group_id
          AND gm.user_id = auth.uid()
      )
    )
  );

-- 6. Обновляем основные политики для groups, group_members и posts
DROP POLICY IF EXISTS "Allow public read groups" ON public.groups;
CREATE POLICY "Allow read groups" ON public.groups
  FOR SELECT USING (
    is_public = true 
    OR privacy_type IN ('open', 'closed') 
    OR EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
    )
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "Allow public read group members" ON public.group_members;
CREATE POLICY "Allow read group members" ON public.group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_members.group_id 
        AND (g.privacy_type IN ('open', 'closed') OR EXISTS (
          SELECT 1 FROM public.group_members gm2 
          WHERE gm2.group_id = g.id AND gm2.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Allow public read posts" ON public.posts;
CREATE POLICY "Allow read posts" ON public.posts
  FOR SELECT USING (
    group_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = posts.group_id 
        AND (g.privacy_type = 'open' OR EXISTS (
          SELECT 1 FROM public.group_members gm 
          WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
        ))
    )
  );
