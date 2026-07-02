-- Add likes_count to comments
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Policies for comment_likes
DROP POLICY IF EXISTS "Allow public read comment_likes" ON public.comment_likes;
CREATE POLICY "Allow public read comment_likes" ON public.comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert comment_likes" ON public.comment_likes;
CREATE POLICY "Allow auth insert comment_likes" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete own comment_likes" ON public.comment_likes;
CREATE POLICY "Allow delete own comment_likes" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Trigger for handling comment stats
CREATE OR REPLACE FUNCTION public.handle_comment_stats()
RETURNS trigger AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.comments SET likes_count = likes_count + 1 WHERE id = new.comment_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.comments SET likes_count = likes_count - 1 WHERE id = old.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_like_change ON public.comment_likes;
CREATE TRIGGER on_comment_like_change
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_comment_stats();

-- Add tables to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comment_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  END IF;
END;
$$;
