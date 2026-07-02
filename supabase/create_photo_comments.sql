-- Photo Comments Table (для комментариев к фото без поста — аватарка, обложка и т.д.)
CREATE TABLE IF NOT EXISTS public.photo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by photo URL
CREATE INDEX IF NOT EXISTS idx_photo_comments_url ON public.photo_comments(photo_url, created_at ASC);

-- Enable RLS
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow public read photo_comments" ON public.photo_comments;
CREATE POLICY "Allow public read photo_comments" ON public.photo_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert photo_comments" ON public.photo_comments;
CREATE POLICY "Allow auth insert photo_comments" ON public.photo_comments FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Allow update own photo_comments" ON public.photo_comments;
CREATE POLICY "Allow update own photo_comments" ON public.photo_comments FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Allow delete own photo_comments" ON public.photo_comments;
CREATE POLICY "Allow delete own photo_comments" ON public.photo_comments FOR DELETE USING (auth.uid() = author_id);

-- Content length constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'photo_comments_content_length_check'
  ) THEN
    ALTER TABLE public.photo_comments ADD CONSTRAINT photo_comments_content_length_check CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000);
  END IF;
END $$;

-- Add to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'photo_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_comments;
  END IF;
END;
$$;
