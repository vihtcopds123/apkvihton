import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Text, IconButton } from '@vkontakte/vkui'
import { Icon24Dismiss } from '@vkontakte/icons'
import { CustomAvatar } from './CustomAvatar'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { ShareModal } from './ShareModal'
import { useMusicStore } from '../store/useMusicStore'

const isVideoUrl = (url: string) => {
  if (!url) return false
  const cleanUrl = url.split('?')[0].toLowerCase()
  return cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.mov')
}

export interface Story {
  id: string
  user_id: string
  media_url: string
  created_at: string
  author: {
    id: string
    full_name: string | null
    avatar_url: string | null
    avatar_decoration?: string | null
  }
  likes_count?: number
  views_count?: number
  shares_count?: number
  expires_at?: string
}

interface StoryViewerOverlayProps {
  stories: Story[]
  initialIndex?: number
  onClose: () => void
}

export const StoryViewerOverlay: React.FC<StoryViewerOverlayProps> = ({
  stories,
  initialIndex = 0,
  onClose
}) => {
  const { profile } = useAuthStore()
  const { selectProfile } = useAppStore()
  const [localStories, setLocalStories] = useState(stories)
  const [activeIdx, setActiveIdx] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<number | null>(null)
  
  // Likes, Views and Shares local states
  const [likesCount, setLikesCount] = useState(0)
  const [viewsCount, setViewsCount] = useState(0)
  const [sharesCount, setSharesCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [storyLikers, setStoryLikers] = useState<{ id: string; full_name: string | null; avatar_url: string | null }[]>([])
  const [showStoryLikersTooltip, setShowStoryLikersTooltip] = useState(false)

  const activeStory = localStories[activeIdx]

  // Track if timer is paused (e.g., when share modal is open)
  const [isPaused, setIsPaused] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState('')

  // Video-specific states
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Refs for tracking swipe and hold gestures
  const pressStartTimeRef = useRef<number>(0)
  const startXRef = useRef<number>(0)
  const startYRef = useRef<number>(0)
  const isDraggingRef = useRef<boolean>(false)
  const currentDiffYRef = useRef<number>(0)
  const currentDiffXRef = useRef<number>(0)

  const handleGestureStart = (clientX: number, clientY: number) => {
    pressStartTimeRef.current = Date.now()
    startXRef.current = clientX
    startYRef.current = clientY
    isDraggingRef.current = true
    currentDiffYRef.current = 0
    currentDiffXRef.current = 0
    setIsPaused(true)

    if (containerRef.current) {
      containerRef.current.style.transition = 'none'
    }
  }

  const handleGestureMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return
    const diffY = startYRef.current - clientY
    currentDiffYRef.current = diffY
    currentDiffXRef.current = clientX - startXRef.current

    if (containerRef.current) {
      if (diffY > 0) {
        containerRef.current.style.transform = `translateY(${-diffY}px)`
        containerRef.current.style.opacity = `${Math.max(0, 1 - diffY / 300)}`
      } else {
        containerRef.current.style.transform = 'none'
        containerRef.current.style.opacity = '1'
      }
    }
  }

  const handleGestureEnd = (clientX: number) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsPaused(false)

    const pressDuration = Date.now() - pressStartTimeRef.current
    const diffY = currentDiffYRef.current
    const diffX = currentDiffXRef.current

    // Свайп вверх: сдвиг больше 80px и вертикальное движение преобладает над горизонтальным
    if (diffY > 80 && Math.abs(diffY) > Math.abs(diffX) * 1.5) {
      if (containerRef.current) {
        containerRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        containerRef.current.style.transform = `translateY(-${window.innerHeight}px)`
        containerRef.current.style.opacity = '0'
      }
      setTimeout(() => {
        onClose()
      }, 200)
      return
    }

    // Если свайп не удался, плавно возвращаем на место
    if (containerRef.current && diffY > 0) {
      containerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out'
      containerRef.current.style.transform = 'translateY(0px)'
      containerRef.current.style.opacity = '1'
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = 'none'
        }
      }, 250)
    }

    // Если это был быстрый тап (длительность < 250мс и сдвига по вертикали почти не было)
    if (pressDuration < 250 && Math.abs(diffY) < 15) {
      const containerWidth = 450
      const actualWidth = Math.min(window.innerWidth, containerWidth)
      
      const rectLeft = (window.innerWidth - actualWidth) / 2
      const relativeX = clientX - rectLeft

      if (relativeX < actualWidth * 0.35) {
        if (activeIdx > 0) {
          setActiveIdx(idx => idx - 1)
        } else {
          setProgress(0)
        }
      } else {
        if (activeIdx < localStories.length - 1) {
          setActiveIdx(idx => idx + 1)
        } else {
          onClose()
        }
      }
    }
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.story-interactive-zone')) return
    handleGestureStart(e.clientX, e.clientY)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    handleGestureMove(e.clientX, e.clientY)
  }

  const onMouseUp = (e: React.MouseEvent) => {
    handleGestureEnd(e.clientX)
  }

  const onMouseLeave = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      setIsPaused(false)
    }
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.story-interactive-zone')) return
    const touch = e.touches[0]
    handleGestureStart(touch.clientX, touch.clientY)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleGestureMove(touch.clientX, touch.clientY)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return
    e.preventDefault() // Prevents ghost clicks on underlying/replaced elements
    const touch = e.changedTouches[0]
    handleGestureEnd(touch.clientX)
  }

  // Reset video duration and container styles on story index change
  useEffect(() => {
    setVideoDuration(null)
    if (containerRef.current) {
      containerRef.current.style.transform = 'none'
      containerRef.current.style.opacity = '1'
      containerRef.current.style.transition = 'none'
    }
  }, [activeIdx])

  // Play/pause video player on state change
  useEffect(() => {
    if (!videoRef.current) return
    if (isPaused) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(err => console.log('Video play interrupted:', err))
    }
  }, [isPaused, activeIdx])

  useEffect(() => {
    setLocalStories(stories)
  }, [stories])

  // Hide header and tabbar while story is open
  useEffect(() => {
    document.body.classList.add('story-viewer-open')
    return () => {
      document.body.classList.remove('story-viewer-open')
    }
  }, [])

  // Dim global music volume when playing video story, and restore when moving to photo/exiting
  useEffect(() => {
    if (activeStory && isVideoUrl(activeStory.media_url)) {
      useMusicStore.getState().setIsDimmed(true)
    } else {
      useMusicStore.getState().setIsDimmed(false)
    }

    return () => {
      useMusicStore.getState().setIsDimmed(false)
    }
  }, [activeStory?.id])

  useEffect(() => {
    if (!activeStory) return

    const updateTimer = () => {
      const expiresAt = new Date(activeStory.expires_at || '')
      const diffMs = expiresAt.getTime() - Date.now()
      if (diffMs <= 0) {
        setTimeRemaining('Истекла')
        // Automatically go to next story or close
        if (activeIdx < localStories.length - 1) {
          setActiveIdx(idx => idx + 1)
        } else {
          onClose()
        }
        return
      }
      
      const diffSecs = Math.floor(diffMs / 1000)
      const diffMins = Math.floor(diffSecs / 60)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)
      
      const secsPart = diffSecs % 60
      const minsPart = diffMins % 60
      const hoursPart = diffHours % 24
      
      let text = ''
      if (diffDays > 0) {
        text = `${diffDays}д ${hoursPart}ч ${minsPart}м ${secsPart}с`
      } else if (diffHours > 0) {
        text = `${diffHours}ч ${minsPart}м ${secsPart}с`
      } else {
        text = `${minsPart}м ${secsPart}с`
      }
      setTimeRemaining(text)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [activeStory, activeIdx, localStories.length, onClose])

  useEffect(() => {
    // Reset progress when index changes
    setProgress(0)
  }, [activeIdx])

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      return
    }

    const isVideo = isVideoUrl(activeStory?.media_url)
    if (isVideo && videoDuration === null) {
      // Pause progress bar until video metadata loads
      return
    }

    const duration = isVideo && videoDuration ? videoDuration : 5
    const step = 100 / (duration * 20) // 20 ticks per second (50ms interval)

    timerRef.current = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          // Go to next story
          if (activeIdx < localStories.length - 1) {
            setActiveIdx(idx => idx + 1)
            return 0
          } else {
            // Close
            onClose()
            return 100
          }
        }
        return prev + step
      })
    }, 50)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [activeIdx, localStories.length, isPaused, videoDuration, activeStory?.media_url, onClose])

  // Manage views, likes, and liked state on active story change
  useEffect(() => {
    if (!activeStory) return

    // Set initial values
    setIsLiked(false)
    setLikesCount(activeStory.likes_count || 0)
    setViewsCount(activeStory.views_count || 0)
    setSharesCount(activeStory.shares_count || 0)

    const incrementAndViewStats = async () => {
      try {
        // 1. Increment view count in database
        await supabase.rpc('increment_story_views', { story_id: activeStory.id })

        // 2. Fetch updated view/like/share counts
        const { data: storyData, error: storyErr } = await supabase
          .from('stories')
          .select('views_count, likes_count, shares_count')
          .eq('id', activeStory.id)
          .single()

        if (!storyErr && storyData) {
          setViewsCount(storyData.views_count || 0)
          setLikesCount(storyData.likes_count || 0)
          setSharesCount(storyData.shares_count || 0)
        }

        // 3. Fetch current user's like status
        if (profile) {
          const { data: likeData, error: likeErr } = await supabase
            .from('story_likes')
            .select('id')
            .eq('story_id', activeStory.id)
            .eq('user_id', profile.id)
            .maybeSingle()

          if (!likeErr && likeData) {
            setIsLiked(true)
          }
        }
      } catch (err) {
        console.error('Error managing story view/like stats:', err)
      }
    }

    incrementAndViewStats()
  }, [activeStory, profile])

  useEffect(() => {
    if (!activeStory) return
    let isSubscribed = true
    const fetchStoryLikers = async () => {
      try {
        const { data, error } = await supabase
          .from('story_likes')
          .select('user_id, profiles(id, full_name, avatar_url)')
          .eq('story_id', activeStory.id)
          .limit(10)
        if (!isSubscribed) return
        if (error) throw error
        if (data) {
          const users = data.map((item: any) => item.profiles).filter(Boolean)
          setStoryLikers(users)
        }
      } catch (err) {
        console.error('Error fetching story likers:', err)
      }
    }
    fetchStoryLikers()
    return () => { isSubscribed = false }
  }, [activeStory])

  if (!activeStory) return null



  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!profile || !activeStory) return

    const previousIsLiked = isLiked
    const previousLikesCount = likesCount

    // Optimistic UI Update
    setIsLiked(!previousIsLiked)
    setLikesCount(prev => prev + (previousIsLiked ? -1 : 1))

    // Мгновенное онлайн обновление списка лайкнувших историю
    if (previousIsLiked) {
      setStoryLikers(prev => prev.filter(x => x.id !== profile.id))
    } else {
      const myUser = {
        id: profile.id,
        full_name: profile.full_name || 'Я',
        avatar_url: profile.avatar_url
      }
      setStoryLikers(prev => {
        if (prev.some(x => x.id === profile.id)) return prev
        return [myUser, ...prev]
      })
    }

    try {
      if (previousIsLiked) {
        const { error } = await supabase
          .from('story_likes')
          .delete()
          .eq('story_id', activeStory.id)
          .eq('user_id', profile.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('story_likes')
          .insert({
            story_id: activeStory.id,
            user_id: profile.id
          })
        if (error) throw error
      }
    } catch (err) {
      console.error('Error toggling story like:', err)
      // Revert if error
      setIsLiked(previousIsLiked)
      setLikesCount(previousLikesCount)
    }
  }

  const clickDeleteIcon = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsPaused(true)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteStory = async () => {
    setShowDeleteConfirm(false)
    if (!profile || !activeStory) return
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', activeStory.id)
        .eq('user_id', profile.id)

      if (error) throw error

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          title: 'История',
          text: 'История успешно удалена!'
        }
      }))

      // Emit global delete event
      window.dispatchEvent(new CustomEvent('story-deleted-global', { detail: { storyId: activeStory.id } }))

      // Filter local state
      const remaining = localStories.filter(s => s.id !== activeStory.id)
      setLocalStories(remaining)
      
      if (remaining.length === 0) {
        onClose()
      } else {
        // Adjust active index
        if (activeIdx >= remaining.length) {
          setActiveIdx(remaining.length - 1)
        }
        setProgress(0)
        setIsPaused(false)
      }
    } catch (err) {
      console.error('Error deleting story:', err)
      alert('Не удалось удалить историю')
      setIsPaused(false)
    }
  }

  const cancelDeleteStory = () => {
    setShowDeleteConfirm(false)
    setIsPaused(false)
  }

  const handleOpenShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsPaused(true)
    setShowShareModal(true)
  }

  const handleCloseShare = () => {
    setShowShareModal(false)
    setIsPaused(false)
  }

  // Helper is replaced by useEffect timer state

  return createPortal(
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 11000,
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      {/* Main Container with Hold & Swipe gestures */}
      <div 
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 450,
          height: '100%',
          maxHeight: 800,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 5,
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      >
        {/* Story Media */}
        {isVideoUrl(activeStory.media_url) ? (
          <video 
            ref={videoRef}
            src={activeStory.media_url}
            autoPlay
            playsInline
            muted={isMuted}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 16,
              zIndex: 1,
              pointerEvents: 'none'
            }}
            onLoadedMetadata={(e) => {
              setVideoDuration(e.currentTarget.duration)
            }}
            onEnded={() => {
              setProgress(100)
            }}
          />
        ) : (
          <img 
            src={activeStory.media_url} 
            alt="story" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 16,
              zIndex: 1,
              pointerEvents: 'none'
            }} 
          />
        )}

        {/* Top Controls Overlay */}
        <div 
          className="story-interactive-zone"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '16px 16px 24px 16px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {/* Progress Indicators */}
          <div style={{ display: 'flex', gap: 4, width: '100%' }}>
            {localStories.map((story, idx) => {
              let widthVal = '0%'
              if (idx < activeIdx) widthVal = '100%'
              else if (idx === activeIdx) widthVal = `${progress}%`

              return (
                <div 
                  key={story.id} 
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: 'rgba(255, 255, 255, 0.25)',
                    overflow: 'hidden'
                  }}
                >
                  <div 
                    style={{
                      width: widthVal,
                      height: '100%',
                      background: '#ffffff',
                      transition: idx === activeIdx && !isPaused ? 'none' : 'width 0.1s linear'
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* User Info Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CustomAvatar size={40} src={activeStory.author.avatar_url} name={activeStory.author.full_name} id={activeStory.author.id} decoration={activeStory.author.avatar_decoration} style={{ border: '2px solid #ffffff' }} />
              <div>
                <Text style={{ color: '#ffffff', fontWeight: 600, fontSize: 14 }}>
                  {activeStory.author.full_name}
                </Text>
                <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{new Date(activeStory.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>·</span>
                  <span style={{ color: '#ffb300' }}>⏳ осталось {timeRemaining}</span>
                </Text>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {profile && activeStory.user_id === profile.id && (
                <IconButton 
                  onClick={clickDeleteIcon}
                  style={{ 
                    color: '#ff453a', 
                    backgroundColor: 'rgba(255, 69, 58, 0.18)', 
                    borderRadius: '50%',
                    width: 36,
                    height: 36,
                    minWidth: 36,
                    minHeight: 36,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1.5px solid rgba(255, 69, 58, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  aria-label="Удалить историю"
                  title="Удалить историю"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </IconButton>
              )}

              {isVideoUrl(activeStory.media_url) && (
                <IconButton 
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMuted(prev => !prev)
                  }}
                  style={{ 
                    color: '#ffffff', 
                    backgroundColor: 'rgba(255, 255, 255, 0.15)', 
                    borderRadius: '50%',
                    width: 36,
                    height: 36,
                    minWidth: 36,
                    minHeight: 36,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1.5px solid rgba(255, 255, 255, 0.25)',
                    transition: 'all 0.2s ease'
                  }}
                  aria-label={isMuted ? "Включить звук" : "Выключить звук"}
                  title={isMuted ? "Включить звук" : "Выключить звук"}
                >
                  {isMuted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  )}
                </IconButton>
              )}

              <IconButton 
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }} 
                style={{ 
                  color: '#ffffff', 
                  backgroundColor: 'rgba(255, 255, 255, 0.15)', 
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  minWidth: 36,
                  minHeight: 36,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  transition: 'all 0.2s ease'
                }}
                aria-label="Закрыть"
              >
                <Icon24Dismiss />
              </IconButton>
            </div>
          </div>
        </div>

        {showDeleteConfirm && (
          <div 
            className="story-interactive-zone"
            style={{
              position: 'absolute',
              top: 20,
              left: 12,
              right: 12,
            zIndex: 100,
            background: 'rgba(30, 30, 30, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            animation: 'storySlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: '#ffffff', fontWeight: 600, fontSize: 15 }}>Удаление истории</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 13 }}>Вы уверены, что хотите навсегда удалить эту историю?</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button 
                onClick={cancelDeleteStory}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Отмена
              </button>
              <button 
                onClick={confirmDeleteStory}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#ff453a',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        )}

        {/* Bottom Actions Overlay */}
        <div 
          className="story-interactive-zone"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 20px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16
        }}>
          {/* Views count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ffffff', opacity: 0.9 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{viewsCount}</span>
          </div>

          {/* Likes & Share buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Like button chip */}
            <div 
              className="story-like-container"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
              onMouseEnter={() => setShowStoryLikersTooltip(true)}
              onMouseLeave={() => setShowStoryLikersTooltip(false)}
            >
              <div 
                onClick={handleLikeToggle}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 5, 
                  color: '#ffffff', 
                  background: isLiked ? 'rgba(255, 45, 85, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                  border: isLiked ? '1px solid rgba(255, 45, 85, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '6px 12px', 
                  borderRadius: 20, 
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  zIndex: 30
                }}
              >
                {isLiked ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff2d55">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: isLiked ? '#ff2d55' : '#ffffff' }}>{likesCount}</span>
              </div>

              {/* Стопка аватарок в историях */}
              {storyLikers.length > 0 && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowStoryLikersTooltip(!showStoryLikersTooltip)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 6px',
                    borderRadius: 20,
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    height: 28,
                    boxSizing: 'border-box',
                    zIndex: 30
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {storyLikers.slice(0, 3).map((liker, idx) => (
                      <div 
                        key={liker.id}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '1px solid #000000',
                          marginLeft: idx > 0 ? -5 : 0,
                          zIndex: 10 - idx,
                          background: '#333',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 6,
                          fontWeight: 'bold',
                          color: '#ccc'
                        }}
                      >
                        {liker.avatar_url ? (
                          <img src={liker.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span>{liker.full_name?.charAt(0)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Всплывающий список лайкнувших в историях */}
              {showStoryLikersTooltip && storyLikers.length > 0 && (
                <div 
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: 8,
                    background: 'rgba(20, 20, 20, 0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 14,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                    padding: '8px 12px',
                    width: 'max-content',
                    minWidth: 150,
                    maxWidth: 220,
                    zIndex: 99999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    backdropFilter: 'blur(10px)',
                    animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
                    Оценили:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {storyLikers.map(liker => (
                      <div 
                        key={liker.id} 
                        onClick={(e) => { e.stopPropagation(); setShowStoryLikersTooltip(false); onClose(); selectProfile(liker.id); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        <div style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', background: '#333', flexShrink: 0 }}>
                          {liker.avatar_url ? (
                            <img src={liker.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#0077ff', color: '#fff', fontWeight: 'bold' }}>{liker.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{liker.full_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Share button chip (Direct Messages Only) */}
            <div 
              onClick={handleOpenShare}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#ffffff', 
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '6px 12px', 
                borderRadius: 20, 
                cursor: 'pointer',
                transition: 'all 0.2s',
                zIndex: 30
              }}
              title="Поделиться в личных сообщениях"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 6 }}>Поделиться</span>
              {sharesCount > 0 && (
                <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 6, opacity: 0.8 }}>{sharesCount}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showShareModal && (
        <ShareModal 
          story={activeStory} 
          mode="dm_only" 
          onClose={handleCloseShare} 
          onSuccess={() => {
            setSharesCount(prev => prev + 1)
          }}
        />
      )}
    </div>,
    document.body
  )
}
