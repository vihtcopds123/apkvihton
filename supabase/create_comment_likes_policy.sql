-- Add update policy for comments
DROP POLICY IF EXISTS "Allow update own comments" ON public.comments;
CREATE POLICY "Allow update own comments" ON public.comments FOR UPDATE USING (auth.uid() = author_id);
