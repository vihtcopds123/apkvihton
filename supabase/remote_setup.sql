-- ==========================================
-- VIHTON SOCIAL NETWORK CONSOLIDATED BACKEND SETUP
-- ==========================================

-- 1. Create numeric sequence for profile IDs
CREATE SEQUENCE IF NOT EXISTS public.profiles_num_id_seq START 2;

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  vk_id TEXT UNIQUE,
  username TEXT UNIQUE,
  num_id INT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  city TEXT,
  birth_date DATE,
  is_online BOOLEAN DEFAULT false,
  status_preference TEXT CHECK (status_preference IN ('online', 'offline')) DEFAULT 'online',
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT NULL,
  role TEXT DEFAULT NULL,
  roles TEXT[] DEFAULT '{}'
);

-- 3. Groups Table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  members_count INT DEFAULT 1,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Group Members Table
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('member', 'admin', 'owner')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique ON public.group_members(group_id, user_id);

-- 5. Polls Table (Опросы)
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Poll Options Table
CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  votes_count INT DEFAULT 0
);

-- 7. Poll Votes Table
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- 8. Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  images TEXT[],
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  wall_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT NULL,
  repost_source_id UUID REFERENCES public.posts(id) ON DELETE SET NULL DEFAULT NULL,
  poll_id UUID REFERENCES public.polls(id) ON DELETE SET NULL DEFAULT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_group ON public.posts(group_id, created_at DESC);

-- 9. Post Likes Table
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- 10. Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Comment Likes Table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- 12. Friendships Table
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status ON public.friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status ON public.friendships (addressee_id, status);

-- 13. Conversations Table (Диалоги)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pinned_by UUID[] DEFAULT '{}',
  deleted_by UUID[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(participant_1, participant_2)
);

-- 14. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  image_url TEXT,
  is_read BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  original_content TEXT DEFAULT null,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON public.messages (conversation_id, created_at DESC);

-- 15. Photos Table
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('like', 'comment', 'friend_request', 'friend_accepted')),
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON public.notifications (user_id, created_at DESC);

-- 17. Bookmarks Table (Закладки)
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- 18. Stories Table (Истории)
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  views_count INT DEFAULT 0,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

-- 19. Story Likes Table
CREATE TABLE IF NOT EXISTS public.story_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- 20. Community News Table (Новости сообществ)
CREATE TABLE IF NOT EXISTS public.community_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_news_community ON public.community_news(community_id, created_at DESC);


-- ==========================================
-- ROW LEVEL SECURITY (RLS) ACTIVATION
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_news ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- ROW LEVEL SECURITY POLICIES (RLS POLICIES)
-- ==========================================

-- Profiles Policies
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow update own profile" ON public.profiles;
CREATE POLICY "Allow update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Groups Policies
DROP POLICY IF EXISTS "Allow public read groups" ON public.groups;
CREATE POLICY "Allow public read groups" ON public.groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth create groups" ON public.groups;
CREATE POLICY "Allow auth create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow owner update/delete groups" ON public.groups;
CREATE POLICY "Allow owner update/delete groups" ON public.groups FOR ALL USING (auth.uid() = owner_id);

-- Group Admin Helper Function
CREATE OR REPLACE FUNCTION public.is_group_admin(check_group_id uuid, check_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id
      AND user_id = check_user_id
      AND role IN ('admin', 'owner')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Group Members Policies
DROP POLICY IF EXISTS "Allow public read group members" ON public.group_members;
CREATE POLICY "Allow public read group members" ON public.group_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth join groups" ON public.group_members;
CREATE POLICY "Allow auth join groups" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user leave or admin kick members" ON public.group_members;
CREATE POLICY "Allow user leave or admin kick members" ON public.group_members
  FOR ALL USING (
    auth.uid() = user_id OR public.is_group_admin(group_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id OR public.is_group_admin(group_id, auth.uid())
  );

-- Polls Policies
DROP POLICY IF EXISTS "Allow public read polls" ON public.polls;
CREATE POLICY "Allow public read polls" ON public.polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert polls" ON public.polls;
CREATE POLICY "Allow auth insert polls" ON public.polls FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Poll Options Policies
DROP POLICY IF EXISTS "Allow public read poll_options" ON public.poll_options;
CREATE POLICY "Allow public read poll_options" ON public.poll_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert poll_options" ON public.poll_options;
CREATE POLICY "Allow auth insert poll_options" ON public.poll_options FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Poll Votes Policies
DROP POLICY IF EXISTS "Allow public read poll_votes" ON public.poll_votes;
CREATE POLICY "Allow public read poll_votes" ON public.poll_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert poll_votes" ON public.poll_votes;
CREATE POLICY "Allow auth insert poll_votes" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow auth delete own poll_votes" ON public.poll_votes;
CREATE POLICY "Allow auth delete own poll_votes" ON public.poll_votes FOR DELETE USING (auth.uid() = user_id);

-- Posts Policies
DROP POLICY IF EXISTS "Allow public read posts" ON public.posts;
CREATE POLICY "Allow public read posts" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert own posts" ON public.posts;
CREATE POLICY "Allow insert own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Allow update/delete own posts" ON public.posts;
DROP POLICY IF EXISTS "Allow update/delete own posts or wall owner" ON public.posts;
CREATE POLICY "Allow update/delete own posts or wall owner" ON public.posts
  FOR ALL USING (
    auth.uid() = author_id 
    OR auth.uid() = wall_id 
    OR auth.uid() = 'fee894db-c5b0-4022-bb9f-56c60decac86'::uuid
  );

-- Post Likes Policies
DROP POLICY IF EXISTS "Allow public read post_likes" ON public.post_likes;
CREATE POLICY "Allow public read post_likes" ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert post_likes" ON public.post_likes;
CREATE POLICY "Allow auth insert post_likes" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete own post_likes" ON public.post_likes;
CREATE POLICY "Allow delete own post_likes" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments Policies
DROP POLICY IF EXISTS "Allow public read comments" ON public.comments;
CREATE POLICY "Allow public read comments" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert comments" ON public.comments;
CREATE POLICY "Allow auth insert comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Allow update own comments" ON public.comments;
CREATE POLICY "Allow update own comments" ON public.comments FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Allow delete own comments" ON public.comments;
CREATE POLICY "Allow delete own comments" ON public.comments FOR DELETE USING (auth.uid() = author_id);

-- Comment Likes Policies
DROP POLICY IF EXISTS "Allow public read comment_likes" ON public.comment_likes;
CREATE POLICY "Allow public read comment_likes" ON public.comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert comment_likes" ON public.comment_likes;
CREATE POLICY "Allow auth insert comment_likes" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete own comment_likes" ON public.comment_likes;
CREATE POLICY "Allow delete own comment_likes" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Friendships Policies
DROP POLICY IF EXISTS "Allow users to read own friendships" ON public.friendships;
CREATE POLICY "Allow users to read own friendships" ON public.friendships 
  FOR SELECT USING ((status = 'accepted'::text) OR (auth.uid() = requester_id) OR (auth.uid() = addressee_id));

DROP POLICY IF EXISTS "Allow users to insert friendships" ON public.friendships;
CREATE POLICY "Allow users to insert friendships" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Allow users to update/delete own friendships" ON public.friendships;
CREATE POLICY "Allow users to update/delete own friendships" ON public.friendships FOR ALL USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Conversations Policies
DROP POLICY IF EXISTS "Allow users to read own conversations" ON public.conversations;
CREATE POLICY "Allow users to read own conversations" ON public.conversations FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP POLICY IF EXISTS "Allow users to insert own conversations" ON public.conversations;
CREATE POLICY "Allow users to insert own conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP POLICY IF EXISTS "Allow users to update own conversations" ON public.conversations;
CREATE POLICY "Allow users to update own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Messages Policies
DROP POLICY IF EXISTS "Allow users to read messages in own conversations" ON public.messages;
CREATE POLICY "Allow users to read messages in own conversations" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = messages.conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
  )
);

DROP POLICY IF EXISTS "Allow users to insert messages to own conversations" ON public.messages;
CREATE POLICY "Allow users to insert messages to own conversations" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
  )
);

DROP POLICY IF EXISTS "Allow users to update messages in own conversations" ON public.messages;
CREATE POLICY "Allow users to update messages in own conversations" ON public.messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = messages.conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
  )
);

-- Photos Policies
DROP POLICY IF EXISTS "Allow public read photos" ON public.photos;
CREATE POLICY "Allow public read photos" ON public.photos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth upload photos" ON public.photos;
CREATE POLICY "Allow auth upload photos" ON public.photos FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow delete own photos" ON public.photos;
CREATE POLICY "Allow delete own photos" ON public.photos FOR DELETE USING (auth.uid() = owner_id);

-- Notifications Policies
DROP POLICY IF EXISTS "Allow users to read own notifications" ON public.notifications;
CREATE POLICY "Allow users to read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to insert notifications they originate" ON public.notifications;
CREATE POLICY "Allow users to insert notifications they originate" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (auth.uid() = from_user_id OR auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "Allow users to update own notifications" ON public.notifications;
CREATE POLICY "Allow users to update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete own notifications" ON public.notifications;
CREATE POLICY "Allow users to delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- Bookmarks Policies
DROP POLICY IF EXISTS "Allow user to manage own bookmarks" ON public.bookmarks;
CREATE POLICY "Allow user to manage own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id);

-- Stories Policies
DROP POLICY IF EXISTS "Allow public read stories" ON public.stories;
CREATE POLICY "Allow public read stories" ON public.stories FOR SELECT USING (expires_at > now());

DROP POLICY IF EXISTS "Allow auth insert stories" ON public.stories;
CREATE POLICY "Allow auth insert stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete own stories" ON public.stories;
CREATE POLICY "Allow delete own stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Story Likes Policies
DROP POLICY IF EXISTS "Allow public read story_likes" ON public.story_likes;
CREATE POLICY "Allow public read story_likes" ON public.story_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow auth insert story_likes" ON public.story_likes;
CREATE POLICY "Allow auth insert story_likes" ON public.story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete own story_likes" ON public.story_likes;
CREATE POLICY "Allow delete own story_likes" ON public.story_likes FOR DELETE USING (auth.uid() = user_id);

-- Community News Policies
DROP POLICY IF EXISTS "community_news_read_members" ON public.community_news;
CREATE POLICY "community_news_read_members" ON public.community_news
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = community_news.community_id
        AND gm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = community_news.community_id
        AND g.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "community_news_write_owner" ON public.community_news;
CREATE POLICY "community_news_write_owner" ON public.community_news
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = community_news.community_id
        AND g.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = community_news.community_id
        AND g.owner_id = auth.uid()
    )
  );


-- ==========================================
-- DATABASE CONSTRAINTS
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comments_content_length_check'
  ) THEN
    ALTER TABLE public.comments ADD CONSTRAINT comments_content_length_check CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_content_or_image_required_check'
  ) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_content_or_image_required_check CHECK (
      (content IS NOT NULL AND char_length(btrim(content)) BETWEEN 1 AND 4000)
      OR image_url IS NOT NULL
    );
  END IF;
END $$;


-- ==========================================
-- AUTOMATION TRIGGERS & FUNCTIONS
-- ==========================================

-- 1. Trigger function: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_num_id int;
BEGIN
  v_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  
  IF lower(v_username) = 'viht' AND lower(new.email) != 'anviht@yandex.ru' THEN
    RAISE EXCEPTION 'Username "viht" is reserved for the creator.';
  END IF;

  IF v_username = 'viht' THEN
    v_num_id := 1;
  ELSE
    v_num_id := nextval('public.profiles_num_id_seq');
  END IF;

  INSERT INTO public.profiles (id, username, full_name, avatar_url, cover_url, num_id)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || substr(md5(random()::text), 1, 5)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    null,
    null,
    v_num_id
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Trigger function: handle_new_message
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

DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message();

-- 3. Trigger function: handle_post_stats
CREATE OR REPLACE FUNCTION public.handle_post_stats()
RETURNS trigger AS $$
BEGIN
  IF tg_op = 'INSERT' AND tg_table_name = 'post_likes' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = new.post_id;
  ELSIF tg_op = 'DELETE' AND tg_table_name = 'post_likes' THEN
    UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = old.post_id;
  ELSIF tg_op = 'INSERT' AND tg_table_name = 'comments' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = new.post_id;
  ELSIF tg_op = 'DELETE' AND tg_table_name = 'comments' THEN
    UPDATE public.posts SET comments_count = comments_count - 1 WHERE id = old.post_id;
  END IF;
  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_change ON public.post_likes;
CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_post_stats();

DROP TRIGGER IF EXISTS on_comment_change ON public.comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_post_stats();

-- 4. Trigger function: handle_poll_vote_change
CREATE OR REPLACE FUNCTION public.handle_poll_vote_change()
RETURNS trigger AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.poll_options SET votes_count = votes_count + 1 WHERE id = new.option_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.poll_options SET votes_count = votes_count - 1 WHERE id = old.option_id;
  END IF;
  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_poll_vote_change ON public.poll_votes;
CREATE TRIGGER on_poll_vote_change
  AFTER INSERT OR DELETE ON public.poll_votes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_poll_vote_change();

-- 5. Trigger function: sync_group_members_count
CREATE OR REPLACE FUNCTION public.sync_group_members_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups
      SET members_count = (SELECT COUNT(*) FROM public.group_members WHERE group_id = NEW.group_id)
      WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups
      SET members_count = (SELECT COUNT(*) FROM public.group_members WHERE group_id = OLD.group_id)
      WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_group_members_count ON public.group_members;
CREATE TRIGGER trg_sync_group_members_count
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_group_members_count();

-- 6. Trigger function: handle_comment_stats (comment likes count)
CREATE OR REPLACE FUNCTION public.handle_comment_stats()
RETURNS trigger AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.comments SET likes_count = likes_count + 1 WHERE id = new.comment_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.comments SET likes_count = likes_count - 1 WHERE id = old.comment_id;
  END IF;
  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_like_change ON public.comment_likes;
CREATE TRIGGER on_comment_like_change
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_comment_stats();

-- 7. Trigger function: handle_story_like_change
CREATE OR REPLACE FUNCTION public.handle_story_like_change()
RETURNS trigger AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.stories SET likes_count = likes_count + 1 WHERE id = new.story_id;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.stories SET likes_count = GREATEST(0, likes_count - 1) WHERE id = old.story_id;
  END IF;
  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_story_like_change ON public.story_likes;
CREATE TRIGGER on_story_like_change
  AFTER INSERT OR DELETE ON public.story_likes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_story_like_change();

-- 8. Story View Increment Helper
CREATE OR REPLACE FUNCTION public.increment_story_views(story_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.stories
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = story_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Story Purge Helper
CREATE OR REPLACE FUNCTION public.purge_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM public.stories
  WHERE expires_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Role Management RPCs
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


-- ==========================================
-- REALTIME REPLICATION CONFIGURATION
-- ==========================================
DO $$
BEGIN
  -- Create publication if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to realtime publication safely
DO $$
DECLARE
  v_tables text[] := ARRAY['messages', 'notifications', 'poll_votes', 'poll_options', 'comment_likes', 'comments', 'posts', 'post_likes', 'stories', 'conversations', 'group_members', 'profiles', 'groups'];
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END $$;


-- ==========================================
-- STORAGE BUCKETS & POLICIES SETUP
-- ==========================================

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('covers', 'covers', true),
  ('posts-media', 'posts-media', true),
  ('photos', 'photos', true),
  ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Avatars Bucket Policies
DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
CREATE POLICY "Public Read Avatars" ON storage.objects 
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Auth Upload Avatars" ON storage.objects;
CREATE POLICY "Auth Upload Avatars" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Update Avatars" ON storage.objects;
CREATE POLICY "Auth Update Avatars" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 2. Covers Bucket Policies
DROP POLICY IF EXISTS "Public Read Covers" ON storage.objects;
CREATE POLICY "Public Read Covers" ON storage.objects 
  FOR SELECT USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Auth Upload Covers" ON storage.objects;
CREATE POLICY "Auth Upload Covers" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Update Covers" ON storage.objects;
CREATE POLICY "Auth Update Covers" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');

-- 3. Posts-Media Bucket Policies
DROP POLICY IF EXISTS "Public Read Posts-Media" ON storage.objects;
CREATE POLICY "Public Read Posts-Media" ON storage.objects 
  FOR SELECT USING (bucket_id = 'posts-media');

DROP POLICY IF EXISTS "Auth Upload Posts-Media" ON storage.objects;
CREATE POLICY "Auth Upload Posts-Media" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'posts-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Manage Own Posts-Media" ON storage.objects;
CREATE POLICY "Auth Manage Own Posts-Media" ON storage.objects 
  FOR ALL USING (bucket_id = 'posts-media' AND auth.role() = 'authenticated');

-- 4. Photos Bucket Policies
DROP POLICY IF EXISTS "Public Read Photos" ON storage.objects;
CREATE POLICY "Public Read Photos" ON storage.objects 
  FOR SELECT USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Auth Upload Photos" ON storage.objects;
CREATE POLICY "Auth Upload Photos" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Manage Own Photos" ON storage.objects;
CREATE POLICY "Auth Manage Own Photos" ON storage.objects 
  FOR ALL USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- 5. Chat-Media Bucket Policies
DROP POLICY IF EXISTS "Public Read Chat-Media" ON storage.objects;
CREATE POLICY "Public Read Chat-Media" ON storage.objects 
  FOR SELECT USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Auth Upload Chat-Media" ON storage.objects;
CREATE POLICY "Auth Upload Chat-Media" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Manage Own Chat-Media" ON storage.objects;
CREATE POLICY "Auth Manage Own Chat-Media" ON storage.objects 
  FOR ALL USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');


-- ==========================================
-- PROFILE USERNAME SECURITY CONSTRAINT
-- ==========================================

-- Trigger to prevent hijacking the 'viht' username on profile inserts/updates
CREATE OR REPLACE FUNCTION public.check_profile_username()
RETURNS trigger AS $$
DECLARE
  v_email text;
BEGIN
  -- Get the user's email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = new.id;
  
  IF lower(new.username) = 'viht' AND lower(v_email) != 'anviht@yandex.ru' THEN
    RAISE EXCEPTION 'Username "viht" is reserved for the creator.';
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_profile_username ON public.profiles;
CREATE TRIGGER trg_check_profile_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_username();


-- ==========================================
-- AUTOMATIC NOTIFICATIONS TRIGGERS
-- ==========================================

-- 1. Post Likes notifications trigger
CREATE OR REPLACE FUNCTION public.handle_post_like_notification()
RETURNS trigger AS $$
DECLARE
  v_author_id uuid;
BEGIN
  IF tg_op = 'INSERT' THEN
    SELECT author_id INTO v_author_id FROM public.posts WHERE id = new.post_id;
    IF v_author_id IS NOT NULL AND v_author_id != new.user_id THEN
      INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
      VALUES (v_author_id, 'like', new.user_id, new.post_id)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF tg_op = 'DELETE' THEN
    SELECT author_id INTO v_author_id FROM public.posts WHERE id = old.post_id;
    IF v_author_id IS NOT NULL THEN
      DELETE FROM public.notifications 
      WHERE user_id = v_author_id 
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

-- 2. Post Comments notifications trigger
CREATE OR REPLACE FUNCTION public.handle_comment_notification()
RETURNS trigger AS $$
DECLARE
  v_author_id uuid;
BEGIN
  IF tg_op = 'INSERT' THEN
    SELECT author_id INTO v_author_id FROM public.posts WHERE id = new.post_id;
    IF v_author_id IS NOT NULL AND v_author_id != new.author_id THEN
      INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
      VALUES (v_author_id, 'comment', new.author_id, new.post_id)
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

-- 3. Friendship requests/acceptance notifications trigger
CREATE OR REPLACE FUNCTION public.handle_friendship_notification()
RETURNS trigger AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.status = 'pending' THEN
      INSERT INTO public.notifications (user_id, type, from_user_id)
      VALUES (new.addressee_id, 'friend_request', new.requester_id)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF tg_op = 'UPDATE' THEN
    IF old.status = 'pending' AND new.status = 'accepted' THEN
      -- Delete the pending request notification
      DELETE FROM public.notifications 
      WHERE user_id = new.addressee_id 
        AND type = 'friend_request' 
        AND from_user_id = new.requester_id;
        
      -- Insert friendship accepted notification
      INSERT INTO public.notifications (user_id, type, from_user_id)
      VALUES (new.requester_id, 'friend_accepted', new.addressee_id)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF tg_op = 'DELETE' THEN
    -- Clean up any notification between the two users
    DELETE FROM public.notifications 
    WHERE (user_id = old.addressee_id AND type = 'friend_request' AND from_user_id = old.requester_id)
       OR (user_id = old.requester_id AND type = 'friend_accepted' AND from_user_id = old.addressee_id);
  END IF;
  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_friendship_notification ON public.friendships;
CREATE TRIGGER trg_friendship_notification
  AFTER INSERT OR UPDATE OR DELETE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.handle_friendship_notification();

