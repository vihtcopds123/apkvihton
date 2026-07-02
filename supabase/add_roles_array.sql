-- Добавляем поле roles (массив привилегий) к таблице profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{}';

-- Синхронизируем существующие одиночные роли в массив
UPDATE profiles SET roles = ARRAY[role] WHERE role IS NOT NULL AND role != '';

-- RPC: добавить роль пользователю (вызывается только создателем)
CREATE OR REPLACE FUNCTION add_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_username text;
BEGIN
  SELECT username INTO caller_username FROM profiles WHERE id = auth.uid();
  IF caller_username NOT IN ('viht', 'adm') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE profiles
  SET roles = array_append(
    COALESCE(roles, '{}'),
    new_role
  )
  WHERE id = target_user_id
    AND NOT (new_role = ANY(COALESCE(roles, '{}')));
END;
$$;

-- RPC: убрать роль у пользователя
CREATE OR REPLACE FUNCTION remove_user_role(target_user_id uuid, role_to_remove text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_username text;
BEGIN
  SELECT username INTO caller_username FROM profiles WHERE id = auth.uid();
  IF caller_username NOT IN ('viht', 'adm') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE profiles
  SET roles = array_remove(COALESCE(roles, '{}'), role_to_remove)
  WHERE id = target_user_id;
END;
$$;

-- RPC: установить весь массив ролей сразу
CREATE OR REPLACE FUNCTION set_user_roles(target_user_id uuid, new_roles text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_username text;
BEGIN
  SELECT username INTO caller_username FROM profiles WHERE id = auth.uid();
  IF caller_username NOT IN ('viht', 'adm') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE profiles
  SET roles = COALESCE(new_roles, '{}')
  WHERE id = target_user_id;
END;
$$;
