import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ConfigProvider,
  AdaptivityProvider,
  AppRoot,
  SplitLayout,
  SplitCol,
  View,
  Spinner,
  Text,
  Headline,
  FormItem,
  Input,
  Button,
  Box,
  Spacing
} from '@vkontakte/vkui'
import '@vkontakte/vkui/dist/vkui.css'
import './App.css'

import { useAuthStore } from './store/useAuthStore'
import { useAppStore, setGlobalNavigate } from './store/useAppStore'
import { supabase } from './supabaseClient'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { App as CapacitorApp } from '@capacitor/app'

// Import panels
import { LoginPanel } from './panels/LoginPanel'
import { FeedPanel } from './panels/FeedPanel'
import { FriendsPanel } from './panels/FriendsPanel'
import { ConversationsPanel } from './panels/ConversationsPanel'
import { GroupsPanel } from './panels/GroupsPanel'
import { NotificationsPanel } from './panels/NotificationsPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { BookmarksPanel } from './panels/BookmarksPanel'
import { AboutPanel } from './panels/AboutPanel'
import { MusicPanel } from './panels/MusicPanel'
import { BalancePanel } from './panels/BalancePanel'

const ProfilePanel = lazy(() => import('./panels/ProfilePanel').then(m => ({ default: m.ProfilePanel })))
const ChatPanel = lazy(() => import('./panels/ChatPanel').then(m => ({ default: m.ChatPanel })))

import { Tabbar } from './components/Tabbar'
import { Header } from './components/Header'
import { CustomContextMenu } from './components/CustomContextMenu'
import { CustomAvatar } from './components/CustomAvatar'
import { GalleryOverlay } from './components/GalleryOverlay'
import { PostDetailOverlay } from './components/PostDetailOverlay'
import { GlobalMusicPlayer } from './components/GlobalMusicPlayer'
import { ExpandedMusicPlayer } from './components/ExpandedMusicPlayer'
import { StickerPackModal } from './components/StickerPackModal'
import { AttachmentsDrawer } from './components/AttachmentsDrawer'
import { FireworksCanvas } from './components/FireworksCanvas'

let globalAudioCtx: AudioContext | null = null

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass()
    }
  }
  return globalAudioCtx
}

if (typeof window !== 'undefined') {
  const initAudio = () => {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        window.removeEventListener('click', initAudio)
        window.removeEventListener('touchstart', initAudio)
      })
    } else if (ctx) {
      window.removeEventListener('click', initAudio)
      window.removeEventListener('touchstart', initAudio)
    }
  }
  window.addEventListener('click', initAudio)
  window.addEventListener('touchstart', initAudio)
}

const playSound = (type: 'like' | 'message' | 'friend') => {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    if (type === 'message') {
      const playTone = (time: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, time)
        gain.connect(ctx.destination)
        osc.connect(gain)
        gain.gain.setValueAtTime(0.08, time)
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
        osc.start(time)
        osc.stop(time + duration)
      }
      playTone(ctx.currentTime, 587.33, 0.12)
      playTone(ctx.currentTime + 0.08, 880.00, 0.18)
    } else if (type === 'like') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(180, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.15)
      gain.connect(ctx.destination)
      osc.connect(gain)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    } else if (type === 'friend') {
      const playTone = (time: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, time)
        gain.connect(ctx.destination)
        osc.connect(gain)
        gain.gain.setValueAtTime(0.06, time)
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
        osc.start(time)
        osc.stop(time + duration)
      }
      playTone(ctx.currentTime, 261.63, 0.25)
      playTone(ctx.currentTime + 0.08, 329.63, 0.25)
      playTone(ctx.currentTime + 0.16, 392.00, 0.25)
      playTone(ctx.currentTime + 0.24, 523.25, 0.35)
    }
  } catch (err) {
    console.warn('Audio playback failed or not supported:', err)
  }
}

interface ToastData {
  id: string
  title: string
  text: string
  avatar?: string
  senderId?: string
  senderName?: string
  onClick?: () => void
}

function RouteSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => {
    setGlobalNavigate(navigate)
    return () => setGlobalNavigate(() => {})
  }, [navigate])

  useEffect(() => {
    if (!user) return

    const handleUrlRouting = async () => {
      const path = location.pathname
      const store = useAppStore.getState()
      
      // 1. Redirect empty root to /news
      if (path === '/' || path === '') {
        navigate('/news', { replace: true })
        return
      }

      // 2. /news -> Newsfeed
      if (path === '/news') {
        if (store.activeStory !== 'feed' || store.activePanel !== 'main') {
          store.setStory('feed')
        }
        return
      }

      // 3. /friends -> Friends
      if (path === '/friends') {
        if (store.activeStory !== 'friends' || store.activePanel !== 'main') {
          store.setStory('friends')
        }
        return
      }

      // 4. /settings -> Settings
      if (path === '/settings') {
        if (store.activeStory !== 'settings' || store.activePanel !== 'main') {
          store.setStory('settings')
        }
        return
      }

      // 5. /im -> Dialogs list
      if (path === '/im' || path === '/im/') {
        if (store.activeStory !== 'messages' || store.selectedChatId !== null) {
          store.setStory('messages')
          store.selectChat(null)
        }
        return
      }

      // /bookmarks -> Bookmarks
      if (path === '/bookmarks') {
        if (store.activeStory !== 'bookmarks' || store.activePanel !== 'main') {
          store.setStory('bookmarks')
        }
        return
      }

      // /groups -> Groups
      if (path === '/groups') {
        if (store.activeStory !== 'groups' || store.selectedGroupId !== null) {
          store.setStory('groups')
          store.selectGroup(null)
        }
        return
      }

      // /groups/:groupId
      const groupMatch = path.match(/^\/groups\/([a-zA-Z0-9_-]+)$/)
      if (groupMatch) {
        const groupId = groupMatch[1]
        if (store.selectedGroupId !== groupId) {
          store.selectGroup(groupId)
        }
        return
      }

      // /gr/:groupUsername
      const grMatch = path.match(/^\/gr\/([a-zA-Z0-9_-]+)$/)
      if (grMatch) {
        const groupUsername = grMatch[1].toLowerCase()
        const handleGrRoute = async () => {
          try {
            const { data, error } = await supabase
              .from('groups')
              .select('id')
              .eq('username', groupUsername)
              .maybeSingle()
            if (data && !error) {
              if (store.selectedGroupId !== data.id || store.activeStory !== 'groups') {
                store.setStory('groups')
                store.selectGroup(data.id, groupUsername)
              }
            }
          } catch (e) {
            console.error('Error routing /gr/:', e)
          }
        }
        handleGrRoute()
        return
      }

      // /notifications -> Notifications
      if (path === '/notifications') {
        if (store.activeStory !== 'notifications' || store.activePanel !== 'main') {
          store.setStory('notifications')
        }
        return
      }

      // /music -> Music
      if (path === '/music') {
        if (store.activeStory !== 'music' || store.activePanel !== 'main') {
          store.setStory('music')
        }
        return
      }

      // /about -> About
      if (path === '/about') {
        if (store.activeStory !== 'about' || store.activePanel !== 'main') {
          store.setStory('about')
        }
        return
      }

      // /support -> Support
      if (path === '/support') {
        if (store.activeStory !== 'support' || store.activePanel !== 'main') {
          store.setStory('support')
        }
        return
      }

      // /download -> Download
      if (path === '/download') {
        if (store.activeStory !== 'download' || store.activePanel !== 'main') {
          store.setStory('download')
        }
        return
      }

      // /profile -> Profile (my profile)
      if (path === '/profile') {
        const myId = useAuthStore.getState().user?.id
        if (myId && store.selectedProfileId !== myId) {
          store.selectProfile(myId)
        }
        return
      }

      // 6. /im/[tag] or /im/[chatGroupId]
      const imMatch = path.match(/^\/im\/([a-zA-Z0-9_-]+)$/)
      if (imMatch) {
        const param = imMatch[1]
        
        // Check if it's a UUID (group chat ID)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)
        if (isUUID) {
          if (store.selectedChatId !== param) {
            store.selectChat(param)
          }
          return
        }

        // Otherwise, it is a tag (username) or vid<id>
        try {
          let profileQuery = supabase.from('profiles').select('*')
          if (param.startsWith('vid')) {
            const numId = parseInt(param.replace('vid', ''), 10)
            profileQuery = profileQuery.eq('num_id', numId)
          } else {
            profileQuery = profileQuery.eq('username', param.toLowerCase())
          }
          
          const { data: recipient, error } = await profileQuery.maybeSingle()
          if (recipient && !error) {
            // Find or create conversation with recipient
            let { data: conv } = await supabase
              .from('conversations')
              .select('*')
              .or(`and(participant_1.eq.${user.id},participant_2.eq.${recipient.id}),and(participant_1.eq.${recipient.id},participant_2.eq.${user.id})`)
              .maybeSingle()

            if (!conv) {
              const { data: newConv } = await supabase
                .from('conversations')
                .insert({ participant_1: user.id, participant_2: recipient.id })
                .select()
                .single()
              conv = newConv
            }

            if (conv && store.selectedChatId !== conv.id) {
              store.selectChat(conv.id, recipient)
            }
          }
        } catch (err) {
          console.error('Error routing to chat via tag:', err)
        }
        return
      }

      // /stickerpack/:code
      const stickerPackMatch = path.match(/^\/stickerpack\/([a-zA-Z0-9_-]+)$/)
      if (stickerPackMatch) {
        const code = stickerPackMatch[1]
        store.setOpenStickerPackCode(code)
        navigate('/news', { replace: true })
        return
      }

      // /profile/:profileId
      const profileMatch = path.match(/^\/profile\/([a-zA-Z0-9_-]+)$/)
      if (profileMatch) {
        const param = profileMatch[1]
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)
        if (isUUID) {
          if (store.selectedProfileId !== param) {
            store.selectProfile(param)
          }
          return
        }
      }

      // 7. /vid<id> -> Profile
      const vidMatch = path.match(/^\/vid(\d+)$/)
      if (vidMatch) {
        const numId = parseInt(vidMatch[1], 10)
        try {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('num_id', numId)
            .maybeSingle()

          if (profileData && !error) {
            if (store.selectedProfileId !== profileData.id) {
              store.selectProfile(profileData.id)
            }
          }
        } catch (err) {
          console.error('Error routing to profile via vid URL:', err)
        }
        return
      }

      // 8.1 /([a-zA-Z0-9_-]+)/vbalnc -> Balance page
      const balanceMatch = path.match(/^\/([a-zA-Z0-9_-]+)\/vbalnc$/)
      if (balanceMatch) {
        // If already on balance story, just stay (came from internal setStory call)
        if (store.activeStory === 'balance') return

        const tag = balanceMatch[1].toLowerCase()
        const myProfile = useAuthStore.getState().profile

        // Profile not loaded yet — wait, don't redirect
        if (!myProfile) return

        if (myProfile.username?.toLowerCase() === tag) {
          store.setStory('balance')
        } else {
          // Wrong user's balance page — redirect to own balance
          navigate(`/${myProfile.username!.toLowerCase()}/vbalnc`, { replace: true })
        }
        return
      }

      // 8. /[tag] -> Profile
      const tagMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/)
      if (tagMatch) {
        const tag = tagMatch[1].toLowerCase()
        const reservedPaths = ['feed', 'profile', 'friends', 'chat', 'groups', 'notifications', 'settings', 'bookmarks', 'about', 'login', 'auth', 'im', 'news', 'support', 'download', 'music']
        if (!reservedPaths.includes(tag)) {
          try {
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('id')
              .eq('username', tag)
              .maybeSingle()

            if (profileData && !error) {
              if (store.selectedProfileId !== profileData.id) {
                store.selectProfile(profileData.id)
              }
            }
          } catch (err) {
            console.error('Error routing to profile via tag URL:', err)
          }
        }
      }
    }

    handleUrlRouting()
  }, [location.pathname, user])

  return null
}

function PasswordRecoveryScreen() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { updatePassword, loading, error, clearError, setResettingPassword } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    if (newPassword.length < 6) {
      setLocalError('Пароль должен быть не менее 6 символов')
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Пароли не совпадают')
      return
    }

    const successRes = await updatePassword(newPassword)
    if (successRes) {
      setSuccess(true)
      setTimeout(() => {
        setResettingPassword(false)
        window.location.href = '/'
      }, 2000)
    }
  }

  return (
    <div className="auth-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#0b0c10' }}>
      <div className="auth-bg">
        <div className="auth-bg-blob blob-1"></div>
        <div className="auth-bg-blob blob-2"></div>
        <div className="auth-bg-blob blob-3"></div>
      </div>
      <div className="auth-content" style={{ width: '100%', maxWidth: '400px', padding: '16px', boxSizing: 'border-box' }}>
        <div className="auth-card">
          <Box className="auth-card-header" style={{ textAlign: 'center' }}>
            <Headline level="1" weight="2" className="auth-card-title">
              {success ? 'Успешно!' : 'Новый пароль'}
            </Headline>
            <Text className="auth-card-subtitle" style={{ marginTop: 8 }}>
              {success ? 'Пароль изменен. Вход в аккаунт...' : 'Придумайте и введите новый пароль для входа'}
            </Text>
          </Box>

          <Spacing size={28} />

          {(error || localError) && (
            <div className="auth-error" style={{ marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {localError || error}
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="field-wrapper">
                <FormItem htmlFor="newPassword" className="field-label">Новый пароль</FormItem>
                <div className="auth-input-container">
                  <div className="auth-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="auth-input"
                  />
                </div>
              </div>

              <div className="field-wrapper" style={{ marginTop: 16 }}>
                <FormItem htmlFor="confirmPassword" className="field-label">Повторите новый пароль</FormItem>
                <div className="auth-input-container">
                  <div className="auth-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="auth-input"
                  />
                </div>
              </div>

              <Spacing size={24} />

              <Button
                className="auth-submit-btn"
                size="l"
                stretched
                type="submit"
                loading={loading}
              >
                Сохранить и войти
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const formatMessageTextPreview = (content: string | null): string => {
  if (!content) return 'Вложение'
  const trimmed = content.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && parsed.type === 'channel_forward') {
        return `📢 Запись из канала ${parsed.channelName || ''}`
      }
    } catch(e) {}
  }
  return content
}

function AppContent() {
  const { user, checkingSession, checkSession, isResettingPassword } = useAuthStore()
  const { activeStory, activePanel, selectedGroupId } = useAppStore()
  const [toast, setToast] = useState<ToastData | null>(null)
  const [visitedStories, setVisitedStories] = useState<Set<string>>(new Set([activeStory, 'balance']))

  // --- GLOBAL AUDIO CALL SYSTEM ---
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle')
  const [callPartner, setCallPartner] = useState<{ id: string; name: string; avatar: string } | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [myProfile, setMyProfile] = useState<any>(null)

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  const callStateRef = useRef(callState)
  const callPartnerRef = useRef(callPartner)

  useEffect(() => { callStateRef.current = callState }, [callState])
  useEffect(() => { callPartnerRef.current = callPartner }, [callPartner])

  // Управление классом channel-open для скрытия таббара
  useEffect(() => {
    if (activeStory === 'groups' && selectedGroupId !== null) {
      document.body.classList.add('channel-open')
    } else {
      document.body.classList.remove('channel-open')
    }
  }, [activeStory, selectedGroupId])

  const navigate = useNavigate()

  // Получение моего профиля
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data) setMyProfile(data)
    })
  }, [user])

  // Регистрация нативных push-уведомлений для Android/iOS через Capacitor
  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return

    const registerPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions()
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions()
        }
        if (permStatus.receive !== 'granted') {
          console.warn('Push notification permission denied')
          return
        }

        await PushNotifications.register()

        try {
          await PushNotifications.createChannel({
            id: 'default',
            name: 'Default Channel',
            description: 'General notifications',
            importance: 5,
            visibility: 1,
            sound: 'default',
            vibration: true
          })
        } catch (err) {
          console.warn('Could not create notification channel:', err)
        }

        PushNotifications.addListener('registration', async (token: any) => {
          console.log('Push registration success, token:', token.value)
          
          const fcmSubscription = { fcmToken: token.value }

          // Сохраняем/обновляем токен в таблице user_push_tokens
          const { data: existing } = await supabase
            .from('user_push_tokens')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()

          if (existing) {
            await supabase
              .from('user_push_tokens')
              .update({ subscription: fcmSubscription })
              .eq('user_id', user.id)
          } else {
            await supabase
              .from('user_push_tokens')
              .insert({ user_id: user.id, subscription: fcmSubscription })
          }
        })

        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Push registration error:', error)
        })

        PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
          console.log('Push notification received:', notification)
        })

        PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
          console.log('Push notification action performed:', notification)
          const url = notification.notification.data?.url
          if (url) {
            navigate(url)
          }
        })
      } catch (err) {
        console.error('Error setting up native push:', err)
      }
    }

    registerPush()
  }, [user])

  // Перехват системного жеста и кнопки "Назад" на Android/iOS для Capacitor
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const setupBackButton = async () => {
      const listener = await CapacitorApp.addListener('backButton', () => {
        const store = useAppStore.getState()

        // 1. Закрытие открытых оверлеев, drawers и модалок
        if (store.showAttachmentsDrawer) {
          store.setShowAttachmentsDrawer(false)
          return
        }
        if (store.showChannelInfo) {
          store.setShowChannelInfo(false)
          return
        }
        if (store.openStickerPackCode) {
          store.setOpenStickerPackCode(null)
          return
        }

        // 2. Свайп назад в чате -> возвращаемся в список диалогов
        if (store.activeStory === 'messages' && store.activePanel === 'chat_detail') {
          store.selectChat(null)
          return
        }

        // 3. С настроек/информации канала возвращение в сам канал
        // (уже обработано выше через showChannelInfo)

        // 4. Свайп в канале -> возвращаемся в список сообществ/каналов
        if (store.activeStory === 'groups' && store.activePanel === 'group_detail') {
          store.selectGroup(null)
          return
        }

        // 5. Со списка каналов -> возвращаемся в новости
        if (store.activeStory === 'groups' && store.activePanel === 'main') {
          store.setStory('feed')
          return
        }

        // 6. С настроек -> возвращаемся на мою страницу (профиль)
        if (store.activeStory === 'settings') {
          store.setStory('profile')
          return
        }

        // 7. О приложении (About / Support / Download) -> возвращаемся на мою страницу (профиль)
        if (store.activeStory === 'about' || store.activeStory === 'support' || store.activeStory === 'download') {
          store.setStory('profile')
          return
        }

        // 8. Баланс -> возвращаемся на мою страницу (профиль)
        if (store.activeStory === 'balance') {
          store.setStory('profile')
          return
        }

        // 9. На моей странице (профиль) -> возвращаемся в новости
        if (store.activeStory === 'profile') {
          store.setStory('feed')
          return
        }

        // 10. С других вкладок (друзья, уведомления, музыка, закладки) -> возвращаемся в новости
        if (store.activeStory !== 'feed') {
          store.setStory('feed')
          return
        }

        // 11. Если мы на главной странице новостей и некуда возвращаться -> сворачиваем приложение
        CapacitorApp.exitApp()
      })

      return () => {
        listener.remove()
      }
    }

    const sub = setupBackButton()
    return () => {
      sub.then(cleanup => cleanup())
    }
  }, [])

  // Привязка удаленного аудиопотока
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream
    }
  }, [remoteStream, callState])

  const sendSignal = (targetId: string, event: string, payload: any) => {
    const ch = supabase.channel(`user_calls_send:${targetId}`)
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event,
          payload: { ...payload, senderId: user?.id }
        }).then(() => {
          supabase.removeChannel(ch)
        })
      }
    })
  }

  const cleanupCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    setCallState('idle')
    setCallPartner(null)
    setLocalStream(null)
    setRemoteStream(null)
    setIsMuted(false)
  }

  const createPeerConnection = (partnerId: string) => {
    if (peerConnection.current) {
      peerConnection.current.close()
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream)
      })
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0])
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(partnerId, 'call:ice', {
          targetId: partnerId,
          candidate: event.candidate
        })
      }
    }

    peerConnection.current = pc
    return pc
  }

  const startVoiceCall = async (targetUser: any) => {
    if (!user) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setLocalStream(stream)
      setCallState('calling')
      setCallPartner({
        id: targetUser.id,
        name: targetUser.full_name || 'Собеседник',
        avatar: targetUser.avatar_url || ''
      })

      sendSignal(targetUser.id, 'call:invite', {
        callerId: user.id,
        callerName: myProfile?.full_name || user.email,
        callerAvatar: myProfile?.avatar_url || '',
        targetId: targetUser.id
      })
    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err)
      alert('Не удалось получить доступ к микрофону.')
    }
  }

  const acceptCall = async () => {
    if (!callPartner || !user) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setLocalStream(stream)
      setCallState('connected')

      sendSignal(callPartner.id, 'call:accept', {
        targetId: callPartner.id
      })

      setTimeout(async () => {
        const pc = createPeerConnection(callPartner.id)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        sendSignal(callPartner.id, 'call:sdp', {
          targetId: callPartner.id,
          senderId: user.id,
          sdp: offer
        })
      }, 300)
    } catch (err) {
      console.error('Ошибка при принятии звонка:', err)
      declineCall()
    }
  }

  const declineCall = () => {
    if (!callPartner) return
    sendSignal(callPartner.id, 'call:decline', {
      targetId: callPartner.id
    })
    cleanupCall()
  }

  const hangupCall = () => {
    if (callPartner) {
      sendSignal(callPartner.id, 'call:hangup', {
        targetId: callPartner.id
      })
    }
    cleanupCall()
  }

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  // Подписка на личный канал звонков
  useEffect(() => {
    if (!user) return

    const myChannel = supabase.channel(`user_calls:${user.id}`, { config: { broadcast: { self: false } } })

    myChannel.on('broadcast', { event: 'call:invite' }, (response) => {
      const { callerId, callerName, callerAvatar, targetId } = response.payload
      if (targetId === user.id) {
        if (callStateRef.current !== 'idle') {
          sendSignal(callerId, 'call:decline', { targetId: callerId, reason: 'busy' })
          return
        }
        setCallPartner({ id: callerId, name: callerName, avatar: callerAvatar })
        setCallState('ringing')
      }
    })
    .on('broadcast', { event: 'call:accept' }, (response) => {
      if (response.payload?.targetId === user.id) {
        setCallState('connected')
      }
    })
    .on('broadcast', { event: 'call:decline' }, (response) => {
      if (response.payload?.targetId === user.id) {
        alert(response.payload.reason === 'busy' ? 'Собеседник занят' : 'Звонок отклонен')
        cleanupCall()
      }
    })
    .on('broadcast', { event: 'call:hangup' }, (response) => {
      if (response.payload?.targetId === user.id) {
        cleanupCall()
      }
    })
    .on('broadcast', { event: 'message:new' }, (response) => {
      const msg = response.payload?.message
      const sender = response.payload?.sender
      if (msg && sender) {
        window.dispatchEvent(new CustomEvent('global-message-received', {
          detail: { message: msg }
        }))

        const isCurrentChat = useAppStore.getState().activeStory === 'messages' && useAppStore.getState().selectedChatId === msg.conversation_id
        if (!isCurrentChat) {
          playSound('message')
          const toastId = Math.random().toString()
          setToast({
            id: toastId,
            title: sender.full_name || 'Новое сообщение',
            text: `Сообщение: ${formatMessageTextPreview(msg.content)}`,
            avatar: sender.avatar_url || undefined,
            senderId: msg.sender_id,
            senderName: sender.full_name || undefined,
            onClick: () => {
              useAppStore.getState().selectChat(msg.conversation_id, {
                id: sender.id,
                full_name: sender.full_name,
                avatar_url: sender.avatar_url,
                is_online: true,
                username: sender.username
              })
            }
          })
          useAppStore.getState().setUnreadMessagesCount(useAppStore.getState().unreadMessagesCount + 1)
          setTimeout(() => setToast(prev => prev?.id === toastId ? null : prev), 4000)
        }
      }
    })
    .on('broadcast', { event: 'post:new' }, async (response) => {
      const { post: newPost, group } = response.payload || {}
      if (newPost && group && user) {
        // Проверяем, не заглушен ли данный канал пользователем
        const { data: memberData } = await supabase
          .from('group_members')
          .select('is_muted')
          .eq('group_id', group.id)
          .eq('user_id', user.id)
          .maybeSingle()
          
        if (memberData?.is_muted) {
          return
        }

        // Если пользователь сейчас находится прямо в этом канале, не показываем тост
        const isCurrentGroup = useAppStore.getState().activeStory === 'groups' && useAppStore.getState().selectedGroupId === group.id
        if (isCurrentGroup) return

        playSound('message')
        const toastId = Math.random().toString()
        setToast({
          id: toastId,
          title: group.name || 'Новый пост в канале',
          text: newPost.content ? (newPost.content.length > 60 ? newPost.content.substring(0, 60) + '...' : newPost.content) : 'Вложение',
          avatar: group.avatar_url || undefined,
          senderId: group.id,
          onClick: () => {
            useAppStore.getState().selectGroup(group.id, group.username)
            useAppStore.getState().setStory('groups')
            useAppStore.getState().selectChat(null, null)
          }
        })
        setTimeout(() => setToast(prev => prev?.id === toastId ? null : prev), 4000)
      }
    })
    .on('broadcast', { event: 'messages-read' }, (response) => {
      const { conversationId, readerId } = response.payload || {}
      if (conversationId && readerId) {
        window.dispatchEvent(new CustomEvent('global-messages-read', {
          detail: { conversationId, readerId }
        }))
        useAppStore.getState().recountUnreadMessages(user.id)
      }
    })
    .on('broadcast', { event: 'call:sdp' }, async (response) => {
      if (response.payload?.targetId === user.id) {
        const { sdp, senderId } = response.payload
        try {
          if (sdp.type === 'offer') {
            const pc = createPeerConnection(senderId || callPartnerRef.current?.id || '')
            await pc.setRemoteDescription(new RTCSessionDescription(sdp))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            sendSignal(senderId || callPartnerRef.current?.id || '', 'call:sdp', {
              targetId: senderId || callPartnerRef.current?.id || '',
              senderId: user.id,
              sdp: answer
            })
          } else if (sdp.type === 'answer') {
            if (peerConnection.current) {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp))
            }
          }
        } catch (err) {
          console.error('Ошибка при обработке SDP:', err)
        }
      }
    })
    .on('broadcast', { event: 'call:ice' }, async (response) => {
      if (response.payload?.targetId === user.id) {
        const { candidate } = response.payload
        try {
          if (peerConnection.current) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate))
          }
        } catch (err) {
          console.error('Ошибка при добавлении ICE-кандидата:', err)
        }
      }
    })
    .subscribe()

    // Экспортируем функцию старта звонка
    ;(window as any).startVoiceCall = startVoiceCall

    return () => {
      supabase.removeChannel(myChannel)
      delete (window as any).startVoiceCall
    }
  }, [user, localStream, myProfile])


  // Listen to visualViewport resizing to handle mobile keyboard layout shifting (iOS)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const updateVisualHeight = () => {
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight
      document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`)
    }

    window.visualViewport.addEventListener('resize', updateVisualHeight)
    window.visualViewport.addEventListener('scroll', updateVisualHeight)
    updateVisualHeight()

    return () => {
      window.visualViewport?.removeEventListener('resize', updateVisualHeight)
      window.visualViewport?.removeEventListener('scroll', updateVisualHeight)
    }
  }, [])

  // Web Push Token Registration
  useEffect(() => {
    if (!user) return

    const initPush = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    // Push notifications not supported
          return
        }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
    // Notification permission not granted
          return
        }

        const registration = await navigator.serviceWorker.ready
        
        // Check if subscription already exists with correct VAPID key
        let subscription = await registration.pushManager.getSubscription()
        const keysVersion = localStorage.getItem('viht_vapid_keys_v3')
        if (subscription && !keysVersion) {
          try {
            await subscription.unsubscribe()
            subscription = null
            localStorage.setItem('viht_vapid_keys_v3', 'true')
          } catch (e) {
            console.error('Unsubscribe error:', e)
          }
        }

        if (!subscription) {
          const vapidPublicKey = 'BOXz22wbQguxYIQ_LqEPIZMGkec4jXUbfaIoe4cXPf6b5CXq07UB4Z6gILuWMPpLndxdiq3Db9jGKvhzFfFn8zs'
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          })
          localStorage.setItem('viht_vapid_keys_v3', 'true')
        }

        // Save subscription to database - check if exists first
        const { data: existing } = await supabase
          .from('user_push_tokens')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()
        
        let error
        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('user_push_tokens')
            .update({ subscription: subscription.toJSON() })
            .eq('user_id', user.id)
          error = updateError
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('user_push_tokens')
            .insert({ user_id: user.id, subscription: subscription.toJSON() })
          error = insertError
        }
        
        if (error) {
          console.error('Error saving push token to Supabase:', error)
        }
      } catch (err) {
        console.error('Failed to register push notifications:', err)
      }
    }

    initPush()
  }, [user])

  // Железобетонная страховка удаления has-profile-bg при переходе на другие вкладки
  useEffect(() => {
    const isProfileActive = activeStory === 'profile';
    if (!isProfileActive) {
      document.documentElement.classList.remove('has-profile-bg');
    }
  }, [activeStory]);

  // Сброс статуса прослушивания музыки перед закрытием / обновлением вкладки
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentUser = useAuthStore.getState().user
      if (!currentUser) return

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (supabaseUrl && supabaseAnonKey) {
        let token = ''
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            try {
              const parsed = JSON.parse(localStorage.getItem(key) || '{}')
              token = parsed.access_token || ''
            } catch {}
            break
          }
        }

        const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${currentUser.id}`
        fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': token ? `Bearer ${token}` : `Bearer ${supabaseAnonKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ listening_to: null }),
          keepalive: true
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, []);

  useEffect(() => {
    if (!user) return
    const store = useAppStore.getState()
    
    if (activeStory === 'settings') {
      window.history.replaceState(null, '', '/settings')
    } else if (activeStory === 'friends') {
      window.history.replaceState(null, '', '/friends')
    } else if (activeStory === 'bookmarks') {
      window.history.replaceState(null, '', '/bookmarks')
    } else if (activeStory === 'about') {
      window.history.replaceState(null, '', '/about')
    } else if (activeStory === 'support') {
      window.history.replaceState(null, '', '/support')
    } else if (activeStory === 'download') {
      window.history.replaceState(null, '', '/download')
    } else if (activeStory === 'feed') {
      window.history.replaceState(null, '', '/news')
    } else if (activeStory === 'messages' && !store.selectedChatId) {
      window.history.replaceState(null, '', '/im')
    } else if (activeStory === 'music') {
      window.history.replaceState(null, '', '/music')
    }
  }, [activeStory, user]);

  useEffect(() => {
    if (activeStory) {
      setVisitedStories(prev => {
        // Always add immediately when story becomes active
        const next = new Set(prev)
        next.add(activeStory)
        return next
      })
    }
  }, [activeStory])

  // Load initial unread counts when user logs in
  useEffect(() => {
    if (!user) return
    
    const loadCounts = async () => {
      try {
        // Auto-create Saved Messages ("Избранное") conversation if it doesn't exist
        const { data: selfConvs } = await supabase
          .from('conversations')
          .select('id')
          .eq('participant_1', user.id)
          .eq('participant_2', user.id)
        
        if (!selfConvs || selfConvs.length === 0) {
          await supabase
            .from('conversations')
            .insert({
              participant_1: user.id,
              participant_2: user.id
            })
        }

        // 1. Unread messages — use central debounced recount to avoid 503 errors
        useAppStore.getState().recountUnreadMessages(user.id)

        // 2. Unread notifications
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
        
        useAppStore.getState().setUnreadNotificationsCount(notifCount || 0)

        // 3. Load menu configuration
        useAppStore.getState().loadMenuItems(user.id)

        // 4. Load mutes and blocks
        await useAppStore.getState().fetchMutesAndBlocks(user.id)
      } catch (err) {
        console.error('Error loading initial counts:', err)
      }
    }
    
    loadCounts()
  }, [user])

  // Heartbeat: update last_seen every 3 minutes so online detection via last_seen stays accurate
  useEffect(() => {
    if (!user) return

    const updatePresence = () => {
      supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString(), is_online: true })
        .eq('id', user.id)
        .then(() => {})
    }

    // Update immediately on mount/login
    updatePresence()

    const interval = setInterval(updatePresence, 3 * 60 * 1000) // every 3 minutes

    // On tab visibility change: update last_seen when becoming visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updatePresence()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user?.id])



  // Setup realtime notification channels
  useEffect(() => {
    if (!user) return

    // 1. Subscribe to new messages
    const messageChannel = supabase
      .channel('global-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, async (payload) => {
        const newMessage = payload.new as any
        if (newMessage.sender_id !== user.id) {
          // Check if this conversation belongs to the user
          const { data: conv } = await supabase
            .from('conversations')
            .select('participant_1, participant_2, is_group')
            .eq('id', newMessage.conversation_id)
            .single()
          
          if (conv) {
            let isParticipant = false
            if (conv.is_group) {
              const { data: member } = await supabase
                .from('conversation_members')
                .select('id')
                .eq('conversation_id', newMessage.conversation_id)
                .eq('user_id', user.id)
                .maybeSingle()
              isParticipant = !!member
            } else {
              isParticipant = conv.participant_1 === user.id || conv.participant_2 === user.id
            }

            if (isParticipant) {
              // Check if sender or conversation is muted by current user
              const { mutedUserIds } = useAppStore.getState()
              if (mutedUserIds.has(newMessage.sender_id) || mutedUserIds.has(newMessage.conversation_id)) {
                return
              }

            // Fetch sender profile details
            const { data: sender } = await supabase
              .from('profiles')
              .select('full_name, avatar_url, username')
              .eq('id', newMessage.sender_id)
              .single()

            // Play sound for incoming message
            playSound('message')

            if (newMessage.gift_id) {
              window.dispatchEvent(new CustomEvent('trigger-fireworks'))
            }

            const isCurrentChat = useAppStore.getState().activeStory === 'messages' && useAppStore.getState().selectedChatId === newMessage.conversation_id
            if (sender && !isCurrentChat) {
              const toastId = Math.random().toString()
              setToast({
                id: toastId,
                title: sender.full_name || 'Новое сообщение',
                text: `Сообщение: ${formatMessageTextPreview(newMessage.content)}`,
                avatar: sender.avatar_url || undefined,
                senderId: newMessage.sender_id,
                senderName: sender.full_name || undefined,
                onClick: () => {
                  useAppStore.getState().selectChat(newMessage.conversation_id, {
                    id: newMessage.sender_id,
                    full_name: sender.full_name,
                    avatar_url: sender.avatar_url,
                    is_online: true,
                    username: sender.username
                  })
                }
              })
              // Update badge count
              useAppStore.getState().setUnreadMessagesCount(useAppStore.getState().unreadMessagesCount + 1)
              // Auto hide after 4 seconds
              setTimeout(() => setToast(prev => prev?.id === toastId ? null : prev), 4000)
            }
          }
        }
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages'
    }, async (payload) => {
      const updatedMsg = payload.new as any
      if (updatedMsg?.is_read) {
        useAppStore.getState().recountUnreadMessages(user.id)
      }
    })
    .subscribe()
    // 2. Subscribe to notifications
    const notifChannel = supabase
      .channel('global-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, async (payload) => {
        const newNotif = payload.new as any
        
        // Fetch sender profile details
        const { data: sender } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, username')
          .eq('id', newNotif.from_user_id)
          .single()

        if (sender) {
          let text = ''
          if (newNotif.type === 'friend_request') {
            text = 'Заявка в друзья: хочет добавиться к вам'
            playSound('friend')
          } else if (newNotif.type === 'friend_accepted') {
            text = 'Дружба: принял(а) вашу заявку'
            playSound('friend')
          } else if (newNotif.type === 'like') {
            text = 'Лайк: понравилась ваша запись'
            playSound('like')
          } else if (newNotif.type === 'comment') {
            text = 'Комментарий: оставил(а) комментарий'
            playSound('message')
          } else if (newNotif.type === 'message') {
            const { data: msg } = await supabase
              .from('messages')
              .select('id, content, conversation_id, created_at, audio_id, image_url, video_url, audio_url, reply_to_id, sender_id')
              .eq('sender_id', newNotif.from_user_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (msg) {
              window.dispatchEvent(new CustomEvent('global-message-received', {
                detail: { message: msg }
              }))

              const isCurrentChat = useAppStore.getState().activeStory === 'messages' && useAppStore.getState().selectedChatId === msg.conversation_id
              if (!isCurrentChat) {
                playSound('message')
                const toastId = Math.random().toString()
                setToast({
                  id: toastId,
                  title: sender.full_name || 'Новое сообщение',
                  text: `Сообщение: ${formatMessageTextPreview(msg.content)}`,
                  avatar: sender.avatar_url || undefined,
                  senderId: newNotif.from_user_id,
                  senderName: sender.full_name || undefined,
                  onClick: () => {
                    useAppStore.getState().selectChat(msg.conversation_id, {
                      id: newNotif.from_user_id,
                      full_name: sender.full_name,
                      avatar_url: sender.avatar_url,
                      is_online: true,
                      username: sender.username
                    })
                  }
                })
                useAppStore.getState().setUnreadMessagesCount(useAppStore.getState().unreadMessagesCount + 1)
                setTimeout(() => setToast(prev => prev?.id === toastId ? null : prev), 4000)
              }
            }
            return
          }

          const toastId = Math.random().toString()
          setToast({
            id: toastId,
            title: sender.full_name || 'Уведомление',
            text: text,
            avatar: sender.avatar_url || undefined,
            senderId: newNotif.from_user_id,
            senderName: sender.full_name || undefined,
            onClick: () => {
              if (newNotif.post_id) {
                window.dispatchEvent(new CustomEvent('open-post', { detail: { postId: newNotif.post_id } }))
              } else {
                useAppStore.getState().setStory('notifications')
              }
            }
          })
          // Update badge count
          useAppStore.getState().setUnreadNotificationsCount(useAppStore.getState().unreadNotificationsCount + 1)
          // Auto hide after 4 seconds
          setTimeout(() => setToast(prev => prev?.id === toastId ? null : prev), 4000)
        }
      })
      .subscribe()

    // 3. Subscribe to blocks and mutes changes
    const blocksChannel = supabase
      .channel('global-blocks')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_blocks_mutes'
      }, () => {
        useAppStore.getState().fetchMutesAndBlocks(user.id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(messageChannel)
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(blocksChannel)
    }
  }, [user])

  useEffect(() => {
    // Check session on mount
    checkSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        useAuthStore.setState({ isResettingPassword: true })
      } else if (event === 'SIGNED_IN') {
        const { user } = useAuthStore.getState()
        if (!user) {
          // Fresh login, not a token refresh
          checkSession()
        }
      } else if (event === 'SIGNED_OUT') {
        checkSession()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const handleShowToast = (e: Event) => {
      const customEvent = e as CustomEvent<{
        title: string
        text: string
        avatar?: string
        senderId?: string
        senderName?: string
        duration?: number
      }>
      const detail = customEvent.detail
      if (detail) {
        const toastId = Math.random().toString()
        setToast({
          id: toastId,
          title: detail.title,
          text: detail.text,
          avatar: detail.avatar,
          senderId: detail.senderId,
          senderName: detail.senderName,
          onClick: () => setToast(null)
        })
        setTimeout(() => setToast(prev => prev?.id === toastId ? null : prev), detail.duration || 4000)
      }
    }

    window.addEventListener('show-toast', handleShowToast)
    return () => window.removeEventListener('show-toast', handleShowToast)
  }, [])

  // Disable body scroll when inside chat detail to lock viewport
  useEffect(() => {
    if (activeStory === 'messages' && activePanel === 'chat_detail') {
      document.body.style.overflow = 'hidden'
      document.body.style.height = '100vh'
    } else {
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
  }, [activeStory, activePanel])

  const getStoryStyle = (story: string): React.CSSProperties => {
    const isActive = activeStory === story
    const isChatDetail = story === 'messages' && activePanel === 'chat_detail'
    return {
      display: isActive ? 'flex' : 'none',
      flexDirection: 'column',
      width: '100%',
      flex: 1,
      height: (isActive && !isChatDetail) ? 'auto' : '100%',
      overflow: (isActive && !isChatDetail) ? 'visible' : 'hidden'
    }
  }

  if (checkingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
        <Spinner size="l" />
        <span style={{ fontSize: 16, color: 'var(--vkui--color_text_secondary)' }}>Загрузка Vihton...</span>
      </div>
    )
  }

  if (isResettingPassword) {
    return <PasswordRecoveryScreen />
  }

  if (!user) {
    return (
      <View activePanel="login">
        <LoginPanel id="login" />
      </View>
    )
  }

  return (
    <>
      <RouteSync />
      <Header />
      <div className="profile-bg-blur" />

      {/* iOS Style Dynamic Island Notification Toast */}
      {toast && (
        <div 
          onClick={() => {
            if (toast.onClick) toast.onClick();
            setToast(null);
          }}
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(20, 20, 20, 0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '10px 18px',
            borderRadius: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
            color: '#ffffff',
            cursor: 'pointer',
            animation: 'slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            minWidth: 280,
            maxWidth: 380,
          }}
        >
          {(toast.avatar || toast.senderName) && (
            <CustomAvatar size={36} src={toast.avatar} name={toast.senderName} id={toast.senderId} style={{ border: '2px solid rgba(255, 255, 255, 0.2)' }} />
          )}
          <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
            <Text weight="2" style={{ fontSize: 13, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toast.title}
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
              {toast.text}
            </Text>
          </div>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#0077ff',
            boxShadow: '0 0 10px #0077ff',
            flexShrink: 0
          }} />
        </div>
      )}

      <SplitLayout 
        className={`main-layout-container ${activeStory === 'messages' && activePanel === 'chat_detail' ? 'desktop-chat-layout' : ''} ${activeStory === 'groups' && selectedGroupId !== null ? 'desktop-group-layout' : ''}`}
        style={{ 
          justifyContent: 'center', 
          maxWidth: (activeStory === 'messages' && activePanel === 'chat_detail') 
            ? '100%' 
            : (activeStory === 'about' || activeStory === 'support' || activeStory === 'download') 
              ? 1200 
              : 800,
          margin: activeStory === 'messages' && activePanel === 'chat_detail' ? 0 : '0 auto',
          ...(activeStory === 'messages' && activePanel === 'chat_detail' ? {
            height: '100vh',
            width: '100%',
            overflow: 'hidden'
          } : {})
        }}
      >
        {/* Main Epic view container */}
        <SplitCol 
          width="100%" 
          maxWidth={(activeStory === 'messages' && activePanel === 'chat_detail') 
            ? '100%' 
            : (activeStory === 'about' || activeStory === 'support' || activeStory === 'download') 
              ? 1200 
              : 800} 
          className={`main-split-col ${activeStory === 'messages' && activePanel === 'chat_detail' ? 'chat-active-col' : ''}`}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            width: '100%', 
            flex: 1, 
            overflow: (activeStory === 'messages' && activePanel === 'chat_detail') ? 'hidden' : 'visible' 
          }}>
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: 80 }}><Spinner size="l" /></div>}>
              <div style={getStoryStyle('profile')}>
              {visitedStories.has('profile') && (
                <View id="profile" activePanel="main">
                  <ProfilePanel id="main" />
                </View>
              )}
            </div>
            
            <div style={getStoryStyle('feed')}>
              {visitedStories.has('feed') && (
                <View id="feed" activePanel={activeStory === 'feed' ? activePanel : 'main'}>
                  <FeedPanel id="main" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('messages')}>
              {visitedStories.has('messages') && (
                <View id="messages" activePanel={activeStory === 'messages' ? activePanel : 'main'}>
                  <ConversationsPanel id="main" />
                  <ChatPanel id="chat_detail" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('friends')}>
              {visitedStories.has('friends') && (
                <View id="friends" activePanel="main">
                  <FriendsPanel id="main" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('groups')}>
              {visitedStories.has('groups') && (
                <View id="groups" activePanel={activeStory === 'groups' ? activePanel : 'main'}>
                  <GroupsPanel id="main" />
                  <GroupsPanel id="group_detail" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('notifications')}>
              {visitedStories.has('notifications') && (
                <View id="notifications" activePanel={activeStory === 'notifications' ? activePanel : 'main'}>
                  <NotificationsPanel id="main" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('settings')}>
              {visitedStories.has('settings') && (
                <View id="settings" activePanel={activeStory === 'settings' ? activePanel : 'main'}>
                  <SettingsPanel id="main" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('bookmarks')}>
              {visitedStories.has('bookmarks') && (
                <View id="bookmarks" activePanel={activeStory === 'bookmarks' ? activePanel : 'main'}>
                  <BookmarksPanel id="main" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('about')}>
              {visitedStories.has('about') && (
                <View id="about" activePanel={activeStory === 'about' ? activePanel : 'main'}>
                  <AboutPanel id="main" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('support')}>
              {visitedStories.has('support') && (
                <View id="support" activePanel={activeStory === 'support' ? activePanel : 'main'}>
                  <AboutPanel id="main" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('download')}>
              {visitedStories.has('download') && (
                <View id="download" activePanel={activeStory === 'download' ? activePanel : 'main'}>
                  <AboutPanel id="main" />
                </View>
              )}
            </div>
            <div style={getStoryStyle('music')}>
              {visitedStories.has('music') && (
                <View id="music" activePanel={activeStory === 'music' ? activePanel : 'main'}>
                  <MusicPanel id="main" />
                </View>
              )}
            </div>

            <div style={getStoryStyle('balance')}>
              {visitedStories.has('balance') && (
                <View id="balance" activePanel="main">
                  <BalancePanel id="main" />
                </View>
              )}
            </div>

            </Suspense>
          </div>
        </SplitCol>
      </SplitLayout>

      {/* Floating Glassmorphic Bottom Dock */}
      {!(activeStory === 'messages' && activePanel === 'chat_detail') && <Tabbar />}
      <GlobalMusicPlayer />
      <ExpandedMusicPlayer />
      <CustomContextMenu />
      <GalleryOverlay />
      <PostDetailOverlay />

      {/* GLOBAL WEBRTC AUDIO CALL OVERLAY */}
      {callState !== 'idle' && callPartner && (
        <div className="v-call-overlay">
          <div className="v-call-partner-info">
            <div className="v-call-avatar-container">
              <div className="v-call-avatar-pulse" />
              <div className="v-call-avatar-pulse-2" />
              <CustomAvatar size={100} src={callPartner.avatar} name={callPartner.name} id={callPartner.id} />
            </div>
            <h2 style={{ margin: '16px 0 4px 0', fontSize: 22, fontWeight: 600 }}>{callPartner.name}</h2>
            <div className="v-call-status-text">
              {callState === 'calling' ? 'Исходящий вызов...' : callState === 'ringing' ? 'Входящий вызов...' : 'Разговор...'}
            </div>
          </div>

          {callState === 'connected' && remoteStream && (
            <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
          )}

          {callState === 'ringing' ? (
            <div className="v-call-incoming-actions">
              <button onClick={declineCall} className="v-call-btn hangup" title="Отклонить">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" transform="rotate(135 12 12)"/></svg>
              </button>
              <button onClick={acceptCall} className="v-call-btn accept" title="Принять">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </button>
            </div>
          ) : (
            <div className="v-call-controls-panel">
              <button onClick={toggleMute} className={`v-call-btn mute ${isMuted ? 'active' : ''}`} title="Микрофон">
                {isMuted ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
                )}
              </button>

              <button onClick={hangupCall} className="v-call-btn hangup" title="Завершить вызов">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" transform="rotate(135 12 12)"/></svg>
              </button>
            </div>
          )}
        </div>
      )}
      <StickerPackModal />
      <AttachmentsDrawer />
      <FireworksCanvas />
    </>
  )
}

function App() {
  const theme = useAppStore(state => state.theme)
  return (
    <ConfigProvider colorScheme={theme}>
      <AdaptivityProvider>
        <AppRoot>
          <AppContent />
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default App
