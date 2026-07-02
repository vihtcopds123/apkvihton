import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Panel, Spinner } from '@vkontakte/vkui'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { AdminBadge } from '../components/AdminBadge'
import { FormattedText } from '../components/FormattedText'
import { CustomAvatar } from '../components/CustomAvatar'
import { DialogsList } from '../components/DialogsList'
import { MessageItem } from '../components/MessageItem'
import { ChatInput } from '../components/ChatInput'
import { MusicSelectModal } from '../components/MusicSelectModal'
import { EmojiPicker } from '../components/EmojiPicker'
import { StickerPicker } from '../components/StickerPicker'
import { uploadToTelegram } from '../utils/telegramStorage'

const groupMembersCache: Record<string, GroupMember[]> = {}
const memberTagsCache: Record<string, Record<string, { text: string; color: string }>> = {}
const pinnedMessagesCache: Record<string, { id: string; content: string | null } | null> = {}


interface GroupMember {
  user_id: string
  role: string
  last_read_at?: string | null
  profile: { id: string; full_name: string | null; avatar_url: string | null; username: string | null }
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  image_url: string | null
  video_url?: string | null
  audio_url?: string | null
  is_read: boolean
  is_edited?: boolean
  original_content?: string | null
  is_deleted?: boolean
  created_at: string
  reply_to_id?: string | null
  reply_to_content?: string | null
  reply_to_sender_name?: string | null
  reactions?: Record<string, string[]> | null
  forwarded_from?: string | null
  forwarded_from_id?: string | null
  audio_id?: string | null
  audio?: any | null
  gift_id?: string | null
  gift?: any | null
}

interface Conversation {
  id: string
  updated_at: string
  is_group?: boolean
  group_name?: string | null
  group_avatar_url?: string | null
  created_by?: string | null
  deleted_by?: string[]
  participant: {
    id: string
    full_name: string | null
    avatar_url: string | null
    is_online: boolean
    username: string | null
    num_id?: number | null
    last_seen?: string | null
    role?: string | null
    status_preference?: string | null
    avatar_decoration?: string | null
  }
  lastMessage?: {
    content: string | null
    created_at: string
    sender_id: string
    is_read: boolean
  }
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000
const isRecentlyOnline = (s?: string | null) => !!s && Date.now() - new Date(s).getTime() < ONLINE_THRESHOLD_MS

const formatLastSeen = (s: string | null) => {
  if (!s) return 'был(а) недавно'
  if (isRecentlyOnline(s)) return 'в сети'
  const diff = Date.now() - new Date(s).getTime()
  const min = Math.floor(diff / 60000), h = Math.floor(min / 60), d = Math.floor(h / 24)
  if (min < 1) return 'был(а) только что'
  if (min < 60) return 'был(а) ' + min + ' мин. назад'
  if (h < 24) return 'был(а) ' + h + ' ч. назад'
  if (d === 1) return 'был(а) вчера'
  if (d < 7) return 'был(а) ' + d + ' дн. назад'
  return 'был(а) ' + new Date(s).toLocaleDateString('ru-RU')
}

const formatSeparatorDate = (dateStr: string) => {
  const date = new Date(dateStr), now = new Date()
  const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  return date.getFullYear() === now.getFullYear() ? `${date.getDate()} ${months[date.getMonth()]}` : `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

const formatAudioDuration = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`

const REACTION_EMOJIS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDC4E']

// Проверяет, содержит ли сообщение только эмодзи (стикер)
const isEmojiOnlyMessage = (text: string | null): boolean => {
  if (!text || !text.trim()) return false
  // Проверяем: есть ли буквы или цифры — если да, это не стикер
  if (/[a-zA-Zа-яА-ЯёЁ0-9]/.test(text)) return false
  // Удаляем эмодзи, пробелы, вариации выбора (VS16), ZWJ
  const emojiRegex = /[\p{Emoji_Presentation}\p{Emoji}\u200D\uFE0F\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\s\u20E3]/gu
  const stripped = text.replace(emojiRegex, '')
  return stripped.length === 0 && text.trim().length <= 8
}



const GroupAvatar: React.FC<{ size: number; src?: string | null }> = ({ size, src }) => {
  if (src) return <img src={src} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, #5856d6, #af52de)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
      <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    </div>
  )
}

export const ChatPanel: React.FC<{ id: string }> = ({ id }) => {
  const { profile } = useAuthStore()
  const { selectedChatId, selectedChatParticipant, selectChat, selectProfile, mutedUserIds, blockedUserIds, blockedByUserIds, toggleMuteUser, toggleBlockUser } = useAppStore()
  const isGroupChat = !!selectedChatParticipant?.is_group

  const [messages, setMessages] = useState<Message[]>([])
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [inputText, setInputText] = useState('')
  const [attachedTrack, setAttachedTrack] = useState<any | null>(null)
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768)
  const [isEmojiCollapsed, setIsEmojiCollapsed] = useState(true)
  const [chatSettingsTab, setChatSettingsTab] = useState<'emoji' | 'settings' | 'stickers'>('emoji')
  const [chatSettings, setChatSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('viht_chat_custom_settings')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error(e)
    }
    return {
      fontSize: 14.5,
      fontFamily: 'system-ui',
      fontWeight: '500',
      lineHeight: 1.45,
      messageGap: 12,
      chatMaxWidth: '100%',
      bubbleStyle: 'classic',
      bubbleColor: 'blue'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('viht_chat_custom_settings', JSON.stringify(chatSettings))
    } catch (e) {
      console.error(e)
    }
  }, [chatSettings])

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const typingTimeoutRef = useRef<any>(null)
  const channelRef = useRef<any>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const uploadCancelRef = useRef<(() => void) | null>(null)
  const optionsMenuRef = useRef<HTMLDivElement>(null)

  const [replyTo, setReplyTo] = useState<{ id: string; content: string; senderName: string } | null>(null)
  const [forwardMsg, setForwardMsg] = useState<{ id: string; content: string } | null>(null)
  const [forwardModalOpen, setForwardModalOpen] = useState(false)
  const [forwardSending, setForwardSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<any>(null)
  
  // --- CIRCLE VIDEO STATE & REFS ---
  const [isRecordingCircle, setIsRecordingCircle] = useState(false)
  const [circleStream, setCircleStream] = useState<MediaStream | null>(null)
  const [circleSeconds, setCircleSeconds] = useState(0)
  const circleVideoRef = useRef<HTMLVideoElement>(null)
  const circleRecorderRef = useRef<MediaRecorder | null>(null)
  const circleChunksRef = useRef<Blob[]>([])

  const [inputActionMode, setInputActionMode] = useState<'audio' | 'video'>('audio')

  const [reactionPopup, setReactionPopup] = useState<{ msgId: string; x: number; y: number } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResultIdx, setSearchResultIdx] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; content: string | null } | null>(null)
  const { setShowAttachmentsDrawer } = useAppStore()
  const broadcastNewMessage = (msg: Message) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'new-message',
      payload: { message: msg }
    })

    if (!profile) return
    const senderPayload = {
      id: profile.id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      username: profile.username
    }

    if (isGroupChat) {
      groupMembers.forEach(member => {
        if (member.user_id !== profile.id) {
          const personalChan = supabase.channel(`user_calls:${member.user_id}`)
          personalChan.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              personalChan.send({
                type: 'broadcast',
                event: 'message:new',
                payload: { message: msg, sender: senderPayload }
              }).then(() => {
                supabase.removeChannel(personalChan)
              })
            }
          })
        }
      })
    } else if (selectedChatParticipant) {
      const personalChan = supabase.channel(`user_calls:${selectedChatParticipant.id}`)
      personalChan.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          personalChan.send({
            type: 'broadcast',
            event: 'message:new',
            payload: { message: msg, sender: senderPayload }
          }).then(() => {
            supabase.removeChannel(personalChan)
          })
        }
      })
    }
  }

    const performScrollToMessage = (msgId: string) => {
      const runScroll = () => {
        const el = document.querySelector(`[data-message-id="${msgId}"]`)
        if (el) {
          const container = messagesContainerRef.current
          if (container) {
            const msgRect = (el as HTMLElement).getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            const relativeTop = msgRect.top - containerRect.top + container.scrollTop
            const targetScrollTop = relativeTop - containerRect.height / 2 + (el as HTMLElement).clientHeight / 2
            container.scrollTo({
              top: targetScrollTop,
              behavior: 'smooth'
            })
          }
          const msgEl = el as HTMLElement
          if (!msgEl.classList.contains('v-message-jump-highlight')) {
            msgEl.classList.add('v-message-jump-highlight')
            setTimeout(() => {
              msgEl.classList.remove('v-message-jump-highlight')
            }, 2500)
          }
        }
      }

      runScroll()
      setTimeout(runScroll, 80)
      setTimeout(runScroll, 200)
      setTimeout(runScroll, 450)
      setTimeout(runScroll, 800)
    }

    const handleJumpToMessage = async (msgId: string, createdAt: string) => {
      setShowAttachmentsDrawer(false)
      const exists = messages.some(m => m.id === msgId)
      if (exists) {
        setTimeout(() => {
          performScrollToMessage(msgId)
        }, 300)
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*, audio:music_tracks(id, title, artist, duration, file_url, cover_url), gift:user_gifts(*)')
          .eq('conversation_id', selectedChatId)
          .gte('created_at', createdAt)
          .order('created_at', { ascending: true })
        
        if (error) throw error
        if (data) {
          setMessages(data)
          useAppStore.getState().setMessagesCache(selectedChatId!, data)
          const oldest = data[0]
          if (oldest) {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', selectedChatId)
              .lt('created_at', oldest.created_at)
            setHasMoreMessages((count || 0) > 0)
          }
          
          setTimeout(() => {
            performScrollToMessage(msgId)
          }, 500)
        }
      } catch (e) {
        console.error('Error jumping to message:', e)
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    const handleJump = (e: Event) => {
      const { msgId, msgDate } = (e as CustomEvent).detail
      handleJumpToMessage(msgId, msgDate)
    }
    window.addEventListener('jump-to-message', handleJump)
    return () => window.removeEventListener('jump-to-message', handleJump)
  }, [messages])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [addingMemberSearch, setAddingMemberSearch] = useState('')
  const [availableUsersForGroup, setAvailableUsersForGroup] = useState<{ id: string; full_name: string | null; avatar_url: string | null; username: string | null }[]>([])
  const [showAddMemberPanel, setShowAddMemberPanel] = useState(false)
  const [groupAvatarUploading, setGroupAvatarUploading] = useState(false)
  const [groupAvatarInputRef] = [useRef<HTMLInputElement>(null)]
  const [groupMuted, setGroupMuted] = useState(false)
  const [editingTagUserId, setEditingTagUserId] = useState<string | null>(null)
  const [editingTagText, setEditingTagText] = useState('')

  const [isResizing, setIsResizing] = useState(false)
  const [isHistoryReady, setIsHistoryReady] = useState(false)

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const centerX = window.innerWidth / 2
      const dist = Math.abs(moveEvent.clientX - centerX)
      const newWidth = Math.min(window.innerWidth - 32, Math.max(500, dist * 2))
      
      setChatSettings((prev: any) => ({
        ...prev,
        chatMaxWidth: `${newWidth}px`
      }))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
  const [editingTagColor, setEditingTagColor] = useState('#007aff')
  const TAG_COLORS = ['#007aff', '#ff3b30', '#ff9500', '#30d158', '#bf5af2', '#ff2d55', '#64d2ff', '#ffd60a']
  const [memberTags, setMemberTags] = useState<Record<string, { text: string; color: string }>>({})

  useEffect(() => {
    if (selectedChatId) {
      setGroupMuted(mutedUserIds.has(selectedChatId))
    } else {
      setGroupMuted(false)
    }
  }, [selectedChatId, mutedUserIds])

  // Update browser URL dynamically for dialogue/group chats
  useEffect(() => {
    if (selectedChatId) {
      if (selectedChatParticipant && !selectedChatParticipant.is_group) {
        const tag = selectedChatParticipant.username || `vid${selectedChatParticipant.num_id || ''}`
        window.history.replaceState(window.history.state, '', `/im/${tag}`)
      } else {
        window.history.replaceState(window.history.state, '', `/im/${selectedChatId}`)
      }
    }
  }, [selectedChatId, selectedChatParticipant])

  // Анти-спам
  const sendTimesRef = useRef<number[]>([])
  const [captchaOpen, setCaptchaOpen] = useState(false)
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const pendingSendRef = useRef<(() => void) | null>(null)

  const isBlockedByUs = selectedChatParticipant ? blockedUserIds.has(selectedChatParticipant.id) : false
  const isBlockedByThem = selectedChatParticipant ? blockedByUserIds.has(selectedChatParticipant.id) : false
  const isSystemChat = selectedChatParticipant?.id === '00000000-0000-0000-0000-000000000000'
  const isVihtAdmin = profile?.username === 'viht'
  // viht can write to system chat (broadcast); others can only read
  const isChatRestricted = (!isGroupChat && (isBlockedByUs || isBlockedByThem)) || (isSystemChat && !isVihtAdmin)

  const lastReadByPartnerIdx = useMemo(() => {
    if (!profile || isGroupChat) return -1
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.sender_id === profile.id && m.is_read && !m.id.startsWith('temp-') && !m.is_deleted) return i
    }
    return -1
  }, [messages, profile, isGroupChat])

  const getMemberName = (userId: string) => {
    if (userId === profile?.id) return 'Вы'
    const member = groupMembers.find(gm => gm.user_id === userId)
    const baseName = member?.profile.full_name || 'Собеседник'
    const tag = memberTags[userId]
    return tag ? `${baseName} #${tag.text}` : baseName
  }
  const getMemberAvatar = (userId: string) => {
    if (userId === profile?.id) return profile?.avatar_url
    return groupMembers.find(gm => gm.user_id === userId)?.profile.avatar_url
  }
  const renderMemberName = (userId: string) => {
    const member = groupMembers.find(gm => gm.user_id === userId)
    const baseName = userId === profile?.id ? 'Вы' : member?.profile.full_name || 'Собеседник'
    const tag = memberTags[userId]
    if (!tag) return <span>{baseName}</span>
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {baseName}
        <span style={{ color: tag.color, fontWeight: 700, fontSize: '0.85em', textShadow: `0 0 8px ${tag.color}80, 0 0 16px ${tag.color}40`, padding: '1px 5px', borderRadius: 4, background: `${tag.color}15`, border: `1px solid ${tag.color}40` }}>#{tag.text}</span>
      </span>
    )
  }

  useEffect(() => {
    const handle = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  // Вставка изображения из буфера обмена по Ctrl+V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!selectedChatId || editingMessage) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            // Имитируем input change
            const dt = new DataTransfer()
            dt.items.add(file)
            const event = { target: { files: dt.files } } as unknown as React.ChangeEvent<HTMLInputElement>
            handleFileChange(event)
          }
          break
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [selectedChatId, editingMessage])

  useEffect(() => {
    const close = () => setReactionPopup(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (optionsMenuOpen && optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) setOptionsMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [optionsMenuOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedChatParticipant || !textareaRef.current) return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key.length === 1) textareaRef.current.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedChatParticipant])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight - 6, 120)}px`
    }
  }, [inputText])

  const fetchConversationMeta = async () => {
    if (!selectedChatId) return
    try {
      const { data } = await supabase.from('conversations').select('pinned_message_id').eq('id', selectedChatId).maybeSingle()
      if (data?.pinned_message_id) {
        const { data: msg } = await supabase.from('messages').select('id, content').eq('id', data.pinned_message_id).maybeSingle()
        const pin = msg ? { id: msg.id, content: msg.content } : null
        setPinnedMessage(pin)
        pinnedMessagesCache[selectedChatId] = pin
      } else {
        setPinnedMessage(null)
        pinnedMessagesCache[selectedChatId] = null
      }
    } catch (err) { console.error(err) }
  }

  const fetchGroupMembers = async () => {
    if (!selectedChatId || !isGroupChat) return
    try {
      const { data } = await supabase.from('conversation_members').select('user_id, role, last_read_at, profile:profiles(id, full_name, avatar_url, username)').eq('conversation_id', selectedChatId)
      if (data) {
        const members = data.map((m: any) => ({ user_id: m.user_id, role: m.role, last_read_at: m.last_read_at, profile: m.profile }))
        setGroupMembers(members)
        groupMembersCache[selectedChatId] = members
      }
    } catch (err) { console.error(err) }
  }

  const fetchMemberTags = async () => {
    if (!selectedChatId || !isGroupChat) return
    try {
      const { data, error } = await supabase.from('member_tags').select('user_id, tag_text, tag_color').eq('conversation_id', selectedChatId)
      if (error) { console.error('fetchMemberTags error:', error); return }
      if (data) {
        const tags: Record<string, { text: string; color: string }> = {}
        data.forEach(t => { tags[t.user_id] = { text: t.tag_text, color: t.tag_color } })
        setMemberTags(tags)
        memberTagsCache[selectedChatId] = tags
      }
    } catch (err) { console.error('fetchMemberTags:', err) }
  }

  const handleSetMemberTag = async (userId: string, text: string, color: string) => {
    if (!selectedChatId || !isAdmin) return
    try {
      const { error } = await supabase.from('member_tags').upsert(
        { conversation_id: selectedChatId, user_id: userId, tag_text: text, tag_color: color },
        { onConflict: 'conversation_id,user_id' }
      )
      if (error) { console.error('setMemberTag:', error); return }
      setMemberTags(prev => ({ ...prev, [userId]: { text, color } }))
      setEditingTagUserId(null)
    } catch (err) { console.error(err) }
  }

  const handleRemoveMemberTag = async (userId: string) => {
    if (!selectedChatId || !isAdmin) return
    try {
      const { error } = await supabase.from('member_tags').delete().eq('conversation_id', selectedChatId).eq('user_id', userId)
      if (error) { console.error('removeMemberTag:', error); return }
      setMemberTags(prev => { const n = { ...prev }; delete n[userId]; return n })
      setEditingTagUserId(null)
    } catch (err) { console.error(err) }
  }

  const fetchAvailableUsers = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, username').order('full_name')
      if (data) {
        const memberIds = new Set(groupMembers.map(m => m.user_id))
        setAvailableUsersForGroup(data.filter(p => !memberIds.has(p.id) && p.id !== profile?.id))
      }
    } catch (err) { console.error(err) }
  }

  const handleAddMember = async (userId: string) => {
    if (!selectedChatId) return
    try {
      const addedUser = availableUsersForGroup.find(u => u.id === userId)
      const { error } = await supabase.from('conversation_members').insert({ conversation_id: selectedChatId, user_id: userId, role: 'member' })
      if (error) { console.error('Add member error:', error); return }

      // Добавим системное сообщение
      const addedName = addedUser?.full_name || 'Участник'
      const adminName = profile?.full_name || 'Администратор'
      await supabase.from('messages').insert({
        conversation_id: selectedChatId,
        sender_id: '00000000-0000-0000-0000-000000000000',
        content: `${adminName} пригласил участника ${addedName}`
      })

      fetchGroupMembers()
      setAvailableUsersForGroup(prev => prev.filter(u => u.id !== userId))
    } catch (err) { console.error(err) }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedChatId || !confirm('Удалить участника из группы?')) return
    try {
      const removedMember = groupMembers.find(m => m.user_id === userId)
      const { error } = await supabase.from('conversation_members').delete().eq('conversation_id', selectedChatId).eq('user_id', userId)
      if (error) { console.error('Remove member error:', error); return }

      // Добавим системное сообщение
      const removedName = removedMember?.profile?.full_name || 'Участник'
      const adminName = profile?.full_name || 'Администратор'
      await supabase.from('messages').insert({
        conversation_id: selectedChatId,
        sender_id: '00000000-0000-0000-0000-000000000000',
        content: `${adminName} удалил участника ${removedName}`
      })

      fetchGroupMembers()
      fetchAvailableUsers()
    } catch (err) { console.error(err) }
  }

  const handleDeleteGroup = async () => {
    if (!selectedChatId || !confirm('Вы уверены, что хотите безвозвратно удалить эту группу? Это действие удалит все сообщения и участников для всех пользователей.')) return
    try {
      // 1. Сначала удаляем участников
      await supabase.from('conversation_members').delete().eq('conversation_id', selectedChatId)
      // 2. Удаляем сообщения
      await supabase.from('messages').delete().eq('conversation_id', selectedChatId)
      // 3. Удаляем саму беседу
      const { error } = await supabase.from('conversations').delete().eq('id', selectedChatId)
      if (error) throw error

      // 4. Сбрасываем выбранный чат
      useAppStore.getState().selectChat(null, null)
      setShowGroupSettings(false)
      alert('Группа успешно удалена')
    } catch (err) {
      console.error('Error deleting group:', err)
      alert('Не удалось удалить группу')
    }
  }

  const handleUploadGroupAvatar = async (file: File) => {
    if (!selectedChatId || !profile) return
    setGroupAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `group-avatar-${selectedChatId}-${Date.now()}.${ext}`
      const publicUrl = await uploadToTelegram(file, fileName)
      await supabase.from('conversations').update({ group_avatar_url: publicUrl }).eq('id', selectedChatId)
      useAppStore.getState().selectChat(selectedChatId, { ...selectedChatParticipant!, group_avatar_url: publicUrl })
    } catch (err) { console.error('Avatar upload error:', err) }
    finally { setGroupAvatarUploading(false) }
  }

  const isAdmin = groupMembers.some(m => m.user_id === profile?.id && m.role === 'admin')

  const handlePinMessage = async (msgId: string, currentlyPinned: boolean) => {
    if (!selectedChatId) return
    try {
      await supabase.from('conversations').update({ pinned_message_id: currentlyPinned ? null : msgId }).eq('id', selectedChatId)
      fetchConversationMeta()
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    const handleEdit = (e: Event) => {
      const d = (e as CustomEvent).detail
      setEditingMessage({ id: d.id, content: d.content }); setInputText(d.content); textareaRef.current?.focus()
    }
    const handleDelete = (e: Event) => { const { id } = (e as CustomEvent).detail; setDeleteConfirmId(id) }
    const handleReply = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; content: string }
      const msg = messages.find(m => m.id === d.id)
      const senderName = msg?.sender_id === profile?.id ? (profile?.full_name || 'Vy') : isGroupChat ? getMemberName(msg?.sender_id || '') : (selectedChatParticipant?.full_name || 'Sobesednik')
      setReplyTo({ id: d.id, content: d.content, senderName }); setEditingMessage(null); textareaRef.current?.focus()
    }
    const handleForward = (e: Event) => { const d = (e as CustomEvent).detail as { id: string; content: string }; setForwardMsg(d); setForwardModalOpen(true) }
    const handlePin = (e: Event) => { const { id, isPinned } = (e as CustomEvent).detail; handlePinMessage(id, isPinned) }
    const handleReactEvent = (e: Event) => {
      const { id, emoji } = (e as CustomEvent).detail
      handleReact(id, emoji)
    }
    window.addEventListener('edit-message', handleEdit)
    window.addEventListener('delete-message', handleDelete)
    window.addEventListener('reply-message', handleReply)
    window.addEventListener('forward-message', handleForward)
    window.addEventListener('pin-message', handlePin)
    window.addEventListener('react-message', handleReactEvent)
    return () => {
      window.removeEventListener('edit-message', handleEdit)
      window.removeEventListener('delete-message', handleDelete)
      window.removeEventListener('reply-message', handleReply)
      window.removeEventListener('forward-message', handleForward)
      window.removeEventListener('pin-message', handlePin)
      window.removeEventListener('react-message', handleReactEvent)
    }
  }, [messages, profile, selectedChatParticipant, isGroupChat, groupMembers, selectedChatId])

  useEffect(() => { return () => { if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl) } }, [localPreviewUrl])

  const fetchConversations = async () => {
    if (!profile) return
    const cached = useAppStore.getState().conversationsCache
    if (cached?.length > 0) {
      // Фильтруем удалённые чаты из кэша
      const filtered = cached.filter((c: any) => !(c.deleted_by || []).includes(profile.id))
      setConversations(filtered)
    }
    try {
      // 1. Личные диалоги
      const { data: directData } = await supabase.from('conversations').select(`id, updated_at, is_group, group_name, group_avatar_url, created_by, deleted_by, participant_1:profiles!conversations_participant_1_fkey(id, full_name, avatar_url, is_online, username, num_id, last_seen, role, status_preference, avatar_decoration), participant_2:profiles!conversations_participant_2_fkey(id, full_name, avatar_url, is_online, username, num_id, last_seen, role, status_preference, avatar_decoration)`).or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`).eq('is_group', false).not('deleted_by', 'cs', `{${profile.id}}`).order('updated_at', { ascending: false })
      const directConvs: Conversation[] = (directData || []).map((item: any) => {
        const other = item.participant_1.id === profile.id ? item.participant_2 : item.participant_1
        return { id: item.id, updated_at: item.updated_at, deleted_by: item.deleted_by || [], participant: other }
      })

      // 2. Группы через членство
      const { data: membershipData } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', profile.id)
      const groupConvIds = (membershipData || []).map((m: any) => m.conversation_id)
      let groupConvs: Conversation[] = []
      if (groupConvIds.length > 0) {
        const { data: groupData } = await supabase.from('conversations').select('id, updated_at, deleted_by, is_group, group_name, group_avatar_url, created_by').eq('is_group', true).in('id', groupConvIds).not('deleted_by', 'cs', `{${profile.id}}`)
        for (const gc of groupData || []) {
          await supabase.from('conversation_members').select('*', { count: 'exact', head: true }).eq('conversation_id', gc.id)
          groupConvs.push({
            id: gc.id,
            updated_at: gc.updated_at,
            deleted_by: gc.deleted_by || [],
            is_group: true,
            group_name: gc.group_name,
            group_avatar_url: gc.group_avatar_url,
            created_by: gc.created_by,
            participant: { id: gc.id, full_name: gc.group_name || 'Группа', avatar_url: gc.group_avatar_url, is_online: false, username: null }
          })
        }
      }

      const allConvs = [...directConvs, ...groupConvs]
      for (const c of allConvs) {
        const { data: msg } = await supabase.from('messages').select('*').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (msg) c.lastMessage = msg
      }
      allConvs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      const isSame = cached && cached.length === allConvs.length && cached.every((c: any, idx: number) => 
        c.id === allConvs[idx].id && 
        c.updated_at === allConvs[idx].updated_at &&
        c.lastMessage?.content === allConvs[idx].lastMessage?.content &&
        c.lastMessage?.is_read === allConvs[idx].lastMessage?.is_read
      )

      if (!isSame) {
        setConversations(allConvs)
        useAppStore.getState().setConversationsCache(allConvs)
      }
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    fetchConversations()
    const channel = supabase.channel('realtime:chat_sidebar_convs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any
        setConversations(prev => {
          const conv = prev.find(c => c.id === msg.conversation_id)
          if (!conv) return prev
          const updated = prev.map(c => c.id === msg.conversation_id ? { ...c, lastMessage: msg, updated_at: msg.created_at } : c)
          updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          return updated
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any
        setConversations(prev => prev.map(c => c.id === msg.conversation_id && (c.lastMessage as any)?.id === msg.id ? { ...c, lastMessage: msg } : c))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const updated = payload.new as any
        const cur = useAppStore.getState().selectedChatParticipant
        if (cur && updated.id === cur.id) useAppStore.getState().selectChat(useAppStore.getState().selectedChatId!, { ...cur, is_online: updated.is_online, last_seen: updated.last_seen, status_preference: updated.status_preference })
        setConversations(prev => prev.map(c => {
          if (c.is_group) return c
          if (c.participant.id === updated.id) return { ...c, participant: { ...c.participant, ...updated } }
          return c
        }))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (!isIOS) return

    const handleResize = () => {
      if (window.visualViewport) {
        const height = window.visualViewport.height
        const offsetTop = window.visualViewport.offsetTop
        const chatMain = document.querySelector('.v-chat-main') as HTMLElement
        if (chatMain) {
          chatMain.style.height = `${height}px`
          chatMain.style.setProperty('height', `${height}px`, 'important')
          
          // Detect if keyboard is open
          const isKeyboardOpen = height < window.innerHeight - 100
          if (isKeyboardOpen) {
            chatMain.classList.add('keyboard-open')
          } else {
            chatMain.classList.remove('keyboard-open')
          }

          // Only prevent viewport from shifting while chat is the active visible panel
          if (offsetTop > 0 && document.querySelector('.v-chat-main')) {
            window.scrollTo(0, 0)
            document.body.scrollTop = 0
          }
        }
      }
    }

    const viewport = window.visualViewport
    if (viewport) {
      // Only listen to resize (keyboard open/close), NOT scroll
      // Listening to scroll causes the whole page to jump to top when user scrolls
      // on other panels (FeedPanel, ProfilePanel) on iOS
      viewport.addEventListener('resize', handleResize)
      handleResize()
    }

    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', handleResize)
      }
      const chatMain = document.querySelector('.v-chat-main') as HTMLElement
      if (chatMain) {
        chatMain.style.removeProperty('height')
      }
    }

  }, [selectedChatId])

  const updateGlobalUnreadCount = () => {
    if (profile?.id) {
      useAppStore.getState().recountUnreadMessages(profile.id)
    }
  }

  const updateLastReadAt = async () => {
    if (!profile || !selectedChatId || !isGroupChat) return
    try {
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', selectedChatId)
        .eq('user_id', profile.id)
    } catch (e) {
      console.error('Error updating last_read_at:', e)
    }
  }

  const fetchMessages = async () => {
    if (!selectedChatId) return
    const cached = useAppStore.getState().messagesCache[selectedChatId]
    if (!cached?.length) setLoading(true)
    else { 
      setMessages(cached)
      setLoading(false)
      scrollToBottom() 
    }
    try {
      const { data, error } = await supabase.from('messages').select('*, audio:music_tracks(id, title, artist, duration, file_url, cover_url), gift:user_gifts(*)').eq('conversation_id', selectedChatId).order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      if (data) {
        const asc = [...data].reverse()
        const isSame = cached && cached.length === asc.length && cached.every((m, idx) => 
          m.id === asc[idx].id && 
          m.content === asc[idx].content && 
          m.is_read === asc[idx].is_read && 
          m.is_deleted === asc[idx].is_deleted &&
          JSON.stringify(m.reactions || {}) === JSON.stringify(asc[idx].reactions || {})
        )

        if (!isSame) {
          setMessages(asc)
          useAppStore.getState().setMessagesCache(selectedChatId, asc)
          scrollToBottom()
        }
        setHasMoreMessages(data.length === 50)
        if (profile) {
          await supabase.from('messages').update({ is_read: true }).eq('conversation_id', selectedChatId).neq('sender_id', profile.id)
          updateGlobalUnreadCount()
          updateLastReadAt()
          
          window.dispatchEvent(new CustomEvent('global-messages-read', {
            detail: { conversationId: selectedChatId, readerId: profile.id }
          }))
          
          channelRef.current?.send({
            type: 'broadcast',
            event: 'messages-read',
            payload: { conversationId: selectedChatId, readerId: profile.id }
          })
          
          if (selectedChatParticipant && !isGroupChat) {
            const personalChan = supabase.channel(`user_calls:${selectedChatParticipant.id}`)
            personalChan.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                personalChan.send({
                  type: 'broadcast',
                  event: 'messages-read',
                  payload: { conversationId: selectedChatId, readerId: profile.id }
                }).then(() => {
                  supabase.removeChannel(personalChan)
                })
              }
            })
          }

          if (selectedChatParticipant && !isGroupChat) {
            await supabase.from('notifications').delete().eq('user_id', profile.id).eq('type', 'message').eq('from_user_id', selectedChatParticipant.id)
            const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('is_read', false)
            useAppStore.getState().setUnreadNotificationsCount(count || 0)
          }
        }
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const scrollToBottom = () => {
    const run = () => {
      const container = messagesContainerRef.current
      if (container) {
        container.scrollTop = container.scrollHeight + 99999
        setIsHistoryReady(true)
      }
    }
    // Multiple retries to handle images/media loading and rendering
    requestAnimationFrame(run)
    setTimeout(run, 50)
    setTimeout(run, 200)
    setTimeout(run, 500)
    setTimeout(run, 1000)
    setTimeout(run, 1800)
  }

  useEffect(() => {
    if (selectedChatId && messages.length > 0) useAppStore.getState().setMessagesCache(selectedChatId, messages)
  }, [messages, selectedChatId])

  const handleScroll = async () => {
    const c = messagesContainerRef.current
    if (!c || loadingOlder || !hasMoreMessages || !selectedChatId || c.scrollTop > 50) return
    setLoadingOlder(true)
    const oldest = messages[0]
    if (!oldest) { setLoadingOlder(false); return }
    try {
      const { data, error } = await supabase.from('messages').select('*, audio:music_tracks(id, title, artist, duration, file_url, cover_url)').eq('conversation_id', selectedChatId).lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(30)
      if (error) throw error
      if (data?.length) {
        const older = [...data].reverse()
        const prevH = c.scrollHeight, prevT = c.scrollTop
        setMessages(prev => { const next = [...older, ...prev]; useAppStore.getState().setMessagesCache(selectedChatId, next); return next })
        setTimeout(() => { if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - prevH + prevT }, 0)
        if (data.length < 30) setHasMoreMessages(false)
      } else setHasMoreMessages(false)
    } catch (err) { console.error(err) }
    finally { setLoadingOlder(false) }
  }

  useEffect(() => {
    const cached = useAppStore.getState().messagesCache[selectedChatId || '']
    if (cached?.length) {
      setMessages(cached)
      setIsHistoryReady(true)
    } else {
      setMessages([])
      setIsHistoryReady(false)
    }
    setHasMoreMessages(true)
    setLoadingOlder(false)

    // Load static cached pinned message
    if (selectedChatId && pinnedMessagesCache[selectedChatId] !== undefined) {
      setPinnedMessage(pinnedMessagesCache[selectedChatId])
    } else {
      setPinnedMessage(null)
    }

    // Load static cached group members and tags
    if (selectedChatId && groupMembersCache[selectedChatId]) {
      setGroupMembers(groupMembersCache[selectedChatId])
    } else {
      setGroupMembers([])
    }
    
    if (selectedChatId && memberTagsCache[selectedChatId]) {
      setMemberTags(memberTagsCache[selectedChatId])
    } else {
      setMemberTags({})
    }

    setShowGroupSettings(false)
    setShowAddMemberPanel(false)
    setReplyTo(null)
    setEditingMessage(null)
    setInputText('')
    
    fetchMessages()
    fetchConversationMeta()
    if (isGroupChat) { 
      fetchGroupMembers()
      fetchMemberTags() 
    }
    if (profile?.id) { 
      useAppStore.getState().fetchMutesAndBlocks(profile.id) 
    }
    setIsPartnerTyping(false)
    // Автофокус отключен для предотвращения автовызова клавиатуры на телефонах
    if (!selectedChatId) return

    // Используем общее имя канала для всех участников чата
    const channelName = `chat:${selectedChatId}`

    const handleIncomingMessage = async (msg: Message) => {
      if (msg.conversation_id !== selectedChatId) return

      if (msg.audio_id && !msg.audio) {
        try {
          const { data } = await supabase
            .from('music_tracks')
            .select('id, title, artist, duration, file_url, cover_url')
            .eq('id', msg.audio_id)
            .single()
          if (data) msg.audio = data
        } catch (e) {
          console.error(e)
        }
      }
      if (msg.gift_id && !msg.gift) {
        try {
          const { data } = await supabase
            .from('user_gifts')
            .select('*')
            .eq('id', msg.gift_id)
            .single()
          if (data) msg.gift = data
        } catch (e) {
          console.error('Error fetching gift detail:', e)
        }
      }
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        if (msg.sender_id === profile?.id) {
          const ti = prev.findIndex(m => m.id.startsWith('temp-') && (m.content === msg.content || m.audio_id === msg.audio_id))
          if (ti !== -1) { const n = [...prev]; n[ti] = msg; return n }
        }
        return [...prev, msg]
      })
      scrollToBottom()

      if (profile && msg.sender_id !== profile.id) {
        supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then(async () => {
          updateGlobalUnreadCount()
          updateLastReadAt()
          
          window.dispatchEvent(new CustomEvent('global-messages-read', {
            detail: { conversationId: selectedChatId, readerId: profile.id }
          }))
          
          channelRef.current?.send({
            type: 'broadcast',
            event: 'messages-read',
            payload: { conversationId: selectedChatId, readerId: profile.id }
          })
          
          if (selectedChatParticipant && !isGroupChat) {
            const personalChan = supabase.channel(`user_calls:${selectedChatParticipant.id}`)
            personalChan.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                personalChan.send({
                  type: 'broadcast',
                  event: 'messages-read',
                  payload: { conversationId: selectedChatId, readerId: profile.id }
                }).then(() => {
                  supabase.removeChannel(personalChan)
                })
              }
            })
          }

          if (!isGroupChat) {
            await supabase.from('notifications').delete().eq('user_id', profile.id).eq('type', 'message').eq('from_user_id', msg.sender_id)
            const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('is_read', false)
            useAppStore.getState().setUnreadNotificationsCount(count || 0)
          }
        })
      }
    }

    const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedChatId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          handleIncomingMessage(payload.new as Message)
        } else if (payload.eventType === 'UPDATE') {
          const msg = payload.new as Message
          const processUpdate = async () => {
            if (msg.audio_id && !msg.audio) {
              try {
                const { data } = await supabase
                  .from('music_tracks')
                  .select('id, title, artist, duration, file_url, cover_url')
                  .eq('id', msg.audio_id)
                  .single()
                if (data) msg.audio = data
              } catch (e) {
                console.error(e)
              }
            }
            setMessages(prev => prev.map(m => m.id === msg.id ? msg : m))
          }
          processUpdate()
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_tags', filter: `conversation_id=eq.${selectedChatId}` }, () => {
        fetchMemberTags()
      })
      .on('broadcast', { event: 'typing' }, (response) => {
        if (response.payload?.userId !== profile?.id) {
          setIsPartnerTyping(response.payload.isTyping)
        }
      })
      .on('broadcast', { event: 'new-message' }, (response) => {
        if (response.payload?.message) {
          handleIncomingMessage(response.payload.message)
        }
      })
      .on('broadcast', { event: 'messages-read' }, (response) => {
        const { conversationId, readerId } = response.payload
        if (conversationId === selectedChatId) {
          setMessages(prev => prev.map(m => m.sender_id !== readerId ? { ...m, is_read: true } : m))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${selectedChatId}` }, (payload) => {
        const updatedMember = payload.new as any
        setGroupMembers(prev => prev.map(m => m.user_id === updatedMember.user_id ? { ...m, last_read_at: updatedMember.last_read_at } : m))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (profile && selectedChatId) {
            channel.send({
              type: 'broadcast',
              event: 'messages-read',
              payload: { conversationId: selectedChatId, readerId: profile.id }
            })
          }
        }
      })

    const handleGlobalMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail.message
      if (msg) {
        handleIncomingMessage(msg)
      }
    }
    const handleGlobalRead = (e: Event) => {
      const { conversationId, readerId } = (e as CustomEvent).detail
      if (conversationId === selectedChatId) {
        setMessages(prev => prev.map(m => m.sender_id !== readerId ? { ...m, is_read: true } : m))
      }
    }
    window.addEventListener('global-message-received', handleGlobalMessage)
    window.addEventListener('global-messages-read', handleGlobalRead)

    channelRef.current = channel
    return () => {
      channel.send({ type: 'broadcast', event: 'typing', payload: { userId: profile?.id, isTyping: false } })
      channelRef.current = null; supabase.removeChannel(channel)
      window.removeEventListener('global-message-received', handleGlobalMessage)
      window.removeEventListener('global-messages-read', handleGlobalRead)
    }
  }, [selectedChatId, profile?.id])

  const handleInputChange = (text: string) => {
    setInputText(text)
    if (!profile || !selectedChatId || !channelRef.current) {
      return
    }
    if (!isTyping) { 
      setIsTyping(true) 
      channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: profile.id, isTyping: true } })
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false) 
      channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: profile.id, isTyping: false } })
    }, 2500)
  }

  // Быстрая отправка emoji как стикера (если поле пустое)
  const handleEmojiSelect = (emoji: string) => {
    if (!inputText.trim()) {
      // Отправляем как стикер
      setInputText(emoji)
      setTimeout(() => handleSendMessage(), 50)
    } else {
      setInputText(prev => prev + emoji)
    }
    textareaRef.current?.focus()
  }

  // Анти-спам: >5 сообщений за 2 секунды → капча
  const generateCaptcha = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    setCaptchaCode(code)
    setCaptchaInput('')
    return code
  }

  const checkSpam = (sendAction: () => void) => {
    const now = Date.now()
    sendTimesRef.current = sendTimesRef.current.filter(t => now - t < 2000)
    if (sendTimesRef.current.length >= 5) {
      pendingSendRef.current = sendAction
      generateCaptcha()
      setCaptchaOpen(true)
      return false
    }
    sendTimesRef.current.push(now)
    return true
  }

  const handleCaptchaSubmit = () => {
    if (captchaInput === captchaCode) {
      setCaptchaOpen(false)
      pendingSendRef.current?.()
      pendingSendRef.current = null
    } else {
      generateCaptcha()
      setCaptchaInput('')
    }
  }

  const doSendMessage = async () => {
    if (!profile || !selectedChatId || sending) return

    if (isChatRestricted) {
      alert('Чат заблокирован.')
      return
    }

    if (!isGroupChat && selectedChatParticipant) {
      const { data: blockCheck, error: blockErr } = await supabase
        .from('chat_blocks_mutes')
        .select('is_blocked')
        .eq('user_id', selectedChatParticipant.id)
        .eq('target_user_id', profile.id)
        .eq('is_blocked', true)
        .maybeSingle()

      if (!blockErr && blockCheck?.is_blocked) {
        alert('Пользователь заблокировал вас, отправка сообщений невозможна.')
        useAppStore.getState().fetchMutesAndBlocks(profile.id)
        return
      }
    }

    setIsTyping(false)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: profile.id, isTyping: false } })
    const trimmed = inputText.trim()
    if (editingMessage) {
      if (!trimmed) { alert('Сообщение не может быть пустым!'); return }
      const orig = messages.find(m => m.id === editingMessage.id)?.original_content || editingMessage.content
      setEditingMessage(null); setInputText('')
      await supabase.from('messages').update({ content: trimmed, is_edited: true, original_content: orig }).eq('id', editingMessage.id)
      return
    }
    if (isUploading || (!trimmed && !uploadedUrl && !attachedTrack)) return
    setSending(true)
    const text = inputText
    let videoUrl: string | null = null
    let imageUrl: string | null = null

    if (uploadedUrl) {
      const isVid = attachedFile?.type.startsWith('video/') || attachedFile?.name.toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)
      if (isVid) {
        const baseUrl = uploadedUrl.split('?')[0]
        videoUrl = videoTitle ? `${baseUrl}?title=${encodeURIComponent(videoTitle)}` : baseUrl
      } else {
        imageUrl = uploadedUrl
      }
    }

    const currentReply = replyTo
    const trackToSend = attachedTrack
    setInputText(''); setAttachedFile(null); setUploadedUrl(null); setLocalPreviewUrl(''); setUploadProgress(0); setReplyTo(null); setVideoTitle(''); setAttachedTrack(null)
    const tempId = 'temp-' + Date.now()
    const tempMsg: Message = { 
      id: tempId, 
      conversation_id: selectedChatId, 
      sender_id: profile.id, 
      content: text || null, 
      image_url: imageUrl, 
      video_url: videoUrl, 
      is_read: false, 
      created_at: new Date().toISOString(), 
      reply_to_id: currentReply?.id || null, 
      reply_to_content: currentReply?.content || null, 
      reply_to_sender_name: currentReply?.senderName || null,
      audio_id: trackToSend?.id || null,
      audio: trackToSend
    }
    setMessages(prev => [...prev, tempMsg]); scrollToBottom()
    try {
      // === SYSTEM BROADCAST: viht sends to system chat -> broadcast to ALL users via RPC ===
      if (isSystemChat && isVihtAdmin) {
        const { data, error } = await supabase
          .rpc('broadcast_system_message', {
            p_content: text || null,
            p_image_url: imageUrl,
            p_video_url: videoUrl,
            p_audio_id: trackToSend?.id || null
          });
        if (error) throw error;
        if (data) {
          const fullData = {
            ...data,
            audio: trackToSend || null
          };
          setMessages(prev => prev.map(m => m.id === tempId ? fullData : m));
          broadcastNewMessage(fullData);
        }
      } else {
        // Normal message send
        const { data, error } = await supabase
          .from('messages')
          .insert({ 
            conversation_id: selectedChatId, 
            sender_id: profile.id, 
            content: text || null, 
            image_url: imageUrl, 
            video_url: videoUrl, 
            reply_to_id: currentReply?.id || null, 
            reply_to_content: currentReply?.content || null, 
            reply_to_sender_name: currentReply?.senderName || null,
            audio_id: trackToSend?.id || null
          })
          .select('*, audio:music_tracks(id, title, artist, duration, file_url, cover_url)')
          .single()
        if (error) throw error
        if (data) {
          setMessages(prev => prev.map(m => m.id === tempId ? data : m))
          broadcastNewMessage(data);
        }
      }
    } catch (err: any) { alert('Ошибка отправки сообщения:\n' + (err?.message || JSON.stringify(err))); setMessages(prev => prev.filter(m => m.id !== tempId)) }
    finally { setSending(false); scrollToBottom() }
  }

  const sendSticker = async (stickerUrl: string) => {
    if (!profile || !selectedChatId) return
    setSending(true)
    const imageUrl = stickerUrl + '?sticker=true'
    const tempId = 'temp-' + Date.now()
    const tempMsg: Message = { 
      id: tempId, 
      conversation_id: selectedChatId, 
      sender_id: profile.id, 
      content: null, 
      image_url: imageUrl, 
      video_url: null, 
      is_read: false, 
      created_at: new Date().toISOString(), 
      reply_to_id: null, 
      reply_to_content: null, 
      reply_to_sender_name: null,
      audio_id: null,
      audio: null
    }
    setMessages(prev => [...prev, tempMsg]); scrollToBottom()
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ 
          conversation_id: selectedChatId, 
          sender_id: profile.id, 
          content: null, 
          image_url: imageUrl, 
          video_url: null, 
          reply_to_id: null, 
          reply_to_content: null, 
          reply_to_sender_name: null,
          audio_id: null
        })
        .select('*, audio:music_tracks(id, title, artist, duration, file_url, cover_url)')
        .single()
      if (error) throw error
      if (data) {
        setMessages(prev => prev.map(m => m.id === tempId ? data : m))
        broadcastNewMessage(data);
      }
    } catch (err: any) { 
      alert('Ошибка отправки стикера:\n' + (err?.message || JSON.stringify(err)))
      setMessages(prev => prev.filter(m => m.id !== tempId)) 
    } finally { 
      setSending(false); scrollToBottom() 
    }
  }

  const handleSendMessage = () => {
    if (!checkSpam(doSendMessage)) return
    doSendMessage()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); await sendVoiceMessage(blob) }
      mr.start(100); mediaRecorderRef.current = mr
      setIsRecording(true); setRecordingSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch { alert('Нет доступа к микрофону.') }
  }
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    setIsRecording(false); clearInterval(recordTimerRef.current)
  }
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null; mediaRecorderRef.current.onstop = null
      if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
    }
    setIsRecording(false); clearInterval(recordTimerRef.current); audioChunksRef.current = []
  }

  // --- CIRCLE VIDEO FUNCTIONS ---
  const startCircleVideo = async () => {
    try {
      // iOS требует exact constraints для стабильности
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: isIOS ? { exact: 360 } : { ideal: 360 }, 
          height: isIOS ? { exact: 360 } : { ideal: 360 }, 
          facingMode: 'user' 
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      setCircleStream(stream)
      setIsRecordingCircle(true)
      setCircleSeconds(0)
      circleChunksRef.current = []

      // Определение поддерживаемого формата для кроссплатформенности (в т.ч. iOS)
      let options = {}
      let extension = 'webm'
      let mimeType = 'video/webm'

      if (isIOS) {
        // iOS приоритет - webm если есть, иначе fallback
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          options = { mimeType: 'video/webm;codecs=vp9,opus' }
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          options = { mimeType: 'video/webm' }
        } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
          options = { mimeType: 'video/mp4;codecs=h264,aac' }
          extension = 'mp4'
          mimeType = 'video/mp4'
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          options = { mimeType: 'video/mp4' }
          extension = 'mp4'
          mimeType = 'video/mp4'
        }
      } else {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          options = { mimeType: 'video/webm;codecs=vp9,opus' }
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          options = { mimeType: 'video/webm' }
        } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
          options = { mimeType: 'video/mp4;codecs=h264,aac' }
          extension = 'mp4'
          mimeType = 'video/mp4'
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          options = { mimeType: 'video/mp4' }
          extension = 'mp4'
          mimeType = 'video/mp4'
        }
      }

      const recorder = new MediaRecorder(stream, options)
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          circleChunksRef.current.push(e.data)
        }
      }
      recorder.onstop = async () => {
        // Принудительно глушим все треки стрима при остановке
        stream.getTracks().forEach(track => track.stop())
        
        const videoBlob = new Blob(circleChunksRef.current, { type: mimeType })
        const fileName = `circle-${Date.now()}.${extension}`
        
        setIsUploading(true)
        setUploadProgress(0)
        
        try {
          const publicUrl = await uploadToTelegram(videoBlob, fileName, (percent) => {
            setUploadProgress(Math.round(percent))
          })
          setUploadProgress(100)
          setIsUploading(false)
          
          if (publicUrl) {
            const separator = publicUrl.includes('?') ? '&' : '?';
            await handleSendCircleMessage(publicUrl + separator + 'circle=true')
          }
        } catch (err) {
          console.error('Ошибка загрузки кружочка:', err)
          alert('Не удалось загрузить видеокружочек: ' + (err as Error).message + '\nStack: ' + (err as Error).stack)
          setIsUploading(false)
        }
      }

      recorder.start(100)
      circleRecorderRef.current = recorder
    } catch (err) {
      console.error('Ошибка доступа к камере для кружочка:', err)
      alert('Не удалось получить доступ к камере/микрофону: ' + (err as Error).message)
    }
  }

  const stopCircleVideo = (shouldSend: boolean) => {
    if (circleRecorderRef.current && circleRecorderRef.current.state !== 'inactive') {
      if (!shouldSend) {
        circleRecorderRef.current.onstop = null
      }
      circleRecorderRef.current.stop()
    }
    
    // Мгновенное и гарантированное освобождение камеры и микрофона
    if (circleStream) {
      circleStream.getTracks().forEach(track => {
        track.stop()
      })
    }
    
    // Также на всякий случай останавливаем треки, если они еще остались в стриме рекордера
    if (circleRecorderRef.current && (circleRecorderRef.current as any).stream) {
      const recStream = (circleRecorderRef.current as any).stream as MediaStream
      if (recStream && recStream.getTracks) {
        recStream.getTracks().forEach(track => track.stop())
      }
    }

    setCircleStream(null)
    setIsRecordingCircle(false)
  }

  const handleSendCircleMessage = async (videoUrl: string) => {
    if (!profile || !selectedChatId) return
    const tempId = 'temp-circle-' + Date.now()
    const newMsg = {
      id: tempId,
      conversation_id: selectedChatId,
      sender_id: profile.id,
      content: null,
      image_url: videoUrl,
      is_read: false,
      created_at: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, newMsg as any])
    scrollToBottom()
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedChatId,
          sender_id: profile.id,
          content: null,
          image_url: videoUrl,
          is_read: false
        })
        .select()
        .single()
        
      if (!error && data) {
        setMessages(prev => prev.map(m => m.id === tempId ? data : m))
        broadcastNewMessage(data);
      }
    } catch (err) {
      console.error('Ошибка отправки кружочка:', err)
    }
  }

  useEffect(() => {
    let interval: any = null
    if (isRecordingCircle) {
      interval = setInterval(() => {
        setCircleSeconds(prev => {
          const next = prev + 1
          if (next >= 60) {
            setTimeout(() => {
              stopCircleVideo(true)
            }, 0)
          }
          return next
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecordingCircle])

  // Эффект для назначения stream на video элемент
  useEffect(() => {
    if (circleStream && circleVideoRef.current) {
      const video = circleVideoRef.current
      video.srcObject = circleStream
      video.playsInline = true
      video.muted = true
      video.autoplay = true
      
      video.onloadedmetadata = async () => {
        try {
          await video.play()
        } catch (err) {
          // iOS требует пользовательского взаимодействия
          console.error('Video autoplay blocked:', err)
          // Пробуем с unmuted
          video.muted = false
          try {
            await video.play()
          } catch (err2) {
            console.error('Video still blocked:', err2)
          }
        }
      }
      
      video.onerror = (e) => {
        console.error('Video element error:', e)
      }
    }
  }, [circleStream])
  const sendVoiceMessage = async (audioBlob: Blob) => {
    if (!profile || !selectedChatId) return
    setSending(true)
    try {
      const fileName = `voice-${Date.now()}.webm`
      const publicUrl = await uploadToTelegram(audioBlob, fileName)
      const { data, error: insertErr } = await supabase
        .from('messages')
        .insert({ conversation_id: selectedChatId, sender_id: profile.id, content: '[Голосовое сообщение]', audio_url: publicUrl })
        .select()
        .single()
      if (insertErr) {
        console.error('Insert error:', insertErr)
        throw insertErr
      }
      if (data) {
        setMessages(prev => [...prev, data as Message])
        broadcastNewMessage(data);
      }
      scrollToBottom()
    } catch (err) { 
      console.error('Send voice error:', err)
      alert('Ошибка отправки голосового.')
    }
    finally { setSending(false) }
  }

  const handleReact = async (msgId: string, emoji: string) => {
    if (!profile) return
    setReactionPopup(null)
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = { ...(msg.reactions || {}) }
    const users = [...(reactions[emoji] || [])]
    const idx = users.indexOf(profile.id)
    if (idx === -1) users.push(profile.id); else users.splice(idx, 1)
    if (!users.length) delete reactions[emoji]; else reactions[emoji] = users
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m))
    await supabase.from('messages').update({ reactions }).eq('id', msgId)
  }

  const handleForwardTo = async (convId: string) => {
    if (!profile || !forwardMsg) return
    setForwardSending(true)
    try {
      const origMsg = messages.find(m => m.id === forwardMsg.id)
      const senderName = origMsg?.sender_id === profile.id ? (profile.full_name || 'Vy') : isGroupChat ? getMemberName(origMsg?.sender_id || '') : (selectedChatParticipant?.full_name || '')
      await supabase.from('messages').insert({ conversation_id: convId, sender_id: profile.id, content: forwardMsg.content, forwarded_from: senderName, forwarded_from_id: origMsg?.sender_id || null })
      setForwardModalOpen(false); setForwardMsg(null)
      if (convId === selectedChatId) fetchMessages()
    } catch (err) { console.error(err) }
    finally { setForwardSending(false) }
  }

  const searchMatches = useMemo(() =>
    searchQuery.trim() ? messages.filter(m => !m.is_deleted && m.content?.toLowerCase().includes(searchQuery.toLowerCase())) : []
  , [messages, searchQuery])

  useEffect(() => {
    setSearchResultIdx(0)
    if (searchMatches.length > 0) document.querySelector(`[data-message-id="${searchMatches[0].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [searchQuery])

  const navigateSearch = (dir: 'prev' | 'next') => {
    if (!searchMatches.length) return
    const newIdx = dir === 'next' ? (searchResultIdx + 1) % searchMatches.length : (searchResultIdx - 1 + searchMatches.length) % searchMatches.length
    setSearchResultIdx(newIdx)
    document.querySelector(`[data-message-id="${searchMatches[newIdx].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleCancelUpload = () => {
    if (uploadCancelRef.current) uploadCancelRef.current()
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
    setAttachedFile(null); setLocalPreviewUrl(''); setIsUploading(false); setUploadProgress(0); setUploadedUrl(null); setVideoTitle('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Render function for group settings panel (shared between desktop sidebar and mobile overlay)
  const renderGroupSettingsContent = () => (
    <>
      {/* Header */}
      <div style={{ height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{isAdmin ? 'Настройки группы' : 'Участники'}</span>
        <button onClick={() => { setShowGroupSettings(false); setShowAddMemberPanel(false); setEditingTagUserId(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', fontSize: 20, lineHeight: 1 }}>x</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {/* Group Avatar - visible to all */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ position: 'relative', cursor: isAdmin ? 'pointer' : 'default' }}
            onClick={() => { if (isAdmin) groupAvatarInputRef.current?.click() }}>
            <GroupAvatar size={80} src={selectedChatParticipant?.group_avatar_url} />
            {isAdmin && (
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: '#007aff', border: '2px solid var(--vkui--color_background_content)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
            )}
            {groupAvatarUploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size="s" /></div>}
            <input ref={groupAvatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadGroupAvatar(f); e.target.value = '' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>{selectedChatParticipant?.group_name || 'Группа'}</div>
          <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', marginTop: 2 }}>{groupMembers.length} участ{groupMembers.length === 1 ? 'ник' : groupMembers.length < 5 ? 'ника' : 'ников'}</div>
        </div>

        {/* Notifications toggle - visible to all */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: 'var(--vkui--color_background_secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Уведомления</span>
            </div>
            <button onClick={() => {
              const newMuted = !groupMuted
              setGroupMuted(newMuted)
              if (profile && selectedChatId) {
                if (newMuted) useAppStore.getState().toggleMuteUser(profile.id, selectedChatId)
                else useAppStore.getState().toggleMuteUser(profile.id, selectedChatId)
              }
            }} style={{ width: 44, height: 26, borderRadius: 13, background: groupMuted ? 'var(--vkui--color_background_secondary)' : '#007aff', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: groupMuted ? 2 : 20, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
        </div>

        {/* Members section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Участники</span>
            {isAdmin && (
              <button onClick={() => { setShowAddMemberPanel(!showAddMemberPanel); if (!showAddMemberPanel) fetchAvailableUsers() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007aff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                Добавить
              </button>
            )}
          </div>

          {/* Add member panel - admin only */}
          {showAddMemberPanel && isAdmin && (
            <div style={{ marginBottom: 12, padding: '8px', borderRadius: 12, background: 'var(--vkui--color_background_secondary)', border: '1px solid var(--vkui--color_separator_primary_alpha)' }}>
              <input value={addingMemberSearch} onChange={e => setAddingMemberSearch(e.target.value)}
                placeholder="Поиск пользователя..."
                style={{ width: '100%', background: 'var(--vkui--color_background_content)', border: 'none', outline: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--vkui--color_text_primary)', marginBottom: 8, boxSizing: 'border-box' }} />
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {availableUsersForGroup.filter(u => !addingMemberSearch.trim() || u.full_name?.toLowerCase().includes(addingMemberSearch.toLowerCase()) || u.username?.toLowerCase().includes(addingMemberSearch.toLowerCase())).map(u => (
                  <div key={u.id} onClick={() => handleAddMember(u.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--vkui--color_background_content)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <CustomAvatar size={30} src={u.avatar_url} name={u.full_name} id={u.id} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name}</div>
                      {u.username && <div style={{ fontSize: 10, color: 'var(--vkui--color_text_secondary)' }}>@{u.username}</div>}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#007aff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
                  </div>
                ))}
                {availableUsersForGroup.length === 0 && <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', textAlign: 'center', padding: 12 }}>Все пользователи уже в группе</div>}
              </div>
            </div>
          )}

          {/* Members list */}
          {groupMembers.map(m => {
            const memberTag = memberTags[m.user_id]
            return (
              <div key={m.user_id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 10, transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--vkui--color_background_secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div onClick={() => { if (m.user_id !== profile?.id) selectProfile(m.user_id) }}
                    style={{ cursor: m.user_id !== profile?.id ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <CustomAvatar size={36} src={m.profile.avatar_url} name={m.profile.full_name} id={m.user_id} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span>{m.user_id === profile?.id ? 'Вы' : m.profile.full_name}</span>
                        {memberTag && <span style={{ color: memberTag.color, fontWeight: 700, fontSize: 11, textShadow: `0 0 6px ${memberTag.color}80`, padding: '1px 5px', borderRadius: 3, background: `${memberTag.color}18`, border: `1px solid ${memberTag.color}50`, flexShrink: 0, lineHeight: 1.3 }}>#{memberTag.text}</span>}
                      </div>
                      {m.role === 'admin' && <div style={{ fontSize: 11, color: '#007aff', fontWeight: 600 }}>Администратор</div>}
                    </div>
                  </div>
                  {m.user_id !== profile?.id && (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
                      {/* Tag button - admin only */}
                      {isAdmin && (
                        <button onClick={() => {
                          if (editingTagUserId === m.user_id) { setEditingTagUserId(null); setEditingTagText('') }
                          else { setEditingTagUserId(m.user_id); setEditingTagText(memberTag?.text || ''); setEditingTagColor(memberTag?.color || '#007aff') }
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: memberTag ? memberTag.color : 'var(--vkui--color_text_secondary)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', opacity: 0.7, transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                          title={memberTag ? 'Изменить тег' : 'Назначить тег'}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                        </button>
                      )}
                      {memberTag && isAdmin && (
                        <button onClick={() => handleRemoveMemberTag(m.user_id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', opacity: 0.7 }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                          title="Убрать тег">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                      {/* Remove member button - admin only */}
                      {isAdmin && (
                        <button onClick={() => handleRemoveMember(m.user_id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', opacity: 0.7, transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                          title="Удалить из группы">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                  {/* Tag button for self - admin can tag themselves */}
                  {m.user_id === profile?.id && isAdmin && (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
                      <button onClick={() => {
                        if (editingTagUserId === m.user_id) { setEditingTagUserId(null); setEditingTagText('') }
                        else { setEditingTagUserId(m.user_id); setEditingTagText(memberTag?.text || ''); setEditingTagColor(memberTag?.color || '#007aff') }
                      }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: memberTag ? memberTag.color : 'var(--vkui--color_text_secondary)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', opacity: 0.7, transition: 'opacity 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                        title={memberTag ? 'Изменить тег' : 'Назначить тег'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                      </button>
                      {memberTag && (
                        <button onClick={() => handleRemoveMemberTag(m.user_id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', opacity: 0.7 }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                          title="Убрать тег">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {/* Tag editing inline - admin only */}
                {editingTagUserId === m.user_id && selectedChatId && isAdmin && (
                  <div style={{ padding: '8px 8px 8px 54px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={editingTagText} onChange={e => setEditingTagText(e.target.value.slice(0, 20))}
                        placeholder="Тег (напр. друг, враг, босс)"
                        style={{ flex: 1, background: 'var(--vkui--color_background_content)', border: '1px solid var(--vkui--color_separator_primary_alpha)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--vkui--color_text_primary)', outline: 'none' }}
                        onKeyDown={e => { if (e.key === 'Enter' && editingTagText.trim()) handleSetMemberTag(m.user_id, editingTagText.trim(), editingTagColor); if (e.key === 'Escape') setEditingTagUserId(null) }} />
                      <button onClick={() => { if (editingTagText.trim()) handleSetMemberTag(m.user_id, editingTagText.trim(), editingTagColor) }}
                        style={{ background: '#007aff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                        OK
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {TAG_COLORS.map(c => (
                        <button key={c} onClick={() => setEditingTagColor(c)}
                          style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: editingTagColor === c ? '2.5px solid #fff' : '2px solid transparent', cursor: 'pointer', boxShadow: editingTagColor === c ? `0 0 10px ${c}` : 'none', transition: 'all 0.15s' }} />
                      ))}
                    </div>
                    {editingTagText.trim() && (
                      <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>Предпросмотр: <span style={{ color: editingTagColor, fontWeight: 700, textShadow: `0 0 6px ${editingTagColor}80` }}>#{editingTagText.trim()}</span></div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {isAdmin && (
          <div style={{ marginTop: 24, padding: '0 4px' }}>
            <button 
              onClick={handleDeleteGroup}
              style={{
                width: '100%',
                background: 'rgba(255, 59, 48, 0.1)',
                border: '1px solid rgba(255, 59, 48, 0.3)',
                borderRadius: 12,
                padding: '12px',
                color: '#ff3b30',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 59, 48, 0.18)'
                e.currentTarget.style.borderColor = '#ff3b30'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 59, 48, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(255, 59, 48, 0.3)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              Удалить группу безвозвратно
            </button>
          </div>
        )}
      </div>
    </>
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const MAX_SIZE = 2048 * 1024 * 1024 // 2 ГБ
    if (file.size > MAX_SIZE) { alert('Файл больше 2 ГБ'); return }

    let defaultTitle = ''
    if (file.type.startsWith('video/') || file.name.toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)) {
      defaultTitle = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
    }

    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    setAttachedFile(file); setLocalPreviewUrl(preview); setIsUploading(true); setUploadProgress(0); setUploadedUrl(null); setVideoTitle(defaultTitle)
    const fileExt = file.name.split('.').pop()
    const fileName = `chat-${Date.now()}.${fileExt}`
    let isCancelled = false
    let currentProgress = 0
    let fakeInterval: any = null

    uploadCancelRef.current = () => { 
      isCancelled = true
      if (fakeInterval) clearInterval(fakeInterval)
    }

    try {
      const publicUrl = await uploadToTelegram(file, fileName, (percent) => {
        if (isCancelled) return
        
        // Scale real upload progress to 85%
        const mapped = Math.round(percent * 0.85)
        currentProgress = mapped
        setUploadProgress(mapped)

        // When browser upload is complete (reaches 85%), slowly increment up to 98%
        // while the server processes the file and uploads it to Telegram
        if (percent === 100 && !fakeInterval) {
          fakeInterval = setInterval(() => {
            if (isCancelled) {
              clearInterval(fakeInterval)
              return
            }
            if (currentProgress < 98) {
              currentProgress += 1
              setUploadProgress(currentProgress)
            } else {
              clearInterval(fakeInterval)
            }
          }, 800)
        }
      })

      if (isCancelled) return
      if (fakeInterval) clearInterval(fakeInterval)
      setUploadProgress(100); setUploadedUrl(publicUrl); setIsUploading(false)
    } catch (err: any) { 
      if (!isCancelled) { 
        console.error('File upload error:', err)
        alert('Ошибка загрузки файла'); 
        handleCancelUpload() 
      } 
    }
  }

  const handleImageClick = (mediaUrl: string) => {
    const mediaUrls: string[] = []
    messages.forEach(m => {
      if (m.is_deleted) return
      if (m.image_url) mediaUrls.push(m.image_url)
      if (m.video_url) mediaUrls.push(m.video_url)
    })
    const idx = mediaUrls.indexOf(mediaUrl)
    window.dispatchEvent(new CustomEvent('open-gallery', { 
      detail: { 
        images: mediaUrls, 
        startIndex: idx >= 0 ? idx : 0, 
        disableComments: !isGroupChat 
      } 
    }))
  }

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return <FormattedText content={text} />
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return <span>{parts.map((p, i) => p.toLowerCase() === query.toLowerCase() ? <mark key={i} style={{ background: '#ffcc00', color: '#000', borderRadius: 2, padding: '0 1px' }}>{p}</mark> : <span key={i}>{p}</span>)}</span>
  }



  const bubbleColorMap = {
    blue: 'linear-gradient(135deg, #007aff 0%, #0055d4 100%)',
    purple: 'linear-gradient(135deg, #7f00ff 0%, #e100ff 100%)',
    emerald: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    coral: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
    space: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'
  }

  const bubbleStyleMap = {
    classic: { me: '16px 16px 2px 16px', other: '16px 16px 16px 2px' },
    capsule: { me: '24px', other: '24px' },
    sharp: { me: '4px 16px 16px 16px', other: '16px 4px 16px 16px' },
    origami: { me: '24px 4px 24px 12px', other: '4px 24px 12px 24px' },
    cosmo: { me: '20px 20px 4px 20px', other: '20px 20px 20px 4px' },
    none: { me: '0px', other: '0px' }
  }

  const currentStyle = bubbleStyleMap[(chatSettings.bubbleStyle || 'classic') as keyof typeof bubbleStyleMap] || bubbleStyleMap.classic
  const currentColor = bubbleColorMap[(chatSettings.bubbleColor || 'blue') as keyof typeof bubbleColorMap] || bubbleColorMap.blue

  const chatCustomStyles = {
    '--chat-font-size': `${chatSettings.fontSize}px`,
    '--chat-font-family': chatSettings.fontFamily === 'system-ui' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : chatSettings.fontFamily,
    '--chat-font-weight': chatSettings.fontWeight,
    '--chat-line-height': chatSettings.lineHeight,
    '--chat-message-gap': `${chatSettings.messageGap}px`,
    '--chat-max-width': chatSettings.chatMaxWidth,
    '--chat-bubble-radius-me': currentStyle.me,
    '--chat-bubble-radius-other': currentStyle.other,
    '--chat-bubble-me-bg': currentColor
  } as React.CSSProperties

  return (
    <Panel id={id}>
      <div className={`v-chat-layout ${isResizing ? 'is-resizing' : ''} ${chatSettings.bubbleStyle === 'none' ? 'bubble-style-none' : ''}`} onContextMenu={(e) => e.preventDefault()} style={chatCustomStyles}>
        {isDesktop && (
          <>
            <div className="v-chat-resizer left" onMouseDown={(e) => handleResizeStart(e)} />
            <div className="v-chat-resizer right" onMouseDown={(e) => handleResizeStart(e)} />
          </>
        )}
        <div className="v-chat-body">
          <DialogsList 
            conversations={conversations as any}
            selectedChatId={selectedChatId}
            profileId={profile?.id}
            selectChat={selectChat}
            isRecentlyOnline={isRecentlyOnline}
            GroupAvatar={GroupAvatar}
          />

        <div className="v-chat-main">
          {selectedChatParticipant ? (
            <>
              <div className="v-chat-header" style={{ backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)' }}>
                {searchOpen ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
                    <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="v-chat-header-btn">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <input ref={searchInputRef} autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск в контактах..."
                      style={{ flex: 1, background: 'var(--vkui--color_background_secondary)', border: 'none', outline: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13.5, color: 'var(--vkui--color_text_primary)' }}
                      onKeyDown={e => e.key === 'Enter' && navigateSearch('next')} />
                    {searchMatches.length > 0 && <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', whiteSpace: 'nowrap' }}>{searchResultIdx + 1}/{searchMatches.length}</span>}
                    <button onClick={() => navigateSearch('prev')} className="v-chat-header-btn" disabled={!searchMatches.length}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                    <button onClick={() => navigateSearch('next')} className="v-chat-header-btn" disabled={!searchMatches.length}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
                  </div>
                ) : (
                  <div className="v-chat-header-info" style={{ flex: 1, minWidth: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); selectChat(null) }} className="v-chat-header-btn chat-back-button" style={{ marginRight: 4 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    </button>
                    <div 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (isGroupChat) setShowGroupSettings(!showGroupSettings); 
                        else selectProfile(selectedChatParticipant.id); 
                      }} 
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {selectedChatParticipant.id === profile?.id
                        ? <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #2f80ed, #007aff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div>
                        : isGroupChat ? <GroupAvatar size={38} src={selectedChatParticipant.group_avatar_url} />
                        : <CustomAvatar size={38} src={selectedChatParticipant.avatar_url} name={selectedChatParticipant.full_name} id={selectedChatParticipant.id} decoration={selectedChatParticipant.avatar_decoration} />
                      }
                    </div>
                    <div 
                      className="v-chat-header-text" 
                      style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => setShowAttachmentsDrawer(true)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span 
                          className="v-chat-header-name"
                          style={selectedChatParticipant.id === '00000000-0000-0000-0000-000000000000' ? { color: '#ff9800', fontWeight: 'bold' } : undefined}
                        >
                          {selectedChatParticipant.id === profile?.id ? 'Избранное' : isGroupChat ? (selectedChatParticipant.group_name || 'Группа') : selectedChatParticipant.full_name}
                        </span>
                        {!isGroupChat && selectedChatParticipant.id !== profile?.id && (
                          selectedChatParticipant.id === '00000000-0000-0000-0000-000000000000'
                            ? <span style={{ fontSize: 13, verticalAlign: 'middle' }}>🤖</span>
                            : <AdminBadge username={selectedChatParticipant.username} role={selectedChatParticipant.role} />
                        )}
                        {!isGroupChat && selectedChatParticipant.id !== profile?.id && isPartnerTyping && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'typing-pencil 1.4s infinite', flexShrink: 0 }}>
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            <path d="m15 5 4 4"/>
                          </svg>
                        )}
                      </div>
                      <span className={`v-chat-header-status ${isPartnerTyping ? 'typing' : isGroupChat ? 'offline' : selectedChatParticipant.id === profile?.id ? 'offline' : selectedChatParticipant.id === '00000000-0000-0000-0000-000000000000' ? 'online' : (selectedChatParticipant.status_preference !== 'offline' && isRecentlyOnline(selectedChatParticipant.last_seen)) ? 'online' : 'offline'}`}>
                        {isGroupChat
                          ? (isPartnerTyping ? 'кто-то печатает...' : `${selectedChatParticipant.members_count || groupMembers.length || '?'} участников`)
                          : selectedChatParticipant.id === profile?.id ? 'Вы общаетесь сами с собой'
                          : isPartnerTyping ? 'печатает...'
                          : selectedChatParticipant.id === '00000000-0000-0000-0000-000000000000' ? 'Бот'
                          : selectedChatParticipant.status_preference === 'offline' ? 'Скрыть статус'
                          : formatLastSeen(selectedChatParticipant.last_seen || null)
                        }
                      </span>
                    </div>
                  </div>
                )}
                <div className="v-chat-header-actions">
                  {!searchOpen && (
                    <button onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }} className="v-chat-header-btn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                  )}
                  {!isGroupChat && selectedChatParticipant.id !== profile?.id && !searchOpen && (
                    <button onClick={() => window.dispatchEvent(new CustomEvent('show-toast', { detail: { title: 'Звонки', text: 'Функция звонков находится в разработке!', duration: 4000 } }))} className="v-chat-header-btn" title="Позвонить" style={{ color: '#007aff' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </button>
                  )}
                  {!searchOpen && (
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setOptionsMenuOpen(!optionsMenuOpen)} className="v-chat-header-btn">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                      </button>
                      {optionsMenuOpen && (
                        <div ref={optionsMenuRef} className="v-chat-menu">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation()
                              setShowAttachmentsDrawer(true)
                              setTimeout(() => setOptionsMenuOpen(false), 50)
                            }} 
                            className="v-chat-menu-item"
                          >
                            <span>Вложения</span>
                          </button>
                          
                          {!isGroupChat && selectedChatParticipant && selectedChatParticipant.id !== profile?.id && selectedChatParticipant.id !== '00000000-0000-0000-0000-000000000000' && profile && (
                            <>
                              <button onClick={async (e) => { e.stopPropagation(); setOptionsMenuOpen(false); await toggleMuteUser(profile.id, selectedChatParticipant.id) }} className="v-chat-menu-item">
                                <span>{mutedUserIds.has(selectedChatParticipant.id) ? 'Вкл. уведомления' : 'Заглушить'}</span>
                              </button>
                              <button onClick={async (e) => { e.stopPropagation(); setOptionsMenuOpen(false); if (confirm(blockedUserIds.has(selectedChatParticipant.id) ? 'Разблокировать?' : 'Заблокировать?')) await toggleBlockUser(profile.id, selectedChatParticipant.id) }} className="v-chat-menu-item danger">
                                <span>{blockedUserIds.has(selectedChatParticipant.id) ? 'Разблокировать' : 'Заблокировать'}</span>
                              </button>
                            </>
                          )}
                          
                          {isGroupChat && (
                            <button onClick={(e) => { e.stopPropagation(); setOptionsMenuOpen(false); setShowGroupSettings(!showGroupSettings) }} className="v-chat-menu-item">
                              <span>{showGroupSettings ? 'Скрыть инфо' : 'Информация о группе'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {!searchOpen && (
                    <button onClick={() => selectChat(null)} className="v-chat-header-btn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              </div>

              {pinnedMessage && (
                <div style={{ 
                  position: 'absolute', 
                  top: 72, 
                  left: 12, 
                  right: 12, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '10px 16px', 
                  background: 'var(--vkui--color_background_modal_card, rgba(30, 30, 30, 0.72))', 
                  backdropFilter: 'blur(24px)', 
                  WebkitBackdropFilter: 'blur(24px)', 
                  border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.08))', 
                  borderRadius: 16,
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
                  cursor: 'pointer', 
                  zIndex: 998 
                }}
                  onClick={async () => {
                    const targetId = pinnedMessage.id
                    const exists = messages.some(m => m.id === targetId)
                    if (exists) {
                      performScrollToMessage(targetId)
                    } else {
                      setLoading(true)
                      try {
                        const { data } = await supabase
                          .from('messages')
                          .select('created_at')
                          .eq('id', targetId)
                          .single()
                        if (data) {
                          await handleJumpToMessage(targetId, data.created_at)
                        }
                      } catch (err) {
                        console.error('Error jumping to pinned:', err)
                      } finally {
                        setLoading(false)
                      }
                    }
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#007aff"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z"/></svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#007aff', marginBottom: 1 }}>Закреплено</div>
                    <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pinnedMessage.content || 'Медиа'}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePinMessage(pinnedMessage.id, true) }}
                    style={{
                      background: 'rgba(120,120,128,0.2)',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(120,120,128,0.9)',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      flexShrink: 0,
                      transition: 'background 0.15s, transform 0.1s'
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(120,120,128,0.35)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(120,120,128,0.2)' }}
                    onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.88)' }}
                    onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              )}

              <div ref={messagesContainerRef} key={selectedChatId} className={`v-chat-messages-container ${isHistoryReady ? 'ready' : ''}`} onScroll={handleScroll} style={{ paddingTop: pinnedMessage ? 134 : 84 }}>
                {loading ? (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner size="m" /></div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--vkui--color_text_secondary)', marginTop: 40, padding: 20, fontSize: 13.5 }}>Здесь будет история ваших сообщений.</div>
                ) : (() => {
                  let lastDateStr = ''
                  
                  // Map each group member to their last read message ID
                  const lastReadMessageIdByMember: Record<string, string> = {}
                  if (isGroupChat && groupMembers.length > 0) {
                    groupMembers.forEach(member => {
                      if (member.user_id === profile?.id) return
                      if (!member.last_read_at) return
                      
                      const memberReadTime = new Date(member.last_read_at).getTime()
                      let lastMsgId = null
                      for (let i = messages.length - 1; i >= 0; i--) {
                        const m = messages[i]
                        if (new Date(m.created_at).getTime() <= memberReadTime) {
                          lastMsgId = m.id
                          break
                        }
                      }
                      if (lastMsgId) {
                        lastReadMessageIdByMember[member.user_id] = lastMsgId
                      }
                    })
                  }

                  return messages.map((msg, msgIdx) => {
                    const msgDateStr = new Date(msg.created_at).toDateString()
                    const showSep = msgDateStr !== lastDateStr
                    lastDateStr = msgDateStr
                    const isSearchMatch = searchQuery.trim() && searchMatches[searchResultIdx]?.id === msg.id
                    const isAnyMatch = searchQuery.trim() && searchMatches.some(m => m.id === msg.id)

                    const readBy = isGroupChat 
                      ? groupMembers
                          .filter(m => lastReadMessageIdByMember[m.user_id] === msg.id)
                          .map(m => m.profile)
                      : undefined

                    return (
                      <MessageItem 
                        key={msg.id}
                        msg={msg as any}
                        profileId={profile?.id}
                        pinnedMessageId={pinnedMessage?.id}
                        searchQuery={searchQuery}
                        isSearchMatch={!!isSearchMatch}
                        isAnyMatch={!!isAnyMatch}
                        isGroupChat={isGroupChat}
                        lastReadByPartnerIdx={lastReadByPartnerIdx}
                        msgIdx={msgIdx}
                        selectedChatParticipant={selectedChatParticipant}
                        getMemberAvatar={getMemberAvatar}
                        getMemberName={getMemberName}
                        renderMemberName={renderMemberName}
                        isEmojiOnlyMessage={isEmojiOnlyMessage}
                        formatSeparatorDate={formatSeparatorDate}
                        handleImageClick={handleImageClick}
                        handleReact={handleReact}
                        setReactionPopup={setReactionPopup}
                        showSep={showSep}
                        highlightText={highlightText}
                        readByMembers={readBy}
                      />
                    )
                  })
                })()}
              </div>

              {isSystemChat && isVihtAdmin && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', background: 'rgba(255,149,0,0.1)',
                  borderTop: '1px solid rgba(255,149,0,0.25)',
                  fontSize: 12, color: '#ff9500', fontWeight: 600
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.12 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 2.17h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 17"/>
                  </svg>
                  Рассылка: сообщение получат все пользователи
                </div>
              )}

              <ChatInput 
                isChatRestricted={isChatRestricted}
                isBlockedByUs={isBlockedByUs}
                isSystemChat={isSystemChat}
                editingMessage={editingMessage}
                setEditingMessage={setEditingMessage}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                inputText={inputText}
                setInputText={setInputText}
                handleInputChange={handleInputChange}
                attachedFile={attachedFile}
                localPreviewUrl={localPreviewUrl}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                handleCancelUpload={handleCancelUpload}
                isRecording={isRecording}
                recordingSeconds={recordingSeconds}
                formatAudioDuration={formatAudioDuration}
                cancelRecording={cancelRecording}
                stopRecording={stopRecording}
                startRecording={startRecording}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
                handleFileChange={handleFileChange}
                handleSendMessage={handleSendMessage}
                sending={sending}
                uploadedUrl={uploadedUrl}
                isDesktop={isDesktop}
                isGroupChat={isGroupChat}
                handleEmojiSelect={handleEmojiSelect}
                videoTitle={videoTitle}
                setVideoTitle={setVideoTitle}
                startCircleVideo={startCircleVideo}
                stopCircleVideo={stopCircleVideo}
                isRecordingCircle={isRecordingCircle}
                circleSeconds={circleSeconds}
                circleVideoRef={circleVideoRef}
                inputActionMode={inputActionMode}
                setInputActionMode={setInputActionMode}
                attachedTrack={attachedTrack}
                onMusicAttachClick={() => setIsMusicModalOpen(true)}
                onMusicDetachClick={() => setAttachedTrack(null)}
                onSendSticker={sendSticker}
              />

              {isMusicModalOpen && (
                <MusicSelectModal 
                  onClose={() => setIsMusicModalOpen(false)}
                  onSelect={(track) => {
                    setAttachedTrack(track)
                    setIsMusicModalOpen(false)
                  }}
                />
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 24, color: 'var(--vkui--color_text_secondary)', textAlign: 'center' }}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, marginBottom: 16 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <h3 style={{ fontSize: 16, color: 'var(--vkui--color_text_primary)', marginBottom: 8, fontWeight: 600 }}>Выберите чат</h3>
              <p style={{ fontSize: 13, maxWidth: 280, color: 'var(--vkui--color_text_secondary)', margin: 0, lineHeight: 1.45 }}>Выберите диалог из списка слева.</p>
            </div>
          )}
        </div>
        </div>

        {isDesktop && selectedChatParticipant && !showGroupSettings && (
          <div className="v-chat-sidebar-container" style={isEmojiCollapsed ? { width: '56px', minWidth: '56px', transition: 'width 0.2s ease' } : { transition: 'width 0.2s ease' }}>
            <div className="v-chat-sidebar-panel" style={{ width: '100%' }}>
              {isEmojiCollapsed ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 16 }}>
                  {/* Кнопка смайлика для раскрытия */}
                  <button
                    onClick={() => {
                      setIsEmojiCollapsed(false);
                      setChatSettingsTab('emoji');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 8,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: chatSettingsTab === 'emoji' ? '#007aff' : 'var(--vkui--color_text_secondary)',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Раскрыть эмодзи"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  </button>

                  {/* Кнопка настроек для раскрытия */}
                  <button
                    onClick={() => {
                      setIsEmojiCollapsed(false);
                      setChatSettingsTab('settings');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 8,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: chatSettingsTab === 'settings' ? '#007aff' : 'var(--vkui--color_text_secondary)',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Настройки чата"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ height: 56, padding: '0 8px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha)', flexShrink: 0, background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span 
                        onClick={() => setChatSettingsTab('emoji')} 
                        style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer', color: chatSettingsTab === 'emoji' ? '#007aff' : 'var(--vkui--color_text_secondary)', transition: 'color 0.2s' }}
                      >
                        Эмодзи
                      </span>
                      <span 
                        onClick={() => setChatSettingsTab('stickers')} 
                        style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer', color: chatSettingsTab === 'stickers' ? '#007aff' : 'var(--vkui--color_text_secondary)', transition: 'color 0.2s' }}
                      >
                        Стикеры
                      </span>
                      <span 
                        onClick={() => setChatSettingsTab('settings')} 
                        style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer', color: chatSettingsTab === 'settings' ? '#007aff' : 'var(--vkui--color_text_secondary)', transition: 'color 0.2s' }}
                      >
                        Настройки
                      </span>
                    </div>
                    {/* Кнопка бургера для сворачивания */}
                    <button
                      onClick={() => setIsEmojiCollapsed(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--vkui--color_text_secondary)',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Свернуть панель"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {chatSettingsTab === 'emoji' ? (
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <EmojiPicker isSidebar={true} onSelect={handleEmojiSelect} />
                      </div>
                     ) : chatSettingsTab === 'stickers' ? (
                       <div style={{ flex: 1, overflow: 'hidden' }}>
                         <StickerPicker isSidebar={true} onSelectSticker={(url) => sendSticker(url)} />
                       </div>
                    ) : (
                      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' }}>
                        {/* 1. Блок действий (Глушить/Блокировать) */}
                        {!isGroupChat && selectedChatParticipant && selectedChatParticipant.id !== '00000000-0000-0000-0000-000000000000' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Действия
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={async () => {
                                  if (profile) {
                                    await toggleMuteUser(profile.id, selectedChatParticipant.id);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  background: mutedUserIds.has(selectedChatParticipant.id) ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 149, 0, 0.15)',
                                  border: 'none',
                                  borderRadius: 10,
                                  padding: '10px 8px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: mutedUserIds.has(selectedChatParticipant.id) ? '#30d158' : '#ff9500',
                                  cursor: 'pointer',
                                  transition: 'opacity 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                              >
                                {mutedUserIds.has(selectedChatParticipant.id) ? (
                                  <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                    Вкл. звук
                                  </>
                                ) : (
                                  <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                                    Мьют
                                  </>
                                )}
                              </button>
                              
                              <button
                                onClick={async () => {
                                  if (profile && confirm(blockedUserIds.has(selectedChatParticipant.id) ? 'Разблокировать пользователя?' : 'Заблокировать пользователя?')) {
                                    await toggleBlockUser(profile.id, selectedChatParticipant.id);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  background: blockedUserIds.has(selectedChatParticipant.id) ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255, 59, 48, 0.15)',
                                  border: 'none',
                                  borderRadius: 10,
                                  padding: '10px 8px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: blockedUserIds.has(selectedChatParticipant.id) ? '#007aff' : '#ff3b30',
                                  cursor: 'pointer',
                                  transition: 'opacity 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                {blockedUserIds.has(selectedChatParticipant.id) ? 'Разблок' : 'Блок'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 2. Блок оформления чата */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Оформление чата
                          </div>
                          
                          {/* Ширина чата */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--vkui--color_text_primary)' }}>Ширина области чата</span>
                            <select
                              value={chatSettings.chatMaxWidth}
                              onChange={e => setChatSettings((prev: any) => ({ ...prev, chatMaxWidth: e.target.value }))}
                              className="custom-chat-select"
                            >
                              <option value="100%">На весь экран (100%)</option>
                              <option value="1000px">Широкий (1000px)</option>
                              <option value="850px">Средний (850px)</option>
                              <option value="700px">Компактный (700px)</option>
                            </select>
                          </div>

                          {/* Шрифт чата */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--vkui--color_text_primary)' }}>Шрифт</span>
                            <select
                              value={chatSettings.fontFamily}
                              onChange={e => setChatSettings((prev: any) => ({ ...prev, fontFamily: e.target.value }))}
                              className="custom-chat-select"
                            >
                              <option value="system-ui">Системный</option>
                              <option value="'Inter', sans-serif">Inter</option>
                              <option value="'Roboto', sans-serif">Roboto</option>
                              <option value="'Montserrat', sans-serif">Montserrat</option>
                              <option value="monospace">Monospace (Courier)</option>
                            </select>
                          </div>

                          {/* Размер шрифта */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: 'var(--vkui--color_text_primary)' }}>Размер шрифта</span>
                              <span style={{ fontWeight: 600, color: '#007aff' }}>{chatSettings.fontSize}px</span>
                            </div>
                            <input
                              type="range"
                              min="12"
                              max="22"
                              step="0.5"
                              value={chatSettings.fontSize}
                              onChange={e => setChatSettings((prev: any) => ({ ...prev, fontSize: parseFloat(e.target.value) }))}
                              style={{ width: '100%', accentColor: '#007aff', cursor: 'pointer' }}
                            />
                          </div>

                          {/* Толщина шрифта */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--vkui--color_text_primary)' }}>Толщина шрифта</span>
                            <select
                              value={chatSettings.fontWeight}
                              onChange={e => setChatSettings((prev: any) => ({ ...prev, fontWeight: e.target.value }))}
                              className="custom-chat-select"
                            >
                              <option value="300">Тонкий (300)</option>
                              <option value="400">Обычный (400)</option>
                              <option value="500">Средний (500)</option>
                              <option value="600">Полужирный (600)</option>
                              <option value="700">Жирный (700)</option>
                            </select>
                          </div>

                          {/* Высота строки */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: 'var(--vkui--color_text_primary)' }}>Высота строки</span>
                              <span style={{ fontWeight: 600, color: '#007aff' }}>{chatSettings.lineHeight}</span>
                            </div>
                            <input
                              type="range"
                              min="1.2"
                              max="2.0"
                              step="0.05"
                              value={chatSettings.lineHeight}
                              onChange={e => setChatSettings((prev: any) => ({ ...prev, lineHeight: parseFloat(e.target.value) }))}
                              style={{ width: '100%', accentColor: '#007aff', cursor: 'pointer' }}
                            />
                          </div>

                          {/* Разрыв сообщений */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: 'var(--vkui--color_text_primary)' }}>Разрыв сообщений</span>
                              <span style={{ fontWeight: 600, color: '#007aff' }}>{chatSettings.messageGap}px</span>
                            </div>
                            <input
                              type="range"
                              min="4"
                              max="24"
                              step="2"
                              value={chatSettings.messageGap}
                              onChange={e => setChatSettings((prev: any) => ({ ...prev, messageGap: parseInt(e.target.value) }))}
                              style={{ width: '100%', accentColor: '#007aff', cursor: 'pointer' }}
                            />
                          </div>

                          {/* Форма сообщений (5 видов) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--vkui--color_text_primary)' }}>Форма сообщений</span>
                            <select
                              value={chatSettings.bubbleStyle || 'classic'}
                              onChange={e => setChatSettings((prev: any) => ({ ...prev, bubbleStyle: e.target.value }))}
                              className="custom-chat-select"
                            >
                              <option value="classic">Vihton Classic (Фирменный)</option>
                              <option value="capsule">Cyber Capsule (Кибер-капсула)</option>
                              <option value="sharp">Future Sharp (Нео-минимализм)</option>
                              <option value="origami">Origami Wing (Крыло оригами)</option>
                              <option value="cosmo">Cosmo Bubble (Космо-купол)</option>
                              <option value="none">Без оболочки (Чистый текст)</option>
                            </select>
                          </div>

                          {/* Цвета сообщений (градиенты) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--vkui--color_text_primary)' }}>Цвет сообщений (Моих)</span>
                            <select
                              value={chatSettings.bubbleColor || 'blue'}
                              onChange={e => setChatSettings((prev: any) => ({ ...prev, bubbleColor: e.target.value }))}
                              className="custom-chat-select"
                            >
                              <option value="blue">Классический синий</option>
                              <option value="purple">Фиолетовый закат (Градиент)</option>
                              <option value="emerald">Неоновый изумруд (Градиент)</option>
                              <option value="coral">Коралловое сияние (Градиент)</option>
                              <option value="space">Глубокий космос (Градиент)</option>
                            </select>
                          </div>
                        </div>
                        
                        {/* Сброс настроек */}
                        <button
                          onClick={() => setChatSettings({
                            fontSize: 14.5,
                            fontFamily: 'system-ui',
                            fontWeight: '500',
                            lineHeight: 1.45,
                            messageGap: 12,
                            chatMaxWidth: '100%',
                            bubbleStyle: 'classic',
                            bubbleColor: 'blue'
                          })}
                          style={{
                            background: 'none',
                            border: '1px solid rgba(255, 59, 48, 0.3)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 500,
                            color: '#ff3b30',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            marginTop: 10
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.08)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          Сбросить оформление
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              {/* Attachments & Search Drawer */}

            </div>
          </div>
        )}

        {/* Group settings panel - desktop sidebar OR mobile overlay */}
        {selectedChatParticipant && showGroupSettings && isGroupChat && (
          isDesktop ? (
            /* Desktop: side panel */
            <div className="v-chat-sidebar-container">
              <div className="v-chat-sidebar-panel">
                {renderGroupSettingsContent()}
              </div>
            </div>
          ) : (
            /* Mobile: full-screen overlay */
            <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'var(--vkui--color_background_content)', display: 'flex', flexDirection: 'column' }}>
              {renderGroupSettingsContent()}
            </div>
          )
        )}
      </div>

      {reactionPopup && (
        <div onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', left: Math.min(reactionPopup.x - 120, window.innerWidth - 260), top: Math.max(reactionPopup.y - 52, 10), zIndex: 99999, background: 'rgba(28,28,30,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 40, padding: '8px 12px', display: 'flex', gap: 6, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => handleReact(reactionPopup.msgId, emoji)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '2px 4px', borderRadius: 8, transition: 'transform 0.15s', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {deleteConfirmId && (
        <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--vkui--color_background_content)', borderRadius: 18, padding: '24px 24px 16px', maxWidth: 320, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Удалить сообщение?</div>
                  <div style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', marginBottom: 20, lineHeight: 1.4 }}>Сообщение будет удалено у всех.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, background: 'var(--vkui--color_background_secondary)', border: 'none', borderRadius: 12, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--vkui--color_text_primary)' }}>Отмена</button>
              <button onClick={async () => {
                await supabase.from('messages').update({ content: null, image_url: null, video_url: null, audio_url: null, is_deleted: true }).eq('id', deleteConfirmId)
                setDeleteConfirmId(null)
              }} style={{ flex: 1, background: '#ff3b30', border: 'none', borderRadius: 12, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>Удалить у всех</button>
            </div>
          </div>
        </div>
      )}

      {captchaOpen && (
        <div onClick={() => setCaptchaOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--vkui--color_background_content)', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Слишком быстро</div>
            <div style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', marginBottom: 18 }}>Введите код, чтобы продолжить</div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 8, color: '#007aff', marginBottom: 18, userSelect: 'none' }}>{captchaCode}</div>
            <input
              autoFocus
              value={captchaInput}
              onChange={e => setCaptchaInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => { if (e.key === 'Enter') handleCaptchaSubmit() }}
              placeholder="Код"
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--vkui--color_background_secondary)', border: '1px solid var(--vkui--color_separator_primary_alpha)', borderRadius: 12, padding: '12px 16px', fontSize: 16, textAlign: 'center', letterSpacing: 6, color: 'var(--vkui--color_text_primary)', outline: 'none', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCaptchaOpen(false)} style={{ flex: 1, background: 'var(--vkui--color_background_secondary)', border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--vkui--color_text_primary)' }}>Отмена</button>
              <button onClick={handleCaptchaSubmit} style={{ flex: 1, background: '#007aff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {forwardModalOpen && (
        <div onClick={() => { setForwardModalOpen(false); setForwardMsg(null) }} style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--vkui--color_background_content)', borderRadius: 20, width: '100%', maxWidth: 420, maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Пересылка сообщения</span>
              <button onClick={() => { setForwardModalOpen(false); setForwardMsg(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', fontSize: 20 }}>x</button>
            </div>
            {forwardMsg && <div style={{ padding: '12px 20px', background: 'var(--vkui--color_background_secondary)', margin: '12px 16px', borderRadius: 12, fontSize: 13, color: 'var(--vkui--color_text_secondary)', borderLeft: '3px solid #007aff' }}>{forwardMsg.content || '(Медиа)'}</div>}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
              {conversations.map(c => {
                const isSelf = !c.is_group && c.participant.id === profile?.id
                return (
                  <div key={c.id} onClick={() => !forwardSending && handleForwardTo(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: forwardSending ? 'default' : 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--vkui--color_background_secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {isSelf
                      ? <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #2f80ed, #007aff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div>
                      : c.is_group ? <GroupAvatar size={40} src={c.group_avatar_url} />
                      : <CustomAvatar size={40} src={c.participant.avatar_url} name={c.participant.full_name} id={c.participant.id} decoration={c.participant.avatar_decoration} />
                    }
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{isSelf ? 'Избранное' : c.is_group ? (c.group_name || 'Группа') : c.participant.full_name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </Panel>
  )
}

