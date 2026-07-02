import React, { useEffect, useState, useCallback } from 'react'
import {
  Panel,
  PanelHeader,
  Group,
  Box,
  Text,
  Button,
  FormItem,
  Input,
  Header,
  WriteBar,
  WriteBarIcon,
  IconButton,
  Spinner,
  Tabs,
  TabsItem,
  Snackbar
} from '@vkontakte/vkui'
import {
  Icon28MessageOutline,
  Icon28UserAddOutline,
  Icon28UserMinusOutline,
  Icon28UserOutline,
  Icon28UserAddedOutline,
  Icon28LocationOutline,
  Icon28CalendarOutline,
  Icon28InfoOutline,
  Icon28CameraOutline,
  Icon28SendOutline,
  Icon28LikeOutline,
  Icon28CommentOutline,
  Icon28MoreHorizontal,
  Icon24Dismiss,
  Icon28CheckCircleOutline
} from '@vkontakte/icons'
import { PostCard } from '../components/PostCard'
import { ShareModal } from '../components/ShareModal'
import { StoryViewerOverlay } from '../components/StoryViewerOverlay'
import { uploadToTelegram } from '../utils/telegramStorage'
import type { Story } from '../components/StoryViewerOverlay'
import { ImageEditorModal } from '../components/ImageEditorModal'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { useMusicStore } from '../store/useMusicStore'
import type { Track } from '../store/useMusicStore'
import { MusicSelectModal } from '../components/MusicSelectModal'
import { AdminBadge } from '../components/AdminBadge'
import { CustomAvatar } from '../components/CustomAvatar'
import { EmojiPicker } from '../components/EmojiPicker'
import { AVATAR_DECORATIONS } from '../components/decorations'
import { SkeletonPost } from '../components/SkeletonLoader'
import { useProfile, useProfilePosts, useFriendship, useProfileFriends, useProfileStats, useStories } from '../hooks/useQueries'
import { useQueryClient } from '@tanstack/react-query'

const getOriginalImageUrl = (url: string | null) => {
  if (!url) return ''
  const match = url.match(/[?&]orig=/)
  if (match) {
    const origPart = url.substring(match.index! + 6)
    return decodeURIComponent(origPart)
  }
  return url
}

const GIFT_TIERS = {
  regular: { label: '⭐ Обычные', color: '#8e8e93', price: 10 },
  premium: { label: '💎 Премиум', color: '#ff9500', price: 20 },
  exclusive: { label: '👑 Эксклюзивные', color: '#ff3b30', price: 35 },
} as const

type GiftTier = keyof typeof GIFT_TIERS

const GIFT_ITEMS: Record<string, { name: string; icon: string; animatedUrl: string; price: number; tier: GiftTier }> = {
  // Regular — 10 V
  rose:        { name: 'Роза',       icon: '🌹', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f339/512.gif',    price: 10, tier: 'regular' },
  coffee:      { name: 'Кофе',       icon: '☕', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2615/512.gif',      price: 10, tier: 'regular' },
  star:        { name: 'Звезда',     icon: '⭐', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2b50/512.gif',      price: 10, tier: 'regular' },
  wine:        { name: 'Вино',       icon: '🍷', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f377/512.gif',    price: 10, tier: 'regular' },
  pizza:       { name: 'Пицца',      icon: '🍕', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f355/512.gif',    price: 10, tier: 'regular' },
  ice_cream:   { name: 'Мороженое',  icon: '🍦', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f366/512.gif',    price: 10, tier: 'regular' },
  donut:       { name: 'Пончик',     icon: '🍩', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f369/512.gif',    price: 10, tier: 'regular' },
  cookie:      { name: 'Печенье',    icon: '🍪', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f36a/512.gif',    price: 10, tier: 'regular' },
  watermelon:  { name: 'Арбуз',      icon: '🍉', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f349/512.gif',    price: 10, tier: 'regular' },
  cherries:    { name: 'Вишня',      icon: '🍒', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f352/512.gif',    price: 10, tier: 'regular' },
  strawberry:  { name: 'Клубника',   icon: '🍓', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f353/512.gif',    price: 10, tier: 'regular' },
  clover:      { name: 'Удача',      icon: '🍀', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f340/512.gif',    price: 10, tier: 'regular' },
  // Premium — 20 V
  heart:       { name: 'Сердечко',   icon: '❤️', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif', price: 20, tier: 'premium' },
  gift_box:    { name: 'Подарок',    icon: '🎁', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f381/512.gif',    price: 20, tier: 'premium' },
  champagne:   { name: 'Шампанское', icon: '🍾', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f37e/512.gif',    price: 20, tier: 'premium' },
  toy_bear:    { name: 'Тортик',     icon: '🎂', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f382/512.gif',    price: 20, tier: 'premium' },
  cat:         { name: 'Котик',      icon: '🐱', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f431/512.gif',    price: 20, tier: 'premium' },
  panda:       { name: 'Панда',      icon: '🐼', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f43c/512.gif',    price: 20, tier: 'premium' },
  penguin:     { name: 'Пингвин',    icon: '🐧', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f427/512.gif',    price: 20, tier: 'premium' },
  ghost:       { name: 'Привидение', icon: '👻', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47b/512.gif',    price: 20, tier: 'premium' },
  balloon:     { name: 'Шарик',      icon: '🎈', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f388/512.gif',    price: 20, tier: 'premium' },
  party:       { name: 'Хлопушка',   icon: '🎉', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif',    price: 20, tier: 'premium' },
  // Exclusive — 35 V
  diamond:     { name: 'Алмаз',      icon: '💎', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f48e/512.gif',    price: 35, tier: 'exclusive' },
  rocket:      { name: 'Ракета',     icon: '🚀', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.gif',    price: 35, tier: 'exclusive' },
  fire:        { name: 'Огонь',      icon: '🔥', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif',    price: 35, tier: 'exclusive' },
  crown:       { name: 'Корона',     icon: '👑', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f451/512.gif',    price: 35, tier: 'exclusive' },
  money_wings: { name: 'Деньги',     icon: '💸', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4b8/512.gif',    price: 35, tier: 'exclusive' },
  heart_ribbon:{ name: 'Сердце',     icon: '💝', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f49d/512.gif',    price: 35, tier: 'exclusive' },
  alien:       { name: 'НЛО',        icon: '👽', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47d/512.gif',    price: 35, tier: 'exclusive' },
  unicorn:     { name: 'Единорог',   icon: '🦄', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f984/512.gif',    price: 35, tier: 'exclusive' },
}



const UserProfileMusic: React.FC<{ profileId: string }> = ({ profileId }) => {
  const { user } = useAuthStore()
  const { currentTrack, isPlaying, setCurrentTrack, setPlaylist, setIsPlaying } = useMusicStore()
  
  const [tracks, setTracks] = useState<Track[]>([])
  const [myTracksUrls, setMyTracksUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadTracks = useCallback(async () => {
    setLoading(true)
    try {
      const { data: userTracks } = await supabase
        .from('music_tracks')
        .select('*, profiles(full_name, avatar_url, username)')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
      
      setTracks(userTracks || [])

      if (user) {
        const { data: myLib } = await supabase
          .from('music_tracks')
          .select('file_url')
          .eq('user_id', user.id)
        
        setMyTracksUrls(myLib?.map(t => t.file_url) || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [profileId, user])

  useEffect(() => {
    loadTracks()
  }, [loadTracks])

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying)
    } else {
      setPlaylist(tracks)
      setCurrentTrack(track)
      setIsPlaying(true)
      supabase.rpc('increment_track_plays', { track_id: track.id }).then(() => {})
    }
  }

  const handleAddTrack = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    try {
      const { error } = await supabase.from('music_tracks').insert({
        user_id: user.id,
        title: track.title,
        artist: track.artist,
        album: track.album || null,
        genre: track.genre || null,
        duration: track.duration,
        file_url: track.file_url,
        cover_url: track.cover_url,
        lyrics: track.lyrics || null,
        plays_count: 0
      })
      if (!error) {
        setMyTracksUrls(prev => [...prev, track.file_url])
      } else {
        alert('Не удалось добавить трек в библиотеку.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteTrack = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Вы уверены, что хотите удалить этот трек?')) return
    try {
      const { error } = await supabase.from('music_tracks').delete().eq('id', trackId)
      if (!error) {
        setTracks(prev => prev.filter(t => t.id !== trackId))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDownload = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = track.file_url
    a.download = `${track.artist} — ${track.title}.mp3`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <Spinner size="m" />
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="vkuiGroup" style={{ textAlign: 'center', padding: 24, margin: 0, borderRadius: 12, border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.08))', backgroundColor: 'var(--vkui--color_background_content, #ffffff)' }}>
        <Text style={{ color: 'var(--vkui--color_text_secondary)', fontSize: 14 }}>У пользователя пока нет музыки.</Text>
      </div>
    )
  }

  return (
    <div className="vkuiGroup" style={{ padding: '8px 12px', margin: 0, borderRadius: 12, border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.08))', backgroundColor: 'var(--vkui--color_background_content, #ffffff)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tracks.map(track => {
          const isActive = currentTrack?.file_url === track.file_url
          return (
            <div 
              key={track.id} 
              className={`music-track-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTrackClick(track)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              {/* Cover */}
              <div className="music-track-cover" style={{ position: 'relative', width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                {track.cover_url ? (
                  <img src={track.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="music-track-cover-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(0,119,255,0.1), rgba(88,86,214,0.1))', color: '#0077ff' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                    </svg>
                  </div>
                )}
                {isActive && isPlaying && (
                  <div className="music-equalizer" style={{ position: 'absolute', inset: 0, background: 'rgba(0, 119, 255, 0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, padding: '6px' }}>
                    <span style={{ width: 2, height: '60%', background: '#fff', animation: 'equalizer 0.6s ease-in-out infinite alternate' }}/><span style={{ width: 2, height: '80%', background: '#fff', animation: 'equalizer 0.6s ease-in-out infinite alternate 0.2s' }}/><span style={{ width: 2, height: '50%', background: '#fff', animation: 'equalizer 0.6s ease-in-out infinite alternate 0.1s' }}/>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="music-track-info" style={{ flex: 1, minWidth: 0 }}>
                <div 
                  className="music-track-title" 
                  style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#0077ff' : 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {track.title}
                </div>
                <div 
                  className="music-track-artist" 
                  style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}
                >
                  {track.artist}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <span className="music-track-duration" style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', marginRight: 4 }}>
                  {formatDuration(track.duration)}
                </span>
                
                {/* Download */}
                <IconButton onClick={e => handleDownload(track, e)} style={{ width: 28, height: 28, color: 'var(--vkui--color_text_secondary)' }} title="Скачать">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </IconButton>

                {/* Add / Delete */}
                {profileId === user?.id ? (
                  <IconButton onClick={e => handleDeleteTrack(track.id, e)} style={{ width: 28, height: 28, color: 'var(--vkui--color_text_secondary)' }} title="Удалить">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </IconButton>
                ) : (
                  !myTracksUrls.includes(track.file_url) && (
                    <IconButton onClick={e => handleAddTrack(track, e)} style={{ width: 28, height: 28, color: '#34c759' }} title="Добавить к себе">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </IconButton>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ProfilePanelProps {
  id: string
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ id }) => {
  const { profile: myProfile, updateProfile } = useAuthStore()
  const { 
    selectedProfileId, selectProfile, selectChat, mutedUserIds, blockedUserIds, blockedByUserIds, toggleMuteUser, toggleBlockUser, activeStory, activePanel
  } = useAppStore()
  
  const targetId = selectedProfileId || myProfile?.id
  const queryClient = useQueryClient()
  const { data: profile = null } = useProfile(targetId)
  const hasBlockedMe = profile ? blockedByUserIds.has(profile.id) : false
  const { data: posts = [], isLoading: loading } = useProfilePosts(targetId)
  const { data: allStories = [] } = useStories()
  const stories = allStories.filter(s => s.user_id === targetId)

  const { data: friendship = null } = useFriendship(myProfile?.id, targetId)
  const { data: profileFriends = [] } = useProfileFriends(targetId)
  const { data: profileStatsData } = useProfileStats(targetId)
  const profileStats = profileStatsData || { profileViews: 0, postsCount: 0, likesGiven: 0, likesReceived: 0, commentsGiven: 0, commentsReceived: 0 }

  const [activeStoriesList, setActiveStoriesList] = useState<Story[] | null>(null)
  const [editorFile, setEditorFile] = useState<File | null>(null)
  const [editorMode, setEditorMode] = useState<'circle' | 'banner' | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const [roleMenuCoords, setRoleMenuCoords] = useState<{ x: number; y: number } | null>(null)
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false)
  const [optionsMenuCoords, setOptionsMenuCoords] = useState<{ x: number; y: number } | null>(null)
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [wallFilter, setWallFilter] = useState<'all' | 'music'>('all')

  // Gift states
  const [sendGiftModalOpen, setSendGiftModalOpen] = useState(false)
  const [selectedGiftKey, setSelectedGiftKey] = useState('gift_box')
  const [selectedGiftTier, setSelectedGiftTier] = useState<GiftTier>('regular')
  const [giftMessage, setGiftMessage] = useState('')
  const [snackbar, setSnackbar] = useState<React.ReactNode | null>(null)
  const [giftIsAnonymous, setGiftIsAnonymous] = useState(false)
  const [sendingGift, setSendingGift] = useState(false)
  const [gifts, setGifts] = useState<any[]>([])
  const [selectedGiftDetail, setSelectedGiftDetail] = useState<any | null>(null)
  const [hoveredGiftId, setHoveredGiftId] = useState<string | null>(null)
  const [hoveredCover, setHoveredCover] = useState(false)
  const [avatarClickMenuOpen, setAvatarClickMenuOpen] = useState(false)
  const [avatarMenuCoords, setAvatarMenuCoords] = useState<{ x: number; y: number } | null>(null)
  const [decoModalOpen, setDecoModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])



  // Poll state
  const [isAddingPoll, setIsAddingPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [sharingPost, setSharingPost] = useState<any | null>(null)

  const handleToggleRole = async (roleKey: string) => {
    if (!profile) return
    const currentRoles: string[] = profile.roles ?? (profile.role ? [profile.role] : [])
    const hasRole = currentRoles.includes(roleKey)
    const newRoles = hasRole
      ? currentRoles.filter(r => r !== roleKey)
      : [...currentRoles, roleKey]
    try {
      const { error } = await supabase.rpc('set_user_roles', {
        target_user_id: profile.id,
        new_roles: newRoles
      })
      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['profile', targetId] })

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          title: 'Управление привилегиями',
          text: hasRole
            ? `Привилегия снята`
            : `Привилегия выдана`
        }
      }))
    } catch (err) {
      console.error('Error toggling role:', err)
      alert('Не удалось изменить привилегию: ' + (err as any).message)
    }
  }

  const handleClearAllRoles = async () => {
    if (!profile) return
    try {
      const { error } = await supabase.rpc('set_user_roles', {
        target_user_id: profile.id,
        new_roles: []
      })
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { title: 'Управление привилегиями', text: 'Все привилегии сняты' }
      }))
    } catch (err) {
      console.error('Error clearing roles:', err)
      alert('Не удалось снять привилегии: ' + (err as any).message)
    }
  }
  
  // Edit form state
  const [editFullName, setEditFullName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editStatusPreference, setEditStatusPreference] = useState<'online' | 'offline'>('online')
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [newPostText, setNewPostText] = useState('')
  const [attachedMedias, setAttachedMedias] = useState<{
    id: string
    file: File
    previewUrl: string
    progress: number
    isUploading: boolean
    uploadedUrl: string | null
    title?: string
    abortController?: AbortController
  }[]>([])
  const [attachedAudio, setAttachedAudio] = useState<Track | null>(null)
  const [showMusicModal, setShowMusicModal] = useState(false)
  const [uploadingPost, setUploadingPost] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const isInputActive = isFocused || newPostText.trim() !== '' || isAddingPoll || attachedMedias.length > 0 || !!attachedAudio

  // Info & Stats expansion state
  const [infoExpanded, setInfoExpanded] = useState(false)

  const giftsScrollRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = giftsScrollRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [gifts])

  useEffect(() => {
    const handleCloseMenu = () => {
      setRoleMenuOpen(false)
      setOptionsMenuOpen(false)
    }
    document.addEventListener('click', handleCloseMenu)
    return () => document.removeEventListener('click', handleCloseMenu)
  }, [])



  // Listen for header menu "Edit Profile" trigger
  useEffect(() => {
    const handleOpenEdit = () => {
      // Only open edit if this is own profile
      if (profile && myProfile && profile.id === myProfile.id) {
        setIsEditing(true)
      }
    }
    window.addEventListener('open-profile-edit', handleOpenEdit)
    return () => window.removeEventListener('open-profile-edit', handleOpenEdit)
  }, [profile?.id, myProfile?.id])

  useEffect(() => {
    if (profile) {
      setEditFullName(profile.full_name || '')
      setEditBio(profile.bio || '')
      setEditCity(profile.city || '')
      setEditBirthDate(profile.birth_date || '')
      setEditUsername(profile.username || '')
      setEditStatusPreference((profile.status_preference as 'online' | 'offline') || 'online')
      setStatusText(profile.status || '')

      const tag = profile.username || `vid${profile.num_id}`
      window.history.replaceState(window.history.state, '', `/${tag}`)
    }
  }, [profile])

  useEffect(() => {
    if (!targetId) return

    const channelName = `profile-posts-realtime-${targetId}-${Math.random().toString(36).substring(2, 9)}`
    const postsSubscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['profile-posts', targetId] })
        queryClient.invalidateQueries({ queryKey: ['profile-stats', targetId] })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_likes'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['profile-posts', targetId] })
        queryClient.invalidateQueries({ queryKey: ['profile-stats', targetId] })
      })
      .subscribe()

    const profileChannelName = `profile-details-realtime-${targetId}-${Math.random().toString(36).substring(2, 9)}`
    const profileSubscription = supabase
      .channel(profileChannelName)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${targetId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(postsSubscription)
      supabase.removeChannel(profileSubscription)
    }
  }, [targetId, queryClient])

  useEffect(() => {
    const isThisPanelActive = 
      (activeStory === 'profile' && activePanel === id) ||
      (activeStory === 'friends' && activePanel === id);

    if (isThisPanelActive) {
      const bgValue = profile?.cover_url 
        ? `url(${profile.cover_url})` 
        : 'linear-gradient(135deg, var(--vkui--color_background_accent) 0%, #aa3bff 100%)';
      document.documentElement.style.setProperty('--profile-cover-url', bgValue);
      document.documentElement.classList.add('has-profile-bg');
    }

    return () => {
      if (isThisPanelActive) {
        document.documentElement.classList.remove('has-profile-bg');
      }
    }
  }, [profile?.cover_url, activeStory, activePanel, id]);

  useEffect(() => {
    const handleStoryDeletedGlobal = () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    }
    window.addEventListener('story-deleted-global', handleStoryDeletedGlobal)
    return () => window.removeEventListener('story-deleted-global', handleStoryDeletedGlobal)
  }, [queryClient])

  // Block system right-click everywhere on profile page (except inputs)
  useEffect(() => {
    if (activePanel !== id) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('textarea') && !target.closest('input')) {
        e.preventDefault()
      }
    }
    document.addEventListener('contextmenu', handler)
    return () => document.removeEventListener('contextmenu', handler)
  }, [activePanel, id])

  // Сбросить вкладку "Музыка" если владелец скрыл её и мы не владелец
  const targetProfile = profile
  useEffect(() => {
    if (!targetProfile) return
    const hiddenByOwner = targetProfile.hide_music
    const viewingOwnProfile = targetProfile.id === myProfile?.id
    if (hiddenByOwner && !viewingOwnProfile) {
      setWallFilter('all')
    }
  }, [targetProfile?.hide_music, targetProfile?.id, myProfile?.id])

  const handleSaveProfile = async () => {
    if (editBirthDate) {
      const birthYear = new Date(editBirthDate).getFullYear()
      const today = new Date()
      const chosenDate = new Date(editBirthDate)
      if (birthYear < 1980 || chosenDate > today) {
        alert('Дата рождения должна быть в диапазоне от 1980 года до сегодняшнего дня.')
        return
      }
    }

    const cleanTag = editUsername.trim()
    if (!cleanTag) {
      alert('Поле "Тег" не может быть пустым!')
      return
    }

    // Only English letters and numbers, max 7 characters, no special characters/separators
    const tagRegex = /^[a-zA-Z0-9]{1,7}$/
    if (!tagRegex.test(cleanTag)) {
      alert('Тег может состоять только из английских букв и цифр, и быть не длиннее 7 символов!')
      return
    }
    try {
      // Check tag uniqueness
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanTag)
        .neq('id', myProfile?.id)
        .maybeSingle()

      if (checkError) throw checkError
      if (existing) {
        alert('Этот тег уже занят другим пользователем!')
        return
      }

      const success = await updateProfile({
        full_name: editFullName,
        bio: editBio,
        city: editCity,
        birth_date: editBirthDate || null,
        username: editUsername,
        status_preference: editStatusPreference,
        is_online: editStatusPreference === 'online'
      })

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser && editEmail !== authUser.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: editEmail })
        if (emailError) throw emailError
      }

      if (success) {
        setIsEditing(false)
        queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
        queryClient.invalidateQueries({ queryKey: ['profile-posts', targetId] })
        queryClient.invalidateQueries({ queryKey: ['profile-stats', targetId] })
      }
    } catch (err) {
      console.error('Error saving profile settings:', err)
    }
  }

  const handleUploadAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!myProfile || !e.target.files || e.target.files.length === 0) return
    setEditorFile(e.target.files[0])
    setEditorMode('circle')
    e.target.value = ''
  }

  const handleUploadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!myProfile || !e.target.files || e.target.files.length === 0) return
    setEditorFile(e.target.files[0])
    setEditorMode('banner')
    e.target.value = ''
  }

  const performAvatarUpload = async (originalFile: File, croppedFile: File) => {
    setUploadingAvatar(true)
    try {
      const origExt = originalFile.name.split('.').pop()
      const origName = `avatar-orig-${Date.now()}.${origExt}`
      const origUrl = await uploadToTelegram(originalFile, origName)

      const cropExt = croppedFile.name.split('.').pop()
      const cropName = `avatar-crop-${Date.now()}.${cropExt}`
      const croppedUrl = await uploadToTelegram(croppedFile, cropName)

      const separator = croppedUrl.includes('?') ? '&' : '?'
      const finalUrl = `${croppedUrl}${separator}orig=${encodeURIComponent(origUrl)}`

      await updateProfile({ avatar_url: finalUrl })
      queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
      queryClient.invalidateQueries({ queryKey: ['profile-posts', targetId] })
      queryClient.invalidateQueries({ queryKey: ['profile-stats', targetId] })
    } catch (err: any) {
      console.error('Error uploading avatar:', err)
      alert('Не удалось загрузить аватарку:\n' + (err?.message || err?.error_description || JSON.stringify(err)))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const performCoverUpload = async (originalFile: File, croppedFile: File) => {
    setUploadingCover(true)
    try {
      const origExt = originalFile.name.split('.').pop()
      const origName = `bg-orig-${Date.now()}.${origExt}`
      const origUrl = await uploadToTelegram(originalFile, origName)

      const cropExt = croppedFile.name.split('.').pop()
      const cropName = `bg-crop-${Date.now()}.${cropExt}`
      const croppedUrl = await uploadToTelegram(croppedFile, cropName)

      const separator = croppedUrl.includes('?') ? '&' : '?'
      const finalUrl = `${croppedUrl}${separator}orig=${encodeURIComponent(origUrl)}`

      await updateProfile({ cover_url: finalUrl })
      queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
      queryClient.invalidateQueries({ queryKey: ['profile-posts', targetId] })
      queryClient.invalidateQueries({ queryKey: ['profile-stats', targetId] })
    } catch (err: any) {
      console.error('Error uploading cover:', err)
      alert('Не удалось загрузить обложку:\n' + (err?.message || err?.error_description || JSON.stringify(err)))
    } finally {
      setUploadingCover(false)
    }
  }

  const fetchGifts = async () => {
    if (!targetId) return
    try {
      const { data, error } = await supabase
        .from('user_gifts')
        .select('*, sender:profiles!user_gifts_sender_id_fkey(id, full_name)')
        .eq('receiver_id', targetId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setGifts(data || [])
    } catch (err) {
      console.error('Error fetching gifts:', err)
    }
  }

  useEffect(() => {
    fetchGifts()
  }, [targetId])

  const handleDeleteCover = async () => {
    if (!myProfile || !confirm('Вы уверены, что хотите удалить обложку профиля?')) return
    setUploadingCover(true)
    try {
      await updateProfile({ cover_url: null })
      queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
      queryClient.invalidateQueries({ queryKey: ['profile-posts', targetId] })
      queryClient.invalidateQueries({ queryKey: ['profile-stats', targetId] })
    } catch (err: any) {
      console.error('Error deleting cover:', err)
      alert('Не удалось удалить обложку:\n' + err?.message)
    } finally {
      setUploadingCover(false)
    }
  }

  const handleSendGift = async () => {
    if (!myProfile || !targetId) return
    const giftConfig = GIFT_ITEMS[selectedGiftKey] || GIFT_ITEMS.gift_box
    const giftPrice = giftConfig.price

    const currentBalance = myProfile.balance ?? 0
    if (currentBalance < giftPrice) {
      setSnackbar(
        <Snackbar
          onClose={() => setSnackbar(null)}
          onClosed={() => setSnackbar(null)}
          before={<Icon24Dismiss fill="#ff3b30" />}
          style={{
            zIndex: 999999,
            background: 'var(--vkui--color_background_modal, #1c1c1e)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}
          action="Кошелек"
          onActionClick={() => {
            setSendGiftModalOpen(false)
            useAppStore.getState().setStory('balance')
          }}
        >
          Недостаточно Vihton. Требуется {giftPrice} V.
        </Snackbar>
      )
      return
    }

    setSendingGift(true)
    try {
      const { error } = await supabase
        .from('user_gifts')
        .insert({
          sender_id: giftIsAnonymous ? null : myProfile.id,
          receiver_id: targetId,
          gift_key: selectedGiftKey,
          message: giftMessage.trim() || null,
          is_anonymous: giftIsAnonymous
        })

      if (error) throw error

      const newBalance = currentBalance - giftPrice
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', myProfile.id)

      if (balanceError) throw balanceError

      useAuthStore.getState().updateProfile({ balance: newBalance })

      window.dispatchEvent(new CustomEvent('trigger-fireworks'))

      setGiftMessage('')
      setGiftIsAnonymous(false)
      setSendGiftModalOpen(false)
      fetchGifts()
      
      setSnackbar(
        <Snackbar
          onClose={() => setSnackbar(null)}
          onClosed={() => setSnackbar(null)}
          before={<Icon28CheckCircleOutline fill="var(--vkui--color_icon_accent)" />}
          style={{
            zIndex: 999999,
            background: 'var(--vkui--color_background_modal, #1c1c1e)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}
        >
          Подарок успешно отправлен! Списано {giftPrice} V.
        </Snackbar>
      )
    } catch (err: any) {
      console.error('Error sending gift:', err)
      setSnackbar(
        <Snackbar
          onClose={() => setSnackbar(null)}
          onClosed={() => setSnackbar(null)}
          before={<Icon24Dismiss fill="#ff3b30" />}
          style={{
            zIndex: 999999,
            background: 'var(--vkui--color_background_modal, #1c1c1e)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}
        >
          Не удалось отправить подарок: {err.message}
        </Snackbar>
      )
    } finally {
      setSendingGift(false)
    }
  }

  const handleDeleteGift = async (giftId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот подарок?')) return
    try {
      const { error } = await supabase
        .from('user_gifts')
        .delete()
        .eq('id', giftId)

      if (error) throw error
      fetchGifts()
    } catch (err: any) {
      console.error('Error deleting gift:', err)
      alert('Не удалось удалить подарок: ' + err.message)
    }
  }

  const handleSelectDeco = async (decoUrl: string | null) => {
    if (!myProfile) return
    try {
      await updateProfile({ avatar_decoration: decoUrl })
      queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { title: 'Декорация', text: decoUrl ? 'Декорация успешно установлена!' : 'Декорация удалена!' }
      }))
      setDecoModalOpen(false)
    } catch (err: any) {
      console.error('Error updating avatar decoration:', err)
      alert('Не удалось обновить декорацию: ' + err.message)
    }
  }



  const handleFriendAction = async () => {
    if (!myProfile || !selectedProfileId) return
    
    try {
      if (!friendship) {
        // Send request
        const { error } = await supabase
          .from('friendships')
          .insert({
            requester_id: myProfile.id,
            addressee_id: selectedProfileId,
            status: 'pending'
          })
        if (error) throw error
      } else if (friendship.status === 'pending' && friendship.addressee_id === myProfile.id) {
        // Accept request
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', friendship.id)
        if (error) throw error
      } else {
        // Remove friendship or cancel request
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('id', friendship.id)
        if (error) throw error
      }
      queryClient.invalidateQueries({ queryKey: ['friendship', myProfile?.id, targetId] })
      queryClient.invalidateQueries({ queryKey: ['profile-friends', targetId] })
    } catch (err) {
      console.error('Error with friendship action:', err)
    }
  }

  const handleOpenDirectChat = async () => {
    if (!myProfile || !selectedProfileId) return
    
    try {
      // Check if conversation exists
      let { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(participant_1.eq.${myProfile.id},participant_2.eq.${selectedProfileId}),and(participant_1.eq.${selectedProfileId},participant_2.eq.${myProfile.id})`)
        .maybeSingle()
      
      if (!conv) {
        // Create conversation
        const { data, error } = await supabase
          .from('conversations')
          .insert({
            participant_1: myProfile.id,
            participant_2: selectedProfileId
          })
          .select()
          .single()
        if (error) throw error
        conv = data
      }

      if (conv && profile) {
        selectChat(conv.id, {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          is_online: !!profile.is_online,
          username: profile.username,
          num_id: profile.num_id,
          last_seen: profile.last_seen,
          status_preference: profile.status_preference
        })
      }
    } catch (err) {
      console.error('Error opening chat:', err)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    if (attachedMedias.length + files.length > 10) {
      alert('Максимальное количество прикрепляемых файлов — 10 штук.')
      return
    }

    const newItems: any[] = []
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const previewUrl = URL.createObjectURL(file)
      
      let title = ''
      if (file.type.startsWith('video/') || file.name.toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)) {
        title = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      }

      const controller = new AbortController()

      newItems.push({
        id,
        file,
        previewUrl,
        progress: 0,
        isUploading: true,
        uploadedUrl: null,
        title: title || undefined,
        abortController: controller
      })
    }

    setAttachedMedias(prev => [...prev, ...newItems])

    for (const item of newItems) {
      const fileExt = item.file.name.split('.').pop()
      const fileName = `post-${Date.now()}.${fileExt}`
      
      let currentProgress = 0
      let fakeInterval: any = null

      try {
        const publicUrl = await uploadToTelegram(
          item.file, 
          fileName, 
          (percent) => {
            const mapped = Math.round(percent * 0.85)
            currentProgress = mapped
            setAttachedMedias(prev => prev.map(m => m.id === item.id ? { ...m, progress: mapped } : m))

            if (percent === 100 && !fakeInterval) {
              fakeInterval = setInterval(() => {
                if (currentProgress < 98) {
                  currentProgress += 1
                  setAttachedMedias(prev => prev.map(m => m.id === item.id ? { ...m, progress: currentProgress } : m))
                } else {
                  clearInterval(fakeInterval)
                }
              }, 800)
            }
          },
          item.abortController?.signal
        )

        if (fakeInterval) clearInterval(fakeInterval)
        setAttachedMedias(prev => prev.map(m => m.id === item.id ? { ...m, progress: 100, isUploading: false, uploadedUrl: publicUrl } : m))
      } catch (err: any) {
        if (fakeInterval) clearInterval(fakeInterval)
        if (err.name === 'AbortError') {
          continue
        }
        console.error('File upload error:', err)
        alert('Ошибка при загрузке файла')
        setAttachedMedias(prev => prev.filter(m => m.id !== item.id))
      }
    }
  }

  const handleImageClick = (imagesList: string[], index: number, postContext?: any) => {
    window.dispatchEvent(new CustomEvent('open-gallery', {
      detail: {
        images: imagesList,
        startIndex: index,
        postContext: postContext ? {
          id: postContext.id,
          author: postContext.author,
          content: postContext.content,
          created_at: postContext.created_at
        } : undefined
      }
    }))
  }

  const handleCreatePost = async () => {
    if (!myProfile || (!newPostText.trim() && attachedMedias.length === 0 && !isAddingPoll && !attachedAudio)) return
    if (attachedMedias.some(m => m.isUploading)) {
      alert('Пожалуйста, подождите завершения загрузки файлов.')
      return
    }

    const isOwnWall = targetId === myProfile.id
    const hasWallAccess = isOwnWall || (friendship?.status === 'accepted' && profile?.allow_wall_posts !== false)
    if (!hasWallAccess) {
      alert('Вы не можете публиковать записи на этой стене согласно настройкам приватности пользователя.')
      return
    }

    setUploadingPost(true)

    try {
      const imageUrls = attachedMedias.map(m => {
        if (!m.uploadedUrl) return null
        if (m.title) {
          const baseUrl = m.uploadedUrl.split('?')[0]
          return baseUrl + `?title=${encodeURIComponent(m.title)}`
        }
        return m.uploadedUrl
      }).filter(Boolean) as string[]
      let createdPollId: string | null = null

      if (isAddingPoll && pollQuestion.trim()) {
        const { data: pollData, error: pollError } = await supabase
          .from('polls')
          .insert({ question: pollQuestion })
          .select()
          .single()

        if (pollError) throw pollError
        createdPollId = pollData.id

        const optionsToInsert = pollOptions
          .filter(o => o.trim())
          .map(o => ({ poll_id: createdPollId!, text: o }))

        if (optionsToInsert.length > 0) {
          const { error: optionsError } = await supabase
            .from('poll_options')
            .insert(optionsToInsert)
          if (optionsError) throw optionsError
        }
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          author_id: myProfile.id,
          wall_id: targetId,
          content: newPostText,
          images: imageUrls.length > 0 ? imageUrls : null,
          poll_id: createdPollId,
          audio_id: attachedAudio ? attachedAudio.id : null
        })
        .select(`
          *,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, avatar_decoration),
          audio:music_tracks(id, title, artist, duration, file_url, cover_url),
          repost_source:repost_source_id(
            *,
            author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, avatar_decoration),
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
        .single()

      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['profile-posts', targetId] })
      queryClient.invalidateQueries({ queryKey: ['profile-stats', targetId] })
      setNewPostText('')
      setAttachedMedias([])
      setIsCreatingPost(false)
      setIsAddingPoll(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      setAttachedAudio(null)
    } catch (err) {
      console.error('Error creating post on profile:', err)
    } finally {
      setUploadingPost(false)
    }
  }

  const handleSaveStatus = async () => {
    setIsEditingStatus(false)
    if (!profile || !myProfile || profile.id !== myProfile.id) return
    try {
      const trimmed = statusText.trim()
      const { error } = await supabase
        .from('profiles')
        .update({ status: trimmed || null })
        .eq('id', myProfile.id)
      
      if (error) throw error
      
      queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
      updateProfile({ status: trimmed || null })
    } catch (err) {
      console.error('Error saving status:', err)
    }
  }



  if (loading) {
    return (
      <Panel id={id}>
        <Box position="sticky" insetBlockStart={0} style={{ zIndex: 10, background: 'transparent', boxShadow: 'none' }}>
          <PanelHeader fixed={false} className="transparent-header" delimiter="none">Профиль</PanelHeader>
        </Box>
        <Box style={{ padding: '0 16px' }}>
          <SkeletonPost />
          <SkeletonPost />
        </Box>
      </Panel>
    )
  }

  if (!profile) {
    return (
      <Panel id={id}>
        <Box position="sticky" insetBlockStart={0} style={{ zIndex: 10, background: 'transparent', boxShadow: 'none' }}>
          <PanelHeader fixed={false} className="transparent-header" delimiter="none">Профиль</PanelHeader>
        </Box>
        <Box style={{ textAlign: 'center', marginTop: 40 }}>
          <Text>Пользователь не найден</Text>
        </Box>
      </Panel>
    )
  }

  const isOwnProfile = profile.id === myProfile?.id
  const canPostOnWall = isOwnProfile || (friendship?.status === 'accepted' && profile.allow_wall_posts !== false)
  const filteredPosts = posts

  const profileCreatedAtLabel = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('ru-RU')
    : 'недавно'

  return (
    <Panel id={id} onContextMenu={(e) => { if (!(e.target as HTMLElement).closest('textarea') && !(e.target as HTMLElement).closest('input')) e.preventDefault() }}>

      {isMobile && profile?.profile_decoration && (
        <div className="v-profile-effect-fullpage" key={profile.id}>
          <img src={`/profile_effects/${profile.profile_decoration}.png`} alt="" style={{ width: '100vw', height: '100vh', objectFit: 'cover', pointerEvents: 'none' }} />
        </div>
      )}

      {/* Cover image & Profile header card */}
      <div 
        className="profile-card" 
        style={{ 
          padding: 0, 
          position: 'relative', 
          marginBottom: 16, 
          marginTop: -16, 
          borderRadius: '0 0 12px 12px', 
          background: 'var(--vkui--color_background_content)', 
          zIndex: 1,
          overflow: 'hidden'
        }}
      >
        {!isMobile && profile?.profile_decoration && (
          <div className="v-profile-effect-desktop" key={profile.id}>
            <img src={`/profile_effects/${profile.profile_decoration}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          </div>
        )}

        <div 
          onMouseEnter={() => setHoveredCover(true)}
          onMouseLeave={() => setHoveredCover(false)}
          style={{
            position: 'relative',
            height: 200,
            background: profile.cover_url ? `url(${profile.cover_url}) center/cover no-repeat` : 'linear-gradient(135deg, var(--vkui--color_background_accent) 0%, #aa3bff 100%)',
          }}
        >
          {/* Градиентная подложка для читаемости шапки */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 50%)',
            pointerEvents: 'none'
          }} />
          {isOwnProfile && hoveredCover && (
            <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 8, zIndex: 2 }}>
              {profile.cover_url && (
                <button
                  type="button"
                  onClick={handleDeleteCover}
                  style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    outline: 'none',
                    color: '#fff',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    padding: 0
                  }}
                  title="Удалить обложку"
                >
                  <Icon24Dismiss fill="#fff" style={{ width: 20, height: 20 }} />
                </button>
              )}
              <label 
                style={{ 
                  cursor: 'pointer', 
                  background: 'rgba(0, 0, 0, 0.5)', 
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  width: 38,
                  height: 38,
                  borderRadius: '50%', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                  padding: 0
                }}
                title="Загрузить новую обложку"
              >
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadCover} />
                <Icon28CameraOutline fill="#fff" style={{ width: 20, height: 20 }} />
              </label>
            </div>
          )}
          {uploadingCover && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px 12px 0 0',
              zIndex: 3
            }}>
              <Spinner size="m" style={{ color: '#fff' }} />
            </div>
          )}
        </div>

        {/* Profile Info block */}
        <div className="profile-info-section" style={{ display: 'flex', padding: '16px 24px', alignItems: 'flex-end', position: 'relative', gap: 24, flexWrap: 'wrap', overflow: 'visible' }}>
          {/* Avatar overlap */}
          <div 
            className="profile-avatar-wrapper"
            style={{ position: 'relative', marginTop: -50, flexShrink: 0 }}
          >
            <div style={{
              padding: stories.length > 0 ? 3 : 0,
              borderRadius: '50%',
              background: stories.length > 0 ? 'linear-gradient(135deg, #0077ff 0%, #aa3bff 100%)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              position: 'relative',
              cursor: 'pointer'
            }}
            onClick={(e) => {
              e.stopPropagation()
              // System bot profile — avatar click is disabled
              if (profile.id === '00000000-0000-0000-0000-000000000000') return
              if (stories.length > 0) {
                const rect = e.currentTarget.getBoundingClientRect()
                setAvatarMenuCoords({ x: rect.left + rect.width / 2, y: rect.bottom })
                setAvatarClickMenuOpen(true)
              } else if (profile.avatar_url) {
                handleImageClick([getOriginalImageUrl(profile.avatar_url)], 0)
              }
            }}
            >
              <CustomAvatar 
                size={120} 
                src={profile.avatar_url} 
                name={profile.full_name} 
                id={profile.id} 
                decoration={profile.avatar_decoration}
                style={{ 
                  border: '4px solid var(--vkui--color_background_page)', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)', 
                }} 
              />
              {uploadingAvatar && (
                <div style={{
                  position: 'absolute',
                  inset: stories.length > 0 ? 3 : 0,
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 11
                }}>
                  <Spinner size="s" style={{ color: '#fff' }} />
                </div>
              )}
            </div>
            {isOwnProfile && (
              <label 
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'absolute', bottom: 0, right: 0, cursor: 'pointer', background: 'var(--vkui--color_background_accent)', padding: 6, borderRadius: '50%', border: '2px solid var(--vkui--color_background_page)', display: 'flex', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', zIndex: 10 }}
              >
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadAvatar} />
                <Icon28CameraOutline fill="#fff" style={{ width: 16, height: 16 }} />
              </label>
            )}

          </div>

          {/* Name and status */}
          <div className="profile-name-status profile-info-details" style={{ flex: 1, minWidth: 180, paddingBottom: 8 }}>
            {/* Row 1: Name + privilege badge */}
            <div className="profile-name-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: profile.id === '00000000-0000-0000-0000-000000000000' ? '#ff9500' : 'var(--vkui--color_text_primary)', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                {profile.full_name}
                {isOwnProfile ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <EmojiPicker
                      onSelect={async (emoji) => {
                        await updateProfile({ emoji_status: emoji })
                        queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
                      }}
                      placement="down"
                      customTrigger={
                        <span
                          style={{ 
                            fontSize: profile.emoji_status ? 20 : 16, 
                            opacity: profile.emoji_status ? 1 : 0.4, 
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 4px',
                            borderRadius: 4,
                            background: 'rgba(255,255,255,0.04)',
                            transition: 'opacity 0.2s'
                          }}
                          title={profile.emoji_status ? "Сменить эмодзи-статус" : "Установить эмодзи-статус"}
                        >
                          {profile.emoji_status || '😀+'}
                        </span>
                      }
                    />
                    {profile.emoji_status && (
                      <span
                        onClick={async (e) => {
                          e.stopPropagation()
                          await updateProfile({ emoji_status: null })
                          queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
                        }}
                        style={{ fontSize: 12, opacity: 0.4, cursor: 'pointer' }}
                        title="Удалить эмодзи-статус"
                      >
                        ✕
                      </span>
                    )}
                  </div>
                ) : (
                  profile.emoji_status && (
                    <span style={{ fontSize: 20, display: 'inline-flex', alignItems: 'center' }} title="Эмодзи-статус">
                      {profile.emoji_status}
                    </span>
                  )
                )}
              </span>
              {profile.id === '00000000-0000-0000-0000-000000000000'
                ? <span style={{ fontSize: 15, verticalAlign: 'middle' }}>🤖</span>
                : <AdminBadge username={profile.username} role={profile.role} roles={profile.roles ?? undefined} />
              }
            </div>

            {/* Editable Status */}
            <div style={{ marginTop: 4, minHeight: 20 }}>
              {isOwnProfile ? (
                isEditingStatus ? (
                  <input
                    type="text"
                    value={statusText}
                    onChange={(e) => setStatusText(e.target.value)}
                    onBlur={handleSaveStatus}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveStatus()
                    }}
                    autoFocus
                    maxLength={100}
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      padding: '4px 8px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.12))',
                      background: 'var(--vkui--color_background_content, #fff)',
                      color: 'var(--vkui--color_text_primary, #000)',
                      outline: 'none'
                    }}
                  />
                ) : (
                  <Text
                    onClick={() => setIsEditingStatus(true)}
                    style={{
                      fontSize: 13,
                      color: profile.status ? 'var(--vkui--color_text_primary)' : 'var(--vkui--color_text_secondary)',
                      fontStyle: profile.status ? 'normal' : 'italic',
                      cursor: 'pointer',
                      display: 'inline-block',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      background: 'transparent',
                      transition: 'background 0.2s'
                    }}
                    className="profile-status-text-hover"
                  >
                    {profile.status || 'установить статус'}
                  </Text>
                )
              ) : (
                profile.status && (
                  <Text style={{ fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                    {profile.status}
                  </Text>
                )
              )}
            </div>

            {profile.listening_to && (
              <div
                className="profile-listening-status profile-listening-pulse"
                onClick={() => {
                  const track = profile.listening_to
                  useMusicStore.getState().setPlaylist([track])
                  useMusicStore.getState().setCurrentTrack(track)
                  useMusicStore.getState().setIsPlaying(true)
                  useMusicStore.getState().setIsPlayerExpanded(true)
                }}
                title="Нажмите, чтобы включить этот трек"
              >
                {/* Neon glow behind (like header mini-player) */}
                <div className="profile-listening-glow" />

                {/* Animated equalizer bars instead of static note icon */}
                <div className="profile-listening-equalizer">
                  <span /><span /><span /><span />
                </div>

                <span className="profile-listening-text">
                  {profile.listening_to.artist} — {profile.listening_to.title}
                </span>
              </div>
            )}


            {/* Row 2: Online status + bio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: hasBlockedMe ? '#8e8e93' : profile.id === '00000000-0000-0000-0000-000000000000' ? '#34c759' : (profile.status_preference !== 'offline' && profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000) ? '#34c759' : '#8e8e93',
                flexShrink: 0
              }} />
              <Text style={{ fontSize: 13, color: hasBlockedMe ? 'var(--vkui--color_text_secondary)' : profile.id === '00000000-0000-0000-0000-000000000000' ? '#34c759' : (profile.status_preference !== 'offline' && profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000) ? '#34c759' : 'var(--vkui--color_text_secondary)' }}>
                {hasBlockedMe
                  ? 'никогда не заходил'
                  : profile.id === '00000000-0000-0000-0000-000000000000'
                    ? 'Бот'
                    : profile.status_preference === 'offline'
                      ? 'скрыт статус'
                      : (profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000)
                        ? 'в сети'
                        : profile.last_seen
                          ? (() => {
                              const diff = Math.floor((Date.now() - new Date(profile.last_seen).getTime()) / 60000)
                              if (diff < 60) return `был(а) ${diff} мин. назад`
                              const h = Math.floor(diff / 60)
                              if (h < 24) return `был(а) ${h} ч. назад`
                              const d = Math.floor(h / 24)
                              if (d === 1) return 'был(а) вчера'
                              if (d < 7) return `был(а) ${d} дн. назад`
                              return `был(а) ${new Date(profile.last_seen).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
                            })()
                          : 'не в сети'
                }
              </Text>
            </div>
          </div>

          {/* Action buttons */}
          <div className="profile-action-buttons profile-actions-wrapper" style={{ display: 'flex', gap: 10, paddingBottom: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            {isOwnProfile || hasBlockedMe ? (
              <></>
            ) : (
              <>
                {profile.id !== '00000000-0000-0000-0000-000000000000' && (
                  <>
                    {!blockedUserIds.has(profile.id) && (
                      <Button 
                        before={<Icon28MessageOutline />} 
                        size="m" 
                        onClick={handleOpenDirectChat} 
                        className="profile-btn-message"
                      >
                        {!isMobile && <span className="profile-btn-text">Сообщение</span>}
                      </Button>
                    )}
                    
                    <Button
                      before={(() => {
                        if (!friendship) return <Icon28UserAddOutline />
                        if (friendship.status === 'pending') {
                          if (friendship.requester_id === myProfile?.id) {
                            return <Icon28UserOutline />
                          } else {
                            return <Icon28UserAddOutline />
                          }
                        }
                        if (friendship.status === 'accepted') {
                          return <Icon28UserAddedOutline />
                        }
                        return <Icon28UserMinusOutline />
                      })()}
                      size="m"
                      mode={friendship ? 'secondary' : 'primary'}
                      onClick={handleFriendAction}
                      className="profile-btn-friends"
                    >
                      {!isMobile && (
                        <span className="profile-btn-text">
                          {!friendship ? 'Добавить в друзья' :
                           friendship.status === 'pending' && friendship.requester_id === myProfile?.id ? 'Отменить заявку' :
                           friendship.status === 'pending' ? 'Принять заявку' : 'Удалить из друзей'}
                        </span>
                      )}
                    </Button>
                  </>
                )}

                <Button
                  before={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 12 20 22 4 22 4 12" />
                      <rect x="2" y="7" width="20" height="5" />
                      <line x1="12" y1="22" x2="12" y2="7" />
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                    </svg>
                  } 
                  size="m" 
                  mode="secondary"
                  onClick={() => setSendGiftModalOpen(true)}
                  className="profile-btn-gift"
                >
                  {!isMobile && <span className="profile-btn-text">Подарок</span>}
                </Button>

                {profile.id !== '00000000-0000-0000-0000-000000000000' && (
                  <div className="profile-btn-more-container" style={{ position: 'relative' }}>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        setOptionsMenuCoords({ x: rect.left, y: rect.bottom })
                        setOptionsMenuOpen(!optionsMenuOpen)
                      }}
                      className="profile-btn-more"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Icon28MoreHorizontal />
                    </IconButton>
                  </div>
                )}

                  {optionsMenuOpen && optionsMenuCoords && profile && myProfile && (
                    <div 
                      className="custom-context-menu"
                      style={{
                        position: 'fixed',
                        top: optionsMenuCoords.y + 8,
                        left: Math.max(16, optionsMenuCoords.x - 144),
                        width: 180,
                        backgroundColor: 'rgba(18, 18, 22, 0.97)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 14,
                        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55)',
                        padding: '6px',
                        zIndex: 10000,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          setOptionsMenuOpen(false)
                          await toggleMuteUser(myProfile.id, profile.id)
                        }}
                        className="context-menu-item"
                        style={{
                          padding: '8px 12px',
                          background: 'none',
                          border: 'none',
                          borderRadius: 8,
                          color: '#ffffff',
                          textAlign: 'left',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          width: '100%',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {mutedUserIds.has(profile.id) ? '🔊 Вкл. уведомления' : '🔕 Заглушить'}
                      </button>
                      
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          setOptionsMenuOpen(false)
                          if (confirm(blockedUserIds.has(profile.id) ? 'Разблокировать этого пользователя?' : 'Заблокировать этого пользователя? Он не сможет отправлять вам сообщения.')) {
                            await toggleBlockUser(myProfile.id, profile.id)
                          }
                        }}
                        className="context-menu-item"
                        style={{
                          padding: '8px 12px',
                          background: 'none',
                          border: 'none',
                          borderRadius: 8,
                          color: blockedUserIds.has(profile.id) ? '#4da3ff' : '#ff453a',
                          textAlign: 'left',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          width: '100%',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = blockedUserIds.has(profile.id) ? 'rgba(0, 119, 255, 0.1)' : 'rgba(255, 69, 58, 0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {blockedUserIds.has(profile.id) ? '🔓 Разблокировать' : '🚫 Заблокировать'}
                      </button>
                    </div>
                  )}
              </>
            )}

            {myProfile && (myProfile.id === 'fee894db-c5b0-4022-bb9f-56c60decac86' || myProfile.username === 'viht') && (
              <div>
                <Button 
                  before={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  } 
                  size="m" 
                  mode="secondary"
                  style={{ background: 'linear-gradient(135deg, #0077ff 0%, #aa3bff 100%)', color: '#ffffff', border: 'none' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    setRoleMenuCoords({ x: rect.left, y: rect.bottom })
                    setRoleMenuOpen(!roleMenuOpen)
                  }}
                >
                  Привилегии
                </Button>
                {roleMenuOpen && roleMenuCoords && (() => {
                  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
                  const currentRoles: string[] = profile?.roles ?? (profile?.role ? [profile.role] : [])
                  const allPrivileges = [
                    { role: 'creator',   label: '👑 Создатель' },
                    { role: 'donator',   label: '💎 Донатер' },
                    { role: 'sponsor',   label: '🤝 Спонсор' },
                    { role: 'first',     label: '1️⃣ Первый' },
                    { role: 'cool',      label: '😎 Крутой' },
                    { role: 'star',      label: '⭐ Звёздочка' },
                    { role: 'heart',     label: '❤️ Сердечко' },
                    { role: 'moderator', label: '🛠️ Модератор' },
                    { role: 'admin',     label: '🛡️ Админ' },
                  ]
                  return (
                    <div 
                      className="custom-context-menu"
                      style={{
                        position: 'fixed',
                        top: roleMenuCoords.y + 8,
                        left: roleMenuCoords.x,
                        width: 210,
                        backgroundColor: isDark ? 'rgba(18, 18, 22, 0.97)' : 'rgba(255, 255, 255, 0.97)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: 14,
                        boxShadow: isDark ? '0 12px 40px rgba(0, 0, 0, 0.55)' : '0 12px 40px rgba(0, 0, 0, 0.15)',
                        padding: '6px 6px 4px',
                        zIndex: 10000,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1
                      }}
                    >
                      <div style={{ padding: '4px 10px 6px', fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Привилегии
                      </div>
                      {allPrivileges.map(item => {
                        const active = currentRoles.includes(item.role)
                        return (
                          <button
                            key={item.role}
                            onClick={async () => {
                              await handleToggleRole(item.role)
                            }}
                            className="context-menu-item"
                            style={{
                              padding: '7px 10px',
                              background: active ? (isDark ? 'rgba(0, 119, 255, 0.15)' : 'rgba(0, 119, 255, 0.08)') : 'none',
                              border: 'none',
                              borderRadius: 8,
                              color: active ? '#0077ff' : (isDark ? '#ffffff' : '#1c1c1e'),
                              textAlign: 'left',
                              fontSize: 13,
                              fontWeight: active ? 600 : 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              transition: 'background-color 0.15s ease, color 0.15s ease'
                            }}
                            onMouseEnter={e => !active && (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)')}
                            onMouseLeave={e => !active && (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span>{item.label}</span>
                            <span style={{
                              width: 16, height: 16,
                              borderRadius: 4,
                              border: active ? 'none' : (isDark ? '1.5px solid rgba(255,255,255,0.25)' : '1.5px solid rgba(0,0,0,0.15)'),
                              background: active ? '#0077ff' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}>
                              {active && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </span>
                          </button>
                        )
                      })}
                      <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
                      <button
                        onClick={async () => {
                          await handleClearAllRoles()
                          setRoleMenuOpen(false)
                        }}
                        style={{
                          padding: '7px 10px',
                          background: 'none',
                          border: 'none',
                          borderRadius: 8,
                          color: '#ff453a',
                          textAlign: 'left',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          width: '100%',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 69, 58, 0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        ❌ Снять все привилегии
                      </button>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Info & Stats - Expandable Block inside profile-card */}
          {!hasBlockedMe && (
            <div style={{
              width: '100%',
              marginTop: 12,
              borderTop: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.08))',
              overflow: 'hidden'
            }}>
            {/* Header - clickable */}
            <div 
              onClick={() => setInfoExpanded(!infoExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0 8px',
                cursor: 'pointer',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)' }}>
                  Информация
                </span>
                {isOwnProfile && (
                  <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>
                    {profileStats.postsCount} постов · {profileStats.likesReceived} лайков
                  </span>
                )}
              </div>
              <svg 
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)', transform: infoExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--vkui--color_text_secondary)' }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            {/* Expanded content */}
            <div style={{
              maxHeight: infoExpanded ? '600px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: infoExpanded ? 1 : 0
            }}>
              <div style={{ padding: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Basic info */}
                {(profile.city || profile.birth_date || profile.bio || profile.created_at) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
                    {profile.city && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                        <Icon28LocationOutline width={16} height={16} style={{ color: 'var(--vkui--color_text_secondary)' }} />
                        <span style={{ color: 'var(--vkui--color_text_secondary)', width: 110, flexShrink: 0 }}>Город:</span>
                        <span>{profile.city}</span>
                      </div>
                    )}
                    {profile.birth_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                        <Icon28CalendarOutline width={16} height={16} style={{ color: 'var(--vkui--color_text_secondary)' }} />
                        <span style={{ color: 'var(--vkui--color_text_secondary)', width: 110, flexShrink: 0 }}>День рождения:</span>
                        <span>{new Date(profile.birth_date).toLocaleDateString('ru-RU')}</span>
                      </div>
                    )}
                    {profile.bio && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                        <Icon28InfoOutline width={16} height={16} style={{ color: 'var(--vkui--color_text_secondary)', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: 'var(--vkui--color_text_secondary)', width: 110, flexShrink: 0 }}>О себе:</span>
                        <span>{profile.bio}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--vkui--color_text_secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span style={{ color: 'var(--vkui--color_text_secondary)', width: 110, flexShrink: 0 }}>На сайте с:</span>
                      <span>{profileCreatedAtLabel}</span>
                    </div>
                  </div>
                )}

                {/* Stats as text rows - only visible for profile owner */}
                {isOwnProfile && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.05))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--vkui--color_text_secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <span style={{ color: 'var(--vkui--color_text_secondary)', width: 180, flexShrink: 0 }}>Просмотров профиля:</span>
                      <span>{profileStats.profileViews}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--vkui--color_text_secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      <span style={{ color: 'var(--vkui--color_text_secondary)', width: 180, flexShrink: 0 }}>Постов:</span>
                      <span>{profileStats.postsCount}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                      <Icon28LikeOutline width={16} height={16} style={{ color: 'var(--vkui--color_text_secondary)' }} />
                      <span style={{ color: 'var(--vkui--color_text_secondary)', width: 180, flexShrink: 0 }}>Лайков получено:</span>
                      <span>{profileStats.likesReceived}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                      <Icon28LikeOutline width={16} height={16} style={{ color: 'var(--vkui--color_text_secondary)' }} />
                      <span style={{ color: 'var(--vkui--color_text_secondary)', width: 180, flexShrink: 0 }}>Лайков поставлено:</span>
                      <span>{profileStats.likesGiven}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                      <Icon28CommentOutline width={16} height={16} style={{ color: 'var(--vkui--color_text_secondary)' }} />
                      <span style={{ color: 'var(--vkui--color_text_secondary)', width: 180, flexShrink: 0 }}>Комментариев получено:</span>
                      <span>{profileStats.commentsReceived}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
                      <Icon28CommentOutline width={16} height={16} style={{ color: 'var(--vkui--color_text_secondary)' }} />
                      <span style={{ color: 'var(--vkui--color_text_secondary)', width: 180, flexShrink: 0 }}>Комментариев оставлено:</span>
                      <span>{profileStats.commentsGiven}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Single main column layout */}
      <div className="profile-main-column" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 0 }}>
        {!hasBlockedMe && (
          <>
        {/* Active Stories tray on Profile */}


        {/* Edit Form */}
        {isOwnProfile && isEditing && (
          <Group header={<Header size="s">Редактирование профиля</Header>}>
            <div>
              <FormItem top="Имя и Фамилия">
                <Input type="text" value={editFullName} onChange={e => setEditFullName(e.target.value)} />
              </FormItem>
               <FormItem top="Тег">
                <Input 
                  type="text" 
                  value={editUsername} 
                  onChange={e => setEditUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7))} 
                  placeholder="тег" 
                />
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_primary)' }}>
                    Ваш ID страницы: <span style={{ fontWeight: 600, color: '#007aff' }}>{profile.num_id}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Button 
                      size="s" 
                      mode="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(String(profile.num_id)).then(() => {
                          window.dispatchEvent(new CustomEvent('show-toast', {
                            detail: { title: 'Копирование', text: 'ID страницы скопирован в буфер обмена!' }
                          }))
                        })
                      }}
                    >
                      Копировать ID
                    </Button>
                    <Button 
                      size="s" 
                      mode="secondary"
                      onClick={() => {
                        const link = `vihtclub.ru/${editUsername || 'id' + profile.num_id}`
                        navigator.clipboard.writeText(link).then(() => {
                          window.dispatchEvent(new CustomEvent('show-toast', {
                            detail: { title: 'Копирование', text: 'Ссылка скопирована в буфер обмена!' }
                          }))
                        })
                      }}
                    >
                      Копировать ссылку
                    </Button>
                  </div>
                </div>
              </FormItem>
              <FormItem top="Электронная почта">
                <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="email@example.com" />
              </FormItem>
              <FormItem top="О себе (Bio)">
                <Input type="text" value={editBio} onChange={e => setEditBio(e.target.value)} />
              </FormItem>
              <FormItem top="Город">
                <Input type="text" value={editCity} onChange={e => setEditCity(e.target.value)} />
              </FormItem>
              <FormItem top="Дата рождения">
                <Input 
                  type="date" 
                  value={editBirthDate} 
                  onChange={e => setEditBirthDate(e.target.value)} 
                  min="1980-01-01"
                  max={new Date().toISOString().split('T')[0]}
                />
              </FormItem>
              <FormItem top="Статус на сайте">
                <select 
                  value={editStatusPreference} 
                  onChange={e => setEditStatusPreference(e.target.value as 'online' | 'offline')}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--vkui--color_separator_primary_alpha)',
                    backgroundColor: '#ffffff',
                    fontSize: 14,
                    color: '#000000'
                  }}
                >
                  <option value="online">В сети (Онлайн)</option>
                  <option value="offline">Не в сети (Офлайн / Невидимка)</option>
                </select>
              </FormItem>
              <FormItem>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Button size="m" onClick={handleSaveProfile}>Сохранить</Button>
                  <Button size="m" mode="secondary" onClick={() => setIsEditing(false)}>Отмена</Button>
                </div>
              </FormItem>
            </div>
          </Group>
        )}

        {/* Блок подарков */}
        {gifts.length > 0 && (
          <div className="vkuiGroup profile-gifts-card" style={{
            padding: '12px 16px',
            marginBottom: 16,
            background: 'var(--vkui--color_background_content, #ffffff)',
            border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.08))',
            borderRadius: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--vkui--color_text_primary)' }}>
                Подарки ({gifts.length})
              </span>
            </div>
            <div ref={giftsScrollRef} className="gifts-scroll-container" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, paddingTop: 8, paddingLeft: 6, paddingRight: 6 }}>
              {gifts.map((gift: any) => {
                const item = GIFT_ITEMS[gift.gift_key] || GIFT_ITEMS.gift_box
                const isHovered = hoveredGiftId === gift.id
                return (
                  <div 
                    key={gift.id}
                    onClick={() => setSelectedGiftDetail(gift)}
                    onMouseEnter={() => setHoveredGiftId(gift.id)}
                    onMouseLeave={() => setHoveredGiftId(null)}
                    className="profile-gift-item"
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      width: 72, 
                      padding: '12px 6px 8px',
                      borderRadius: 14,
                      background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      flexShrink: 0,
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    title={
                      `${gift.is_anonymous ? 'Анонимно' : (gift.sender?.full_name || 'Пользователь')}\n` +
                      (gift.message ? `«${gift.message}»\n` : '') +
                      new Date(gift.created_at).toLocaleDateString()
                    }
                  >
                    {isOwnProfile && isHovered && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteGift(gift.id)
                        }}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 18,
                          height: 18,
                          background: '#ff3b30',
                          color: '#fff',
                          borderRadius: '50%',
                          fontSize: 10,
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                          zIndex: 5,
                          border: '1.5px solid var(--vkui--color_background_content, #1e1e24)'
                        }}
                        title="Удалить подарок"
                      >
                        ✕
                      </span>
                    )}
                    <img 
                      src={item.animatedUrl} 
                      alt={item.name} 
                      style={{ 
                        width: 44, 
                        height: 44, 
                        objectFit: 'contain',
                        transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                      }} 
                    />
                    <span 
                      style={{ 
                        fontSize: 9, 
                        color: 'var(--vkui--color_text_secondary)', 
                        textAlign: 'center', 
                        marginTop: 6,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%',
                        fontWeight: 500
                      }}
                    >
                      {gift.is_anonymous ? 'Анонимно' : (gift.sender?.full_name || 'Пользователь')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}



        <div className="profile-overview-grid">
          {/* Friends block */}
          <div className="vkuiGroup profile-overview-card" style={{ padding: 0, margin: 0 }}>
            <div className="profile-overview-card__header">
              <span className="profile-overview-card__title">Друзья</span>
              <span
                onClick={() => useAppStore.getState().setStory('friends')}
                className="profile-overview-card__link"
              >
                {profileFriends.length}
              </span>
            </div>
            {profileFriends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '18px 16px 20px', color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>
                Пока нет друзей
              </div>
            ) : (
              <div className="profile-friends-grid">
                {profileFriends.slice(0, 6).map(friend => (
                  <div
                    key={friend.id}
                    onClick={() => useAppStore.getState().selectProfile(friend.id)}
                    className="profile-friend-tile"
                  >
                    <CustomAvatar size={isMobile ? 54 : 72} src={friend.avatar_url} name={friend.full_name} id={friend.id} decoration={friend.avatar_decoration} style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }} />
                    <Text className="profile-friend-name">
                      {friend.full_name?.split(' ')[0] || 'Пользователь'}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Posts list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header row */}
          <div className="vkuiGroup profile-wall-header-card" style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 16px 8px',
            margin: 0,
            borderRadius: 12,
            background: 'var(--vkui--color_background_content, #ffffff)',
            border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.08))'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Text weight="2" style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--vkui--color_text_secondary)' }}>
                Стена
              </Text>
              {canPostOnWall && (
                <Button size="s" mode="tertiary" onClick={() => setIsCreatingPost(!isCreatingPost)} style={{ borderRadius: 8 }}>
                  {isCreatingPost ? 'Отмена' : 'Добавить запись'}
                </Button>
              )}
            </div>
            
            <Tabs style={{ marginTop: 8, marginLeft: -16, marginRight: -16 }}>
              <TabsItem id="all-posts-tab" aria-controls="wall-posts-content" selected={wallFilter === 'all'} onClick={() => setWallFilter('all')}>
                Все записи
              </TabsItem>
              {(!profile.hide_music || isOwnProfile) && (
                <TabsItem id="user-music-tab" aria-controls="wall-posts-content" selected={wallFilter === 'music'} onClick={() => setWallFilter('music')}>
                  Музыка {isOwnProfile ? 'пользователя' : profile.full_name?.split(' ')[0]}
                </TabsItem>
              )}
            </Tabs>
          </div>

          {canPostOnWall && isCreatingPost && (
            <div className="vkuiGroup profile-wall-create-card" style={{
              position: 'relative',
              padding: '16px',
              margin: 0,
              borderRadius: 12,
              border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.08))',
              background: 'var(--vkui--color_background_content, #ffffff)'
            }}>
              <WriteBar
                className="profile-write-bar"
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileChange({
                      target: { files: e.dataTransfer.files }
                    } as any)
                  }
                }}
                placeholder="Что у вас нового?"
                after={
                   <div style={{ display: 'flex', alignItems: 'center' }}>
                     <input
                       ref={fileInputRef}
                       type="file"
                       multiple
                       accept="image/*,video/*"
                       style={{ display: 'none' }}
                       onChange={handleFileChange}
                     />
                     <div className={`writebar-helper-icons ${isInputActive ? 'active' : ''}`}>
                       <EmojiPicker onSelect={(emoji) => setNewPostText(prev => prev + emoji)} placement="up" />
                       <IconButton 
                          aria-label="Опрос"
                          onClick={() => setIsAddingPoll(!isAddingPoll)}
                          style={{ color: isAddingPoll ? 'var(--vkui--color_icon_accent)' : 'var(--vkui--color_text_secondary)', padding: 0 }}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                          </svg>
                        </IconButton>
                       <IconButton 
                          aria-label="Прикрепить музыку"
                          onClick={() => setShowMusicModal(true)}
                          style={{ color: attachedAudio ? 'var(--vkui--color_icon_accent)' : 'var(--vkui--color_text_secondary)', padding: 0 }}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                          </svg>
                        </IconButton>
                       <WriteBarIcon 
                         aria-label="Прикрепить фото"
                         onClick={() => fileInputRef.current?.click()}
                       >
                         <Icon28CameraOutline />
                       </WriteBarIcon>
                     </div>
                     <WriteBarIcon mode="send" onClick={handleCreatePost} disabled={uploadingPost || attachedMedias.some(m => m.isUploading) || (!newPostText.trim() && attachedMedias.length === 0 && !isAddingPoll && !attachedAudio)} aria-label="Отправить запись">
                       {uploadingPost ? <Spinner size="s" /> : <Icon28SendOutline />}
                     </WriteBarIcon>
                   </div>
                }
              />
              {isAddingPoll && (
                <div style={{
                  borderRadius: 14,
                  background: 'var(--vkui--color_background_modal, var(--vkui--color_background_content, #ffffff))',
                  border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.08))',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  animation: 'pollFadeIn 0.3s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--vkui--color_icon_accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--vkui--color_text_primary)', letterSpacing: '0.2px' }}>
                      Создание опроса
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Тема опроса"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: 14,
                      fontWeight: 500,
                      borderRadius: 8,
                      border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.12))',
                      background: 'var(--vkui--color_background_secondary, #f2f3f5)',
                      color: 'var(--vkui--color_text_primary)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pollOptions.map((opt, oIdx) => (
                      <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--vkui--color_icon_secondary, #99a2ad)', flexShrink: 0 }} />
                        <input
                          type="text"
                          placeholder={`Вариант ${oIdx + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const val = e.target.value
                            setPollOptions(prev => prev.map((o, idx) => idx === oIdx ? val : o))
                          }}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            fontSize: 13,
                            borderRadius: 8,
                            border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.12))',
                            background: 'var(--vkui--color_background_content, #ffffff)',
                            color: 'var(--vkui--color_text_primary)',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                        {pollOptions.length > 2 && (
                          <IconButton 
                            onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== oIdx))}
                            style={{ color: '#ff453a', padding: 4 }}
                            aria-label="Удалить вариант"
                          >
                            <Icon24Dismiss width={20} height={20} />
                          </IconButton>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                    {pollOptions.length < 10 && (
                      <Button 
                        mode="secondary" 
                        size="s" 
                        onClick={() => setPollOptions(prev => [...prev, ''])}
                        style={{ borderRadius: 8 }}
                      >
                        + Добавить вариант
                      </Button>
                    )}
                    <Button
                      mode="tertiary"
                      size="s"
                      onClick={() => {
                        setIsAddingPoll(false)
                        setPollQuestion('')
                        setPollOptions(['', ''])
                      }}
                      style={{ borderRadius: 8, color: 'var(--vkui--color_text_secondary)' }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
              {attachedMedias.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {attachedMedias.map((item) => {
                    const isVideo = item.file.type.startsWith('video/') || item.file.name.toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)
                    if (isVideo) {
                      return (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', width: 140, height: 82, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--vkui--color_separator_primary_alpha)' }}>
                          <div style={{ position: 'relative', width: '100%', height: 52, backgroundColor: '#000' }}>
                            <video src={item.previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                            
                            {item.isUploading && (
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 'bold',
                                zIndex: 3,
                                gap: 2
                              }}>
                                <Spinner size="s" style={{ color: '#fff' }} />
                                <span>{item.progress}%</span>
                              </div>
                            )}

                            <button
                              onClick={() => {
                                item.abortController?.abort()
                                URL.revokeObjectURL(item.previewUrl)
                                setAttachedMedias(prev => prev.filter(m => m.id !== item.id))
                              }}
                              style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4, padding: 0 }}
                            >
                              ×
                            </button>
                          </div>
                          <input 
                            type="text"
                            value={item.title || ''}
                            onChange={(e) => {
                              const newTitle = e.target.value
                              setAttachedMedias(prev => prev.map(m => m.id === item.id ? { ...m, title: newTitle } : m))
                            }}
                            placeholder="Название видео"
                            style={{
                              width: '100%',
                              height: 30,
                              border: 'none',
                              padding: '4px 8px',
                              boxSizing: 'border-box',
                              fontSize: 11,
                              background: 'var(--vkui--color_background_secondary)',
                              color: 'var(--vkui--color_text_primary)',
                              outline: 'none'
                            }}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={item.id} style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--vkui--color_separator_primary_alpha)' }}>
                        <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        
                        {item.isUploading && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.6)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 'bold',
                            zIndex: 3,
                            gap: 2
                          }}>
                            <Spinner size="s" style={{ color: '#fff' }} />
                            <span>{item.progress}%</span>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            item.abortController?.abort()
                            URL.revokeObjectURL(item.previewUrl)
                            setAttachedMedias(prev => prev.filter(m => m.id !== item.id))
                          }}
                          style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4, padding: 0 }}
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {attachedAudio && (
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'var(--vkui--color_background_secondary, #f2f3f5)',
                    border: '1px solid var(--vkui--color_separator_primary_alpha)',
                    position: 'relative',
                    marginTop: 8
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', background: '#1c1c1e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {attachedAudio.cover_url ? (
                      <img src={attachedAudio.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 14 }}>🎵</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {attachedAudio.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                      {attachedAudio.artist}
                    </div>
                  </div>
                  <button
                    onClick={() => setAttachedAudio(null)}
                    style={{
                      background: 'rgba(0,0,0,0.05)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--vkui--color_text_secondary)',
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {wallFilter === 'music' ? (
            <UserProfileMusic profileId={profile.id} />
          ) : (
            posts.length === 0 ? (
              <div className="vkuiGroup" style={{ textAlign: 'center', padding: 24, margin: 0, borderRadius: 12, border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.08))', backgroundColor: 'var(--vkui--color_background_content, #ffffff)' }}>
                <Text style={{ color: 'var(--vkui--color_text_secondary)', fontSize: 14 }}>На стене пока нет записей.</Text>
              </div>
            ) : (
              filteredPosts.map(post => (
                <PostCard 
                  key={post.id}
                  post={post}
                  onDeleteSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['profile-posts', targetId] })
                    queryClient.invalidateQueries({ queryKey: ['profile-stats', targetId] })
                  }}
                  onShareClick={(postObj) => setSharingPost(postObj)}
                />
              ))
            )
          )}
        </div>
      </>
    )}
  </div>

      {sharingPost && (
        <ShareModal 
          post={sharingPost} 
          onClose={() => setSharingPost(null)} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['profile-posts', targetId] })
            queryClient.invalidateQueries({ queryKey: ['profile-stats', targetId] })
          }}
        />
      )}


      {activeStoriesList && (
        <StoryViewerOverlay 
          stories={activeStoriesList} 
          onClose={() => setActiveStoriesList(null)} 
        />
      )}

      {sendGiftModalOpen && (
        <div 
          onClick={() => setSendGiftModalOpen(false)}
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
              maxWidth: 380,
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--vkui--color_text_primary)' }}>
                Отправить подарок
              </span>
              <span 
                onClick={() => setSendGiftModalOpen(false)} 
                style={{ cursor: 'pointer', fontSize: 20, opacity: 0.6, color: 'var(--vkui--color_text_primary)', padding: 4 }}
              >
                ✕
              </span>
            </div>

            {/* Tier Tab Buttons */}
            <div style={{ display: 'flex', gap: 8, margin: '4px 0 0' }}>
              {(['regular', 'premium', 'exclusive'] as GiftTier[]).map(tier => {
                const t = GIFT_TIERS[tier]
                const active = selectedGiftTier === tier
                return (
                  <button
                    key={tier}
                    onClick={() => { setSelectedGiftTier(tier); setSelectedGiftKey(Object.entries(GIFT_ITEMS).find(([, i]) => i.tier === tier)?.[0] || '') }}
                    style={{
                      flex: 1,
                      padding: '9px 4px',
                      borderRadius: 14,
                      border: active ? `1.5px solid ${t.color}` : '1.5px solid transparent',
                      background: active ? `${t.color}18` : 'rgba(255,255,255,0.04)',
                      color: active ? t.color : 'var(--vkui--color_text_secondary)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      boxShadow: active ? `0 2px 12px ${t.color}30` : 'none'
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{t.label.split(' ')[0]}</span>
                    <span>{t.label.split(' ').slice(1).join(' ')}</span>
                    <span style={{ fontSize: 9, opacity: 0.8, marginTop: 1 }}>{t.price} Vihton</span>
                  </button>
                )
              })}
            </div>

            {/* Gift Grid for selected tier */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, maxHeight: 240, overflowY: 'auto', padding: '4px', boxSizing: 'border-box' }}>
              {Object.entries(GIFT_ITEMS).filter(([, item]) => item.tier === selectedGiftTier).map(([key, item]) => {
                const selected = selectedGiftKey === key
                const t = GIFT_TIERS[selectedGiftTier]
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedGiftKey(key)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '8px 4px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      border: selected ? `2px solid ${t.color}` : '2px solid transparent',
                      background: selected ? `${t.color}20` : 'rgba(255,255,255,0.04)',
                      boxShadow: selected ? `0 0 14px ${t.color}45` : 'none',
                      transition: 'all 0.2s ease',
                      transform: 'none'
                    }}
                    title={item.name}
                  >
                    <img src={item.animatedUrl} alt={item.name} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                    <span style={{ fontSize: 9, marginTop: 4, color: selected ? t.color : 'var(--vkui--color_text_secondary)', textAlign: 'center', fontWeight: 600, lineHeight: 1.2 }}>
                      {item.name}
                    </span>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>Ваше пожелание (необязательно):</span>
              <textarea
                value={giftMessage}
                onChange={e => setGiftMessage(e.target.value)}
                placeholder="Напиши что-нибудь приятное..."
                maxLength={200}
                style={{
                  width: '100%',
                  height: 75,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0,0,0,0.25)',
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>
              <input
                type="checkbox"
                checked={giftIsAnonymous}
                onChange={e => setGiftIsAnonymous(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Отправить анонимно</span>
            </label>

            <Button
              size="l"
              loading={sendingGift}
              onClick={handleSendGift}
              style={{ 
                width: '100%', 
                marginTop: 8,
                background: 'linear-gradient(135deg, #0077ff 0%, #aa3bff 100%)',
                border: 'none',
                borderRadius: 12,
                boxShadow: '0 4px 15px rgba(0, 119, 255, 0.3)'
              }}
            >
              Отправить
            </Button>
          </div>
        </div>
      )}

      {selectedGiftDetail && (() => {
        const item = GIFT_ITEMS[selectedGiftDetail.gift_key] || GIFT_ITEMS.gift_box
        return (
          <div 
            onClick={() => setSelectedGiftDetail(null)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 200010,
              padding: 16
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(20, 20, 25, 0.55)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 24,
                width: '100%',
                maxWidth: 360,
                padding: 24,
                boxShadow: '0 20px 50px rgba(122, 0, 255, 0.15), 0 0 30px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative'
              }}
            >
              <span 
                onClick={() => setSelectedGiftDetail(null)} 
                style={{ 
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  cursor: 'pointer', 
                  fontSize: 18, 
                  opacity: 0.5, 
                  color: 'var(--vkui--color_text_primary)',
                  padding: 4,
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
              >
                ✕
              </span>

              <div style={{ 
                width: 140, 
                height: 140, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '16px 0 20px',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle, rgba(255, 215, 0, 0.18) 0%, rgba(255, 215, 0, 0) 70%)',
                  borderRadius: '50%',
                  animation: 'pulseGlow 2.5s infinite alternate ease-in-out'
                }} />
                <img 
                  src={item.animatedUrl} 
                  alt={item.name} 
                  style={{ width: '80%', height: '80%', objectFit: 'contain', zIndex: 1, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))' }} 
                />
              </div>

              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--vkui--color_text_primary)', marginBottom: 12 }}>
                Подарок «{item.name}»
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 18 }}>
                <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>Отправитель:</span>
                {selectedGiftDetail.is_anonymous ? (
                  <span style={{ 
                    fontSize: 13, 
                    fontWeight: 600, 
                    color: 'var(--vkui--color_text_secondary)', 
                    background: 'rgba(255, 255, 255, 0.06)',
                    padding: '4px 12px',
                    borderRadius: 20
                  }}>
                    Анонимно
                  </span>
                ) : (
                  <span 
                    onClick={() => {
                      setSelectedGiftDetail(null)
                      selectProfile(selectedGiftDetail.sender_id)
                    }}
                    style={{ 
                      fontSize: 13, 
                      fontWeight: 600, 
                      color: 'var(--vkui--color_text_accent, #007aff)', 
                      cursor: 'pointer',
                      background: 'var(--vkui--color_background_secondary_alpha, rgba(0, 122, 255, 0.08))',
                      padding: '4px 12px',
                      borderRadius: 20,
                      transition: 'background 0.2s, transform 0.2s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 122, 255, 0.14)'
                      e.currentTarget.style.transform = 'scale(1.02)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--vkui--color_background_secondary_alpha, rgba(0, 122, 255, 0.08))'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    {selectedGiftDetail.sender?.full_name || 'Пользователь'}
                  </span>
                )}
              </div>

              {selectedGiftDetail.message ? (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '14px 18px',
                  width: '100%',
                  textAlign: 'left',
                  boxSizing: 'border-box',
                  marginBottom: 18,
                  position: 'relative',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)'
                }}>
                  <div style={{ fontSize: 10, color: 'var(--vkui--color_text_secondary)', opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Сообщение:</div>
                  <div style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    color: 'var(--vkui--color_text_primary)',
                    fontFamily: 'Georgia, serif'
                  }}>
                    «{selectedGiftDetail.message}»
                  </div>
                </div>
              ) : (
                <div style={{ 
                  fontSize: 13, 
                  color: 'var(--vkui--color_text_secondary)', 
                  fontStyle: 'italic', 
                  marginBottom: 18,
                  opacity: 0.7 
                }}>
                  Без сообщения
                </div>
              )}

              <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', marginBottom: 20 }}>
                Отправлено {new Date(selectedGiftDetail.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>

              <Button
                size="l"
                mode="outline"
                onClick={() => setSelectedGiftDetail(null)}
                style={{ 
                  width: '100%', 
                  borderRadius: 12, 
                  borderColor: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  background: 'rgba(255,255,255,0.03)'
                }}
              >
                Закрыть
              </Button>
            </div>
          </div>
        )
      })()}
      {decoModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200020,
          padding: 16
        }}>
          <div style={{
            background: 'var(--vkui--color_background_content, #1e1e24)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 24,
            width: '100%',
            maxWidth: 480,
            padding: 24,
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--vkui--color_text_primary)' }}>
                Декорации аватарок (Discord)
              </span>
              <span 
                onClick={() => setDecoModalOpen(false)} 
                style={{ cursor: 'pointer', fontSize: 20, opacity: 0.6, color: 'var(--vkui--color_text_primary)' }}
              >
                ✕
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <div
                onClick={() => handleSelectDeco(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 16,
                  cursor: 'pointer',
                  border: !profile.avatar_decoration ? '2px solid #0077ff' : '2px solid transparent',
                  background: 'rgba(255,255,255,0.03)',
                  transition: 'transform 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ width: 64, height: 64, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)' }}>✕</span>
                </div>
                <span style={{ fontSize: 11, marginTop: 8, color: 'var(--vkui--color_text_secondary)', textAlign: 'center', fontWeight: 500 }}>
                  Без рамки
                </span>
              </div>

              {AVATAR_DECORATIONS.map((deco) => {
                const selected = profile.avatar_decoration === deco.url
                return (
                  <div
                    key={deco.id}
                    onClick={() => handleSelectDeco(deco.url)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: 12,
                      borderRadius: 16,
                      cursor: 'pointer',
                      border: selected ? '2px solid #0077ff' : '2px solid transparent',
                      background: selected ? 'rgba(0, 119, 255, 0.08)' : 'rgba(255,255,255,0.03)',
                      transition: 'transform 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ position: 'relative', width: 64, height: 64 }}>
                      <CustomAvatar 
                        size={64} 
                        src={profile.avatar_url} 
                        name={profile.full_name} 
                        id={profile.id}
                      />
                      <img 
                        src={deco.url} 
                        alt="" 
                        style={{
                          position: 'absolute',
                          top: -6,
                          left: -6,
                          width: 76,
                          height: 76,
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, marginTop: 8, color: 'var(--vkui--color_text_primary)', textAlign: 'center', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                      {deco.name}
                    </span>
                  </div>
                )
              })}
            </div>
            
            <Button
              size="m"
              mode="secondary"
              onClick={() => setDecoModalOpen(false)}
              style={{ width: '100%' }}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}
      {avatarClickMenuOpen && (
        <>
          <div 
            onClick={() => setAvatarClickMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              animation: 'fadeIn 0.2s ease forwards'
            }}
          />
          <div 
            onClick={(e) => e.stopPropagation()}
            className="avatar-click-menu"
            style={{
              position: 'fixed',
              top: avatarMenuCoords ? avatarMenuCoords.y + 8 : 'auto',
              left: avatarMenuCoords ? avatarMenuCoords.x : 'auto',
            }}
          >
            <div className="bottom-sheet-handle" style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'var(--vkui--color_icon_secondary, rgba(255,255,255,0.25))',
              alignSelf: 'center',
              marginBottom: 8,
              display: 'none'
            }} />

            <div style={{ 
              fontSize: 14, 
              fontWeight: 700, 
              color: 'var(--vkui--color_text_primary)', 
              textAlign: 'center', 
              marginBottom: 10,
              padding: '0 8px',
              opacity: 0.9
            }}>
              Выберите действие
            </div>
            
            <button
              onClick={() => {
                setAvatarClickMenuOpen(false)
                setActiveStoriesList(stories)
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--vkui--color_background_accent, #007aff)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Посмотреть историю
            </button>

            {profile.avatar_url && (
              <button
                onClick={() => {
                  setAvatarClickMenuOpen(false)
                  handleImageClick([getOriginalImageUrl(profile.avatar_url!)], 0)
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--vkui--color_background_secondary, rgba(255,255,255,0.08))',
                  color: 'var(--vkui--color_text_primary)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.2s',
                  marginTop: 14
                }}
              >
                Открыть фото профиля
              </button>
            )}

            <button
              onClick={() => setAvatarClickMenuOpen(false)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: 'transparent',
                color: 'var(--vkui--color_text_secondary)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                marginTop: 14,
                opacity: 0.8
              }}
            >
              Отмена
            </button>
          </div>
        </>
      )}

      {editorFile && editorMode && (
        <ImageEditorModal 
          file={editorFile}
          aspectRatio={editorMode}
          onClose={() => {
            setEditorFile(null)
            setEditorMode(null)
          }}
          onSave={async (croppedFile) => {
            const mode = editorMode
            const rawFile = editorFile
            setEditorFile(null)
            setEditorMode(null)
            
            if (rawFile) {
              if (mode === 'circle') {
                await performAvatarUpload(rawFile, croppedFile)
              } else if (mode === 'banner') {
                await performCoverUpload(rawFile, croppedFile)
              }
            }
          }}
        />
      )}

      {showMusicModal && (
        <MusicSelectModal 
          onClose={() => setShowMusicModal(false)}
          onSelect={(track) => {
            setAttachedAudio(track)
            setShowMusicModal(false)
          }}
        />
      )}

      {snackbar}
    </Panel>
  )
}
