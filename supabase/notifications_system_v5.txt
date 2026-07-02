-- 1. Расширение типов уведомлений
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('like', 'comment', 'friend_request', 'friend_accepted', 'message', 'reply'));

-- 2. Триггер на новые сообщения в чатах с проверкой заглушек
CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS trigger AS $$
DECLARE
  v_recipient_id uuid;
  v_is_muted boolean;
BEGIN
  -- Находим получателя сообщения (другого участника диалога)
  SELECT CASE 
    WHEN participant_1 = new.sender_id THEN participant_2
    ELSE participant_1
  END INTO v_recipient_id
  FROM public.conversations
  WHERE id = new.conversation_id;

  IF v_recipient_id IS NOT NULL THEN
    -- Проверяем заглушен ли чат получателем
    SELECT EXISTS (
      SELECT 1 FROM public.chat_blocks_mutes
      WHERE user_id = v_recipient_id 
        AND target_user_id = new.sender_id 
        AND is_muted = true
    ) INTO v_is_muted;

    -- Если не заглушен, создаем уведомление о новом сообщении
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


-- 3. Триггер для лайков постов и сообществ
CREATE OR REPLACE FUNCTION public.handle_post_like_notification()
RETURNS trigger AS $$
DECLARE
  v_author_id uuid;
  v_group_owner_id uuid;
  v_group_id uuid;
BEGIN
  IF tg_op = 'INSERT' THEN
    SELECT author_id, group_id INTO v_author_id, v_group_id FROM public.posts WHERE id = new.post_id;
    
    -- Проверяем владельца сообщества, если запись в сообществе
    IF v_group_id IS NOT NULL THEN
      SELECT owner_id INTO v_group_owner_id FROM public.groups WHERE id = v_group_id;
    END IF;

    -- Уведомляем автора записи
    IF v_author_id IS NOT NULL AND v_author_id != new.user_id THEN
      INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
      VALUES (v_author_id, 'like', new.user_id, new.post_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Уведомляем владельца сообщества
    IF v_group_owner_id IS NOT NULL AND v_group_owner_id != new.user_id AND v_group_owner_id != v_author_id THEN
      INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
      VALUES (v_group_owner_id, 'like', new.user_id, new.post_id)
      ON CONFLICT DO NOTHING;
    END IF;
    
  ELSIF tg_op = 'DELETE' THEN
    SELECT author_id, group_id INTO v_author_id, v_group_id FROM public.posts WHERE id = old.post_id;
    
    IF v_group_id IS NOT NULL THEN
      SELECT owner_id INTO v_group_owner_id FROM public.groups WHERE id = v_group_id;
    END IF;

    IF v_author_id IS NOT NULL THEN
      DELETE FROM public.notifications 
      WHERE user_id = v_author_id 
        AND type = 'like' 
        AND from_user_id = old.user_id 
        AND post_id = old.post_id;
    END IF;

    IF v_group_owner_id IS NOT NULL THEN
      DELETE FROM public.notifications 
      WHERE user_id = v_group_owner_id 
        AND type = 'like' 
        AND from_user_id = old.user_id 
        AND post_id = old.post_id;
    END IF;
  END IF;
  
  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_like_notification ON public.post_likes;
CREATE TRIGGER trg_post_like_notification
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_like_notification();


-- 4. Триггер на новые комментарии (нормальные комменты и ответы)
CREATE OR REPLACE FUNCTION public.handle_comment_notification()
RETURNS trigger AS $$
DECLARE
  v_post_author_id uuid;
  v_replied_user_id uuid;
BEGIN
  IF tg_op = 'INSERT' THEN
    SELECT author_id INTO v_post_author_id FROM public.posts WHERE id = new.post_id;
    
    -- Пытаемся найти упомянутого автора предыдущего комментария к этому посту
    SELECT c.author_id INTO v_replied_user_id
    FROM public.comments c
    JOIN public.profiles p ON c.author_id = p.id
    WHERE c.post_id = new.post_id
      AND c.author_id != new.author_id
      AND (
        new.content LIKE p.full_name || ',%'
        OR new.content LIKE p.full_name || ' %'
      )
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF v_replied_user_id IS NOT NULL THEN
      -- Это ответ конкретному пользователю
      INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
      VALUES (v_replied_user_id, 'reply', new.author_id, new.post_id)
      ON CONFLICT DO NOTHING;
    ELSIF v_post_author_id IS NOT NULL AND v_post_author_id != new.author_id THEN
      -- Обычный комментарий автору поста
      INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
      VALUES (v_post_author_id, 'comment', new.author_id, new.post_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_notification ON public.comments;
CREATE TRIGGER trg_comment_notification
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_notification();
