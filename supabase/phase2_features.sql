-- Phase 2 Migration: Stories, Reposts, Polls, Bookmarks

-- =========================================================================
-- 1. Bookmarks (Закладки)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user to manage own bookmarks" ON public.bookmarks;
CREATE POLICY "Allow user to manage own bookmarks" ON public.bookmarks
  FOR ALL
  USING (auth.uid() = user_id);

-- =========================================================================
-- 2. Stories (Истории)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read stories" ON public.stories;
CREATE POLICY "Allow public read stories" ON public.stories
  FOR SELECT
  USING (expires_at > now());

DROP POLICY IF EXISTS "Allow auth insert stories" ON public.stories;
CREATE POLICY "Allow auth insert stories" ON public.stories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete own stories" ON public.stories;
CREATE POLICY "Allow delete own stories" ON public.stories
  FOR DELETE
  USING (auth.uid() = user_id);

-- =========================================================================
-- 3. Polls (Опросы)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  votes_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Allow public read poll_options" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "Allow public read poll_votes" ON public.poll_votes FOR SELECT USING (true);

CREATE POLICY "Allow auth insert polls" ON public.polls FOR INSERT WITH CHECK (auth.uid() is not null);
CREATE POLICY "Allow auth insert poll_options" ON public.poll_options FOR INSERT WITH CHECK (auth.uid() is not null);
CREATE POLICY "Allow auth insert poll_votes" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow auth delete own poll_votes" ON public.poll_votes FOR DELETE USING (auth.uid() = user_id);

-- =========================================================================
-- 4. Reposts & Poll columns on Posts table
-- =========================================================================
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS repost_source_id UUID REFERENCES public.posts(id) ON DELETE SET NULL DEFAULT NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES public.polls(id) ON DELETE SET NULL DEFAULT NULL;

-- Trigger to increment/decrement votes_count in poll_options
CREATE OR REPLACE FUNCTION public.handle_poll_vote_change()
RETURNS trigger AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.poll_options SET votes_count = votes_count + 1 WHERE id = new.option_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.poll_options SET votes_count = votes_count - 1 WHERE id = old.option_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_poll_vote_change ON public.poll_votes;
CREATE TRIGGER on_poll_vote_change
  AFTER INSERT OR DELETE ON public.poll_votes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_poll_vote_change();

-- =========================================================================
-- 5. Realtime publication additions
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'poll_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'poll_options'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;
  END IF;
END;
$$;
