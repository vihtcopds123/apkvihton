-- ==========================================
-- VIHTON SOCIAL NETWORK DATABASE SCHEMA
-- ==========================================

-- 1. Profiles Table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  vk_id text unique,
  username text unique,
  num_id int unique,
  full_name text,
  avatar_url text,
  cover_url text,
  bio text,
  city text,
  birth_date date,
  is_online boolean default false,
  status_preference text check (status_preference in ('online', 'offline')) default 'online',
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

-- 2. Posts Table
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  images text[],
  likes_count int default 0,
  comments_count int default 0,
  group_id uuid, -- If posted in a group
  created_at timestamptz default now()
);

alter table public.posts enable row level security;

-- 3. Post Likes Table
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table public.post_likes enable row level security;

-- 4. Comments Table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  likes_count int default 0,
  created_at timestamptz default now()
);

alter table public.comments enable row level security;

-- 5. Friendships Table
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'blocked')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_1 uuid references public.profiles(id) on delete cascade not null,
  participant_2 uuid references public.profiles(id) on delete cascade not null,
  pinned_by uuid[] default '{}',
  deleted_by uuid[] default '{}',
  updated_at timestamptz default now(),
  unique(participant_1, participant_2)
);

alter table public.conversations enable row level security;

-- 7. Messages Table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text,
  image_url text,
  is_read boolean default false,
  is_edited boolean default false,
  original_content text default null,
  is_deleted boolean default false,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

-- 8. Groups Table
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  avatar_url text,
  cover_url text,
  owner_id uuid references public.profiles(id) on delete set null,
  members_count int default 1,
  is_public boolean default true,
  created_at timestamptz default now()
);

alter table public.groups enable row level security;

-- 9. Group Members Table
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('member', 'admin', 'owner')) default 'member',
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

alter table public.group_members enable row level security;

-- 10. Photos Table
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  url text not null,
  caption text,
  likes_count int default 0,
  created_at timestamptz default now()
);

alter table public.photos enable row level security;

-- 11. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('like', 'comment', 'friend_request', 'friend_accepted')),
  from_user_id uuid references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;


-- ==========================================
-- ROW LEVEL SECURITY POLICIES (RLS)
-- ==========================================

-- Profiles
create policy "Allow public read profiles" on public.profiles for select using (true);
create policy "Allow update own profile" on public.profiles for update using (auth.uid() = id);

-- Posts
create policy "Allow public read posts" on public.posts for select using (true);
create policy "Allow insert own posts" on public.posts for insert with check (auth.uid() = author_id);
create policy "Allow update/delete own posts" on public.posts for all using (auth.uid() = author_id);

-- Post Likes
create policy "Allow public read post_likes" on public.post_likes for select using (true);
create policy "Allow auth insert post_likes" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "Allow delete own post_likes" on public.post_likes for delete using (auth.uid() = user_id);

-- Comments
create policy "Allow public read comments" on public.comments for select using (true);
create policy "Allow auth insert comments" on public.comments for insert with check (auth.uid() = author_id);
create policy "Allow update own comments" on public.comments for update using (auth.uid() = author_id);
create policy "Allow delete own comments" on public.comments for delete using (auth.uid() = author_id);

-- Comment Likes
create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references public.comments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);
alter table public.comment_likes enable row level security;
create policy "Allow public read comment_likes" on public.comment_likes for select using (true);
create policy "Allow auth insert comment_likes" on public.comment_likes for insert with check (auth.uid() = user_id);
create policy "Allow delete own comment_likes" on public.comment_likes for delete using (auth.uid() = user_id);

-- Friendships
create policy "Allow users to read own friendships" on public.friendships for select using (status = 'accepted' or auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "Allow users to insert friendships" on public.friendships for insert with check (auth.uid() = requester_id);
create policy "Allow users to update/delete own friendships" on public.friendships for all using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Conversations
create policy "Allow users to read own conversations" on public.conversations for select using (auth.uid() = participant_1 or auth.uid() = participant_2);
create policy "Allow users to insert own conversations" on public.conversations for insert with check (auth.uid() = participant_1 or auth.uid() = participant_2);
create policy "Allow users to update own conversations" on public.conversations for update using (auth.uid() = participant_1 or auth.uid() = participant_2);

-- Messages
create policy "Allow users to read messages in own conversations" on public.messages for select using (
  exists (
    select 1 from public.conversations
    where id = messages.conversation_id
    and (participant_1 = auth.uid() or participant_2 = auth.uid())
  )
);
create policy "Allow users to insert messages to own conversations" on public.messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from public.conversations
    where id = conversation_id
    and (participant_1 = auth.uid() or participant_2 = auth.uid())
  )
);
create policy "Allow users to update messages in own conversations" on public.messages for update using (
  exists (
    select 1 from public.conversations
    where id = messages.conversation_id
    and (participant_1 = auth.uid() or participant_2 = auth.uid())
  )
);


-- Groups
create policy "Allow public read groups" on public.groups for select using (true);
create policy "Allow auth create groups" on public.groups for insert with check (auth.uid() = owner_id);
create policy "Allow owner update/delete groups" on public.groups for all using (auth.uid() = owner_id);

-- Group Members
create policy "Allow public read group members" on public.group_members for select using (true);
create policy "Allow auth join groups" on public.group_members for insert with check (auth.uid() = user_id);
create policy "Allow user leave or admin kick members" on public.group_members for all using (auth.uid() = user_id or exists (
  select 1 from public.group_members admin_check
  where admin_check.group_id = group_members.group_id
  and admin_check.user_id = auth.uid()
  and admin_check.role in ('admin', 'owner')
));

-- Photos
create policy "Allow public read photos" on public.photos for select using (true);
create policy "Allow auth upload photos" on public.photos for insert with check (auth.uid() = owner_id);
create policy "Allow delete own photos" on public.photos for delete using (auth.uid() = owner_id);

-- Notifications
create policy "Allow users to read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Allow users to insert notifications they originate" on public.notifications for insert with check (
  auth.uid() is not null and (auth.uid() = from_user_id or auth.uid() = user_id)
);
create policy "Allow users to update own notifications" on public.notifications for update using (auth.uid() = user_id);
create policy "Allow users to delete own notifications" on public.notifications for delete using (auth.uid() = user_id);


-- ==========================================
-- AUTOMATION TRIGGERS & FUNCTIONS
-- ==========================================

-- Sequence for user numeric IDs (starts at 2 since viht has ID 1)
create sequence if not exists public.profiles_num_id_seq start 2;

-- Trigger to automatically create a profile after user signs up
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_username text;
  v_num_id int;
begin
  v_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  
  if v_username = 'viht' then
    v_num_id := 1;
  else
    v_num_id := nextval('public.profiles_num_id_seq');
  end if;

  insert into public.profiles (id, username, full_name, avatar_url, cover_url, num_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || substr(md5(random()::text), 1, 5)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    null,
    null,
    v_num_id
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger to update conversation updated_at when a new message is inserted
create or replace function public.handle_new_message()
returns trigger as $$
begin
  update public.conversations
  set updated_at = now(),
      deleted_by = '{}'
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_message_inserted
  after insert on public.messages
  for each row execute procedure public.handle_new_message();

-- Function to handle post count increments/decrements
create or replace function public.handle_post_stats()
returns trigger as $$
begin
  -- Likes
  if tg_op = 'INSERT' and tg_table_name = 'post_likes' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' and tg_table_name = 'post_likes' then
    update public.posts set likes_count = likes_count - 1 where id = old.post_id;
  -- Comments
  elsif tg_op = 'INSERT' and tg_table_name = 'comments' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' and tg_table_name = 'comments' then
    update public.posts set comments_count = comments_count - 1 where id = old.post_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create or replace trigger on_like_change
  after insert or delete on public.post_likes
  for each row execute procedure public.handle_post_stats();

create or replace trigger on_comment_change
  after insert or delete on public.comments
  for each row execute procedure public.handle_post_stats();

-- Enable realtime replication for tables
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
