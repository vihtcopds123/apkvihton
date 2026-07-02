-- �������� ���������� pg_net ��� ���������� HTTP ��������, ���� ��� �� ��������
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ������� �������� ���� ����� HTTP ������ � ������ ������������
CREATE OR REPLACE FUNCTION public.send_push_notification_trigger()
RETURNS trigger AS $$
DECLARE
  v_subscriptions json;
  v_sender_name text;
  v_sender_num_id int;
  v_body text;
  v_payload json;
BEGIN
  -- ������� ��� �������� ����������
  SELECT json_agg(subscription) INTO v_subscriptions
  FROM public.user_push_tokens
  WHERE user_id = new.user_id;

  -- ���� �������� ���, ������ �� ������
  IF v_subscriptions IS NULL THEN
    RETURN new;
  END IF;

  -- ������� ��� �����������
  IF new.from_user_id IS NOT NULL THEN
    SELECT full_name, num_id INTO v_sender_name, v_sender_num_id FROM public.profiles WHERE id = new.from_user_id;
  END IF;
  IF v_sender_name IS NULL THEN
    v_sender_name := '���-��';
  END IF;

  -- ��������� �����
  CASE new.type
    WHEN 'like' THEN v_body := v_sender_name || ' ��������(�) ���� �� ���� ������';
    WHEN 'comment' THEN v_body := v_sender_name || ' ����������������(�) ���� ������';
    WHEN 'friend_request' THEN v_body := v_sender_name || ' ����� ���������� � ��� � ������';
    WHEN 'friend_accepted' THEN v_body := v_sender_name || ' ����������(�) ���� ������ � ������';
    WHEN 'message' THEN v_body := v_sender_name || ' ��������(�) ��� ���������';
    WHEN 'reply' THEN v_body := v_sender_name || ' �������(�) �� ��� �����������';
    ELSE v_body := v_sender_name || ' ��������(�) ��� �����������';
  END CASE;

  -- ��������� ���� �������
  v_payload := json_build_object(
    'title', 'Vihton',
    'body', v_body,
    'url', CASE WHEN new.type = 'message' THEN COALESCE('/im/vid' || v_sender_num_id, '/im') ELSE '/notifications' END,
    'subscriptions', v_subscriptions
  );

  -- �������� HTTP-������ � ������ ������������
  BEGIN
    PERFORM net.http_post(
      'https://vihtclub.ru/push-api/send',
      v_payload::text,
      '{}',
      '{"Content-Type": "application/json"}'
    );
  EXCEPTION WHEN OTHERS THEN
    -- ���������� ������ http-�������, ����� ���������� ���� ������ �� ������������
    RAISE WARNING 'Failed to send push HTTP request: %', SQLERRM;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ������� ������� �� ������� � notifications
DROP TRIGGER IF EXISTS trg_send_push_notification ON public.notifications;
CREATE TRIGGER trg_send_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.send_push_notification_trigger();
