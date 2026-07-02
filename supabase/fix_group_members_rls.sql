DROP POLICY IF EXISTS "Allow user leave or admin kick members" ON public.group_members;

CREATE OR REPLACE FUNCTION public.is_group_admin(check_group_id uuid, check_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id
      AND user_id = check_user_id
      AND role IN ('admin', 'owner')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE POLICY "Allow user leave or admin kick members" ON public.group_members
  FOR ALL USING (
    auth.uid() = user_id OR public.is_group_admin(group_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id OR public.is_group_admin(group_id, auth.uid())
  );

NOTIFY pgrst, 'reload schema';