-- Таблица для уникальных просмотров постов (1 аккаунт = 1 просмотр)
CREATE TABLE IF NOT EXISTS public.post_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT unique_post_user_view UNIQUE (post_id, user_id)
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS post_views_post_id_idx ON public.post_views(post_id);
CREATE INDEX IF NOT EXISTS post_views_user_id_idx ON public.post_views(user_id);

-- Настройка RLS политик
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for everyone" ON public.post_views;
CREATE POLICY "Allow select for everyone" ON public.post_views
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for self" ON public.post_views;
CREATE POLICY "Allow insert for self" ON public.post_views
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow update for self" ON public.post_views;
CREATE POLICY "Allow update for self" ON public.post_views
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Триггер для автоматического инкремента счетчика просмотров
CREATE OR REPLACE FUNCTION public.handle_post_view_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.posts
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_view_insert ON public.post_views;
CREATE TRIGGER on_post_view_insert
    AFTER INSERT ON public.post_views
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_post_view_insert();
