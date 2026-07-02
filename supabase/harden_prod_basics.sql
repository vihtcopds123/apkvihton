-- Production hardening patch for existing local/remote databases.
-- Apply this file to an already created database.

drop policy if exists "Allow system/users to insert notifications" on public.notifications;
drop policy if exists "Allow users to insert notifications they originate" on public.notifications;
drop policy if exists "Allow users to delete own notifications" on public.notifications;

create policy "Allow users to insert notifications they originate"
on public.notifications
for insert
with check (
  auth.uid() is not null
  and (auth.uid() = from_user_id or auth.uid() = user_id)
);

create policy "Allow users to delete own notifications"
on public.notifications
for delete
using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_content_length_check'
  ) then
    alter table public.comments
      add constraint comments_content_length_check
      check (char_length(btrim(content)) between 1 and 2000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_content_or_image_required_check'
  ) then
    alter table public.messages
      add constraint messages_content_or_image_required_check
      check (
        (content is not null and char_length(btrim(content)) between 1 and 4000)
        or image_url is not null
      );
  end if;
end $$;

create index if not exists idx_notifications_user_created_at
  on public.notifications (user_id, created_at desc);

create index if not exists idx_messages_conversation_created_at
  on public.messages (conversation_id, created_at desc);

create index if not exists idx_friendships_requester_status
  on public.friendships (requester_id, status);

create index if not exists idx_friendships_addressee_status
  on public.friendships (addressee_id, status);
