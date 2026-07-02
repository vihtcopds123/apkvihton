import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from '@vkontakte/vkui'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { CustomAvatar } from './CustomAvatar'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  image_url: string | null
  video_url?: string | null
  audio_url?: string | null
  is_read: boolean
  is_deleted?: boolean
  created_at: string
  audio_id?: string | null
  audio?: any | null
  sender?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

const PhotoGridItem: React.FC<{ m: any; handleJumpToMessage: (id: string, date: string) => void }> = ({ m, handleJumpToMessage }) => {
  const [hasError, setHasError] = useState(false)
  if (hasError) return null
  return (
    <div className="v-chat-drawer-grid-item" onClick={() => handleJumpToMessage(m.id, m.created_at)}>
      <img src={m.image_url!} alt="" className="v-chat-drawer-grid-image" onError={() => setHasError(true)} />
    </div>
  )
}

export const AttachmentsDrawer: React.FC = () => {
  const { showAttachmentsDrawer, setShowAttachmentsDrawer, selectedChatId } = useAppStore()
  const { profile } = useAuthStore()

  const [drawerTab, setDrawerTab] = useState<'search' | 'photo' | 'video' | 'circle' | 'audio' | 'link'>('search')
  const [drawerMessages, setDrawerMessages] = useState<Message[]>([])
  const [drawerSearchQuery, setDrawerSearchQuery] = useState('')
  const [loadingDrawerData, setLoadingDrawerData] = useState(false)
  const openTimeRef = useRef<number>(0)

  const isAudioUrl = (url: string | null | undefined) => {
    if (!url) return false
    const cleanUrl = url.split(/[?#]/)[0].toLowerCase()
    return cleanUrl.endsWith('.mp3') || 
           cleanUrl.endsWith('.wav') || 
           cleanUrl.endsWith('.ogg') || 
           cleanUrl.endsWith('.m4a') || 
           cleanUrl.endsWith('.webm') ||
           url.includes('voice-') ||
           url.includes('audio-')
  }

  useEffect(() => {
    if (showAttachmentsDrawer && selectedChatId) {
      openTimeRef.current = Date.now()
      const loadAllDrawerMessages = async () => {
        setLoadingDrawerData(true)
        try {
          const { data, error } = await supabase
            .from('messages')
            .select('*, sender:profiles(id, full_name, avatar_url), audio:music_tracks(id, title, artist, duration, file_url, cover_url)')
            .eq('conversation_id', selectedChatId)
            .order('created_at', { ascending: false })
          if (error) throw error
          if (data) setDrawerMessages(data)
        } catch (e) {
          console.error('Error fetching drawer data:', e)
        } finally {
          setLoadingDrawerData(false)
        }
      }
      loadAllDrawerMessages()
    } else {
      setDrawerSearchQuery('')
    }
  }, [showAttachmentsDrawer, selectedChatId])

  if (!showAttachmentsDrawer) return null

  const handleJumpToMessage = (msgId: string, msgDate: string) => {
    setShowAttachmentsDrawer(false)
    window.dispatchEvent(new CustomEvent('jump-to-message', {
      detail: { msgId, msgDate }
    }))
  }

  const getSenderName = (m: Message) => {
    if (m.sender_id === profile?.id) return 'Вы'
    return m.sender?.full_name || 'Собеседник'
  }

  const getSenderAvatar = (m: Message) => {
    if (m.sender_id === profile?.id) return profile?.avatar_url
    return m.sender?.avatar_url || null
  }

  const renderDrawerTabContent = () => {
    switch (drawerTab) {
      case 'search': {
        const q = drawerSearchQuery.trim().toLowerCase()
        const results = q ? drawerMessages.filter(m => !m.is_deleted && m.content?.toLowerCase().includes(q)) : []
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input 
              value={drawerSearchQuery}
              onChange={e => setDrawerSearchQuery(e.target.value)}
              placeholder="Поиск по сообщениям..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                outline: 'none',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 14,
                color: '#fff'
              }}
            />
            {q && results.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: 13, padding: '20px 0' }}>Ничего не найдено</div>
            )}
            <div className="v-chat-drawer-list">
              {results.map(m => (
                <div key={m.id} className="v-chat-drawer-list-item" onClick={() => handleJumpToMessage(m.id, m.created_at)}>
                  <CustomAvatar size={32} src={getSenderAvatar(m)} name={getSenderName(m)} id={m.sender_id} />
                  <div className="v-chat-drawer-list-item-content">
                    <div className="v-chat-drawer-list-item-title">{getSenderName(m)}</div>
                    <div className="v-chat-drawer-list-item-subtitle">{m.content}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'photo': {
        const photos = drawerMessages.filter(m => !m.is_deleted && m.image_url && !m.image_url.includes('circle=true') && !m.image_url.includes('sticker=true') && !isAudioUrl(m.image_url) && !m.image_url.split(/[?#]/)[0].toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/))
        if (!photos.length) return <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: 13, padding: '40px 0' }}>Нет фотографий</div>
        return (
          <div className="v-chat-drawer-grid-3">
            {photos.map(m => (
              <PhotoGridItem key={m.id} m={m} handleJumpToMessage={handleJumpToMessage} />
            ))}
          </div>
        )
      }
      case 'video': {
        const videos = drawerMessages.filter(m => !m.is_deleted && m.image_url && !m.image_url.includes('circle=true') && !isAudioUrl(m.image_url) && m.image_url.split(/[?#]/)[0].toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/))
        if (!videos.length) return <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: 13, padding: '40px 0' }}>Нет видео</div>
        return (
          <div className="v-chat-drawer-grid-3">
            {videos.map(m => (
              <div key={m.id} className="v-chat-drawer-grid-item" onClick={() => handleJumpToMessage(m.id, m.created_at)}>
                <div className="v-chat-drawer-grid-video-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
            ))}
          </div>
        )
      }
      case 'circle': {
        const circles = drawerMessages.filter(m => !m.is_deleted && m.image_url && m.image_url.includes('circle=true'))
        if (!circles.length) return <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: 13, padding: '40px 0' }}>Нет видеокружочков</div>
        return (
          <div className="v-chat-drawer-circles-flex">
            {circles.map(m => (
              <div key={m.id} className="v-chat-drawer-circle-item" onClick={() => handleJumpToMessage(m.id, m.created_at)}>
                <video 
                  src={m.image_url || ''} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>
            ))}
          </div>
        )
      }
      case 'audio': {
        const audios = drawerMessages.filter(m => !m.is_deleted && (m.audio_url || m.audio || m.audio_id || isAudioUrl(m.image_url) || isAudioUrl(m.video_url)))
        if (!audios.length) return <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: 13, padding: '40px 0' }}>Нет аудиозаписей</div>
        return (
          <div className="v-chat-drawer-list">
            {audios.map(m => {
              const isVoice = !m.audio && !m.audio_id
              return (
                <div key={m.id} className="v-chat-drawer-list-item" onClick={() => handleJumpToMessage(m.id, m.created_at)}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#007aff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    {isVoice ? '🎙️' : '🎵'}
                  </div>
                  <div className="v-chat-drawer-list-item-content">
                    <div className="v-chat-drawer-list-item-title">
                      {m.audio ? m.audio.title : m.audio_id ? 'Музыкальный трек' : 'Голосовое сообщение'}
                    </div>
                    <div className="v-chat-drawer-list-item-subtitle">
                      {m.audio ? m.audio.artist : getSenderName(m)}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {new Date(m.created_at).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )
            })}
          </div>
        )
      }
      case 'link': {
        const links = drawerMessages.filter(m => !m.is_deleted && m.content && (m.content.includes('http://') || m.content.includes('https://')))
        if (!links.length) return <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: 13, padding: '40px 0' }}>Нет ссылок</div>
        return (
          <div className="v-chat-drawer-list">
            {links.map(m => {
              const urlMatches = m.content!.match(/https?:\/\/[^\s]+/g)
              const firstUrl = urlMatches ? urlMatches[0] : ''
              return (
                <div key={m.id} className="v-chat-drawer-list-item v-chat-drawer-link-item" onClick={() => handleJumpToMessage(m.id, m.created_at)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <CustomAvatar size={20} src={getSenderAvatar(m)} name={getSenderName(m)} id={m.sender_id} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{getSenderName(m)}</span>
                  </div>
                  <div className="v-chat-drawer-link-text">{m.content}</div>
                  {firstUrl && (
                    <a href={firstUrl} target="_blank" rel="noopener noreferrer" className="v-chat-drawer-link-url" onClick={e => e.stopPropagation()}>
                      {firstUrl}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )
      }
    }
  }

  return (
    <div 
      className="v-chat-drawer-overlay" 
      onClick={() => {
        if (Date.now() - openTimeRef.current < 300) return
        setShowAttachmentsDrawer(false)
      }}
    >
      <div 
        className="v-chat-attachments-drawer" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v-chat-drawer-handle" onClick={() => setShowAttachmentsDrawer(false)} />
        <div className="v-chat-drawer-header">
          <span className="v-chat-drawer-title">Вложения и поиск</span>
          <button className="v-chat-drawer-close" onClick={() => setShowAttachmentsDrawer(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div className="v-chat-drawer-tabs">
          <button className={`v-chat-drawer-tab ${drawerTab === 'search' ? 'active' : ''}`} onClick={() => setDrawerTab('search')}>Поиск</button>
          <button className={`v-chat-drawer-tab ${drawerTab === 'photo' ? 'active' : ''}`} onClick={() => setDrawerTab('photo')}>Фото</button>
          <button className={`v-chat-drawer-tab ${drawerTab === 'video' ? 'active' : ''}`} onClick={() => setDrawerTab('video')}>Видео</button>
          <button className={`v-chat-drawer-tab ${drawerTab === 'circle' ? 'active' : ''}`} onClick={() => setDrawerTab('circle')}>Кружочки</button>
          <button className={`v-chat-drawer-tab ${drawerTab === 'audio' ? 'active' : ''}`} onClick={() => setDrawerTab('audio')}>Аудио</button>
          <button className={`v-chat-drawer-tab ${drawerTab === 'link' ? 'active' : ''}`} onClick={() => setDrawerTab('link')}>Ссылки</button>
        </div>

        <div className="v-chat-drawer-content">
          {loadingDrawerData ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner size="m" /></div>
          ) : (
            renderDrawerTabContent()
          )}
        </div>
      </div>
    </div>
  )
}
