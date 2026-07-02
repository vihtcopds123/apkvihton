-- 1. Добавляем колонку participant_ids в таблицу messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS participant_ids uuid[];

-- 2. Функция для заполнения participant_ids при вставке нового сообщения
CREATE OR REPLACE FUNCTION public.populate_message_participant_ids()
RETURNS trigger AS $$
DECLARE
  v_is_group boolean;
  v_p1 uuid;
  v_p2 uuid;
BEGIN
  SELECT is_group, participant_1, participant_2 
  INTO v_is_group, v_p1, v_p2
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF v_is_group = true THEN
    SELECT array_agg(user_id) INTO NEW.participant_ids
    FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id;
  ELSE
    NEW.participant_ids := ARRAY[v_p1, v_p2];
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем триггер BEFORE INSERT на сообщениях
DROP TRIGGER IF EXISTS trg_populate_message_participant_ids ON public.messages;
CREATE TRIGGER trg_populate_message_participant_ids
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_message_participant_ids();

-- 3. Функция обновления participant_ids в сообщениях при изменении участников беседы (для групп)
CREATE OR REPLACE FUNCTION public.sync_message_participant_ids_on_member_change()
RETURNS trigger AS $$
DECLARE
  v_conv_id uuid;
  v_members uuid[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_conv_id := OLD.conversation_id;
  ELSE
    v_conv_id := NEW.conversation_id;
  END IF;

  SELECT array_agg(user_id) INTO v_members
  FROM public.conversation_members
  WHERE conversation_id = v_conv_id;

  UPDATE public.messages
  SET participant_ids = v_members
  WHERE conversation_id = v_conv_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем триггер AFTER INSERT/UPDATE/DELETE на участниках беседы
DROP TRIGGER IF EXISTS trg_sync_message_participant_ids ON public.conversation_members;
CREATE TRIGGER trg_sync_message_participant_ids
  AFTER INSERT OR UPDATE OR DELETE ON public.conversation_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_message_participant_ids_on_member_change();

-- 4. Заполняем participant_ids для всех существующих сообщений
UPDATE public.messages m
SET participant_ids = ARRAY[c.participant_1, c.participant_2]
FROM public.conversations c
WHERE m.conversation_id = c.id AND c.is_group = false;

UPDATE public.messages m
SET participant_ids = (
  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) 
  FROM public.conversation_members 
  WHERE conversation_id = m.conversation_id
)
FROM public.conversations c
WHERE m.conversation_id = c.id AND c.is_group = true;

-- 5. Пересоздаем RLS-политики на таблицу messages для поддержки реалтайма (без подзапросов)
DROP POLICY IF EXISTS "Allow users to read messages in own conversations" ON public.messages;
CREATE POLICY "Allow users to read messages in own conversations" ON public.messages
  FOR SELECT USING (
    auth.uid() = ANY(participant_ids)
  );

DROP POLICY IF EXISTS "Allow users to insert messages to own conversations" ON public.messages;
CREATE POLICY "Allow users to insert messages to own conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND auth.uid() = ANY(participant_ids)
  );

DROP POLICY IF EXISTS "Allow users to update messages in own conversations" ON public.messages;
CREATE POLICY "Allow users to update messages in own conversations" ON public.messages
  FOR UPDATE USING (
    auth.uid() = ANY(participant_ids)
  );
