import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  username: string | null
  role: string | null
  roles?: string[]
  bio?: string | null
  city?: string | null
  birth_date?: string | null
  status_preference?: string | null
  status?: string | null
  num_id?: number | null
  is_online?: boolean
  last_seen?: string | null
  cover_url?: string | null
  emoji_status?: string | null
  avatar_decoration?: string | null
  profile_decoration?: string | null
  created_at?: string | null
  allow_wall_posts?: boolean | null
  listening_to?: any | null
  hide_music?: boolean | null
}

export const useProfile = (targetId: string | undefined) => {
  return useQuery({
    queryKey: ['profile', targetId],
    queryFn: async () => {
      if (!targetId) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single()

      if (error) throw error
      return data as Profile
    },
    enabled: !!targetId,
  })
}

export const useProfilePosts = (targetId: string | undefined) => {
  return useQuery({
    queryKey: ['profile-posts', targetId],
    queryFn: async () => {
      if (!targetId) return []
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, emoji_status, avatar_decoration),
          audio:music_tracks(id, title, artist, duration, file_url, cover_url),
          repost_source:repost_source_id(
            *,
            author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, emoji_status, avatar_decoration),
            group:groups(id, name, avatar_url),
            audio:music_tracks(id, title, artist, duration, file_url, cover_url)
          ),
          poll:polls(
            id,
            question,
            options:poll_options(
              id,
              poll_id,
              text,
              votes_count
            )
          )
        `)
        .or(`wall_id.eq.${targetId},and(wall_id.is.null,author_id.eq.${targetId})`)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data && data.length > 0) {
        const postIds = data.map((p: any) => p.id)
        try {
          await supabase.rpc('increment_post_views', { post_ids: postIds })
        } catch (_) { /* ignore RPC errors */ }
        
        return data.map((p: any) => ({
          ...p,
          views_count: (p.views_count || 0) + 1
        }))
      }

      return data || []
    },
    enabled: !!targetId,
  })
}

export const useFeedPosts = (profileId: string | undefined) => {
  return useQuery({
    queryKey: ['feed-posts', profileId],
    queryFn: async () => {
      // 1. Fetch user's group subscriptions
      let myGroupIds: string[] = []
      if (profileId) {
        const { data: subs } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', profileId)
        if (subs) {
          myGroupIds = subs.map(s => s.group_id)
        }
      }

      // 2. Fetch posts
      let query = supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, emoji_status, avatar_decoration),
          audio:music_tracks(id, title, artist, duration, file_url, cover_url),
          repost_source:repost_source_id(
            *,
            author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, emoji_status, avatar_decoration),
            group:groups(id, name, avatar_url),
            audio:music_tracks(id, title, artist, duration, file_url, cover_url)
          ),
          group:groups(id, name, avatar_url),
          poll:polls(
            id,
            question,
            options:poll_options(
              id,
              poll_id,
              text,
              votes_count
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (myGroupIds.length > 0) {
        query = query.or(`group_id.is.null,group_id.in.(${myGroupIds.join(',')})`)
      } else {
        query = query.is('group_id', null)
      }

      const { data, error } = await query
      if (error) throw error

      if (data) {
        const filteredPosts = (data as any[]).filter(
          p => p.group_id !== null || p.wall_id === null || p.wall_id === p.author_id
        )

        if (filteredPosts.length > 0) {
          const postIds = filteredPosts.map(p => p.id)
          try {
            await supabase.rpc('increment_post_views', { post_ids: postIds })
          } catch (_) { /* ignore RPC errors */ }

          return filteredPosts.map(p => ({
            ...p,
            views_count: (p.views_count || 0) + 1
          }))
        }
        return filteredPosts
      }
      return []
    },
    enabled: !!profileId,
  })
}

export const useStories = () => {
  return useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      // Purge expired stories
      try {
        await supabase.rpc('purge_expired_stories')
      } catch (_) {}

      const { data, error } = await supabase
        .from('stories')
        .select('*, author:profiles(id, full_name, avatar_url, avatar_decoration)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    },
  })
}

export const useFriendship = (myId: string | undefined, targetId: string | undefined) => {
  return useQuery({
    queryKey: ['friendship', myId, targetId],
    queryFn: async () => {
      if (!myId || !targetId || myId === targetId) return null
      const { data } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${myId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${myId})`)
        .maybeSingle()
      return data || null
    },
    enabled: !!myId && !!targetId && myId !== targetId,
  })
}

export const useProfileFriends = (targetId: string | undefined) => {
  return useQuery({
    queryKey: ['profile-friends', targetId],
    queryFn: async () => {
      if (!targetId) return []
      const { data: friendshipsData, error: fErr } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${targetId},addressee_id.eq.${targetId}`)

      if (fErr) throw fErr
      const friendIds = (friendshipsData || []).map((f: any) => f.requester_id === targetId ? f.addressee_id : f.requester_id)

      if (friendIds.length > 0) {
        const { data: profilesData, error: pErr } = await supabase
          .from('profiles')
          .select('*')
          .in('id', friendIds)
          .limit(18)
        if (pErr) throw pErr
        return profilesData || []
      }
      return []
    },
    enabled: !!targetId,
  })
}

export const useProfileStats = (targetId: string | undefined) => {
  return useQuery({
    queryKey: ['profile-stats', targetId],
    queryFn: async () => {
      if (!targetId) return null
      // Profile views
      const { count: profileViewsCount } = await supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', targetId)
      const profileViews = profileViewsCount || 0

      // Likes given
      const { count: likesGiven } = await supabase
        .from('post_likes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetId)

      // Likes received
      const { data: userPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('author_id', targetId)
      const userPostIds = userPosts?.map(p => p.id) || []
      
      let likesReceived = 0
      if (userPostIds.length > 0) {
        const { count } = await supabase
          .from('post_likes')
          .select('id', { count: 'exact', head: true })
          .in('post_id', userPostIds)
        likesReceived = count || 0
      }

      // Comments given
      const { count: commentsGiven } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', targetId)

      // Comments received
      let commentsReceived = 0
      if (userPostIds.length > 0) {
        const { count } = await supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .in('post_id', userPostIds)
        commentsReceived = count || 0
      }

      const { count: postsCount } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', targetId)

      return {
        profileViews,
        postsCount: postsCount || 0,
        likesGiven: likesGiven || 0,
        likesReceived,
        commentsGiven: commentsGiven || 0,
        commentsReceived
      }
    },
    enabled: !!targetId,
  })
}
