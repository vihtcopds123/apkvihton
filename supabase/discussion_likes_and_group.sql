ALTER TABLE public.group_discussions ADD COLUMN IF NOT EXISTS by_group BOOLEAN DEFAULT false;

ALTER TABLE public.group_discussion_comments ADD COLUMN IF NOT EXISTS by_group BOOLEAN DEFAULT false;
ALTER TABLE public.group_discussion_comments ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;
ALTER TABLE public.group_discussion_comments ADD COLUMN IF NOT EXISTS images TEXT[];

-- Таблица лайков для ответов в обсуждениях
CREATE TABLE IF NOT EXISTS public.discussion_comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.group_discussion_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Включаем RLS
ALTER TABLE public.discussion_comment_likes ENABLE ROW LEVEL SECURITY;

-- Политики RLS
DROP POLICY IF EXISTS "Allow read discussion_comment_likes" ON public.discussion_comment_likes;
CREATE POLICY "Allow read discussion_comment_likes" ON public.discussion_comment_likes 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert discussion_comment_likes" ON public.discussion_comment_likes;
CREATE POLICY "Allow auth insert discussion_comment_likes" ON public.discussion_comment_likes 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete own discussion_comment_likes" ON public.discussion_comment_likes;
CREATE POLICY "Allow delete own discussion_comment_likes" ON public.discussion_comment_likes 
  FOR DELETE USING (auth.uid() = user_id);

-- Триггер для подсчета лайков
CREATE OR REPLACE FUNCTION public.handle_discussion_comment_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.group_discussion_comments SET likes_count = likes_count + 1 WHERE id = new.comment_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.group_discussion_comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = old.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_discussion_comment_like_change ON public.discussion_comment_likes;
CREATE TRIGGER on_discussion_comment_like_change
  AFTER INSERT OR DELETE ON public.discussion_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_discussion_comment_stats();
