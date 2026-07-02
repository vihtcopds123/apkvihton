-- Скрипт исправления уведомлений для групповых чатов
CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS trigger AS $$
DECLARE
  v_recipient_id uuid;
  v_is_muted boolean;
  v_is_group boolean;
  v_member record;
BEGIN
  -- Проверяем, является ли беседа групповой
  SELECT is_group INTO v_is_group
  FROM public.conversations
  WHERE id = new.conversation_id;

  IF v_is_group = true THEN
    -- Для групповых чатов: рассылаем всем участникам кроме отправителя
    FOR v_member IN 
      SELECT user_id 
      FROM public.conversation_members
      WHERE conversation_id = new.conversation_id AND user_id != new.sender_id
    LOOP
      -- Проверяем, не заглушил ли участник отправителя
      SELECT EXISTS (
        SELECT 1 FROM public.chat_blocks_mutes
        WHERE user_id = v_member.user_id 
          AND target_user_id = new.sender_id 
          AND is_muted = true
      ) INTO v_is_muted;

      IF NOT v_is_muted THEN
        INSERT INTO public.notifications (user_id, type, from_user_id)
        VALUES (v_member.user_id, 'message', new.sender_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  ELSE
    -- Для обычных чатов 1-на-1
    SELECT CASE 
      WHEN participant_1 = new.sender_id THEN participant_2
      ELSE participant_1
    END INTO v_recipient_id
    FROM public.conversations
    WHERE id = new.conversation_id;

    IF v_recipient_id IS NOT NULL AND v_recipient_id != new.sender_id THEN
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
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
