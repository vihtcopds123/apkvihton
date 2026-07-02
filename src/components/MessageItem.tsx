import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Spinner } from '@vkontakte/vkui'
import { CustomAvatar } from './CustomAvatar'
import { FormattedText } from './FormattedText'
import { Icon28Play, Icon28Pause } from '@vkontakte/icons'
import { useMusicStore } from '../store/useMusicStore'
import { supabase } from '../supabaseClient'
import { StoryViewerOverlay } from './StoryViewerOverlay'
import { StickerPreviewPopup } from './StickerPreviewPopup'
import { useAppStore } from '../store/useAppStore'

const postCache: Record<string, any> = {}
const storyCache: Record<string, any> = {}
const pendingPostPromises: Record<string, Promise<any> | undefined> = {}
const pendingStoryPromises: Record<string, Promise<any> | undefined> = {}

const formatAudioDuration = (s: number) => 
  `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`

const StickerImageMessage: React.FC<{
  msg: any
  isMe: boolean
  isPinned: boolean
  setReactionPopup: (v: any) => void
}> = ({ msg, isMe, isPinned, setReactionPopup }) => {
  const [showPreview, setShowPreview] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const startPress = () => {
    didLongPress.current = false
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true
      if (imgRef.current) {
        setRect(imgRef.current.getBoundingClientRect())
      }
      setZoomed(true)
    }, 150)
  }

  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    setZoomed(false)
  }

  return (
    <>
      <div
        data-message-id={msg.id}
        data-is-me={isMe ? 'true' : 'false'}
        data-is-deleted="false"
        data-is-pinned={isPinned ? 'true' : 'false'}
        data-message-content="Стикер"
        className="virtualized-item"
        style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', padding: 4, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => {
          if (!didLongPress.current) setShowPreview(true)
        }}
        onDoubleClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setReactionPopup({ msgId: msg.id, x: rect.left + rect.width / 2, y: rect.top - 10 })
        }}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onTouchCancel={endPress}
      >
        <img
          ref={imgRef}
          src={msg.image_url!.split('?')[0]}
          alt="Стикер"
          draggable={false}
          style={{
            width: 180,
            height: 180,
            objectFit: 'contain',
            display: 'block',
            userSelect: 'none',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.18))',
            visibility: zoomed ? 'hidden' : 'visible',
            pointerEvents: 'none',
          }}
        />
      </div>
      {showPreview && createPortal(
        <StickerPreviewPopup
          stickerUrl={msg.image_url!}
          onClose={() => setShowPreview(false)}
        />,
        document.body
      )}
      {zoomed && rect && createPortal(
        <div style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          zIndex: 999999,
          pointerEvents: 'none',
        }}>
          <img
            src={msg.image_url!.split('?')[0]}
            alt="Стикер"
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.3))',
              transformOrigin: isMe ? 'right bottom' : 'left bottom',
              animation: 'zoomStickerIn 0.15s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
          />
          <style>{`
            @keyframes zoomStickerIn {
              from { transform: scale(1); }
              to { transform: scale(1.65); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </>
  )
}

const VoicePlayer: React.FC<{ url: string; isMe: boolean }> = ({ url, isMe }) => {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  useEffect(() => {
    const a = new Audio(url)
    a.preload = 'metadata'
    audioRef.current = a
    
    a.onloadedmetadata = () => {
      const d = a.duration
      if (isFinite(d) && !isNaN(d)) setDuration(d)
    }
    
    a.ontimeupdate = () => {
      setProgress(a.currentTime / (a.duration || 1))
      if (!isFinite(a.duration) && isFinite(a.currentTime) && a.currentTime > 0) {
        setDuration(Math.floor(a.currentTime))
      }
    }
    
    a.onended = () => { 
      if (isFinite(a.currentTime)) setDuration(Math.floor(a.currentTime))
      setPlaying(false)
      setProgress(0)
    }
    
    a.onerror = () => { 
      setDuration(0)
    }
    
    a.load()
    
    return () => { a.pause(); a.src = '' }
  }, [url])
  
  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { 
      a.pause()
      setPlaying(false) 
    } else { 
      a.play()
      setPlaying(true) 
    }
  }
  
  const accent = isMe ? 'rgba(255,255,255,0.9)' : '#007aff'
  const trackBg = isMe ? 'rgba(255,255,255,0.25)' : 'rgba(0,122,255,0.15)'
  const durationText = duration > 0 && isFinite(duration) && !isNaN(duration) ? formatAudioDuration(duration) : '0:00'
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180, alignSelf: isMe ? 'flex-end' : 'flex-start' }}
      data-message-content="Голосовое сообщение">
      <button onClick={toggle} style={{ width: 34, height: 34, borderRadius: '50%', background: accent, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isMe ? '#007aff' : '#fff' }}>
        {playing
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 4, borderRadius: 2, background: trackBg, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress * 100}%`, background: accent, borderRadius: 2, transition: 'width 0.1s linear' }} />
        </div>
        <span style={{ fontSize: 10, opacity: 0.65, color: isMe ? '#fff' : 'inherit' }}>{durationText}</span>
      </div>
    </div>
  )
}

const cleanImageUrl = (url: string | null): string => {
  if (!url) return ''
  const parts = url.split('?')
  if (parts.length > 2) {
    return parts[0] + '?' + parts[1] + '&' + parts.slice(2).join('&')
  }
  return url
}

const CircleVideoMessage: React.FC<{
  msg: any
  isMe: boolean
  isSearchMatch: boolean
  isAnyMatch: boolean
  setReactionPopup: (p: any) => void
}> = ({ msg, isMe, isSearchMatch, isAnyMatch, setReactionPopup }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const expandedVideoRef = useRef<HTMLVideoElement>(null)

  // Оптимальный запуск автоплея для iOS Safari
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    
    // Принудительно перезагружаем медиа-ресурс, чтобы Safari прочел заголовки Range
    try { video.load() } catch(e){}

    const playVideo = () => {
      video.play().catch(err => {
        if (err && err.name !== 'AbortError') {
          console.warn('Autoplay blocked in chat bubble:', err)
        }
      })
    }

    video.addEventListener('canplay', playVideo)
    video.addEventListener('loadeddata', playVideo)
    video.addEventListener('loadedmetadata', playVideo)
    
    playVideo()

    return () => {
      video.removeEventListener('canplay', playVideo)
      video.removeEventListener('loadeddata', playVideo)
      video.removeEventListener('loadedmetadata', playVideo)
    }
  }, [msg.image_url])

  // Контролируемый запуск большого видео со звуком на оверлее
  useEffect(() => {
    if (isExpanded && expandedVideoRef.current) {
      const ev = expandedVideoRef.current
      
      ev.playsInline = true
      try { ev.load() } catch(e){}
      
      // Сначала запускаем беззвучно на 100%
      ev.muted = true
      ev.play().then(() => {
        // Как только пошло воспроизведение, пробуем включить звук
        setTimeout(() => {
          ev.muted = false
          ev.play().catch(err => {
            console.warn('Could not unmute, keeping muted:', err)
            ev.muted = true
          })
        }, 100)
      }).catch(e => {
        console.warn('Overlay muted play blocked too:', e)
        ev.muted = true
        ev.play().catch(err => console.error('Absolute video failure:', err))
      })
    }
  }, [isExpanded])

  const handleOpenExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(true)
    try {
      if (videoRef.current) {
        videoRef.current.pause()
      }
    } catch (err) {
      console.error('Pause bubble error:', err)
    }
  }

  const handleCloseExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(false)
    try {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      console.error('Play bubble error:', err)
    }
  }

  return (
    <>
      <div
        data-message-id={msg.id}
        data-is-me={isMe ? 'true' : 'false'}
        data-is-deleted="false"
        data-message-content="Видеосообщение"
        className={`v-chat-bubble-circle ${isMe ? 'me' : 'other'} virtualized-item`}
        style={{
          outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : 'none',
          outlineOffset: 2
        }}
        onClick={handleOpenExpand}
        onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setReactionPopup({ msgId: msg.id, x: rect.left + rect.width / 2, y: rect.top - 10 })
        }}
      >
        <video
          ref={videoRef}
          src={cleanImageUrl(msg.image_url)}
          loop
          muted
          playsInline
          autoPlay
          preload="auto"
          style={{ pointerEvents: 'none' }}
          {...{
            'webkit-playsinline': 'true'
          } as any}
        />
      </div>

      {isExpanded && createPortal(
        <div className="v-circle-expanded-overlay" onClick={handleCloseExpand}>
          <div className="v-circle-expanded-container" onClick={e => e.stopPropagation()}>
            <video
              ref={expandedVideoRef}
              src={cleanImageUrl(msg.image_url)}
              loop
              playsInline
              autoPlay
              controls={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
              onClick={handleCloseExpand}
              {...{
                'webkit-playsinline': 'true'
              } as any}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

const ReactionBar: React.FC<{ reactions: Record<string, string[]>; myId: string; onReact: (e: string) => void; isMe: boolean }> = ({ reactions, myId, onReact, isMe }) => {
  const entries = Object.entries(reactions).filter(([, u]) => u.length > 0)
  if (!entries.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
      {entries.map(([emoji, users]) => (
        <button key={emoji} onClick={() => onReact(emoji)} style={{ background: users.includes(myId) ? 'rgba(0,122,255,0.18)' : 'var(--vkui--color_background_secondary)', border: users.includes(myId) ? '1px solid rgba(0,122,255,0.45)' : '1px solid var(--vkui--separator_primary_alpha, rgba(255,255,255,0.12))', borderRadius: 12, padding: '2px 7px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}>
          {emoji} <span style={{ fontSize: 11, fontWeight: 600 }}>{users.length}</span>
        </button>
      ))}
    </div>
  )
}

export interface Message {
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
  message_type?: string | null
}

export const ChatStoryCard: React.FC<{ storyId: string }> = ({ storyId }) => {
  const [story, setStory] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [showViewer, setShowViewer] = useState(false)
  const [errorOccurred, setErrorOccurred] = useState<string | null>(null)
  const [authorStories, setAuthorStories] = useState<any[]>([])
  const [startIndex, setStartIndex] = useState(0)

  useEffect(() => {
    let active = true

    const loadStory = async () => {
      if (storyCache[storyId] !== undefined) {
        if (active) {
          setStory(storyCache[storyId]?.deleted ? null : storyCache[storyId])
          setLoading(false)
        }
        return
      }

      if (pendingStoryPromises[storyId]) {
        try {
          const cachedData = await pendingStoryPromises[storyId]
          if (active) {
            setStory(cachedData?.deleted ? null : cachedData)
            setLoading(false)
          }
        } catch (e: any) {
          if (active) setErrorOccurred(e?.message || String(e))
        }
        return
      }

      const fetchPromise = (async () => {
        const { data, error } = await supabase
          .from('stories')
          .select('*, author:profiles(id, full_name, avatar_url, avatar_decoration)')
          .eq('id', storyId)
        
        if (error) throw error
        
        const fetchedStory = data && data.length > 0 ? data[0] : { deleted: true }
        storyCache[storyId] = fetchedStory
        return fetchedStory
      })()

      pendingStoryPromises[storyId] = fetchPromise

      try {
        const fetchedStory = await fetchPromise
        if (active) {
          setStory(fetchedStory.deleted ? null : fetchedStory)
        }
      } catch (e: any) {
        console.error('Error fetching story for chat card:', e)
        if (active) setErrorOccurred(e?.message || String(e))
      } finally {
        delete pendingStoryPromises[storyId]
        if (active) setLoading(false)
      }
    }

    loadStory()
    return () => { active = false }
  }, [storyId])

  if (errorOccurred) {
    return (
      <div style={{ padding: 8, color: '#ff453a', fontSize: 11, background: 'rgba(255,69,58,0.1)', width: '100%', height: '100%', boxSizing: 'border-box' }}>
        Ошибка загрузки истории:<br/>{errorOccurred}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Spinner size="s" style={{ color: 'var(--vkui--color_text_secondary)' }} />
      </div>
    )
  }

  if (!story) {
    return (
      <div style={{
        padding: '8px 12px',
        borderRadius: 12,
        background: 'rgba(255, 69, 58, 0.1)',
        color: '#ff453a',
        fontSize: 11,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 6
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>История удалена</span>
      </div>
    )
  }

  try {
    const isVideo = story.media_url?.split(/[?#]/)[0].toLowerCase().match(/\.(mp4|webm|ogg|mov)$/)

    return (
      <>
        <div 
          onClick={async (e) => {
            e.stopPropagation()
            try {
              const { data, error } = await supabase
                .from('stories')
                .select('*, author:profiles(id, full_name, avatar_url, avatar_decoration)')
                .eq('user_id', story.user_id)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: true })
              
              if (!error && data && data.length > 0) {
                setAuthorStories(data)
                const idx = data.findIndex((s: any) => s.id === story.id)
                setStartIndex(idx !== -1 ? idx : 0)
                setShowViewer(true)
              } else {
                setAuthorStories([story])
                setStartIndex(0)
                setShowViewer(true)
              }
            } catch (err) {
              setAuthorStories([story])
              setStartIndex(0)
              setShowViewer(true)
            }
          }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 12,
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {/* Background image or video */}
          {isVideo ? (
            <video 
              src={`${story.media_url}#t=0.001`} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
            />
          ) : (
            <img 
              src={story.media_url} 
              alt="" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          )}

          {/* Gradient Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)',
            zIndex: 2
          }} />

          {/* Play Icon for video */}
          {isVideo && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffffff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          )}

          {/* Author Info */}
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <CustomAvatar 
              size={18} 
              src={story.author?.avatar_url} 
              name={story.author?.full_name || ''} 
              id={story.author?.id || ''}
              decoration={story.author?.avatar_decoration}
            />
            <span style={{
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)'
            }}>
              {story.author?.full_name ? story.author.full_name.split(' ')[0] : 'Пользователь'}
            </span>
          </div>
        </div>

        {showViewer && (
          <StoryViewerOverlay 
            stories={authorStories} 
            initialIndex={startIndex}
            onClose={() => setShowViewer(false)} 
          />
        )}
      </>
    )
  } catch (err: any) {
    return (
      <div style={{ padding: 8, color: '#ff453a', fontSize: 11, background: 'rgba(255,69,58,0.1)', width: 140, height: 210, boxSizing: 'border-box' }}>
        Ошибка рендера истории:<br/>{err?.message || String(err)}
      </div>
    )
  }
}

export const ChatPostCard: React.FC<{ postId: string }> = ({ postId }) => {
  const [post, setPost] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorOccurred, setErrorOccurred] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadPost = async () => {
      if (postCache[postId] !== undefined) {
        if (active) {
          setPost(postCache[postId]?.deleted ? null : postCache[postId])
          setLoading(false)
        }
        return
      }

      if (pendingPostPromises[postId]) {
        try {
          const cachedData = await pendingPostPromises[postId]
          if (active) {
            setPost(cachedData?.deleted ? null : cachedData)
            setLoading(false)
          }
        } catch (e: any) {
          if (active) setErrorOccurred(e?.message || String(e))
        }
        return
      }

      const fetchPromise = (async () => {
        const { data, error } = await supabase
          .from('posts')
          .select('*, author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username)')
          .eq('id', postId)
        
        if (error) throw error
        
        const fetchedPost = data && data.length > 0 ? data[0] : { deleted: true }
        postCache[postId] = fetchedPost
        return fetchedPost
      })()

      pendingPostPromises[postId] = fetchPromise

      try {
        const fetchedPost = await fetchPromise
        if (active) {
          setPost(fetchedPost.deleted ? null : fetchedPost)
        }
      } catch (e: any) {
        console.error('Error fetching post for chat card:', e)
        if (active) setErrorOccurred(e?.message || String(e))
      } finally {
        delete pendingPostPromises[postId]
        if (active) setLoading(false)
      }
    }

    loadPost()
    return () => { active = false }
  }, [postId])

  if (loading) {
    return (
      <div style={{
        width: 260,
        height: 110,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Spinner size="s" style={{ color: 'var(--vkui--color_text_secondary)' }} />
      </div>
    )
  }

  if (errorOccurred || !post) {
    return (
      <div style={{
        padding: '10px 14px',
        borderRadius: 14,
        background: 'rgba(255, 69, 58, 0.1)',
        color: '#ff453a',
        fontSize: 12,
        width: 260,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Запись не найдена или удалена</span>
      </div>
    )
  }

  const hasImages = post.images && post.images.length > 0
  const firstImage = hasImages ? post.images[0] : null
  const isVideo = firstImage?.split(/[?#]/)[0].toLowerCase().match(/\.(mp4|webm|ogg|mov)$/)

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        window.dispatchEvent(new CustomEvent('open-post', { detail: { postId } }))
      }}
      style={{
        width: 260,
        borderRadius: 14,
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: 12,
        cursor: 'pointer',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'background 0.2s',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CustomAvatar 
          size={24} 
          src={post.author?.avatar_url} 
          name={post.author?.full_name || ''} 
          id={post.author?.id || ''} 
        />
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {post.author?.full_name || 'Пользователь'}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            Запись на стене
          </span>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <span style={{ 
          fontSize: 12, 
          color: 'rgba(255, 255, 255, 0.9)', 
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word'
        }}>
          {post.content}
        </span>
      )}

      {/* Media Attachment Preview */}
      {firstImage && (
        <div style={{
          width: '100%',
          height: 120,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#000',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {isVideo ? (
            <video 
              src={`${firstImage}#t=0.001`} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              muted 
              playsInline 
            />
          ) : (
            <img 
              src={firstImage} 
              alt="" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          )}
          {isVideo && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#ffffff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          )}
          {post.images.length > 1 && (
            <div style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              background: 'rgba(0,0,0,0.6)',
              padding: '2px 6px',
              borderRadius: 4,
              color: '#fff',
              fontSize: 10,
              fontWeight: 600
            }}>
              +{post.images.length - 1}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface MessageItemProps {
  msg: Message
  profileId: string | undefined
  pinnedMessageId: string | undefined
  searchQuery: string
  isSearchMatch: boolean
  isAnyMatch: boolean
  isGroupChat: boolean
  lastReadByPartnerIdx: number
  msgIdx: number
  selectedChatParticipant: any
  getMemberAvatar: (id: string) => string | null | undefined
  getMemberName: (id: string) => string
  renderMemberName: (id: string) => React.ReactNode
  isEmojiOnlyMessage: (text: string | null) => boolean
  formatSeparatorDate: (dateStr: string) => string
  handleImageClick: (url: string) => void
  handleReact: (msgId: string, emoji: string) => void
  setReactionPopup: (popup: { msgId: string; x: number; y: number } | null) => void
  showSep: boolean
  highlightText: (text: string, query: string) => React.ReactNode
  readByMembers?: { id: string; full_name: string | null; avatar_url: string | null; username: string | null }[]
}

const GIFT_ITEMS: Record<string, { name: string; icon: string; animatedUrl: string; price: number }> = {
  rose: { name: 'Роза', icon: '🌹', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f339/512.gif', price: 10 },
  heart: { name: 'Сердечко', icon: '❤️', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif', price: 15 },
  coffee: { name: 'Кофе', icon: '☕', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2615/512.gif', price: 10 },
  gift_box: { name: 'Подарок', icon: '🎁', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f381/512.gif', price: 15 },
  champagne: { name: 'Шампанское', icon: '🍾', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f37e/512.gif', price: 15 },
  toy_bear: { name: 'Тортик', icon: '🎂', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f382/512.gif', price: 15 },
  cat: { name: 'Котик', icon: '🐱', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f431/512.gif', price: 15 },
  star: { name: 'Звезда', icon: '⭐', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2b50/512.gif', price: 10 },
  wine: { name: 'Вино', icon: '🍷', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f377/512.gif', price: 10 },
  pizza: { name: 'Пицца', icon: '🍕', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f355/512.gif', price: 10 },
  ice_cream: { name: 'Мороженое', icon: '🍦', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f366/512.gif', price: 10 },
  diamond: { name: 'Алмаз', icon: '💎', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f48e/512.gif', price: 15 },
  rocket: { name: 'Ракета', icon: '🚀', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.gif', price: 15 },
  fire: { name: 'Огонь', icon: '🔥', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif', price: 15 },
  crown: { name: 'Корона', icon: '👑', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f451/512.gif', price: 15 },
  money_wings: { name: 'Деньги', icon: '💸', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4b8/512.gif', price: 15 },
  heart_ribbon: { name: 'Сердце', icon: '💝', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f49d/512.gif', price: 15 },
  ghost: { name: 'Привидение', icon: '👻', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47b/512.gif', price: 15 },
  alien: { name: 'НЛО', icon: '👽', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47d/512.gif', price: 15 },
  donut: { name: 'Пончик', icon: '🍩', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f369/512.gif', price: 10 },
  cookie: { name: 'Печенье', icon: '🍪', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f36a/512.gif', price: 10 },
  watermelon: { name: 'Арбуз', icon: '🍉', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f349/512.gif', price: 10 },
  cherries: { name: 'Вишня', icon: '🍒', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f352/512.gif', price: 10 },
  strawberry: { name: 'Клубника', icon: '🍓', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f353/512.gif', price: 10 },
  penguin: { name: 'Пингвин', icon: '🐧', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f427/512.gif', price: 10 },
  panda: { name: 'Панда', icon: '🐼', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f43c/512.gif', price: 15 },
  unicorn: { name: 'Единорог', icon: '🦄', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f984/512.gif', price: 15 },
  clover: { name: 'Удача', icon: '🍀', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f340/512.gif', price: 10 },
  balloon: { name: 'Шарик', icon: '🎈', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f388/512.gif', price: 10 },
  party: { name: 'Хлопушка', icon: '🎉', animatedUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif', price: 15 }
}

export const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  profileId,
  pinnedMessageId,
  searchQuery,
  isSearchMatch,
  isAnyMatch,
  isGroupChat,
  lastReadByPartnerIdx,
  msgIdx,
  selectedChatParticipant,
  getMemberAvatar,
  getMemberName,
  renderMemberName,
  isEmojiOnlyMessage,
  formatSeparatorDate,
  handleImageClick,
  handleReact,
  setReactionPopup,
  showSep,
  highlightText,
  readByMembers
}) => {
  const [isOpened, setIsOpened] = useState(false)
  const [loadedGift, setLoadedGift] = useState<any>(msg.gift || null)

  useEffect(() => {
    if (msg.gift_id && !loadedGift) {
      supabase
        .from('user_gifts')
        .select('*, sender:profiles(id, full_name)')
        .eq('id', msg.gift_id)
        .single()
        .then(({ data }) => {
          if (data) setLoadedGift(data)
        })
    }
  }, [msg.gift_id, loadedGift])

  const isMe = msg.sender_id === profileId
  const isPinned = pinnedMessageId === msg.id
  const isMediaOnly = !msg.is_deleted && !msg.content && (msg.image_url || msg.video_url || msg.audio_url)
  const isVoiceOnly = !msg.is_deleted && msg.audio_url && (!msg.content || msg.content === '[Голосовое сообщение]') && !msg.image_url && !msg.video_url
  const isSticker = !msg.is_deleted && isEmojiOnlyMessage(msg.content) && !msg.image_url && !msg.video_url && !msg.audio_url && !msg.forwarded_from && !msg.reply_to_id
  const isStickerImage = !msg.is_deleted && msg.image_url?.includes('sticker=true')
  const isStoryMessage = !msg.is_deleted && msg.content && msg.content.match(/(?:https?:\/\/[^\/]+)?\/story\/([a-f0-9-]+)/i)
  const isPostMessage = !msg.is_deleted && msg.content && msg.content.match(/(?:https?:\/\/[^\/]+)?\/post\/([a-f0-9-]+)/i)
  const isAudioOnlyMessage = !msg.is_deleted && msg.audio_id && !msg.content
  const isChannelForward = !msg.is_deleted && (() => {
    if (!msg.content) return false
    const trimmed = msg.content.trim()
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false
    try {
      const parsed = JSON.parse(trimmed)
      return parsed && parsed.type === 'channel_forward'
    } catch(e) {
      return false
    }
  })()
  const isLastReadByPartner = msgIdx === lastReadByPartnerIdx
  const showSenderName = isGroupChat && !msg.is_deleted

  if (msg.gift_id) {
    const giftDetail = loadedGift
    const giftKey = giftDetail?.gift_key || 'gift_box'
    const giftConfig = GIFT_ITEMS[giftKey] || GIFT_ITEMS.gift_box
    const isMeSender = msg.sender_id === profileId
    const isAnonymous = giftDetail?.is_anonymous || !giftDetail?.sender_id
    const shouldHide = isAnonymous && !isOpened && !isMeSender

    const activeConfig = shouldHide ? GIFT_ITEMS.gift_box : giftConfig
    const messageText = giftDetail?.message

    let giftTitle = 'Вам подарок!'
    if (isMeSender) {
      giftTitle = 'Вы отправили подарок!'
    } else if (shouldHide) {
      giftTitle = 'Вам анонимный подарок!'
    }

    let senderSub = ''
    if (shouldHide) {
      senderSub = 'Нажмите, чтобы открыть'
    } else if (!isMeSender) {
      if (isAnonymous) {
        senderSub = 'от Vihton'
      } else {
        const senderName = giftDetail?.sender?.full_name || getMemberName(msg.sender_id) || 'Пользователь'
        senderSub = `от ${senderName}`
      }
    }

    return (
      <>
        {showSep && <div className="v-chat-date-sep"><span>{formatSeparatorDate(msg.created_at)}</span></div>}
        <div 
          data-message-id={msg.id}
          className="virtualized-item"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            alignSelf: 'center',
            margin: '12px auto',
            padding: '20px 16px',
            width: 'calc(100% - 32px)',
            maxWidth: 280,
            flexShrink: 0,
            boxSizing: 'border-box',
            background: 'var(--vkui--color_background_content)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 24,
            border: '1px solid var(--vkui--color_separator_primary)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
            position: 'relative',
            overflow: 'hidden',
            textAlign: 'center',
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease',
            cursor: 'pointer'
          }}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('trigger-fireworks'))
            if (shouldHide) {
              setIsOpened(true)
            }
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.03)'
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 30%, rgba(255, 215, 0, 0.12), transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          <div style={{ 
            position: 'relative', 
            zIndex: 1, 
            marginBottom: 10,
            transform: shouldHide ? 'scale(1)' : 'scale(1.08)',
            transition: 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <img 
              src={activeConfig.animatedUrl} 
              alt={activeConfig.name} 
              style={{ 
                width: 76, 
                height: 76, 
                objectFit: 'contain',
                filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.15))',
                animation: 'bounce 2s infinite ease-in-out'
              }} 
            />
          </div>

          <div style={{ position: 'relative', zIndex: 1, fontSize: 16, fontWeight: 850, color: '#ffd700', textShadow: '0 0 10px rgba(255, 215, 0, 0.35)', marginBottom: 4, letterSpacing: '-0.3px' }}>
            {giftTitle}
          </div>

          {senderSub && (
            <div style={{ position: 'relative', zIndex: 1, fontSize: 13, color: 'var(--vkui--color_text_secondary)', fontWeight: 550, marginBottom: (!shouldHide && messageText) ? 10 : 0 }}>
              {senderSub}
            </div>
          )}

          {!shouldHide && messageText && (
            <div style={{
              position: 'relative',
              zIndex: 1,
              fontSize: 13,
              fontStyle: 'italic',
              color: 'var(--vkui--color_text_primary)',
              lineHeight: 1.45,
              padding: '10px 14px',
              background: 'var(--vkui--color_background_secondary)',
              borderRadius: 14,
              border: '1px solid var(--vkui--color_separator_primary)',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              « {messageText} »
            </div>
          )}

          <div style={{ position: 'relative', zIndex: 1, fontSize: 10, color: 'var(--vkui--color_text_secondary)', opacity: 0.7, marginTop: 10 }}>
            {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </>
    )
  }

  if (msg.sender_id === '00000000-0000-0000-0000-000000000000' && isGroupChat && !msg.image_url && !msg.video_url && !msg.audio_id && !msg.audio_url) {
    return (
      <>
        {showSep && <div className="v-chat-date-sep"><span>{formatSeparatorDate(msg.created_at)}</span></div>}
        <div 
          style={{ 
            alignSelf: 'center', 
            textAlign: 'center', 
            margin: '10px auto', 
            padding: '6px 14px', 
            borderRadius: 14, 
            background: 'var(--vkui--color_background_secondary)',
            border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))',
            color: 'var(--vkui--color_text_secondary)', 
            fontSize: 12.5,
            fontWeight: 500,
            maxWidth: '85%',
            lineHeight: 1.4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          {msg.content}
        </div>
      </>
    )
  }

  return (
    <>
      {showSep && <div className="v-chat-date-sep"><span>{formatSeparatorDate(msg.created_at)}</span></div>}

      {showSenderName && (
        <div 
          onClick={() => useAppStore.getState().selectProfile(msg.sender_id)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            marginBottom: 2, 
            paddingLeft: isMe ? 0 : 4, 
            paddingRight: isMe ? 4 : 0, 
            alignSelf: isMe ? 'flex-end' : 'flex-start', 
            flexDirection: isMe ? 'row-reverse' : 'row',
            cursor: 'pointer'
          }}
        >
          <CustomAvatar size={18} src={getMemberAvatar(msg.sender_id)} name={getMemberName(msg.sender_id)} id={msg.sender_id} />
          <span style={{ fontSize: 11, fontWeight: 600, color: isMe ? 'rgba(255,255,255,0.9)' : '#007aff' }}>{renderMemberName(msg.sender_id)}</span>
        </div>
      )}

      <div style={{ display: "contents" }}>
        {isVoiceOnly ? (
          <div
            data-message-id={msg.id}
            data-is-me={isMe ? 'true' : 'false'}
            data-is-deleted="false"
            data-is-pinned={isPinned ? 'true' : 'false'}
            data-message-content="Голосовое сообщение"
            className="virtualized-item"
            style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', padding: '8px 12px', borderRadius: 20, background: isMe ? '#007aff' : 'var(--vkui--color_background_secondary)', outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : 'none', outlineOffset: 2 }}
            onDoubleClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setReactionPopup({ msgId: msg.id, x: rect.left + rect.width / 2, y: rect.top - 10 })
            }}
          >
            <VoicePlayer url={msg.audio_url!} isMe={isMe} />
          </div>
        ) : isSticker ? (
          <div
            data-message-id={msg.id}
            data-is-me={isMe ? 'true' : 'false'}
            data-is-deleted="false"
            data-is-pinned={isPinned ? 'true' : 'false'}
            data-message-content={msg.content || ''}
            className="v-chat-sticker virtualized-item"
            style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', fontSize: '48px', lineHeight: 1.2, padding: '4px 8px', cursor: 'default', outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : 'none', outlineOffset: 4, borderRadius: 12 }}
            onDoubleClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setReactionPopup({ msgId: msg.id, x: rect.left + rect.width / 2, y: rect.top - 10 })
            }}
          >
            {msg.content}
          </div>
        ) : isStickerImage ? (
          <StickerImageMessage
            msg={msg}
            isMe={isMe}
            isPinned={isPinned}
            setReactionPopup={setReactionPopup}
          />
        ) : msg.image_url?.includes('circle=true') && !msg.is_deleted ? (
          <CircleVideoMessage msg={msg} isMe={isMe} isSearchMatch={isSearchMatch} isAnyMatch={isAnyMatch} setReactionPopup={setReactionPopup} />
        ) : isStoryMessage ? (() => {
          const storyMatch = msg.content!.match(/(?:https?:\/\/[^\/]+)?\/story\/([a-f0-9-]+)/i)
          const storyId = storyMatch ? storyMatch[1] : ''
          return (
            <div
              data-message-id={msg.id}
              data-is-me={isMe ? 'true' : 'false'}
              data-is-deleted="false"
              data-is-pinned={isPinned ? 'true' : 'false'}
              data-message-content="История"
              className="virtualized-item"
              style={{ 
                alignSelf: isMe ? 'flex-end' : 'flex-start', 
                width: 140,
                height: 210,
                flexShrink: 0,
                display: 'block',
                outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : 'none', 
                outlineOffset: 2,
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative'
              }}
              onDoubleClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setReactionPopup({ msgId: msg.id, x: rect.left + rect.width / 2, y: rect.top - 10 })
              }}
            >
              <ChatStoryCard storyId={storyId} />
            </div>
          )
        })() : isAudioOnlyMessage ? (() => {
          return (
            <div
              data-message-id={msg.id}
              data-is-me={isMe ? 'true' : 'false'}
              data-is-deleted="false"
              data-is-pinned={isPinned ? 'true' : 'false'}
              data-message-content="Музыка"
              className="virtualized-item"
              style={{ 
                alignSelf: isMe ? 'flex-end' : 'flex-start', 
                width: 280,
                flexShrink: 0,
                display: 'block',
                outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : 'none', 
                outlineOffset: 2,
                borderRadius: 14,
                overflow: 'hidden'
              }}
              onDoubleClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setReactionPopup({ msgId: msg.id, x: rect.left + rect.width / 2, y: rect.top - 10 })
              }}
            >
              {msg.audio ? (() => {
                const { currentTrack, isPlaying } = useMusicStore()
                const handlePlayAudio = (track: any) => {
                  const store = useMusicStore.getState()
                  if (currentTrack?.id === track.id) {
                    store.setIsPlaying(!isPlaying)
                  } else {
                    store.setPlaylist([track])
                    store.setCurrentTrack(track)
                    store.setIsPlaying(true)
                  }
                }
                
                return (
                  <div 
                    onClick={(e) => { e.stopPropagation(); handlePlayAudio(msg.audio); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      background: 'var(--vkui--color_background_secondary, rgba(255,255,255,0.05))',
                      border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--vkui--color_background_secondary_hover, rgba(255,255,255,0.08))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--vkui--color_background_secondary, rgba(255,255,255,0.05))'}
                  >
                    {/* Play/Pause icon or cover */}
                    <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#1c1c1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {msg.audio.cover_url ? (
                        <img src={msg.audio.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #3498db, #8e44ad)', color: '#fff', fontSize: 16 }}>
                          🎵
                        </div>
                      )}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}>
                        {currentTrack?.id === msg.audio.id && isPlaying ? (
                          <Icon28Pause width={20} height={20} fill="#fff" />
                        ) : (
                          <Icon28Play width={20} height={20} fill="#fff" style={{ marginLeft: 2 }} />
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--vkui--color_text_primary, #ffffff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {msg.audio.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary, #8a8a8f)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                        {msg.audio.artist}
                      </div>
                    </div>

                    {/* Duration */}
                    <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary, #8a8a8f)', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.floor(msg.audio.duration / 60)}:{(msg.audio.duration % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                )
              })() : (
                <div style={{ padding: '12px 14px', background: 'var(--vkui--color_background_secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spinner size="s" />
                </div>
              )}
            </div>
          )
        })() : isChannelForward ? (() => {
          let forwardData: {
            type: string
            channelId: string
            channelName: string
            channelAvatar: string | null
            postId: string
            text: string
            images: string[]
          } | null = null

          try {
            forwardData = JSON.parse(msg.content || '{}')
          } catch (e) {
            console.error('Failed to parse channel_forward message content', e)
          }

          if (!forwardData) {
            return (
              <div style={{ padding: '8px 12px', background: 'rgba(255,59,48,0.1)', color: '#ff3b30', borderRadius: 8, fontSize: 13 }}>
                Ошибка загрузки пересланного сообщения
              </div>
            )
          }

          const { channelId, channelName, channelAvatar, text, images } = forwardData

          const handleChannelClick = () => {
            if (channelId) {
              useAppStore.getState().selectGroup(channelId)
            }
          }

          return (
            <div
              data-message-id={msg.id}
              data-is-me={isMe ? 'true' : 'false'}
              data-is-deleted="false"
              data-is-pinned={isPinned ? 'true' : 'false'}
              data-message-content="Пересланное сообщение"
              className="virtualized-item"
              style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                width: 300,
                maxWidth: '90%',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : 'none',
                outlineOffset: 2,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(28,28,45,0.85) 0%, rgba(18,18,30,0.95) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                padding: '12px 14px',
                gap: 8,
                userSelect: 'none',
                position: 'relative',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                cursor: 'default'
              }}
              onDoubleClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setReactionPopup({ msgId: msg.id, x: rect.left + rect.width / 2, y: rect.top - 10 })
              }}
            >
              {/* Шапка: Канал */}
              <div 
                onClick={handleChannelClick}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  paddingBottom: 8
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {channelAvatar ? (
                    <img src={channelAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <span style={{ fontSize: 14 }}>📢</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0077ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {channelName}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>переслано из канала</div>
                </div>
              </div>

              {/* Текст поста */}
              {text && (
                <div style={{ 
                  fontSize: 13.5, 
                  lineHeight: 1.45, 
                  color: 'rgba(255,255,255,0.95)', 
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}>
                  {searchQuery.trim() && isAnyMatch ? highlightText(text, searchQuery) : <FormattedText content={text} />}
                </div>
              )}

              {/* Изображения */}
              {images && images.length > 0 && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: images.length === 1 ? '1fr' : '1fr 1fr', 
                  gap: 6,
                  marginTop: text ? 4 : 0,
                  borderRadius: 10,
                  overflow: 'hidden'
                }}>
                  {images.map((img, i) => (
                    <img 
                      key={i} 
                      src={img} 
                      alt="" 
                      loading="lazy" 
                      onClick={(e) => { e.stopPropagation(); handleChannelClick(); }} 
                      style={{ 
                        width: '100%', 
                        height: images.length === 1 ? 160 : 100, 
                        objectFit: 'cover',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s ease',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }} 
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })() : isPostMessage ? (() => {
          const postMatch = msg.content!.match(/(?:https?:\/\/[^\/]+)?\/post\/([a-f0-9-]+)/i)
          const postId = postMatch ? postMatch[1] : ''
          return (
            <div
              data-message-id={msg.id}
              data-is-me={isMe ? 'true' : 'false'}
              data-is-deleted="false"
              data-is-pinned={isPinned ? 'true' : 'false'}
              data-message-content="Запись"
              className="virtualized-item"
              style={{ 
                alignSelf: isMe ? 'flex-end' : 'flex-start', 
                width: 260,
                flexShrink: 0,
                display: 'block',
                outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : 'none', 
                outlineOffset: 2,
                borderRadius: 14,
                overflow: 'hidden'
              }}
              onDoubleClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setReactionPopup({ msgId: msg.id, x: rect.left + rect.width / 2, y: rect.top - 10 })
              }}
            >
              <ChatPostCard postId={postId} />
            </div>
          )
        })() : (
          <div
            data-message-id={msg.id}
            data-is-me={isMe ? 'true' : 'false'}
            data-is-deleted={msg.is_deleted ? 'true' : 'false'}
            data-is-pinned={isPinned ? 'true' : 'false'}
            data-message-content={msg.content || ''}
            className={msg.sender_id === '00000000-0000-0000-0000-000000000000' 
              ? 'virtualized-item' 
              : `v-chat-bubble ${isMe ? 'me' : 'other'} ${isMediaOnly ? 'media-only' : ''} ${msg.is_deleted ? 'deleted' : ''} virtualized-item`
            }
            style={msg.sender_id === '00000000-0000-0000-0000-000000000000'
              ? {
                  alignSelf: 'center',
                  textAlign: 'center',
                  margin: '10px auto',
                  padding: '8px 14px',
                  borderRadius: 16,
                  background: 'var(--vkui--color_background_secondary)',
                  border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))',
                  color: 'var(--vkui--color_text_primary)',
                  fontSize: 13,
                  fontWeight: 500,
                  maxWidth: '85%',
                  lineHeight: 1.4,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6
                }
              : { 
                  alignSelf: isMe ? 'flex-end' : 'flex-start', 
                  maxWidth: '65%', 
                  outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : isPinned ? '1px solid rgba(0,122,255,0.3)' : 'none', 
                  outlineOffset: 2 
                }
            }
            onDoubleClick={(e) => {
              if (msg.is_deleted) return
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setReactionPopup({ msgId: msg.id, x: rect.left + rect.width / 2, y: rect.top - 10 })
            }}
          >
            {msg.is_deleted ? (
              <span style={{ opacity: 0.6, fontStyle: 'italic' }}>Сообщение удалено</span>
            ) : (
              <>
                {msg.forwarded_from && (
                  <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, color: isMe ? 'rgba(255,255,255,0.8)' : '#007aff' }}>
                    <span>--&gt;</span><span style={{ fontWeight: 600 }}>Переслано от {msg.forwarded_from}</span>
                  </div>
                )}
                {msg.reply_to_id && msg.reply_to_content && (
                  <div style={{ borderLeft: `3px solid ${isMe ? 'rgba(255,255,255,0.5)' : '#007aff'}`, paddingLeft: 8, marginBottom: 6, opacity: 0.8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isMe ? 'rgba(255,255,255,0.9)' : '#007aff', marginBottom: 2 }}>{msg.reply_to_sender_name}</div>
                    <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{msg.reply_to_content}</div>
                  </div>
                )}
                {msg.content && (() => {
                  const storyMatch = msg.content.match(/(?:https?:\/\/[^\/]+)?\/story\/([a-f0-9-]+)/i)
                  if (storyMatch) {
                    return <ChatStoryCard storyId={storyMatch[1]} />
                  }
                  return (
                    <div style={{ wordBreak: 'break-word' }}>
                      {searchQuery.trim() && isAnyMatch ? highlightText(msg.content, searchQuery) : <FormattedText content={msg.content} />}
                    </div>
                  )
                })()}
                {msg.image_url && (() => {
                  const isVideo = msg.image_url.split(/[?#]/)[0].toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)
                  if (isVideo) {
                    let title = ''
                    try {
                      const titleParam = msg.image_url.match(/[?&]title=([^&]+)/)?.[1]
                      if (titleParam) title = decodeURIComponent(titleParam)
                    } catch(e){}

                    return (
                      <div 
                        onClick={() => handleImageClick(msg.image_url!)}
                        style={{
                          position: 'relative',
                          width: 280,
                          height: 158,
                          borderRadius: 8,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          marginTop: msg.content ? 6 : 0,
                          backgroundColor: '#000',
                          border: '1px solid rgba(255,255,255,0.08)'
                        }}
                      >
                        <video 
                          src={`${msg.image_url}#t=0.001`} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                          muted
                          playsInline
                          preload="auto"
                        />
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backdropFilter: 'blur(4px)'
                        }}>
                          <Icon28Play fill="#ffffff" width={24} height={24} style={{ marginLeft: 2 }} />
                        </div>
                        {title && (
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                            padding: '8px 12px',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {title}
                          </div>
                        )}
                      </div>
                    )
                  }
                  return <img src={msg.image_url} alt="" loading="lazy" onClick={() => handleImageClick(msg.image_url!)} className="v-chat-media-attachment" style={{ marginTop: msg.content ? 6 : 0 }} />
                })()}
                {msg.video_url && (() => {
                  let title = ''
                  try {
                    const titleParam = msg.video_url.match(/[?&]title=([^&]+)/)?.[1]
                    if (titleParam) title = decodeURIComponent(titleParam)
                  } catch(e){}

                  return (
                    <div 
                      onClick={() => handleImageClick(msg.video_url!)}
                      style={{
                        position: 'relative',
                        width: 280,
                        height: 158,
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        marginTop: msg.content ? 6 : 0,
                        backgroundColor: '#000',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      <video 
                        src={`${msg.video_url}#t=0.001`} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                        muted
                        playsInline
                        preload="auto"
                      />
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(4px)'
                      }}>
                        <Icon28Play fill="#ffffff" width={24} height={24} style={{ marginLeft: 2 }} />
                      </div>
                      {title && (
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                          padding: '8px 12px',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {title}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {msg.audio_url && !isVoiceOnly && <VoicePlayer url={msg.audio_url} isMe={isMe} />}
                {msg.audio && (() => {
                  const { currentTrack, isPlaying } = useMusicStore()
                  const handlePlayAudio = (track: any) => {
                    const store = useMusicStore.getState()
                    if (currentTrack?.id === track.id) {
                      store.setIsPlaying(!isPlaying)
                    } else {
                      store.setPlaylist([track])
                      store.setCurrentTrack(track)
                      store.setIsPlaying(true)
                    }
                  }
                  
                  return (
                    <div 
                      onClick={(e) => { e.stopPropagation(); handlePlayAudio(msg.audio); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: isMe ? 'rgba(255, 255, 255, 0.15)' : 'var(--vkui--color_background_secondary)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        marginTop: msg.content ? 6 : 0,
                        minWidth: 220,
                        maxWidth: 280,
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = isMe ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = isMe ? 'rgba(255, 255, 255, 0.15)' : 'var(--vkui--color_background_secondary)'}
                    >
                      {/* Play/Pause icon or cover */}
                      <div style={{ position: 'relative', width: 34, height: 34, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#1c1c1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {msg.audio.cover_url ? (
                          <img src={msg.audio.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #3498db, #8e44ad)', color: '#fff', fontSize: 13 }}>
                            🎵
                          </div>
                        )}
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff'
                        }}>
                          {currentTrack?.id === msg.audio.id && isPlaying ? (
                            <Icon28Pause width={18} height={18} fill="#fff" />
                          ) : (
                            <Icon28Play width={18} height={18} fill="#fff" style={{ marginLeft: 2 }} />
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? '#fff' : 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {msg.audio.title}
                        </div>
                        <div style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--vkui--color_text_secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                          {msg.audio.artist}
                        </div>
                      </div>

                      {/* Duration */}
                      <div style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--vkui--color_text_secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.floor(msg.audio.duration / 60)}:{(msg.audio.duration % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                  )
                })()}
                {msg.is_edited && msg.original_content && (
                  <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, fontStyle: 'italic', borderTop: isMe ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.06)', paddingTop: 3 }}>bylo: "{msg.original_content}"</div>
                )}
              </>
            )}
          </div>
        )}

        {!msg.is_deleted && msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <ReactionBar reactions={msg.reactions} myId={profileId || ''} onReact={(e) => handleReact(msg.id, e)} isMe={isMe} />
        )}

        <div style={{ fontSize: '10px', color: 'var(--vkui--color_text_secondary)', marginTop: '3px', marginBottom: '2px', padding: '0 4px', alignSelf: msg.sender_id === '00000000-0000-0000-0000-000000000000' ? 'center' : isMe ? 'flex-end' : 'flex-start', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.85 }}>
          {msg.is_edited && !msg.is_deleted && <span>изм.</span>}
          <span>{new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          {isLastReadByPartner && !isGroupChat && selectedChatParticipant && (
            <div title="Прочитано" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 6L8.5 14.5L5 11M22 6l-8.5 8.5"/></svg>
              <CustomAvatar size={14} src={selectedChatParticipant.avatar_url} name={selectedChatParticipant.full_name} id={selectedChatParticipant.id} />
            </div>
          )}
          {isGroupChat && readByMembers && readByMembers.length > 0 && (
            <div title={`Прочитали: ${readByMembers.map(m => m.full_name).join(', ')}`} style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: 1 }}>
                {readByMembers.slice(0, 4).map((member, idx) => (
                  <div 
                    key={member.id} 
                    onClick={(e) => { e.stopPropagation(); useAppStore.getState().selectProfile(member.id); }}
                    style={{ 
                      marginLeft: idx > 0 ? -5 : 0, 
                      border: '1px solid var(--vkui--color_background_content, #1c1c1e)', 
                      borderRadius: '50%', 
                      overflow: 'hidden', 
                      zIndex: 10 - idx,
                      cursor: 'pointer',
                      width: 14,
                      height: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <CustomAvatar size={14} src={member.avatar_url} name={member.full_name} id={member.id} />
                  </div>
                ))}
                {readByMembers.length > 4 && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--vkui--color_text_secondary)', marginLeft: 2, userSelect: 'none' }}>
                    +{readByMembers.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
