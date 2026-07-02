-- ============================================================================
-- Communities V2: News, Subscriptions, Posts-in-Feed
-- Применить в Supabase SQL Editor: psql -f community_v2.sql
-- ============================================================================

-- Таблица новостей сообществ (прикреплённые объявления от админов/владельца)
CREATE TABLE IF NOT EXISTS public.community_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_news_community ON public.community_news(community_id, created_at DESC);

-- Включаем RLS
ALTER TABLE public.community_news ENABLE ROW LEVEL SECURITY;

-- Чтение новостей: только участники сообщества
DROP POLICY IF EXISTS "community_news_read_members" ON public.community_news;
CREATE POLICY "community_news_read_members" ON public.community_news
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = community_news.community_id
        AND gm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = community_news.community_id
        AND g.owner_id = auth.uid()
    )
  );

-- Создание/изменение/удаление: только владелец сообщества
DROP POLICY IF EXISTS "community_news_write_owner" ON public.community_news;
CREATE POLICY "community_news_write_owner" ON public.community_news
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = community_news.community_id
        AND g.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = community_news.community_id
        AND g.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Подписки: добавляем уникальный индекс для защиты от дубликатов
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique
  ON public.group_members(group_id, user_id);

-- ============================================================================
-- Поддержка отписки/вступления: триггер для синхронизации members_count
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_group_members_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups
      SET members_count = (SELECT COUNT(*) FROM public.group_members WHERE group_id = NEW.group_id)
      WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups
      SET members_count = (SELECT COUNT(*) FROM public.group_members WHERE group_id = OLD.group_id)
      WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_group_members_count ON public.group_members;
CREATE TRIGGER trg_sync_group_members_count
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_group_members_count();

-- ============================================================================
-- Убедимся, что posts.group_id существует (для блогов сообществ)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_group ON public.posts(group_id, created_at DESC);