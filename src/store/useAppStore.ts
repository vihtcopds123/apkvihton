import { create } from 'zustand'
import { supabase } from '../supabaseClient'

let recountTimer: any = null

export type StoryType = 'feed' | 'messages' | 'profile' | 'friends' | 'groups' | 'notifications' | 'settings' | 'bookmarks' | 'about' | 'support' | 'download' | 'music' | 'balance'

export let globalNavigate: ((path: string, options?: any) => void) | null = null

export const setGlobalNavigate = (nav: (path: string, options?: any) => void) => {
  globalNavigate = nav
}

const navigateTo = (path: string) => {
  if (globalNavigate && window.location.pathname !== path) {
    globalNavigate(path)
  }
}

export interface MenuItemConfig {
  story: 'profile' | 'messages' | 'friends' | 'groups' | 'feed' | 'bookmarks'
  label: string
  visible: boolean
}

export const DEFAULT_MENU_ITEMS: MenuItemConfig[] = [
  { story: 'profile', label: 'Моя страница', visible: true },
  { story: 'messages', label: 'Сообщения', visible: true },
  { story: 'friends', label: 'Друзья', visible: true },
  { story: 'groups', label: 'Сообщества', visible: true },
  { story: 'feed', label: 'Новости', visible: true },
  { story: 'bookmarks', label: 'Закладки', visible: true }
]

interface AppState {
  activeStory: StoryType
  activePanel: string
  selectedChatId: string | null
  selectedChatParticipant: {
    id: string
    full_name: string | null
    avatar_url: string | null
    is_online: boolean
    username?: string | null
    num_id?: number | null
    last_seen?: string | null
    role?: string | null
    status_preference?: string | null
    is_group?: boolean
    group_name?: string | null
    group_avatar_url?: string | null
    created_by?: string | null
    members_count?: number
    avatar_decoration?: string | null
    profile_decoration?: string | null
  } | null
  selectedGroupId: string | null
  selectedProfileId: string | null
  unreadMessagesCount: number
  unreadNotificationsCount: number
  theme: 'light' | 'dark'
  menuItems: MenuItemConfig[]
  
  setStory: (story: StoryType) => void
  setPanel: (panel: string) => void
  selectChat: (chatId: string | null, participant?: { id: string; full_name: string | null; avatar_url: string | null; is_online: boolean; username?: string | null; num_id?: number | null; last_seen?: string | null; role?: string | null; status_preference?: string | null; is_group?: boolean; group_name?: string | null; group_avatar_url?: string | null; created_by?: string | null; members_count?: number; avatar_decoration?: string | null; profile_decoration?: string | null } | null) => void
  selectGroup: (groupId: string | null, groupUsername?: string | null) => void
  selectProfile: (profileId: string | null) => void
  setUnreadMessagesCount: (count: number) => void
  recountUnreadMessages: (userId: string) => void
  setUnreadNotificationsCount: (count: number) => void
  resetNavigation: () => void
  toggleTheme: () => void
  loadMenuItems: (userId: string) => void
  setMenuItems: (items: MenuItemConfig[], userId: string) => void
  mutedUserIds: Set<string>
  blockedUserIds: Set<string>
  blockedByUserIds: Set<string>
  fetchMutesAndBlocks: (userId: string) => Promise<void>
  toggleMuteUser: (myId: string, targetId: string) => Promise<void>
  toggleBlockUser: (myId: string, targetId: string) => Promise<void>
  conversationsCache: any[]
  messagesCache: Record<string, any[]>
  profilesCache: Record<string, any>
  postsCache: Record<string, any[]>
  statsCache: Record<string, any>
  memberTags: Record<string, { text: string; color: string }>
  setConversationsCache: (convs: any[]) => void
  setMessagesCache: (chatId: string, msgs: any[]) => void
  setProfileCache: (userId: string, data: any) => void
  setPostsCache: (userId: string, posts: any[]) => void
  setStatsCache: (userId: string, stats: any) => void
  setMemberTag: (chatId: string, userId: string, tag: { text: string; color: string } | null) => void
  getMemberTag: (chatId: string, userId: string) => { text: string; color: string } | null
  openStickerPackCode: string | null
  setOpenStickerPackCode: (code: string | null) => void
  showAttachmentsDrawer: boolean
  setShowAttachmentsDrawer: (show: boolean) => void
  showChannelInfo: boolean
  setShowChannelInfo: (show: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => {
  const initialStory = (localStorage.getItem('vh_activeStory') as StoryType) || 'feed'
  const initialPanel = localStorage.getItem('vh_activePanel') || 'main'
  const initialChatId = localStorage.getItem('vh_selectedChatId') || null
  const initialParticipant = localStorage.getItem('vh_selectedChatParticipant')
    ? JSON.parse(localStorage.getItem('vh_selectedChatParticipant')!)
    : null
  const initialGroupId = localStorage.getItem('vh_selectedGroupId') || null
  const initialProfileId = localStorage.getItem('vh_selectedProfileId') || null
  let initialTheme: 'light' | 'dark' = 'light'
  try {
    const local = localStorage.getItem('vh_theme')
    if (local === 'light' || local === 'dark') {
      initialTheme = local
    } else {
      const match = document.cookie.match(/(?:^|; )vh_theme=(light|dark)/)
      if (match) initialTheme = match[1] as 'light' | 'dark'
    }
  } catch (e) {}

  // Apply theme on load
  document.documentElement.setAttribute('data-theme', initialTheme)

  return {
    activeStory: initialStory,
    activePanel: initialPanel,
    selectedChatId: initialChatId,
    selectedChatParticipant: initialParticipant,
    selectedGroupId: initialGroupId,
    selectedProfileId: initialProfileId,
    unreadMessagesCount: 0,
    unreadNotificationsCount: 0,
    theme: initialTheme,
    menuItems: [...DEFAULT_MENU_ITEMS],
    mutedUserIds: new Set<string>(),
    blockedUserIds: new Set<string>(),
    blockedByUserIds: new Set<string>(),
    conversationsCache: [],
    messagesCache: {},
    profilesCache: {},
    postsCache: {},
    statsCache: {},
    memberTags: JSON.parse(localStorage.getItem('vh_memberTags') || '{}'),
    openStickerPackCode: null,
    setOpenStickerPackCode: (code) => set({ openStickerPackCode: code }),
    showAttachmentsDrawer: false,
    setShowAttachmentsDrawer: (show) => set({ showAttachmentsDrawer: show }),
    showChannelInfo: false,
    setShowChannelInfo: (show) => set({ showChannelInfo: show }),
    setConversationsCache: (convs) => set({ conversationsCache: convs }),
    setMessagesCache: (chatId, msgs) => set(state => ({
      messagesCache: {
        ...state.messagesCache,
        [chatId]: msgs
      }
    })),
    setProfileCache: (userId, data) => set(state => ({
      profilesCache: {
        ...state.profilesCache,
        [userId]: data
      }
    })),
    setPostsCache: (userId, posts) => set(state => ({
      postsCache: {
        ...state.postsCache,
        [userId]: posts
      }
    })),
    setStatsCache: (userId, stats) => set(state => ({
      statsCache: {
        ...state.statsCache,
        [userId]: stats
      }
    })),
    setMemberTag: (chatId, userId, tag) => {
      const key = `${chatId}:${userId}`
      const current = { ...get().memberTags }
      if (tag) current[key] = tag
      else delete current[key]
      localStorage.setItem('vh_memberTags', JSON.stringify(current))
      set({ memberTags: current })
    },
    getMemberTag: (chatId, userId) => {
      const key = `${chatId}:${userId}`
      return get().memberTags[key] || null
    },

    setStory: (story) => {
      localStorage.setItem('vh_activeStory', story)
      localStorage.setItem('vh_activePanel', 'main')
      localStorage.removeItem('vh_selectedChatId')
      localStorage.removeItem('vh_selectedChatParticipant')
      localStorage.removeItem('vh_selectedGroupId')
      localStorage.removeItem('vh_selectedProfileId')
      set({ activeStory: story, activePanel: 'main', selectedChatId: null, selectedGroupId: null, selectedProfileId: null })

      const getStoryMainPath = (s: string) => {
        if (s === 'feed') return '/news'
        if (s === 'friends') return '/friends'
        if (s === 'settings') return '/settings'
        if (s === 'messages') return '/im'
        if (s === 'bookmarks') return '/bookmarks'
        if (s === 'groups') return '/groups'
        if (s === 'notifications') return '/notifications'
        if (s === 'about') return '/about'
        if (s === 'support') return '/support'
        if (s === 'download') return '/download'
        if (s === 'profile') return '/profile'
        if (s === 'music') return '/music'
        if (s === 'balance') return null  // balance has no fixed URL path
        return '/news'
      }
      const path = getStoryMainPath(story)
      if (path) navigateTo(path)
    },
    setPanel: (panel) => {
      localStorage.setItem('vh_activePanel', panel)
      set({ activePanel: panel })

      if (panel === 'main') {
        const story = get().activeStory
        const getStoryMainPath = (s: string) => {
          if (s === 'feed') return '/news'
          if (s === 'friends') return '/friends'
          if (s === 'settings') return '/settings'
          if (s === 'messages') return '/im'
          if (s === 'bookmarks') return '/bookmarks'
          if (s === 'groups') return '/groups'
          if (s === 'notifications') return '/notifications'
          if (s === 'about') return '/about'
          if (s === 'support') return '/support'
          if (s === 'download') return '/download'
          if (s === 'profile') return '/profile'
          if (s === 'music') return '/music'
          if (s === 'balance') return null
          return '/news'
        }
        const path = getStoryMainPath(story)
        if (path) navigateTo(path)
      }
    },
    selectChat: (chatId, participant = null) => {
      if (chatId) {
        localStorage.setItem('vh_selectedChatId', chatId)
        if (participant) {
          localStorage.setItem('vh_selectedChatParticipant', JSON.stringify(participant))
        } else {
          localStorage.removeItem('vh_selectedChatParticipant')
        }
        localStorage.setItem('vh_activeStory', 'messages')
        localStorage.setItem('vh_activePanel', 'chat_detail')
        set({
          selectedChatId: chatId,
          selectedChatParticipant: participant,
          activeStory: 'messages',
          activePanel: 'chat_detail'
        })
        const param = participant?.username || (participant?.num_id ? `vid${participant.num_id}` : chatId)
        navigateTo(`/im/${param}`)
      } else {
        localStorage.removeItem('vh_selectedChatId')
        localStorage.removeItem('vh_selectedChatParticipant')
        localStorage.setItem('vh_activePanel', 'main')
        set({
          selectedChatId: null,
          selectedChatParticipant: null,
          activePanel: 'main'
        })
        navigateTo('/im')
      }
    },
    selectGroup: async (groupId, groupUsername) => {
      if (groupId) {
        localStorage.setItem('vh_selectedGroupId', groupId)
        localStorage.setItem('vh_activeStory', 'groups')
        localStorage.setItem('vh_activePanel', 'group_detail')
        set({
          selectedGroupId: groupId,
          activeStory: 'groups',
          activePanel: 'group_detail',
          showChannelInfo: false
        })
        
        if (groupUsername) {
          navigateTo(`/gr/${groupUsername.toLowerCase()}`)
        } else {
          try {
            const { data } = await supabase
              .from('groups')
              .select('username')
              .eq('id', groupId)
              .maybeSingle()
            if (data?.username) {
              navigateTo(`/gr/${data.username.toLowerCase()}`)
            } else {
              navigateTo(`/groups/${groupId}`)
            }
          } catch (e) {
            navigateTo(`/groups/${groupId}`)
          }
        }
      } else {
        localStorage.removeItem('vh_selectedGroupId')
        localStorage.setItem('vh_activePanel', 'main')
        set({
          selectedGroupId: null,
          activePanel: 'main',
          showChannelInfo: false
        })
        navigateTo('/groups')
      }
    },
    selectProfile: (profileId) => {
      if (profileId) {
        localStorage.setItem('vh_selectedProfileId', profileId)
        localStorage.setItem('vh_activeStory', 'profile')
        localStorage.setItem('vh_activePanel', 'main')
        set({
          selectedProfileId: profileId,
          activeStory: 'profile',
          activePanel: 'main'
        })
        const profile = get().profilesCache[profileId]
        const param = profile?.username || (profile?.num_id ? `vid${profile.num_id}` : profileId)
        navigateTo(`/profile/${param}`)
      } else {
        localStorage.removeItem('vh_selectedProfileId')
        localStorage.setItem('vh_activePanel', 'main')
        set({
          selectedProfileId: null,
          activePanel: 'main'
        })
        navigateTo('/profile')
      }
    },
    setUnreadMessagesCount: (count) => set({ unreadMessagesCount: count }),
    recountUnreadMessages: (userId) => {
      if (!userId) return
      if (recountTimer) clearTimeout(recountTimer)
      recountTimer = setTimeout(async () => {
        try {
          // 1. Get active direct conversations (not deleted by user)
          const { data: direct } = await supabase
            .from('conversations')
            .select('id')
            .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
            .eq('is_group', false)
            .not('deleted_by', 'cs', `{${userId}}`)

          // 2. Get group conversations the user is member of (not deleted by user)
          const { data: memberOf } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', userId)

          let groups: any[] = []
          if (memberOf && memberOf.length > 0) {
            const { data: groupData } = await supabase
              .from('conversations')
              .select('id')
              .eq('is_group', true)
              .in('id', memberOf.map(m => m.conversation_id))
              .not('deleted_by', 'cs', `{${userId}}`)
            if (groupData) groups = groupData
          }

          const activeConvIds = [
            ...(direct || []).map(c => c.id),
            ...groups.map(c => c.id)
          ]

          if (activeConvIds.length > 0) {
            let totalUnread = 0
            const batchSize = 10
            for (let i = 0; i < activeConvIds.length; i += batchSize) {
              const batch = activeConvIds.slice(i, i + batchSize)
              const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .in('conversation_id', batch)
                .neq('sender_id', userId)
                .eq('is_read', false)
              totalUnread += (count || 0)
            }
            set({ unreadMessagesCount: totalUnread })
          } else {
            set({ unreadMessagesCount: 0 })
          }
        } catch (err) {
          console.warn('Debounced unread count query failed:', err)
        }
      }, 300)
    },
    setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),
    resetNavigation: () => {
      localStorage.setItem('vh_activeStory', 'feed')
      localStorage.setItem('vh_activePanel', 'main')
      localStorage.removeItem('vh_selectedChatId')
      localStorage.removeItem('vh_selectedChatParticipant')
      localStorage.removeItem('vh_selectedGroupId')
      localStorage.removeItem('vh_selectedProfileId')
      set({
        activeStory: 'feed',
        activePanel: 'main',
        selectedChatId: null,
        selectedChatParticipant: null,
        selectedGroupId: null,
        selectedProfileId: null,
        conversationsCache: [],
        messagesCache: {}
      })
      navigateTo('/news')
    },

    toggleTheme: () => {
      const newTheme = get().theme === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem('vh_theme', newTheme)
      } catch (e) {}
      document.cookie = `vh_theme=${newTheme};path=/;max-age=315360000;SameSite=Lax;Secure`
      document.documentElement.setAttribute('data-theme', newTheme)
      set({ theme: newTheme })
    },
    loadMenuItems: (userId) => {
      const stored = localStorage.getItem(`vihton_menu_config_${userId}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as MenuItemConfig[]
          let hasMissing = false
          const merged = DEFAULT_MENU_ITEMS.map(defItem => {
            const userItem = parsed.find(p => p.story === defItem.story)
            if (!userItem) {
              hasMissing = true
            }
            return {
              ...defItem,
              visible: userItem ? userItem.visible : defItem.visible
            }
          })
          
          merged.sort((a, b) => {
            const idxA = parsed.findIndex(p => p.story === a.story)
            const idxB = parsed.findIndex(p => p.story === b.story)
            
            if (idxA !== -1 && idxB !== -1) {
              return idxA - idxB
            }
            if (idxA !== -1) return -1
            if (idxB !== -1) return 1
            
            const defIdxA = DEFAULT_MENU_ITEMS.findIndex(p => p.story === a.story)
            const defIdxB = DEFAULT_MENU_ITEMS.findIndex(p => p.story === b.story)
            return defIdxA - defIdxB
          })
          
          set({ menuItems: merged })
          
          if (hasMissing) {
            localStorage.setItem(`vihton_menu_config_${userId}`, JSON.stringify(merged))
          }
          return
        } catch (e) {
          console.error('Error loading menu items:', e)
        }
      }
      set({ menuItems: [...DEFAULT_MENU_ITEMS] })
    },
    setMenuItems: (items, userId) => {
      localStorage.setItem(`vihton_menu_config_${userId}`, JSON.stringify(items))
      set({ menuItems: items })
    },
    fetchMutesAndBlocks: async (userId) => {
      try {
        const { data, error } = await supabase
          .from('chat_blocks_mutes')
          .select('target_user_id, is_muted, is_blocked')
          .eq('user_id', userId)
        
        if (error) throw error
        
        const { data: blockedByData } = await supabase
          .from('chat_blocks_mutes')
          .select('user_id')
          .eq('target_user_id', userId)
          .eq('is_blocked', true)

        const mutes = new Set<string>()
        const blocks = new Set<string>()
        if (data) {
          data.forEach(item => {
            if (item.is_muted) mutes.add(item.target_user_id)
            if (item.is_blocked) blocks.add(item.target_user_id)
          })
        }
        
        const blockedBy = new Set<string>()
        if (blockedByData) {
          blockedByData.forEach(item => {
            blockedBy.add(item.user_id)
          })
        }

        set({
          mutedUserIds: mutes,
          blockedUserIds: blocks,
          blockedByUserIds: blockedBy
        })
      } catch (err) {
        console.error('Error fetching mutes and blocks:', err)
      }
    },
    toggleMuteUser: async (myId, targetId) => {
      if (targetId === '00000000-0000-0000-0000-000000000000') return;
      const { mutedUserIds } = get()
      const isMuted = mutedUserIds.has(targetId)
      
      try {
        const { error } = await supabase
          .from('chat_blocks_mutes')
          .upsert({
            user_id: myId,
            target_user_id: targetId,
            is_muted: !isMuted
          }, { onConflict: 'user_id,target_user_id' })
        
        if (error) throw error
        
        const next = new Set(mutedUserIds)
        if (isMuted) next.delete(targetId)
        else next.add(targetId)
        set({ mutedUserIds: next })
      } catch (err) {
        console.error('Error toggling mute:', err)
      }
    },
    toggleBlockUser: async (myId, targetId) => {
      if (targetId === '00000000-0000-0000-0000-000000000000') return;
      const { blockedUserIds } = get()
      const isBlocked = blockedUserIds.has(targetId)
      
      try {
        const { error } = await supabase
          .from('chat_blocks_mutes')
          .upsert({
            user_id: myId,
            target_user_id: targetId,
            is_blocked: !isBlocked
          }, { onConflict: 'user_id,target_user_id' })
        
        if (error) throw error

        if (!isBlocked) {
          // If blocking, delete them from friends
          await supabase
            .from('friendships')
            .delete()
            .or(`and(requester_id.eq.${myId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${myId})`)
        }
        
        const next = new Set(blockedUserIds)
        if (isBlocked) next.delete(targetId)
        else next.add(targetId)
        set({ blockedUserIds: next })
      } catch (err) {
        console.error('Error toggling block:', err)
      }
    }
  }
})
