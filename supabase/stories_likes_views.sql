-- Migration: Add Story Likes and Views

-- 1. Add views_count and likes_count columns to stories table if they don't exist
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS views_count INT DEFAULT 0;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;

-- 2. Create story_likes table
CREATE TABLE IF NOT EXISTS public.story_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- 3. Enable RLS for story_likes
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for story_likes
DROP POLICY IF EXISTS "Allow public read story_likes" ON public.story_likes;
CREATE POLICY "Allow public read story_likes" ON public.story_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert story_likes" ON public.story_likes;
CREATE POLICY "Allow auth insert story_likes" ON public.story_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete own story_likes" ON public.story_likes;
CREATE POLICY "Allow delete own story_likes" ON public.story_likes
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Trigger/function to automatically update likes_count on stories
CREATE OR REPLACE FUNCTION public.handle_story_like_change()
RETURNS trigger AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.stories SET likes_count = likes_count + 1 WHERE id = new.story_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.stories SET likes_count = GREATEST(0, likes_count - 1) WHERE id = old.story_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_story_like_change ON public.story_likes;
CREATE TRIGGER on_story_like_change
  AFTER INSERT OR DELETE ON public.story_likes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_story_like_change();

-- 6. Helper function to increment views count safely
CREATE OR REPLACE FUNCTION public.increment_story_views(story_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.stories
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = story_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Helper function to purge expired stories
CREATE OR REPLACE FUNCTION public.purge_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM public.stories
  WHERE expires_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

