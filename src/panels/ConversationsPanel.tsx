import React, { useEffect, useState } from 'react'
import { Panel, Group, Box, Spinner } from '@vkontakte/vkui'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { AdminBadge } from '../components/AdminBadge'
import { CustomAvatar } from '../components/CustomAvatar'

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

const isRecentlyOnline = (lastSeenStr: string | null | undefined): boolean => {
  if (!lastSeenStr) return false
  return Date.now() - new Date(lastSeenStr).getTime() < ONLINE_THRESHOLD_MS
}

interface Conversation {
  id: string
  updated_at: string
  pinned_by?: string[]
  deleted_by?: string[]
  is_group?: boolean
  group_name?: string | null
  group_avatar_url?: string | null
  created_by?: string | null
  members_count?: number
  participant: {
    id: string
    full_name: string | null
    avatar_url: string | null
    is_online: boolean
    username: string | null
    role?: string | null
    last_seen?: string | null
    status_preference?: string | null
    is_group?: boolean
    avatar_decoration?: string | null
  }
  lastMessage?: {
    content: string | null
    created_at: string
    sender_id: string
    is_read: boolean
    audio_url?: string | null
  }
}

interface ConversationsPanelProps {
  id: string
}

interface ChatFolder {
  id: string
  name: string
  order_index: number
  conversation_ids: string[]
}

const formatConversationTime = (dateStr?: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date()
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера'
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

const getConversationPreview = (conversation: Conversation, currentUserId?: string) => {
  const lastMessage = conversation.lastMessage
  if (!lastMessage) return 'Начните диалог и отправьте первое сообщение'
  const prefix = lastMessage.sender_id === currentUserId ? 'Вы: ' : ''
  if (lastMessage.audio_url) return `${prefix}🎤 Голосовое`
  if (lastMessage.content?.trim()) {
    const isChannelForward = (() => {
      const content = lastMessage.content.trim()
      if (!content.startsWith('{') || !content.endsWith('}')) return false
      try {
        const parsed = JSON.parse(content)
        return parsed && parsed.type === 'channel_forward'
      } catch (e) {
        return false
      }
    })()
    if (isChannelForward) {
      try {
        const parsed = JSON.parse(lastMessage.content)
        return `${prefix}📢 Запись из канала ${parsed.channelName || ''}`
      } catch(e) {}
    }

    const isStory = lastMessage.content.match(/(?:https?:\/\/[^\/]+)?\/story\/([a-f0-9-]+)/i)
    if (isStory) return `${prefix}🎬 История`
    const isPost = lastMessage.content.match(/(?:https?:\/\/[^\/]+)?\/post\/([a-f0-9-]+)/i)
    if (isPost) return `${prefix}📢 Запись на стене`
    return `${prefix}${lastMessage.content}`
  }
  return `${prefix}Вложение`
}

const formatParticipantStatus = (last_seen?: string | null, status_preference?: string | null, membersCount?: number, isGroup?: boolean): string | null => {
  if (isGroup) return membersCount !== undefined ? `${membersCount} участников` : null
  if (!last_seen) return null
  if (status_preference === 'offline') return 'скрыт статус'
  if (isRecentlyOnline(last_seen)) return null
  const date = new Date(last_seen)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMin < 60) return `был(а) ${diffMin} мин. назад`
  if (diffHours < 24) return `был(а) ${diffHours} ч. назад`
  if (diffDays === 1) return 'был(а) вчера'
  if (diffDays < 7) return `был(а) ${diffDays} дн. назад`
  return `был(а) ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
}

// ── Group Avatar ────────────────────────────────────────────────────────────
const GroupAvatar: React.FC<{ size: number; src?: string | null; name?: string | null }> = ({ size, src }) => {
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, #5856d6, #af52de)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
      <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    </div>
  )
}

export const ConversationsPanel: React.FC<ConversationsPanelProps> = ({ id }) => {
  const { profile } = useAuthStore()
  const { selectChat } = useAppStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [processingConversationId, setProcessingConversationId] = useState<string | null>(null)

  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; conv: Conversation | null }>({ visible: false, x: 0, y: 0, conv: null })

  // ── Group creation state ──────────────────────────────────────────────────
  const [showGroupCreate, setShowGroupCreate] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [availableUsers, setAvailableUsers] = useState<{ id: string; full_name: string | null; avatar_url: string | null; username: string | null; avatar_decoration?: string | null }[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  // ── Chat folders state ────────────────────────────────────────────────────
  const [folders, setFolders] = useState<ChatFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null) // null = "Все"
  const [showFolderCreate, setShowFolderCreate] = useState(false)

  // Archived conversations state
  const [archivedIds, setArchivedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('archived_conversations') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('archived_conversations', JSON.stringify(archivedIds))
  }, [archivedIds])

  useEffect(() => {
    if (archivedIds.length === 0 && activeFolderId === '__archive__') {
      setActiveFolderId(null)
    }
  }, [archivedIds, activeFolderId])

  const touchTimerRef = React.useRef<any>(null)
  const isLongPressRef = React.useRef(false)
  const [folderName, setFolderName] = useState('')
  const [folderConvIds, setFolderConvIds] = useState<string[]>([])
  const [savingFolder, setSavingFolder] = useState(false)
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null)

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(prev => prev.visible ? { ...prev, visible: false } : prev)
    document.addEventListener('click', handleCloseMenu)
    return () => document.removeEventListener('click', handleCloseMenu)
  }, [])

  const fetchAvailableUsers = async () => {
    if (!profile) return
    try {
      // Show friends (accepted friend requests)
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url, username, avatar_decoration), addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_url, username, avatar_decoration)')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)

      if (friendships) {
        const users = friendships.map((f: any) => {
          const other = f.requester_id === profile.id ? f.addressee : f.requester
          return other
        }).filter(Boolean)
        setAvailableUsers(users)
      }
    } catch (err) {
      console.error('Error fetching users for group creation:', err)
    }
  }

  const handleCreateGroup = async () => {
    if (!profile || !groupName.trim() || selectedMembers.length === 0) return
    setCreatingGroup(true)
    try {
      // Create conversation
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          participant_1: profile.id,
          participant_2: profile.id,
          is_group: true,
          group_name: groupName.trim(),
          created_by: profile.id
        })
        .select()
        .single()

      if (convErr || !conv) throw convErr

      // Add creator as admin + members
      const membersToInsert = [
        { conversation_id: conv.id, user_id: profile.id, role: 'admin' },
        ...selectedMembers.map(uid => ({ conversation_id: conv.id, user_id: uid, role: 'member' }))
      ]
      await supabase.from('conversation_members').insert(membersToInsert)

      // Send system message
      await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_id: profile.id,
        content: `${profile.full_name || 'Пользователь'} создал(а) группу «${groupName.trim()}»`
      })

      setShowGroupCreate(false)
      setGroupName('')
      setSelectedMembers([])
      fetchConversations()

      // Open newly created group
      selectChat(conv.id, {
        id: conv.id,
        full_name: groupName.trim(),
        avatar_url: null,
        is_online: false,
        username: null,
        is_group: true,
        group_name: groupName.trim(),
        created_by: profile.id,
        members_count: selectedMembers.length + 1
      })
    } catch (err) {
      console.error('Error creating group:', err)
    } finally {
      setCreatingGroup(false)
    }
  }

  // ── Chat folders functions ────────────────────────────────────────────────
  const fetchFolders = async () => {
    if (!profile) return
    try {
      const { data: foldersData, error: foldersErr } = await supabase
        .from('chat_folders')
        .select('id, name, order_index')
        .eq('user_id', profile.id)
        .order('order_index', { ascending: true })

      if (foldersErr) throw foldersErr

      if (!foldersData || foldersData.length === 0) {
        setFolders([])
        return
      }

      // Fetch conversation_ids for each folder
      const folderIds = foldersData.map(f => f.id)
      const { data: convsData } = await supabase
        .from('chat_folder_conversations')
        .select('folder_id, conversation_id')
        .in('folder_id', folderIds)

      const convsByFolder: Record<string, string[]> = {}
      for (const c of convsData || []) {
        if (!convsByFolder[c.folder_id]) convsByFolder[c.folder_id] = []
        convsByFolder[c.folder_id].push(c.conversation_id)
      }

      setFolders(foldersData.map(f => ({
        id: f.id,
        name: f.name,
        order_index: f.order_index,
        conversation_ids: convsByFolder[f.id] || []
      })))
    } catch (err) {
      console.error('Error fetching folders:', err)
    }
  }

  const handleCreateFolder = async () => {
    if (!profile || !folderName.trim() || folderConvIds.length === 0) return
    setSavingFolder(true)
    try {
      const { data: newFolder, error: folderErr } = await supabase
        .from('chat_folders')
        .insert({ user_id: profile.id, name: folderName.trim(), order_index: folders.length })
        .select()
        .single()

      if (folderErr || !newFolder) throw folderErr

      // Add conversations to folder
      if (folderConvIds.length > 0) {
        await supabase.from('chat_folder_conversations').insert(
          folderConvIds.map(convId => ({ folder_id: newFolder.id, conversation_id: convId }))
        )
      }

      setFolders(prev => [...prev, { id: newFolder.id, name: newFolder.name, order_index: newFolder.order_index, conversation_ids: folderConvIds }])
      setShowFolderCreate(false)
      setFolderName('')
      setFolderConvIds([])
    } catch (err) {
      console.error('Error creating folder:', err)
    } finally {
      setSavingFolder(false)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await supabase.from('chat_folders').delete().eq('id', folderId)
      setFolders(prev => prev.filter(f => f.id !== folderId))
      if (activeFolderId === folderId) setActiveFolderId(null)
    } catch (err) {
      console.error('Error deleting folder:', err)
    }
  }

  // ── Filter conversations by active folder ─────────────────────────────────
  const filteredConversations = (() => {
    const nonArchived = conversations.filter(c => !archivedIds.includes(c.id))
    const archived = conversations.filter(c => archivedIds.includes(c.id))

    if (activeFolderId === '__archive__') {
      return archived
    }
    if (activeFolderId === null) return nonArchived // "Все"
    if (activeFolderId === '__groups__') return nonArchived.filter(c => c.is_group) // "Группы"
    const folder = folders.find(f => f.id === activeFolderId)
    if (!folder) return nonArchived
    return nonArchived.filter(c => folder.conversation_ids.includes(c.id))
  })()

  const handleTogglePin = async (conv: Conversation) => {
    if (!profile) return
    const isPinned = conv.pinned_by?.includes(profile.id)
    const newPinnedBy = isPinned
      ? (conv.pinned_by || []).filter(i => i !== profile.id)
      : [...(conv.pinned_by || []), profile.id]
    try {
      await supabase.from('conversations').update({ pinned_by: newPinnedBy }).eq('id', conv.id)
      fetchConversations()
    } catch (err) { console.error('Error toggling pin:', err) }
    finally { setContextMenu(prev => ({ ...prev, visible: false })) }
  }

  const handleMarkAsRead = async (conv: Conversation) => {
    if (!profile) return
    try {
      await supabase.from('messages').update({ is_read: true }).eq('conversation_id', conv.id).neq('sender_id', profile.id)
      window.dispatchEvent(new CustomEvent('global-messages-read', {
        detail: { conversationId: conv.id, readerId: profile.id }
      }))
      fetchConversations()
    } catch (err) { console.error('Error marking as read:', err) }
    finally { setContextMenu(prev => ({ ...prev, visible: false })) }
  }

  const handleDeleteConv = async (conv: Conversation) => {
    if (!profile) return
    if (processingConversationId === conv.id) return
    if (!window.confirm('Удалить диалог из списка? Сообщения останутся у собеседника.')) return
    setProcessingConversationId(conv.id)
    const newDeletedBy = [...(conv.deleted_by || []), profile.id]
    try {
      await supabase.from('conversations').update({ deleted_by: newDeletedBy }).eq('id', conv.id)
      fetchConversations()
    } catch (err) { console.error('Error deleting conversation:', err) }
    finally { setProcessingConversationId(null); setContextMenu(prev => ({ ...prev, visible: false })) }
  }

  const fetchConversations = async (force = false) => {
    if (!profile) return
    // Используем кэш если есть и не принудительная загрузка
    const cached = useAppStore.getState().conversationsCache
    if (cached?.length > 0 && !force) {
      setConversations(cached)
      setLoading(false)
      // Всё равно обновляем в фоне
    } else {
      setLoading(true)
    }

    try {
      // ── 1. Direct conversations ────────────────────────────────────────────
      const { data: directData, error: directErr } = await supabase
        .from('conversations')
        .select(`
          id, updated_at, pinned_by, deleted_by,
          participant_1:profiles!conversations_participant_1_fkey(id, full_name, avatar_url, is_online, username, num_id, role, last_seen, status_preference, avatar_decoration),
          participant_2:profiles!conversations_participant_2_fkey(id, full_name, avatar_url, is_online, username, num_id, role, last_seen, status_preference, avatar_decoration)
        `)
        .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`)
        .eq('is_group', false)
        .not('deleted_by', 'cs', `{${profile.id}}`)

      if (directErr) {
        console.error('Direct conversations error:', directErr)
        throw directErr
      }

      const directConvs: Conversation[] = (directData || [])
        .map((item: any): Conversation | null => {
          const other = item.participant_1?.id === profile.id ? item.participant_2 : item.participant_1
          if (!other) return null
          return {
            id: item.id,
            updated_at: item.updated_at,
            pinned_by: item.pinned_by || [],
            deleted_by: item.deleted_by || [],
            participant: other
          }
        })
        .filter((c): c is Conversation => c !== null)

      // ── 2. Group conversations ─────────────────────────────────────────────
      let groupConvs: Conversation[] = []
      
      const { data: membershipData, error: membershipErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', profile.id)

      if (membershipErr) {
        console.error('conversation_members error:', membershipErr.message, membershipErr)
      } else {
        const groupConvIds = (membershipData || []).map((m: any) => m.conversation_id)

        if (groupConvIds.length > 0) {
          const { data: groupData, error: groupErr } = await supabase
            .from('conversations')
            .select('id, updated_at, pinned_by, deleted_by, is_group, group_name, group_avatar_url, created_by')
            .eq('is_group', true)
            .in('id', groupConvIds)
            .not('deleted_by', 'cs', `{${profile.id}}`)

          if (groupErr) {
            console.error('Group conversations query error:', groupErr.message, groupErr)
          } else {
            for (const gc of groupData || []) {
              const { count } = await supabase
                .from('conversation_members')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', gc.id)

              groupConvs.push({
                id: gc.id,
                updated_at: gc.updated_at,
                pinned_by: gc.pinned_by || [],
                deleted_by: gc.deleted_by || [],
                is_group: true,
                group_name: gc.group_name,
                group_avatar_url: gc.group_avatar_url,
                created_by: gc.created_by,
                members_count: count || 0,
                participant: {
                  id: gc.id,
                  full_name: gc.group_name || 'Группа',
                  avatar_url: gc.group_avatar_url,
                  is_online: false,
                  username: null,
                  is_group: true
                }
              })
            }
          }
        }
      }

      // ── 3. Merge + fetch last messages ─────────────────────────────────────
      const allConvs = [...directConvs, ...groupConvs]

      await Promise.all(allConvs.map(async (c) => {
        const { data: msg } = await supabase
          .from('messages')
          .select('content, created_at, sender_id, is_read, audio_url')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (msg) c.lastMessage = msg
      }))

      // ── 4. Sort ────────────────────────────────────────────────────────────
      allConvs.sort((a, b) => {
        const isPinnedA = a.pinned_by?.includes(profile.id)
        const isPinnedB = b.pinned_by?.includes(profile.id)
        if (isPinnedA && !isPinnedB) return -1
        if (!isPinnedA && isPinnedB) return 1
        if (isPinnedA && isPinnedB) return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()

        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })

      const isSame = cached && cached.length === allConvs.length && cached.every((c, idx) => 
        c.id === allConvs[idx].id && 
        c.updated_at === allConvs[idx].updated_at &&
        c.lastMessage?.content === allConvs[idx].lastMessage?.content &&
        c.lastMessage?.is_read === allConvs[idx].lastMessage?.is_read &&
        c.participant?.is_online === allConvs[idx].participant?.is_online &&
        c.participant?.last_seen === allConvs[idx].participant?.last_seen &&
        c.participant?.status_preference === allConvs[idx].participant?.status_preference
      )

      if (!isSame) {
        setConversations(allConvs)
        useAppStore.getState().setConversationsCache(allConvs)
      }
    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations()
    fetchFolders()
    const channel = supabase
      .channel('realtime:conversations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any
        setConversations(prev => {
          const conv = prev.find(c => c.id === msg.conversation_id)
          if (!conv) return prev
          const updated = prev.map(c => c.id === msg.conversation_id ? { ...c, lastMessage: msg, updated_at: msg.created_at } : c)
          updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          useAppStore.getState().setConversationsCache(updated)
          return updated
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any
        setConversations(prev => prev.map(c => c.id === msg.conversation_id && (c.lastMessage as any)?.id === msg.id ? { ...c, lastMessage: msg } : c))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const updated = payload.new as any
        setConversations(prev => prev.map(c => {
          if (c.is_group) return c
          if (c.participant.id === updated.id) return { ...c, participant: { ...c.participant, ...updated } }
          return c
        }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members' }, () => fetchConversations())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversation_members' }, () => fetchConversations())
      .subscribe()

    const handleGlobalMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail.message
      if (msg) {
        let hasConv = false
        setConversations(prev => {
          const conv = prev.find(c => c.id === msg.conversation_id)
          hasConv = !!conv
          if (!conv) return prev
          const updated = prev.map(c => c.id === msg.conversation_id ? { ...c, lastMessage: msg, updated_at: msg.created_at } : c)
          updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          setTimeout(() => {
            useAppStore.getState().setConversationsCache(updated)
          }, 0)
          return updated
        })
        if (!hasConv) {
          fetchConversations()
        }
      }
    }

    const handleGlobalRead = (e: Event) => {
      const { conversationId, readerId } = (e as CustomEvent).detail
      setConversations(prev => {
        const next = prev.map(c => {
          if (c.id === conversationId && c.lastMessage && c.lastMessage.sender_id !== readerId) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                is_read: true
              }
            }
          }
          return c
        })
        setTimeout(() => {
          useAppStore.getState().setConversationsCache(next)
        }, 0)
        return next
      })
      if (profile?.id) {
        useAppStore.getState().recountUnreadMessages(profile.id)
      }
    }

    window.addEventListener('global-message-received', handleGlobalMessage)
    window.addEventListener('global-messages-read', handleGlobalRead)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('global-message-received', handleGlobalMessage)
      window.removeEventListener('global-messages-read', handleGlobalRead)
    }
  }, [profile?.id])

  const filteredAvailable = availableUsers.filter(u =>
    !memberSearch.trim() || u.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) || u.username?.toLowerCase().includes(memberSearch.toLowerCase())
  )

  return (
    <Panel id={id}>
      {/* Folder tabs */}
      <div style={{ padding: '12px 4px 0', display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <button
          onClick={() => setActiveFolderId(null)}
          style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeFolderId === null ? 600 : 400, background: activeFolderId === null ? '#007aff' : 'var(--vkui--color_background_secondary)', color: activeFolderId === null ? '#fff' : 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}
        >
          Все
        </button>
        <button
          onClick={() => setActiveFolderId('__groups__')}
          style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeFolderId === '__groups__' ? 600 : 400, background: activeFolderId === '__groups__' ? '#007aff' : 'var(--vkui--color_background_secondary)', color: activeFolderId === '__groups__' ? '#fff' : 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}
        >
          Группы
        </button>
        {archivedIds.length > 0 && (
          <button
            onClick={() => setActiveFolderId('__archive__')}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeFolderId === '__archive__' ? 600 : 400, background: activeFolderId === '__archive__' ? '#007aff' : 'var(--vkui--color_background_secondary)', color: activeFolderId === '__archive__' ? '#fff' : 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}
          >
            Архив
          </button>
        )}
        {folders.map(f => (
          <div key={f.id} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setActiveFolderId(f.id)}
              style={{ padding: '6px 14px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeFolderId === f.id ? 600 : 400, background: activeFolderId === f.id ? '#007aff' : 'var(--vkui--color_background_secondary)', color: activeFolderId === f.id ? '#fff' : 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}
              onMouseEnter={e => { const del = e.currentTarget.nextElementSibling as HTMLElement; if (del) del.style.opacity = '1' }}
              onMouseLeave={e => { const del = e.currentTarget.nextElementSibling as HTMLElement; if (del) del.style.opacity = '0' }}
            >
              {f.name}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteFolderId(f.id) }}
              style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#ff3b30', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() => setShowFolderCreate(true)}
          style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--vkui--color_background_secondary)', color: 'var(--vkui--color_text_secondary)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Создать папку"
        >
          +
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setShowGroupCreate(true); fetchAvailableUsers() }}
          title="Создать группу"
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, padding: '4px 6px', borderRadius: 8, transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--vkui--color_background_secondary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          Группа
        </button>
      </div>

      <Group mode="plain" className="conversations-group">
        {loading ? (
          <Box className="prod-skeleton-list" style={{ padding: 12 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="prod-skeleton-item">
                <div className="prod-skeleton-avatar" />
                <div className="prod-skeleton-content">
                  <div className="prod-skeleton-line prod-skeleton-line--lg" />
                  <div className="prod-skeleton-line prod-skeleton-line--sm" />
                </div>
              </div>
            ))}
          </Box>
        ) : filteredConversations.length === 0 ? (
          <Box className="prod-empty-state-card">
            {activeFolderId === null ? 'У вас пока нет диалогов. Перейдите в профиль пользователя и начните общение.' : 'В этой папке пока нет чатов.'}
          </Box>
        ) : (
          filteredConversations.map((c, index) => {
            if (!c.is_group && !c.participant) return null
            const hasUnread = c.lastMessage && !c.lastMessage.is_read && c.lastMessage.sender_id !== profile?.id
            const isSavedMessages = !c.is_group && c.participant.id === profile?.id
            const isPinned = c.pinned_by?.includes(profile?.id || '')
            const isSentByMe = c.lastMessage?.sender_id === profile?.id
            const isReadByOther = c.lastMessage?.is_read === true
            const previewText = getConversationPreview(c, profile?.id)
            const timeLabel = formatConversationTime(c.lastMessage?.created_at || c.updated_at)

            return (
              <React.Fragment key={c.id}>
                <div
                  className={`conversation-card ${hasUnread ? 'is-unread' : ''} ${isPinned ? 'is-pinned' : ''}`}
                  onTouchStart={(e) => {
                    const touch = e.touches[0]
                    const x = touch.clientX
                    const y = touch.clientY
                    isLongPressRef.current = false
                    touchTimerRef.current = setTimeout(() => {
                      isLongPressRef.current = true
                      setContextMenu({ visible: true, x, y, conv: c })
                    }, 600)
                  }}
                  onTouchEnd={() => {
                    if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
                  }}
                  onTouchMove={() => {
                    if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
                  }}
                  onClick={() => {
                    if (isLongPressRef.current) {
                      isLongPressRef.current = false
                      return
                    }
                    if (c.is_group) {
                      selectChat(c.id, {
                        id: c.id,
                        full_name: c.group_name || 'Группа',
                        avatar_url: c.group_avatar_url || null,
                        is_online: false,
                        username: null,
                        is_group: true,
                        group_name: c.group_name,
                        group_avatar_url: c.group_avatar_url,
                        created_by: c.created_by,
                        members_count: c.members_count
                      })
                    } else {
                      selectChat(c.id, c.participant)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    const menuWidth = 180
                    const menuHeight = 160
                    let x = e.clientX, y = e.clientY
                    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
                    if (x < 10) x = 10
                    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10
                    if (y < 10) y = 10
                    setContextMenu({ visible: true, x, y, conv: c })
                  }}
                >
                  {/* Avatar */}
                  <div className="conversation-card__avatar">
                    {isSavedMessages ? (
                      <div className="conversation-card__saved-avatar">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                        </svg>
                      </div>
                    ) : c.is_group ? (
                      <GroupAvatar size={48} src={c.group_avatar_url} name={c.group_name} />
                    ) : (
                      <CustomAvatar size={48} src={c.participant.avatar_url} name={c.participant.full_name} id={c.participant.id} decoration={c.participant.avatar_decoration} />
                    )}
                    {!isSavedMessages && !c.is_group && c.participant.status_preference !== 'offline' && isRecentlyOnline(c.participant.last_seen) && (
                      <div className="conversation-card__online-dot" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="conversation-card__content">
                    <div className="conversation-card__top">
                      <div className="conversation-card__title-wrap">
                        <div className="conversation-card__title-row">
                          <span 
                            className="conversation-card__title"
                            style={(!c.is_group && c.participant.id === '00000000-0000-0000-0000-000000000000') ? { color: '#ff9800', fontWeight: 'bold' } : undefined}
                          >
                            {isSavedMessages ? 'Избранное' : c.is_group ? (c.group_name || 'Группа') : c.participant.full_name}
                          </span>
                          {!isSavedMessages && !c.is_group && (
                            c.participant.id === '00000000-0000-0000-0000-000000000000'
                              ? <span style={{ fontSize: 13, verticalAlign: 'middle', marginLeft: 4 }}>🤖</span>
                              : <AdminBadge username={c.participant.username} role={c.participant.role} />
                          )}
                          {c.is_group && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--vkui--color_text_secondary)" style={{ opacity: 0.5, flexShrink: 0 }}>
                              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                            </svg>
                          )}
                          {isPinned && (
                            <span className="conversation-card__pin" title="Закреплён">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
                              </svg>
                            </span>
                          )}
                        </div>
                        {(() => {
                          const statusText = c.participant?.id === '00000000-0000-0000-0000-000000000000'
                            ? 'Бот'
                            : formatParticipantStatus(c.participant?.last_seen, c.participant?.status_preference, c.members_count, c.is_group)
                          return statusText ? (
                            <span style={{ fontSize: 11, color: c.participant?.id === '00000000-0000-0000-0000-000000000000' ? '#4caf50' : 'var(--vkui--color_text_secondary)', opacity: c.participant?.id === '00000000-0000-0000-0000-000000000000' ? 0.95 : 0.65, lineHeight: 1.2, display: 'block', marginTop: 1 }}>
                              {statusText}
                            </span>
                          ) : null
                        })()}
                      </div>
                      <div className="conversation-card__meta">
                        {timeLabel && <span className="conversation-card__time">{timeLabel}</span>}
                      </div>
                    </div>

                    <div className="conversation-card__bottom-row">
                      <div className={`conversation-card__preview ${hasUnread ? 'is-unread' : ''}`}>
                        {previewText}
                      </div>
                      <div className="conversation-card__indicators">
                        {isSentByMe && (
                          isReadByOther ? (
                            <span className="conversation-card__checkmark" title="Прочитано">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 6L8.5 14.5L5 11M22 6l-8.5 8.5" />
                              </svg>
                            </span>
                          ) : (
                            <span className="conversation-card__checkmark conversation-card__checkmark--unread" title="Доставлено">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          )
                        )}
                        {hasUnread && <span className="conversation-card__badge" />}
                      </div>
                    </div>
                  </div>
                </div>
                {index < filteredConversations.length - 1 && <div className="conversation-card__divider" />}
              </React.Fragment>
            )
          })
        )}
      </Group>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.conv && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }} className="custom-context-menu" onClick={e => e.stopPropagation()}>
          {contextMenu.conv.participant.id !== profile?.id && (
            <button onClick={() => handleTogglePin(contextMenu.conv!)} className="context-menu-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span>{contextMenu.conv.pinned_by?.includes(profile?.id || '') ? 'Открепить' : 'Закрепить'}</span>
            </button>
          )}
          <button onClick={() => handleMarkAsRead(contextMenu.conv!)} className="context-menu-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Прочитано</span>
          </button>

          {/* Archive / Unarchive Option */}
          <button 
            onClick={() => {
              const isArchived = archivedIds.includes(contextMenu.conv!.id)
              if (isArchived) {
                setArchivedIds(prev => prev.filter(id => id !== contextMenu.conv!.id))
              } else {
                setArchivedIds(prev => [...prev, contextMenu.conv!.id])
              }
              setContextMenu(prev => ({ ...prev, visible: false }))
            }} 
            className="context-menu-item"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <path d="M21 8v13H3V8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            <span>{archivedIds.includes(contextMenu.conv!.id) ? 'Убрать из архива' : 'В архив'}</span>
          </button>

          {contextMenu.conv.participant.id !== profile?.id && (
            <>
              <div style={{ height: '1px', background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '4px 0' }} />
              <button onClick={() => handleDeleteConv(contextMenu.conv!)} className="context-menu-item context-menu-item-danger" disabled={processingConversationId === contextMenu.conv?.id} style={{ opacity: processingConversationId === contextMenu.conv?.id ? 0.6 : 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>{processingConversationId === contextMenu.conv?.id ? 'Удаление...' : 'Удалить'}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Group Creation Modal */}
      {showGroupCreate && (
        <div
          onClick={() => { setShowGroupCreate(false); setGroupName(''); setSelectedMembers([]) }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--vkui--color_background_content)', borderRadius: 20, width: '100%', maxWidth: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Создать группу</span>
              <button onClick={() => { setShowGroupCreate(false); setGroupName(''); setSelectedMembers([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Group name input */}
            <div style={{ padding: '14px 20px 10px' }}>
              <input
                autoFocus
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Название группы..."
                style={{ width: '100%', background: 'var(--vkui--color_background_secondary)', border: 'none', outline: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--vkui--color_text_primary)', boxSizing: 'border-box' }}
              />
            </div>

            {/* Member search */}
            <div style={{ padding: '0 20px 10px' }}>
              <input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Поиск участников..."
                style={{ width: '100%', background: 'var(--vkui--color_background_secondary)', border: 'none', outline: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: 'var(--vkui--color_text_primary)', boxSizing: 'border-box' }}
              />
            </div>

            {/* Selected chips */}
            {selectedMembers.length > 0 && (
              <div style={{ padding: '0 20px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedMembers.map(uid => {
                  const u = availableUsers.find(x => x.id === uid)
                  return u ? (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,122,255,0.12)', borderRadius: 20, padding: '3px 10px 3px 6px', fontSize: 12, color: '#007aff' }}>
                      <CustomAvatar size={20} src={u.avatar_url} name={u.full_name} id={u.id} decoration={u.avatar_decoration} />
                      <span>{u.full_name || u.username}</span>
                      <span onClick={() => setSelectedMembers(prev => prev.filter(id => id !== uid))} style={{ cursor: 'pointer', marginLeft: 2, fontWeight: 700 }}>×</span>
                    </div>
                  ) : null
                })}
              </div>
            )}

            {/* Users list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
              {filteredAvailable.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>
                  {availableUsers.length === 0 ? 'Нет друзей для добавления' : 'Ничего не найдено'}
                </div>
              ) : filteredAvailable.map(u => {
                const isSelected = selectedMembers.includes(u.id)
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedMembers(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: isSelected ? 'rgba(0,122,255,0.08)' : 'transparent', transition: 'background 0.15s' }}
                  >
                    <CustomAvatar size={40} src={u.avatar_url} name={u.full_name} id={u.id} decoration={u.avatar_decoration} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--vkui--color_text_primary)' }}>{u.full_name}</div>
                      {u.username && <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>@{u.username}</div>}
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isSelected ? '#007aff' : 'var(--vkui--color_separator_primary)'}`, background: isSelected ? '#007aff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                      {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Create button */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--vkui--color_separator_primary_alpha)' }}>
              <button
                onClick={handleCreateGroup}
                disabled={creatingGroup || !groupName.trim() || selectedMembers.length === 0}
                style={{ width: '100%', background: (!groupName.trim() || selectedMembers.length === 0) ? 'rgba(0,122,255,0.35)' : '#007aff', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, cursor: (!groupName.trim() || selectedMembers.length === 0) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {creatingGroup ? <Spinner size="s" style={{ color: '#fff' }} /> : null}
                {creatingGroup ? 'Создание...' : `Создать группу (${selectedMembers.length + 1} чел.)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Creation Modal */}
      {showFolderCreate && (
        <div
          onClick={() => { setShowFolderCreate(false); setFolderName(''); setFolderConvIds([]) }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--vkui--color_background_content)', borderRadius: 20, width: '100%', maxWidth: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Создать папку</span>
              <button onClick={() => { setShowFolderCreate(false); setFolderName(''); setFolderConvIds([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Folder name input */}
            <div style={{ padding: '14px 20px 10px' }}>
              <input
                autoFocus
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
                placeholder="Название папки..."
                style={{ width: '100%', background: 'var(--vkui--color_background_secondary)', border: 'none', outline: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--vkui--color_text_primary)', boxSizing: 'border-box' }}
              />
            </div>

            {/* Selected chats chips */}
            {folderConvIds.length > 0 && (
              <div style={{ padding: '0 20px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {folderConvIds.map(convId => {
                  const conv = conversations.find(c => c.id === convId)
                  if (!conv) return null
                  const name = conv.is_group ? (conv.group_name || 'Группа') : (conv.participant.id === profile?.id ? 'Избранное' : conv.participant.full_name)
                  return (
                    <div key={convId} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,122,255,0.12)', borderRadius: 20, padding: '3px 10px 3px 6px', fontSize: 12, color: '#007aff' }}>
                      <span>{name}</span>
                      <span onClick={() => setFolderConvIds(prev => prev.filter(id => id !== convId))} style={{ cursor: 'pointer', marginLeft: 2, fontWeight: 700 }}>×</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Conversations list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
              {conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>Нет чатов</div>
              ) : conversations.map(c => {
                const isSelected = folderConvIds.includes(c.id)
                const name = c.is_group ? (c.group_name || 'Группа') : (c.participant.id === profile?.id ? 'Избранное' : c.participant.full_name)
                return (
                  <div
                    key={c.id}
                    onClick={() => setFolderConvIds(prev => isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: isSelected ? 'rgba(0,122,255,0.08)' : 'transparent', transition: 'background 0.15s' }}
                  >
                    {c.is_group ? <GroupAvatar size={40} src={c.group_avatar_url} name={c.group_name} /> : <CustomAvatar size={40} src={c.participant.avatar_url} name={c.participant.full_name} id={c.participant.id} decoration={c.participant.avatar_decoration} />}
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--vkui--color_text_primary)' }}>{name}</div>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isSelected ? '#007aff' : 'var(--vkui--color_separator_primary)'}`, background: isSelected ? '#007aff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                      {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Create button */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--vkui--color_separator_primary_alpha)' }}>
              <button
                onClick={handleCreateFolder}
                disabled={savingFolder || !folderName.trim() || folderConvIds.length === 0}
                style={{ width: '100%', background: (!folderName.trim() || folderConvIds.length === 0) ? 'rgba(0,122,255,0.35)' : '#007aff', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, cursor: (!folderName.trim() || folderConvIds.length === 0) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {savingFolder ? <Spinner size="s" style={{ color: '#fff' }} /> : null}
                {savingFolder ? 'Сохранение...' : `Создать папку (${folderConvIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete folder confirmation */}
      {deleteFolderId && (
        <div
          onClick={() => setDeleteFolderId(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--vkui--color_background_content)', borderRadius: 20, width: '100%', maxWidth: 320, padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,59,48,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--vkui--color_text_primary)', marginBottom: 8 }}>Удалить папку?</div>
            <div style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', marginBottom: 20, lineHeight: 1.4 }}>Папка и все чаты из неё будут удалены. Это действие нельзя отменить.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteFolderId(null)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: 'var(--vkui--color_background_secondary)', color: 'var(--vkui--color_text_primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
              <button onClick={async () => { await handleDeleteFolder(deleteFolderId); setDeleteFolderId(null) }} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: '#ff3b30', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
