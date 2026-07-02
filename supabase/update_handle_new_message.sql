CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = now(),
      deleted_by = '{}'
  WHERE id = new.conversation_id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
