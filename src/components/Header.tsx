import React, { useState, useEffect, useRef } from 'react'
import {
  IconButton,
  Text,
  Spinner,
  Switch,
  Avatar
} from '@vkontakte/vkui'
import { 
  Icon28Notification, 
  Icon28UsersOutline, 
  Icon28SettingsOutline 
} from '@vkontakte/icons'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { supabase } from '../supabaseClient'
import { AdminBadge } from './AdminBadge'
import { CustomAvatar } from './CustomAvatar'
import { MiniPlayerBar } from './MiniPlayerBar'
import { useMusicStore } from '../store/useMusicStore'


export const Header: React.FC = () => {
  const { profile, signOut } = useAuthStore()
  const { setStory, unreadNotificationsCount, selectProfile, theme, toggleTheme, activeStory, activePanel, selectedGroupId, showChannelInfo, setShowChannelInfo } = useAppStore()
  const { currentTrack } = useMusicStore()
  // Show mini player in header when music is playing on non-music pages
  const showMiniPlayerInHeader = !!currentTrack && activeStory !== 'music'

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600)

  const [channelInfo, setChannelInfo] = useState<{ name: string; avatar_url: string | null; members_count: number; isManager: boolean } | null>(null)

  useEffect(() => {
    if (activeStory === 'groups' && selectedGroupId && profile) {
      Promise.all([
        supabase
          .from('groups')
          .select('name, avatar_url, members_count')
          .eq('id', selectedGroupId)
          .single(),
        supabase
          .from('group_members')
          .select('role')
          .eq('group_id', selectedGroupId)
          .eq('user_id', profile.id)
          .maybeSingle()
      ]).then(([groupRes, memberRes]) => {
        if (groupRes.data) {
          const role = memberRes.data?.role
          const isManager = role === 'owner' || role === 'admin' || role === 'moderator'
          setChannelInfo({
            name: groupRes.data.name,
            avatar_url: groupRes.data.avatar_url,
            members_count: groupRes.data.members_count,
            isManager
          })
        }
      })
    } else {
      setChannelInfo(null)
    }
  }, [selectedGroupId, activeStory, profile?.id])

  useEffect(() => {
    const handleCountUpdate = (e: Event) => {
      const { groupId, count } = (e as CustomEvent).detail || {}
      if (groupId === selectedGroupId) {
        setChannelInfo(prev => prev ? { ...prev, members_count: count } : null)
      }
    }
    window.addEventListener('channel-members-count-updated', handleCountUpdate)
    return () => {
      window.removeEventListener('channel-members-count-updated', handleCountUpdate)
    }
  }, [selectedGroupId])

  const getSubscriberWord = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'подписчиков';
    if (mod10 === 1) return 'подписчик';
    if (mod10 >= 2 && mod10 <= 4) return 'подписчика';
    return 'подписчиков';
  }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Global Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ users: any[]; posts: any[] }>({ users: [], posts: [] })
  const [loadingResults, setLoadingResults] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false)
        setIsSearchExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isProfileMenuOpen])

  const performSearch = async (query: string) => {
    setLoadingResults(true)
    try {
      // 1. Search profiles
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username, role, avatar_decoration')
        .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(5)

      // 2. Search posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, content, author:profiles!posts_author_id_fkey(full_name)')
        .ilike('content', `%${query}%`)
        .limit(5)

      setSearchResults({
        users: usersData || [],
        posts: postsData || []
      })
      setShowSearchDropdown(true)
    } catch (err) {
      console.error('Error performing global search:', err)
    } finally {
      setLoadingResults(false)
    }
  }

  // Debounce search input
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults({ users: [], posts: [] })
      setShowSearchDropdown(false)
      return
    }

    const delayDebounceFn = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, from_user:profiles!notifications_from_user_id_fkey(id, full_name, avatar_url, username, role, avatar_decoration)')
        .eq('user_id', profile.id)
        .eq('is_read', false) // Only fetch unread notifications for the dropdown
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Error fetching notifications in header dropdown:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) throw error

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))

      // Decrement count
      useAppStore.getState().setUnreadNotificationsCount(Math.max(0, unreadNotificationsCount - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const notif = notifications.find(n => n.id === notificationId)
      const wasUnread = notif && !notif.is_read

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))

      if (wasUnread) {
        useAppStore.getState().setUnreadNotificationsCount(Math.max(0, unreadNotificationsCount - 1))
      }
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  const handleAcceptFriend = async (fromUserId: string, notificationId: string) => {
    if (!profile) return
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

      // Delete/clear the notification
      await handleDeleteNotification(notificationId)
    } catch (err) {
      console.error('Error accepting friend:', err)
    }
  }

  const handleToggleDropdown = () => {
    const nextOpen = !isDropdownOpen
    setIsDropdownOpen(nextOpen)
    if (nextOpen) {
      fetchNotifications()
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Re-fetch notifications if the unread count changes from real-time events while dropdown is open
  useEffect(() => {
    if (isDropdownOpen) {
      fetchNotifications()
    }
  }, [unreadNotificationsCount])

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

  const renderDropdownBodyContent = () => {
    if (loading) {
      return (
        <div className="notification-dropdown-loading" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--vkui--color_text_secondary)' }}>
          Загрузка...
        </div>
      )
    }
    if (notifications.length === 0) {
      return (
        <div className="notification-dropdown-empty" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--vkui--color_text_secondary)' }}>
          Нет новых уведомлений
        </div>
      )
    }
    return notifications.map((n: any) => (
      <div 
        key={n.id} 
        className="notification-dropdown-item"
        style={{ cursor: 'pointer' }}
        onClick={async () => {
          setIsDropdownOpen(false)
          await handleMarkAsRead(n.id)

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
              console.error('Error opening chat from notification dropdown:', err)
              useAppStore.getState().selectProfile(n.from_user.id)
            }
          } else if (n.from_user?.id) {
            useAppStore.getState().selectProfile(n.from_user.id)
          }
        }}
      >
        <CustomAvatar
          size={36}
          src={n.from_user?.avatar_url}
          name={n.from_user?.full_name}
          id={n.from_user?.id}
          decoration={n.from_user?.avatar_decoration}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            setIsDropdownOpen(false)
            useAppStore.getState().selectProfile(n.from_user?.id)
          }}
        />

        <div className="notification-dropdown-item-content">
          <div className="notification-dropdown-item-text">
            <span
              className="notification-dropdown-item-author"
              onClick={(e) => {
                e.stopPropagation()
                setIsDropdownOpen(false)
                useAppStore.getState().selectProfile(n.from_user?.id)
              }}
            >
              {n.from_user?.full_name}
            </span>
            <AdminBadge username={n.from_user?.username} role={n.from_user?.role} />
            <span className="notification-dropdown-item-action"> {getNotificationText(n.type)}</span>
          </div>
          <div className="notification-dropdown-item-time">
            {new Date(n.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="notification-dropdown-item-actions">
          {n.type === 'friend_request' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleAcceptFriend(n.from_user?.id, n.id)
              }}
              className="notification-accept-btn"
            >
              Принять
            </button>
          )}
          <div className="notification-actions-row">
            {n.type !== 'friend_request' && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  handleMarkAsRead(n.id)
                }}
                className="notification-action-read"
                title="Прочитать"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            )}
            <span
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteNotification(n.id)
              }}
              className="notification-action-delete"
              title="Удалить"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </span>
          </div>
        </div>
      </div>
    ))
  }

  const isAboutMode = activeStory === 'about' || activeStory === 'support' || activeStory === 'download'
  const isSettingsMode = activeStory === 'settings' || activeStory === 'balance' || isAboutMode

  const isGroupDetailActive = activeStory === 'groups' && selectedGroupId !== null

  return (
    <div className={`header-container ${activeStory === 'messages' && activePanel === 'chat_detail' ? 'chat-detail-active' : ''} ${isGroupDetailActive ? 'group-detail-active' : ''} ${isSettingsMode ? 'header-settings-mode' : ''}`}>
      {isGroupDetailActive && channelInfo && channelInfo.avatar_url && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${channelInfo.avatar_url})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          filter: 'blur(28px) saturate(3)',
          opacity: 0.35,
          zIndex: 0,
          pointerEvents: 'none'
        }} />
      )}
      {activeStory === 'settings' && (
        <div className="header-mobile-settings">
          <button 
            onClick={() => {
              selectProfile(profile?.id || null);
              setStory('profile');
            }}
            className="settings-back-btn"
            style={{ border: 'none', background: 'transparent', color: 'var(--vkui--color_text_primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <span className="settings-header-title" style={{ fontSize: 18, fontWeight: 600, color: 'var(--vkui--color_text_primary)' }}>Настройки профиля</span>
        </div>
      )}
      {activeStory === 'balance' && (
        <div className="header-mobile-settings">
          <button 
            onClick={() => setStory('feed')}
            className="settings-back-btn"
            style={{ border: 'none', background: 'transparent', color: 'var(--vkui--color_text_primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <span className="settings-header-title" style={{ fontSize: 18, fontWeight: 600, color: 'var(--vkui--color_text_primary)' }}>Мой кошелек</span>
        </div>
      )}
      {isAboutMode && (
        <div className="header-mobile-settings">
          <button 
            onClick={() => setStory('feed')}
            className="settings-back-btn"
            style={{ border: 'none', background: 'transparent', color: 'var(--vkui--color_text_primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <span className="settings-header-title" style={{ fontSize: 18, fontWeight: 600, color: 'var(--vkui--color_text_primary)' }}>
            {activeStory === 'about' ? 'О сервисе' : activeStory === 'support' ? 'Поддержка проекта' : 'Установка приложения'}
          </span>
        </div>
      )}
      {isGroupDetailActive && channelInfo && (
        <div className="header-channel-details" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12, position: 'relative', zIndex: 1 }}>
          <button 
            onClick={() => {
              if (showChannelInfo) {
                setShowChannelInfo(false)
              } else {
                useAppStore.getState().selectGroup(null)
              }
            }}
            className="settings-back-btn"
            style={{ border: 'none', background: 'transparent', color: 'var(--vkui--color_text_primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          
          <div 
            onClick={() => {
              if (!showChannelInfo) {
                setShowChannelInfo(true)
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: showChannelInfo ? 'default' : 'pointer', textAlign: 'left', flex: 1, minWidth: 0 }}
          >
            {/* Аватарка теперь всегда рендерится на своем месте */}
            {channelInfo.avatar_url ? (
              <Avatar size={32} src={channelInfo.avatar_url} />
            ) : (
              <Avatar size={32} style={{ background: 'linear-gradient(135deg, #aa3bff 0%, var(--vkui--color_background_accent) 100%)' }}>
                <Icon28UsersOutline width={18} height={18} />
              </Avatar>
            )}
            
            {showChannelInfo ? (
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--vkui--color_text_primary)', marginLeft: 2 }}>
                Информация
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--vkui--color_text_primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {channelInfo.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--vkui--color_text_secondary)', fontWeight: 400 }}>
                  {channelInfo.members_count} {getSubscriberWord(channelInfo.members_count)}
                </span>
              </div>
            )}
          </div>

          {channelInfo.isManager && !showChannelInfo && (
            <IconButton 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('show-channel-settings'))
              }}
              style={{ color: 'var(--vkui--color_text_secondary)', padding: 8 }}
            >
              <Icon28SettingsOutline width={22} height={22} className="settings-icon-spin" />
            </IconButton>
          )}
        </div>
      )}
      {/* Left side: Logo & Search */}
      {!isGroupDetailActive && (
        <div className="header-left">
        <div
          onClick={() => setStory('feed')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          {/* Volumetric V Logo */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #0077ff 0%, #0055d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: 18,
            boxShadow: '0 2px 5px rgba(0, 119, 255, 0.3)'
          }}>
            V
          </div>
          {activeStory === 'feed' ? (
            <div className="header-feed-title">
              Новостная лента<span className="header-feed-title-sub">vihton</span>
            </div>
          ) : (activeStory === 'groups' && !selectedGroupId) ? (
            <div className="header-feed-title">
              Каналы<span className="header-feed-title-sub">vihton</span>
            </div>
          ) : (
            <Text weight="2" className="header-logo-text">
              vihton
            </Text>
          )}
        </div>

        {/* Global Search Bar or Mini Player */}
        {showMiniPlayerInHeader ? (
          <MiniPlayerBar />
        ) : (
        <div
          ref={searchContainerRef}
          className={`header-search-container ${(isSearchExpanded || searchQuery.trim().length > 0) ? 'expanded' : 'collapsed'}`}
          onClick={() => {
            if (!isSearchExpanded) {
              setIsSearchExpanded(true)
              setTimeout(() => {
                const inputEl = searchContainerRef.current?.querySelector('input')
                if (inputEl) {
                  inputEl.focus()
                }
              }, 50)
            }
          }}
        >
          {/* Magnifying Glass Icon */}
          <div className="search-icon-wrapper">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Input field */}
          <input
            type="text"
            className="search-input-field"
            placeholder="Поиск"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSearchDropdown(true)
            }}
            onFocus={() => {
              setIsSearchExpanded(true)
              setShowSearchDropdown(true)
            }}
          />

          {/* Clear button */}
          {searchQuery.trim().length > 0 && (
            <button
              className="search-clear-button"
              onClick={(e) => {
                e.stopPropagation()
                setSearchQuery('')
                setShowSearchDropdown(false)
                const inputEl = searchContainerRef.current?.querySelector('input')
                if (inputEl) {
                  inputEl.focus()
                }
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          {/* Search Dropdown Results */}
          {showSearchDropdown && searchQuery.trim().length > 0 && (
            <div className="search-dropdown-results" onClick={e => e.stopPropagation()}>
              {loadingResults ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                  <Spinner size="s" />
                </div>
              ) : searchResults.users.length === 0 && searchResults.posts.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>
                  Ничего не найдено
                </div>
              ) : (
                <>
                  {/* Users Section */}
                  {searchResults.users.length > 0 && (
                    <div>
                      <div style={{ padding: '6px 16px', fontSize: 11, fontWeight: 600, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Люди
                      </div>
                      {searchResults.users.map(u => (
                        <div
                          key={u.id}
                          onClick={() => {
                            selectProfile(u.id)
                            setShowSearchDropdown(false)
                            setSearchQuery('')
                          }}
                          className="context-menu-item"
                          style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                        >
                          <CustomAvatar size={28} src={u.avatar_url} name={u.full_name} id={u.id} decoration={u.avatar_decoration} />
                          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_primary)' }}>{u.full_name}</span>
                              <AdminBadge username={u.username} role={u.role} />
                            </div>
                            {u.username && <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>@{u.username}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Divider if both exist */}
                  {searchResults.users.length > 0 && searchResults.posts.length > 0 && (
                    <div style={{ height: 1, backgroundColor: 'var(--vkui--color_separator_primary_alpha, rgba(0, 0, 0, 0.06))', margin: '6px 0' }} />
                  )}

                  {/* Posts Section */}
                  {searchResults.posts.length > 0 && (
                    <div>
                      <div style={{ padding: '6px 16px', fontSize: 11, fontWeight: 600, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Новости
                      </div>
                      {searchResults.posts.map(p => {
                        const previewText = p.content.length > 60 ? p.content.slice(0, 60) + '...' : p.content
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('open-post', { detail: { postId: p.id } }))
                              setShowSearchDropdown(false)
                              setSearchQuery('')
                            }}
                            className="context-menu-item"
                            style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_primary)', textAlign: 'left', wordBreak: 'break-word' }}>
                              {previewText}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>
                              Автор: {p.author?.full_name || 'Неизвестно'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        )}
      </div>
      )}

      {/* Right side: Notifications & Profile Summary */}
      <div className="header-right">
        <div ref={dropdownRef} style={{ position: 'relative', display: 'flex' }}>
          <IconButton
            onClick={handleToggleDropdown}
            className={`notification-bell-btn ${unreadNotificationsCount > 0 ? 'active-bell' : ''}`}
            style={{ position: 'relative' }}
            aria-label="Уведомления"
          >
            <Icon28Notification width={24} height={24} fill="#828892" />
            {unreadNotificationsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#ff3b30',
                border: '1.5px solid var(--vkui--color_background_page, #ffffff)',
                boxShadow: '0 0 4px rgba(255,59,48,0.4)'
              }} />
            )}
          </IconButton>

          {isDropdownOpen && (
            isMobile ? (
              /* Мобильное красивое модальное окно уведомлений */
              <div 
                onClick={() => setIsDropdownOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(15px)',
                  WebkitBackdropFilter: 'blur(15px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 200000,
                  padding: 16
                }}
              >
                <div 
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'var(--vkui--color_background_content, rgba(23, 23, 28, 0.95))',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.1))',
                    borderRadius: 24,
                    width: '100%',
                    maxWidth: 360,
                    maxHeight: '80vh',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--vkui--color_text_primary)' }}>
                      Уведомления
                    </span>
                    <span 
                      onClick={() => setIsDropdownOpen(false)} 
                      style={{ cursor: 'pointer', fontSize: 20, opacity: 0.6, color: 'var(--vkui--color_text_primary)', padding: 4 }}
                    >
                      ✕
                    </span>
                  </div>

                  <div className="notification-dropdown-body" style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
                    {renderDropdownBodyContent()}
                  </div>

                  <div
                    onClick={() => {
                      setIsDropdownOpen(false)
                      setStory('notifications')
                    }}
                    className="notification-dropdown-footer"
                    style={{
                      padding: '14px',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: 13,
                      color: '#0077ff',
                      cursor: 'pointer',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.01)'
                    }}
                  >
                    Показать все
                  </div>
                </div>
              </div>
            ) : (
              /* Десктопное выпадающее меню */
              <div className="notification-dropdown-menu">
                <div className="notification-dropdown-header">
                  Новые Уведомления
                </div>
                <div className="notification-dropdown-body">
                  {renderDropdownBodyContent()}
                </div>
                <div
                  onClick={() => {
                    setIsDropdownOpen(false)
                    setStory('notifications')
                  }}
                  className="notification-dropdown-footer"
                >
                  Показать все
                </div>
              </div>
            )
          )}
        </div>

        {profile && (
          <div ref={profileMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
            >
              <CustomAvatar size={32} src={profile.avatar_url} name={profile.full_name} id={profile.id} decoration={profile.avatar_decoration} />
              <Text weight="2" className="header-profile-name">
                {profile.full_name?.split(' ')[0]}
              </Text>
            </div>

            {isProfileMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  width: 200,
                  backgroundColor: 'var(--vkui--color_background_content, #ffffff)',
                  border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0, 0, 0, 0.08))',
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 1001,
                  marginTop: 8,
                  padding: '6px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  animation: 'fadeIn 0.15s ease-out',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)'
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    selectProfile(null)
                    setStory('profile')
                  }}
                  className="context-menu-item"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Мой профиль</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    setStory('balance')
                  }}
                  className="context-menu-item"
                  style={{ color: '#ff9500', fontWeight: 600 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  <span>Баланс: {profile?.balance ?? 1000} Vihton</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    setStory('settings')
                  }}
                  className="context-menu-item"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Настройки</span>
                </button>

                <button
                  onClick={() => {
                    toggleTheme()
                  }}
                  className="context-menu-item"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {theme === 'dark' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    )}
                    <span>Темная тема</span>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleTheme()
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </button>

                <div style={{ height: '1px', background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    setStory('about')
                  }}
                  className="context-menu-item"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>О сервисе</span>
                </button>


                <div style={{ height: '1px', background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    signOut()
                  }}
                  className="context-menu-item context-menu-item-danger"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Выйти</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
