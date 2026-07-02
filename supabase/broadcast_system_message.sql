-- 1. Создаем функцию для массовой рассылки системных сообщений в обход RLS
CREATE OR REPLACE FUNCTION public.broadcast_system_message(
  p_content text,
  p_image_url text,
  p_video_url text,
  p_audio_id uuid
)
RETURNS public.messages AS $$
DECLARE
  v_sender_id uuid;
  v_sender_username text;
  v_system_bot_id uuid := '00000000-0000-0000-0000-000000000000';
  r_user record;
  v_conv_id uuid;
  v_admin_msg public.messages;
BEGIN
  -- 1. Проверяем, является ли отправитель админом (по имени пользователя)
  v_sender_id := auth.uid();
  SELECT username INTO v_sender_username FROM public.profiles WHERE id = v_sender_id;
  
  IF v_sender_id IS NULL OR v_sender_username NOT IN ('viht', 'adm') THEN
    RAISE EXCEPTION 'Access denied. Only admins can broadcast system messages.';
  END IF;

  -- 2. Вставляем сообщение в диалог админа с ботом
  SELECT id INTO v_conv_id 
  FROM public.conversations
  WHERE (participant_1 = v_system_bot_id AND participant_2 = v_sender_id)
     OR (participant_1 = v_sender_id AND participant_2 = v_system_bot_id)
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_1, participant_2)
    VALUES (v_system_bot_id, v_sender_id)
    RETURNING id INTO v_conv_id;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, image_url, video_url, audio_id)
  VALUES (v_conv_id, v_sender_id, p_content, p_image_url, p_video_url, p_audio_id)
  RETURNING * INTO v_admin_msg;

  -- 3. Рассылаем остальным пользователям в обход RLS (SECURITY DEFINER)
  FOR r_user IN 
    SELECT id FROM public.profiles WHERE id != v_sender_id AND id != v_system_bot_id
  LOOP
    -- Получаем или создаем диалог между системным ботом и пользователем
    SELECT id INTO v_conv_id 
    FROM public.conversations
    WHERE (participant_1 = v_system_bot_id AND participant_2 = r_user.id)
       OR (participant_1 = r_user.id AND participant_2 = v_system_bot_id)
    LIMIT 1;

    IF v_conv_id IS NULL THEN
      INSERT INTO public.conversations (participant_1, participant_2)
      VALUES (v_system_bot_id, r_user.id)
      RETURNING id INTO v_conv_id;
    END IF;

    -- Вставляем системное сообщение (от имени бота)
    INSERT INTO public.messages (conversation_id, sender_id, content, image_url, video_url, audio_id)
    VALUES (v_conv_id, v_system_bot_id, p_content, p_image_url, p_video_url, p_audio_id);
  END LOOP;

  RETURN v_admin_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Убеждаемся, что триггер уведомлений о сообщениях активен и разрешает тип 'message'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('like', 'comment', 'friend_request', 'friend_accepted', 'message', 'reply'));

CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS trigger AS $$
DECLARE
  v_recipient_id uuid;
  v_is_muted boolean;
BEGIN
  SELECT CASE 
    WHEN participant_1 = new.sender_id THEN participant_2
    ELSE participant_1
  END INTO v_recipient_id
  FROM public.conversations
  WHERE id = new.conversation_id;

  IF v_recipient_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.chat_blocks_mutes
      WHERE user_id = v_recipient_id 
        AND target_user_id = new.sender_id 
        AND is_muted = true
    ) INTO v_is_muted;

    IF NOT v_is_muted THEN
      INSERT INTO public.notifications (user_id, type, from_user_id)
      VALUES (v_recipient_id, 'message', new.sender_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_message_notification ON public.messages;
CREATE TRIGGER trg_message_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_message_notification();
