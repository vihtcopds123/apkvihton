import React, { useEffect, useState } from 'react'
import {
  Panel,
  PanelHeader,
  Group,
  SimpleCell,
  Box,
  Text
} from '@vkontakte/vkui'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { AdminBadge } from '../components/AdminBadge'
import { CustomAvatar } from '../components/CustomAvatar'


interface NotificationItem {
  id: string
  type: 'like' | 'comment' | 'friend_request' | 'friend_accepted' | 'message' | 'reply'
  created_at: string
  is_read: boolean
  post_id: string | null
  from_user: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
    role?: string | null
  }
}

interface NotificationsPanelProps {
  id: string
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ id }) => {
  const { profile } = useAuthStore()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [acceptedFriendIds, setAcceptedFriendIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null)
  const [acceptingFriendId, setAcceptingFriendId] = useState<string | null>(null)

  const fetchNotifications = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, from_user:profiles!notifications_from_user_id_fkey(id, full_name, avatar_url, username, role)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data as unknown as NotificationItem[])

      // Fetch accepted friendships
      const { data: friendshipsData } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
      
      const friendIds = new Set<string>()
      if (friendshipsData) {
        friendshipsData.forEach((f: any) => {
          friendIds.add(f.requester_id === profile.id ? f.addressee_id : f.requester_id)
        })
      }
      setAcceptedFriendIds(friendIds)

      // Mark all as read in DB
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)

      useAppStore.getState().setUnreadNotificationsCount(0)

    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    if (deletingNotificationId === notificationId) return
    if (!window.confirm('Удалить это уведомление?')) return

    setDeletingNotificationId(notificationId)
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
      
      if (error) throw error
      
      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (err) {
      console.error('Error deleting notification:', err)
    } finally {
      setDeletingNotificationId(null)
    }
  }

  const handleAcceptFriend = async (fromUserId: string) => {
    if (!profile) return
    if (acceptingFriendId === fromUserId) return

    setAcceptingFriendId(fromUserId)
    try {
      // Find friendship
      const { data: friendship, error: fError } = await supabase
        .from('friendships')
        .select('id')
        .eq('requester_id', fromUserId)
        .eq('addressee_id', profile.id)
        .eq('status', 'pending')
        .maybeSingle()

      if (fError) throw fError
      
      if (friendship) {
        // Accept friendship
        const { error: uError } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', friendship.id)
        if (uError) throw uError
      }

      // Update local friend request status
      setAcceptedFriendIds(prev => {
        const next = new Set(prev)
        next.add(fromUserId)
        return next
      })
    } catch (err) {
      console.error('Error accepting friend:', err)
    } finally {
      setAcceptingFriendId(null)
    }
  }

  useEffect(() => {
    fetchNotifications()

    if (!profile?.id) return

    const channel = supabase
      .channel('realtime:notifications_panel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newNotif = payload.new as any
          const fetchNewNotifDetails = async () => {
            const { data: sender } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, username')
              .eq('id', newNotif.from_user_id)
              .single()
            
            if (sender) {
              const fullNotif = {
                ...newNotif,
                from_user: sender
              }
              setNotifications(prev => {
                if (prev.some(n => n.id === fullNotif.id)) return prev
                return [fullNotif, ...prev]
              })
            }
          }
          fetchNewNotifDetails()
        } else if (payload.eventType === 'DELETE') {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any
          setNotifications(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  const getNotificationText = (type: string) => {
    switch (type) {
      case 'like':
        return 'поставил(а) лайк на вашу запись'
      case 'comment':
        return 'прокомментировал(а) вашу запись'
      case 'friend_request':
        return 'хочет добавиться к вам в друзья'
      case 'friend_accepted':
        return 'подтвердил(а) вашу заявку в друзья'
      case 'message':
        return 'отправил(а) вам сообщение'
      case 'reply':
        return 'ответил(а) на ваш комментарий'
      default:
        return 'отправил(а) вам уведомление'
    }
  }

  return (
    <Panel id={id}>
      <Box position="sticky" insetBlockStart={0} style={{ zIndex: 10 }}>
        <PanelHeader fixed={false} className="transparent-header" delimiter="none">Уведомления</PanelHeader>
      </Box>

      <Group>
        {loading ? (
          <Box className="prod-skeleton-list" style={{ padding: 12 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="prod-skeleton-item">
                <div className="prod-skeleton-avatar" />
                <div className="prod-skeleton-content">
                  <div className="prod-skeleton-line prod-skeleton-line--lg" />
                  <div className="prod-skeleton-line prod-skeleton-line--md" />
                </div>
              </div>
            ))}
          </Box>
        ) : notifications.length === 0 ? (
          <Box className="prod-empty-state-card">У вас пока нет новых уведомлений</Box>
        ) : (
          notifications.map(n => (
            <SimpleCell
              key={n.id}
              before={
                <CustomAvatar 
                  size={40} 
                  src={n.from_user?.avatar_url} 
                  name={n.from_user?.full_name}
                  id={n.from_user?.id}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    useAppStore.getState().selectProfile(n.from_user?.id)
                  }}
                />
              }
              subtitle={new Date(n.created_at).toLocaleString()}
              style={{
                background: n.is_read ? 'transparent' : 'var(--vkui--color_background_accent_themed_alpha)',
                cursor: (n.type === 'like' || n.type === 'comment' || n.type === 'reply') && n.post_id ? 'pointer' : 'default'
              }}
              onClick={async () => {
                if ((n.type === 'like' || n.type === 'comment' || n.type === 'reply') && n.post_id) {
                  window.dispatchEvent(new CustomEvent('open-post', { detail: { postId: n.post_id } }))
                } else if (n.type === 'message' && n.from_user?.id) {
                  try {
                    const { data: existing } = await supabase
                      .from('conversations')
                      .select('id')
                      .or(`and(participant_1.eq.${profile?.id},participant_2.eq.${n.from_user.id}),and(participant_1.eq.${n.from_user.id},participant_2.eq.${profile?.id})`)
                      .maybeSingle()
                    
                    if (existing) {
                      useAppStore.getState().selectChat(existing.id, {
                        id: n.from_user.id,
                        full_name: n.from_user.full_name,
                        avatar_url: n.from_user.avatar_url,
                        is_online: false,
                        username: n.from_user.username
                      })
                    } else if (profile) {
                      const { data: created } = await supabase
                        .from('conversations')
                        .insert({
                          participant_1: profile.id,
                          participant_2: n.from_user.id
                        })
                        .select('id')
                        .single()
                      
                      if (created) {
                        useAppStore.getState().selectChat(created.id, {
                          id: n.from_user.id,
                          full_name: n.from_user.full_name,
                          avatar_url: n.from_user.avatar_url,
                          is_online: false,
                          username: n.from_user.username
                        })
                      }
                    }
                  } catch (err) {
                    console.error('Error opening chat from notification:', err)
                    useAppStore.getState().selectProfile(n.from_user.id)
                  }
                } else if (n.from_user?.id) {
                  useAppStore.getState().selectProfile(n.from_user.id)
                }
              }}
              after={
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {n.type === 'friend_request' && (
                    acceptedFriendIds.has(n.from_user?.id) ? (
                      <span style={{ fontSize: 13, color: '#4bb34b', fontWeight: 500, padding: '4px 8px' }}>
                        Принято
                      </span>
                    ) : (
                      <button
                        disabled={acceptingFriendId === n.from_user?.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAcceptFriend(n.from_user?.id)
                        }}
                        style={{
                          background: '#4bb34b',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 4,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          opacity: acceptingFriendId === n.from_user?.id ? 0.7 : 1
                        }}
                      >
                        {acceptingFriendId === n.from_user?.id ? 'Обработка...' : 'Принять'}
                      </button>
                    )
                  )}
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      if (deletingNotificationId === n.id) return
                      handleDeleteNotification(n.id)
                    }}
                    style={{
                      color: '#828892',
                      cursor: deletingNotificationId === n.id ? 'default' : 'pointer',
                      fontSize: 18,
                      fontWeight: 'bold',
                      padding: '4px 8px',
                      opacity: deletingNotificationId === n.id ? 0.45 : 1
                    }}
                    title="Удалить"
                  >
                    {deletingNotificationId === n.id ? '...' : '×'}
                  </span>
                </div>
              }
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <Text weight="2" style={{ display: 'inline' }}>
                  {n.from_user?.full_name}
                </Text>
                <AdminBadge username={n.from_user?.username} role={n.from_user?.role} />
                <Text style={{ display: 'inline', color: 'var(--vkui--color_text_secondary)', marginLeft: 4 }}>
                  {getNotificationText(n.type)}
                </Text>
              </div>
            </SimpleCell>
          ))
        )}
      </Group>
    </Panel>
  )
}
