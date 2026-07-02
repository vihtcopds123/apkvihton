import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  Panel,
  PanelHeader,
  Group,
  SimpleCell,
  Button,
  Tabs,
  TabsItem,
  Box,
  Search
} from '@vkontakte/vkui'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import type { Profile } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { AdminBadge } from '../components/AdminBadge'
import { CustomAvatar } from '../components/CustomAvatar'

interface FriendsPanelProps {
  id: string
}

type TabType = 'my_friends' | 'find_people' | 'requests' | 'blacklist'

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

const TAG_COLORS = [
  '#0077ff', '#5856d6', '#ff2d55', '#ff9500',
  '#34c759', '#00c7be', '#af52de', '#ff6b35'
]

const formatLastSeen = (profile: Profile): string => {
  if (profile.status_preference === 'offline') return 'скрыт статус'
  if (!profile.last_seen) return 'не в сети'
  const lastSeen = new Date(profile.last_seen)
  const now = new Date()
  const diffMs = now.getTime() - lastSeen.getTime()
  if (diffMs < ONLINE_THRESHOLD_MS) return 'в сети'
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffMin < 60) return `был(а) ${diffMin} мин. назад`
  if (diffH < 24) return `был(а) ${diffH} ч. назад`
  if (diffD === 1) return 'был(а) вчера'
  if (diffD < 7) return `был(а) ${diffD} дн. назад`
  return `был(а) ${lastSeen.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
}

interface ContextMenu {
  x: number
  y: number
  friend: Profile
}

interface FriendTag {
  text: string
  color: string
}

interface TagModalState {
  friend: Profile
  existingTag: FriendTag | null
}

const FRIEND_TAGS_KEY = 'vh_friend_tags'

function loadFriendTags(): Record<string, FriendTag> {
  try {
    return JSON.parse(localStorage.getItem(FRIEND_TAGS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveFriendTags(tags: Record<string, FriendTag>) {
  localStorage.setItem(FRIEND_TAGS_KEY, JSON.stringify(tags))
}

export const FriendsPanel: React.FC<FriendsPanelProps> = ({ id }) => {
  const { profile: myProfile } = useAuthStore()
  const { selectProfile, selectChat, toggleBlockUser, blockedUserIds } = useAppStore()

  const [activeTab, setActiveTab] = useState<TabType>('my_friends')
  const [friends, setFriends] = useState<Profile[]>([])
  const [requests, setRequests] = useState<{ id: string; requester: Profile }[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [processingTargetId, setProcessingTargetId] = useState<string | null>(null)
  const [friendshipStatuses, setFriendshipStatuses] = useState<Record<string, any>>({})

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Tags
  const [friendTags, setFriendTags] = useState<Record<string, FriendTag>>(loadFriendTags)
  const [tagModal, setTagModal] = useState<TagModalState | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [tagColor, setTagColor] = useState(TAG_COLORS[0])
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)

  const fetchFriendsAndData = async () => {
    if (!myProfile) return
    setLoading(true)
    try {
      const { data: reqFriends } = await supabase
        .from('friendships')
        .select('*, profile:profiles!friendships_addressee_id_fkey(*)')
        .eq('requester_id', myProfile.id)
        .eq('status', 'accepted')

      const { data: addFriends } = await supabase
        .from('friendships')
        .select('*, profile:profiles!friendships_requester_id_fkey(*)')
        .eq('addressee_id', myProfile.id)
        .eq('status', 'accepted')

      const friendsList: Profile[] = [
        ...(reqFriends || []).map((f: any) => f.profile),
        ...(addFriends || []).map((f: any) => f.profile)
      ].filter(Boolean) as Profile[]

      if (friendsList.length > 0) {
        const ids = friendsList.map(f => f.id)
        const { data: freshProfiles } = await supabase
          .from('profiles')
          .select('id, is_online, last_seen, status_preference')
          .in('id', ids)
        if (freshProfiles) {
          const freshMap: Record<string, any> = {}
          freshProfiles.forEach(p => { freshMap[p.id] = p })
          friendsList.forEach((f, i) => {
            const fresh = freshMap[f.id]
            if (fresh) {
              friendsList[i] = { ...f, is_online: fresh.is_online, last_seen: fresh.last_seen, status_preference: fresh.status_preference }
            }
          })
        }
      }

      setFriends(friendsList)

      const { data: reqData } = await supabase
        .from('friendships')
        .select('id, requester:profiles!friendships_requester_id_fkey(*)')
        .eq('addressee_id', myProfile.id)
        .eq('status', 'pending')
      setRequests((reqData || []).map((r: any) => ({ id: r.id, requester: r.requester })))

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', myProfile.id)
      setAllProfiles(profilesData || [])

      const { data: allFriendships } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${myProfile.id},addressee_id.eq.${myProfile.id}`)

      const statusMap: Record<string, any> = {}
      if (allFriendships) {
        allFriendships.forEach(f => {
          const targetId = f.requester_id === myProfile.id ? f.addressee_id : f.requester_id
          statusMap[targetId] = f
        })
      }
      setFriendshipStatuses(statusMap)
    } catch (err) {
      console.error('Error fetching friends data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFriendsAndData()
  }, [myProfile?.id, activeTab, blockedUserIds.size])

  useEffect(() => {
    if (blockedUserIds.size === 0 && activeTab === 'blacklist') {
      setActiveTab('my_friends')
    }
  }, [blockedUserIds.size, activeTab])

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [contextMenu])

  // Disable native context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.friends-list-item')) {
        e.preventDefault()
      }
    }
    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, friend: Profile) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, friend })
  }, [])

  const handleFriendAction = async (targetUserId: string) => {
    if (!myProfile) return
    if (processingTargetId === targetUserId) return

    const friendship = friendshipStatuses[targetUserId]

    if (friendship?.status === 'accepted' && !window.confirm('Удалить пользователя из друзей?')) return
    if (friendship?.status === 'pending' && friendship.requester_id === myProfile.id && !window.confirm('Отменить отправленную заявку в друзья?')) return

    setProcessingTargetId(targetUserId)
    try {
      if (!friendship) {
        const { data, error } = await supabase
          .from('friendships')
          .insert({ requester_id: myProfile.id, addressee_id: targetUserId, status: 'pending' })
          .select().single()
        if (error) throw error
        setFriendshipStatuses(prev => ({ ...prev, [targetUserId]: data }))
      } else if (friendship.status === 'pending' && friendship.addressee_id === myProfile.id) {
        const { data, error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', friendship.id)
          .select().single()
        if (error) throw error
        setFriendshipStatuses(prev => ({ ...prev, [targetUserId]: data }))
        fetchFriendsAndData()
      } else {
        const { error } = await supabase.from('friendships').delete().eq('id', friendship.id)
        if (error) throw error
        setFriendshipStatuses(prev => {
          const updated = { ...prev }
          delete updated[targetUserId]
          return updated
        })
        fetchFriendsAndData()
      }
    } catch (err) {
      console.error('Friend action error:', err)
    } finally {
      setProcessingTargetId(null)
    }
  }

  const removeFriend = async (friendId: string) => {
    const friendship = friendshipStatuses[friendId]
    if (!friendship) return
    if (!window.confirm('Удалить из друзей?')) return
    setProcessingTargetId(friendId)
    try {
      await supabase.from('friendships').delete().eq('id', friendship.id)
      setFriendshipStatuses(prev => {
        const updated = { ...prev }
        delete updated[friendId]
        return updated
      })
      fetchFriendsAndData()
    } catch (err) {
      console.error('Remove friend error:', err)
    } finally {
      setProcessingTargetId(null)
    }
  }

  const handleBlock = async (friend: Profile) => {
    if (!myProfile) return
    const isBlocked = blockedUserIds.has(friend.id)
    const confirmMsg = isBlocked
      ? `Разблокировать ${friend.full_name}?`
      : `Заблокировать ${friend.full_name}?`
    if (!window.confirm(confirmMsg)) return
    await toggleBlockUser(myProfile.id, friend.id)
    setContextMenu(null)
  }

  const handleOpenChat = async (friend: Profile) => {
    if (!myProfile) return
    setContextMenu(null)
    // Find or create conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${myProfile.id},participant_2.eq.${friend.id}),and(participant_1.eq.${friend.id},participant_2.eq.${myProfile.id})`)
      .single()

    let chatId = existing?.id
    if (!chatId) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ participant_1: myProfile.id, participant_2: friend.id })
        .select('id').single()
      chatId = created?.id
    }
    if (chatId) {
      selectChat(chatId, {
        id: friend.id,
        full_name: friend.full_name,
        avatar_url: friend.avatar_url,
        is_online: !!(friend as any).is_online,
        username: friend.username,
        num_id: (friend as any).num_id,
        last_seen: friend.last_seen,
        role: friend.role,
        status_preference: friend.status_preference,
        avatar_decoration: friend.avatar_decoration
      })
    }
  }

  const openTagModal = (friend: Profile) => {
    setContextMenu(null)
    setTagModal({ friend, existingTag: friendTags[friend.id] || null })
    setTagInput(friendTags[friend.id]?.text || '')
    setTagColor(friendTags[friend.id]?.color || TAG_COLORS[0])
  }

  const saveTag = () => {
    if (!tagModal) return
    const trimmed = tagInput.trim().replace(/^#/, '')
    const newTags = { ...friendTags }
    if (trimmed) {
      newTags[tagModal.friend.id] = { text: trimmed, color: tagColor }
    } else {
      delete newTags[tagModal.friend.id]
    }
    saveFriendTags(newTags)
    setFriendTags(newTags)
    setTagModal(null)
  }

  const removeTag = () => {
    if (!tagModal) return
    const newTags = { ...friendTags }
    delete newTags[tagModal.friend.id]
    saveFriendTags(newTags)
    setFriendTags(newTags)
    setTagModal(null)
    if (activeTagFilter === tagModal.friend.id) setActiveTagFilter(null)
  }

  // Collect all unique tags
  const allTags = Array.from(new Set(Object.values(friendTags).map(t => t.text)))

  const filteredFriends = friends.filter(p => {
    const matchSearch =
      (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false
    if (activeTagFilter) {
      const tag = friendTags[p.id]
      return tag?.text === activeTagFilter
    }
    return true
  })

  const filteredProfiles = allProfiles.filter(p =>
    (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const blockedUsers = allProfiles.filter(p => blockedUserIds.has(p.id))
  const filteredBlockedUsers = blockedUsers.filter(p =>
    (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Panel id={id}>
      <Box position="sticky" insetBlockStart={0} style={{ zIndex: 10 }}>
        <PanelHeader fixed={false} className="transparent-header" delimiter="none">
          Друзья
        </PanelHeader>
      </Box>

      <Tabs>
        <TabsItem id="tab-my_friends" selected={activeTab === 'my_friends'} onClick={() => setActiveTab('my_friends')} aria-controls="friends-tab-content">
          Мои друзья
        </TabsItem>
        <TabsItem id="tab-requests" selected={activeTab === 'requests'} onClick={() => setActiveTab('requests')} aria-controls="friends-tab-content">
          Заявки ({requests.length})
        </TabsItem>
        <TabsItem id="tab-find_people" selected={activeTab === 'find_people'} onClick={() => setActiveTab('find_people')} aria-controls="friends-tab-content">
          Поиск людей
        </TabsItem>
        {blockedUserIds.size > 0 && (
          <TabsItem id="tab-blacklist" selected={activeTab === 'blacklist'} onClick={() => setActiveTab('blacklist')} aria-controls="friends-tab-content">
            Черный список
          </TabsItem>
        )}
      </Tabs>

      <Search value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} after={null} />

      {/* Tag filter chips */}
      {activeTab === 'my_friends' && allTags.length > 0 && (
        <div className="friends-tag-filters">
          <button
            className={`friends-tag-chip ${!activeTagFilter ? 'active' : ''}`}
            onClick={() => setActiveTagFilter(null)}
          >
            Все
          </button>
          {allTags.map(tag => {
            const tagEntry = Object.values(friendTags).find(t => t.text === tag)
            return (
              <button
                key={tag}
                className={`friends-tag-chip ${activeTagFilter === tag ? 'active' : ''}`}
                style={{ '--tag-color': tagEntry?.color || '#0077ff' } as any}
                onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
              >
                #{tag}
              </button>
            )
          })}
        </div>
      )}

      <Group id="friends-tab-content">
        {loading ? (
          <Box className="prod-skeleton-list" style={{ padding: 12 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="prod-skeleton-item">
                <div className="prod-skeleton-avatar" />
                <div className="prod-skeleton-content">
                  <div className="prod-skeleton-line prod-skeleton-line--md" />
                  <div className="prod-skeleton-line prod-skeleton-line--sm" />
                </div>
              </div>
            ))}
          </Box>
        ) : activeTab === 'my_friends' ? (
          filteredFriends.length === 0 ? (
            <Box className="prod-empty-state-card">
              {activeTagFilter ? `Нет друзей с тегом #${activeTagFilter}` : 'Список друзей пока пуст'}
            </Box>
          ) : (
            filteredFriends.map(friend => (
              <div
                key={friend.id}
                className="friends-list-item"
                onContextMenu={(e) => handleContextMenu(e, friend)}
              >
                <SimpleCell
                  before={<CustomAvatar size={40} src={friend.avatar_url} name={friend.full_name} id={friend.id} decoration={friend.avatar_decoration} />}
                  subtitle={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{formatLastSeen(friend)}</span>
                      {friendTags[friend.id] && (
                        <span
                          className="friend-tag-badge"
                          style={{ background: friendTags[friend.id].color }}
                        >
                          #{friendTags[friend.id].text}
                        </span>
                      )}
                    </span>
                  }
                  after={
                    <Button
                      size="s"
                      mode="secondary"
                      disabled={processingTargetId === friend.id}
                      loading={processingTargetId === friend.id}
                      onClick={(e) => { e.stopPropagation(); removeFriend(friend.id) }}
                    >
                      Удалить
                    </Button>
                  }
                  onClick={() => selectProfile(friend.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{friend.full_name}</span>
                    <AdminBadge username={friend.username} role={friend.role} />
                  </div>
                </SimpleCell>
              </div>
            ))
          )
        ) : activeTab === 'requests' ? (
          requests.length === 0 ? (
            <Box className="prod-empty-state-card">Нет входящих заявок</Box>
          ) : (
            requests.map(req => (
              <SimpleCell
                key={req.id}
                before={<CustomAvatar size={40} src={req.requester.avatar_url} name={req.requester.full_name} id={req.requester.id} decoration={req.requester.avatar_decoration} />}
                subtitle="хочет добавиться в друзья"
                after={
                  <Button
                    size="s"
                    disabled={processingTargetId === req.requester.id}
                    loading={processingTargetId === req.requester.id}
                    onClick={(e) => { e.stopPropagation(); handleFriendAction(req.requester.id) }}
                  >
                    Принять
                  </Button>
                }
                onClick={() => selectProfile(req.requester.id)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{req.requester.full_name}</span>
                  <AdminBadge username={req.requester.username} role={req.requester.role} />
                </div>
              </SimpleCell>
            ))
          )
        ) : activeTab === 'blacklist' ? (
          filteredBlockedUsers.length === 0 ? (
            <Box className="prod-empty-state-card">Черный список пуст</Box>
          ) : (
            filteredBlockedUsers.map(user => (
              <SimpleCell
                key={user.id}
                before={<CustomAvatar size={40} src={user.avatar_url} name={user.full_name} id={user.id} decoration={user.avatar_decoration} />}
                subtitle={user.username ? `@${user.username}` : ''}
                after={
                  <Button
                    size="s"
                    mode="secondary"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await toggleBlockUser(myProfile!.id, user.id)
                    }}
                  >
                    Разблокировать
                  </Button>
                }
                onClick={() => selectProfile(user.id)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{user.full_name}</span>
                  <AdminBadge username={user.username} role={user.role} />
                </div>
              </SimpleCell>
            ))
          )
        ) : (
          filteredProfiles.length === 0 ? (
            <Box className="prod-empty-state-card">Пользователи не найдены</Box>
          ) : (
            filteredProfiles.map(person => {
              const rel = friendshipStatuses[person.id]
              const buttonText = !rel ? 'Добавить' :
                rel.status === 'pending' && rel.requester_id === myProfile?.id ? 'Отменить' :
                rel.status === 'pending' ? 'Принять' : 'Удалить'
              return (
                <SimpleCell
                  key={person.id}
                  before={<CustomAvatar size={40} src={person.avatar_url} name={person.full_name} id={person.id} decoration={person.avatar_decoration} />}
                  subtitle={formatLastSeen(person)}
                  after={
                    <Button
                      size="s"
                      mode={rel ? 'secondary' : 'primary'}
                      disabled={processingTargetId === person.id}
                      loading={processingTargetId === person.id}
                      onClick={(e) => { e.stopPropagation(); handleFriendAction(person.id) }}
                    >
                      {buttonText}
                    </Button>
                  }
                  onClick={() => selectProfile(person.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{person.full_name}</span>
                    <AdminBadge username={person.username} role={person.role} />
                  </div>
                </SimpleCell>
              )
            })
          )
        )}
      </Group>

      {/* Custom Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="friends-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="friends-context-menu__header">
            <CustomAvatar size={28} src={contextMenu.friend.avatar_url} name={contextMenu.friend.full_name} id={contextMenu.friend.id} decoration={contextMenu.friend.avatar_decoration} />
            <span className="friends-context-menu__name">{contextMenu.friend.full_name}</span>
          </div>
          <div className="friends-context-menu__divider" />
          <button className="friends-context-menu__item" onClick={() => { handleOpenChat(contextMenu.friend) }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Написать сообщение
          </button>
          <button className="friends-context-menu__item" onClick={() => { selectProfile(contextMenu.friend.id); setContextMenu(null) }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Открыть профиль
          </button>
          <button className="friends-context-menu__item" onClick={() => { selectProfile(contextMenu.friend.id); setContextMenu(null) }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/><path d="M14.5 3H21v6.5"/><path d="M10 14L21 3"/></svg>
            Отправить подарок
          </button>
          <button className="friends-context-menu__item" onClick={() => openTagModal(contextMenu.friend)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            Добавить тег
          </button>
          <div className="friends-context-menu__divider" />
          <button className="friends-context-menu__item friends-context-menu__item--danger" onClick={() => { removeFriend(contextMenu.friend.id); setContextMenu(null) }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
            Удалить из друзей
          </button>
          <button className="friends-context-menu__item friends-context-menu__item--danger" onClick={() => handleBlock(contextMenu.friend)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            {blockedUserIds.has(contextMenu.friend.id) ? 'Разблокировать' : 'Заблокировать'}
          </button>
          <button className="friends-context-menu__item friends-context-menu__item--muted" onClick={() => setContextMenu(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            Пожаловаться (в разработке)
          </button>
        </div>
      )}

      {/* Tag Modal */}
      {tagModal && (
        <div className="friends-tag-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setTagModal(null) }}>
          <div className="friends-tag-modal">
            <div className="friends-tag-modal__header">
              <span>Тег для {tagModal.friend.full_name}</span>
              <button className="friends-tag-modal__close" onClick={() => setTagModal(null)}>✕</button>
            </div>
            <p className="friends-tag-modal__hint">Теги помогают сортировать друзей по группам. Например: #работа, #школа, #игры</p>
            <div className="friends-tag-modal__input-row">
              <span className="friends-tag-modal__hash" style={{ color: tagColor }}>#</span>
              <input
                className="friends-tag-modal__input"
                value={tagInput}
                onChange={e => setTagInput(e.target.value.replace(/^#/, ''))}
                placeholder="название тега"
                maxLength={20}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveTag() }}
              />
            </div>
            <div className="friends-tag-modal__colors">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  className={`friends-tag-modal__color-btn ${tagColor === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setTagColor(c)}
                />
              ))}
            </div>
            <div className="friends-tag-modal__actions">
              {tagModal.existingTag && (
                <button className="friends-tag-modal__btn friends-tag-modal__btn--remove" onClick={removeTag}>
                  Удалить тег
                </button>
              )}
              <button className="friends-tag-modal__btn friends-tag-modal__btn--save" onClick={saveTag}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
