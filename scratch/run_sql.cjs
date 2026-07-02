const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ufihkyhvvqfusgavndmh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0'
);

const sql = `
-- Таблица для отслеживания уникальных просмотров постов
CREATE TABLE IF NOT EXISTS public.post_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT unique_post_user_view UNIQUE (post_id, user_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS post_views_post_id_idx ON public.post_views(post_id);
CREATE INDEX IF NOT EXISTS post_views_user_id_idx ON public.post_views(user_id);

-- Включаем RLS
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- Политика RLS
DROP POLICY IF EXISTS "Allow select for everyone" ON public.post_views;
CREATE POLICY "Allow select for everyone" ON public.post_views
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for self" ON public.post_views;
CREATE POLICY "Allow insert for self" ON public.post_views
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Функция триггера для автоматического инкремента views_count в таблице posts
CREATE OR REPLACE FUNCTION public.handle_post_view_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.posts
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер на вставку
DROP TRIGGER IF EXISTS on_post_view_insert ON public.post_views;
CREATE TRIGGER on_post_view_insert
    AFTER INSERT ON public.post_views
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_post_view_insert();
`;

async function main() {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('SQL Execution Error:', error);
  } else {
    console.log('SQL Executed successfully:', data);
  }
}

main();
