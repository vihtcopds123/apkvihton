-- Update RLS Select policy for friendships to allow public read of accepted friendships
DROP POLICY IF EXISTS "Allow users to read own friendships" ON public.friendships;

CREATE POLICY "Allow users to read own friendships" ON public.friendships 
  FOR SELECT 
  USING ((status = 'accepted'::text) OR (auth.uid() = requester_id) OR (auth.uid() = addressee_id));
