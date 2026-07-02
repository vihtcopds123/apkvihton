import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { Icon28Like, Icon28LikeOutline, Icon28CommentOutline, Icon28SendOutline, Icon24ChevronLeft, Icon24ChevronRight, Icon24Dismiss, Icon24Download, Icon24Share } from '@vkontakte/icons'
import { CustomAvatar } from './CustomAvatar'
import { AdminBadge } from './AdminBadge'
import { FormattedText } from './FormattedText'
import { EmojiPicker } from './EmojiPicker'
import { StickerPicker } from './StickerPicker'
import { VideoPlayer } from './VideoPlayer'
import { WriteBar, WriteBarIcon } from '@vkontakte/vkui'

const ReactionBar: React.FC<{ reactions: Record<string, string[]>; myId: string; onReact: (e: string) => void }> = ({ reactions, myId, onReact }) => {
  const entries = Object.entries(reactions).filter(([, u]) => u.length > 0)
  if (!entries.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, justifyContent: 'flex-start' }}>
      {entries.map(([emoji, users]) => (
        <button key={emoji} onClick={() => onReact(emoji)} style={{ background: users.includes(myId) ? 'rgba(0,122,255,0.18)' : 'var(--vkui--color_background_secondary)', border: users.includes(myId) ? '1px solid rgba(0,122,255,0.45)' : '1px solid var(--vkui--separator_primary_alpha, rgba(255,255,255,0.12))', borderRadius: 12, padding: '2px 7px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}>
          {emoji} <span style={{ fontSize: 11, fontWeight: 600 }}>{users.length}</span>
        </button>
      ))}
    </div>
  )
}

interface MediaComment {
  id: string
  media_url: string
  content: string
  created_at: string
  reactions?: Record<string, string[]> | null
  author: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
    role?: string | null
  }
  likes_count?: number
}

interface PostContext {
  id: string
  author: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
    role?: string | null
  }
  content: string
  created_at: string
}

export const GalleryOverlay: React.FC = () => {
  const { profile } = useAuthStore()
  const { selectProfile } = useAppStore()
  const [images, setImages] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isVisible, setIsVisible] = useState<boolean>(false)
  const [postContext, setPostContext] = useState<PostContext | null>(null)
  const [disableComments, setDisableComments] = useState<boolean>(false)
  const [isChannelPost, setIsChannelPost] = useState<boolean>(false)

  const [likeCount, setLikeCount] = useState<number>(0)
  const [isLiked, setIsLiked] = useState<boolean>(false)
  const [mediaLikers, setMediaLikers] = useState<{ id: string; full_name: string | null; avatar_url: string | null }[]>([])
  const [showMediaLikersTooltip, setShowMediaLikersTooltip] = useState<boolean>(false)

  const [comments, setComments] = useState<MediaComment[]>([])
  const [likedCommentIds, setLikedCommentIds] = useState<Record<string, boolean>>({})
  const [commentLikesCountMap, setCommentLikesCountMap] = useState<Record<string, number>>({})
  const [newCommentText, setNewCommentText] = useState<string>('')
  const [showComments, setShowComments] = useState<boolean>(window.innerWidth > 900)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 900)
  const [replyingTo, setReplyingTo] = useState<MediaComment | null>(null)
  const [editingComment, setEditingComment] = useState<MediaComment | null>(null)

  const [notification, setNotification] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState<boolean>(false)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [translateY, setTranslateY] = useState(0)
  const [scale, setScale] = useState(1)
  const [isSwipingY, setIsSwipingY] = useState(false)
  const [startPinchDist, setStartPinchDist] = useState<number | null>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(null), 2500)
    return () => clearTimeout(timer)
  }, [notification])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const handleDownload = async () => {
    if (!currentImageUrl) return
    try {
      const response = await fetch(currentImageUrl, { mode: 'cors' })
      if (!response.ok) throw new Error('Network response was not ok')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = currentImageUrl.split('/').pop()?.split('?')[0] || 'photo.jpg'
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setNotification('Фотография сохранена')
    } catch (err) {
      console.error('Download failed:', err)
      const a = document.createElement('a')
      a.href = currentImageUrl
      a.target = '_blank'
      a.download = 'photo.jpg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setNotification('Фотография открыта для скачивания')
    }
  }

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 900
      setIsMobile(mobile)
      if (!mobile) setShowComments(true)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleOpenGallery = (e: Event) => {
      console.log('GalleryOverlay: handleOpenGallery event received', e)
      const customEvent = e as CustomEvent<{ images: string[]; startIndex: number; postContext?: PostContext; disableComments?: boolean; isChannel?: boolean }>
      console.log('GalleryOverlay: event detail:', customEvent.detail)
      if (customEvent.detail && customEvent.detail.images && customEvent.detail.images.length > 0) {
        setImages(customEvent.detail.images)
        setCurrentIndex(customEvent.detail.startIndex || 0)
        setPostContext(customEvent.detail.postContext || null)
        setDisableComments(!!customEvent.detail.disableComments)
        setIsChannelPost(!!customEvent.detail.isChannel)
        setShowComments(window.innerWidth > 900 && !customEvent.detail.disableComments)
        setIsOpen(true)
        setImageLoaded(false)
        requestAnimationFrame(() => setIsVisible(true))
      }
    }
    window.addEventListener('open-gallery', handleOpenGallery)
    return () => window.removeEventListener('open-gallery', handleOpenGallery)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => setIsOpen(false), 250)
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, images, currentIndex])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      setStartPinchDist(dist)
    } else if (e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX)
      setTouchStartY(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && startPinchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const newScale = Math.max(1, Math.min(3, dist / startPinchDist))
      setScale(newScale)
    } else if (e.touches.length === 1 && touchStartY !== null && touchStartX !== null && scale === 1) {
      const diffY = e.touches[0].clientY - touchStartY
      const diffX = e.touches[0].clientX - touchStartX
      if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
        setIsSwipingY(true)
        setTranslateY(diffY)
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startPinchDist !== null) {
      setStartPinchDist(null)
      setScale(1)
    } else {
      if (isSwipingY && translateY !== 0) {
        if (Math.abs(translateY) > 120) {
          handleClose()
        }
        setTranslateY(0)
        setIsSwipingY(false)
      } else if (touchStartX !== null && e.changedTouches[0]) {
        const diffX = touchStartX - e.changedTouches[0].clientX
        if (Math.abs(diffX) > 60) {
          if (diffX > 0) handleNext()
          else handlePrev()
        }
      }
      setTouchStartX(null)
      setTouchStartY(null)
    }
  }

  const currentImageUrl = images[currentIndex]

  const isVideoUrl = (url: string) => {
    if (!url) return false
    const cleanUrl = url.split('?')[0]
    return cleanUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/) !== null
  }

  useEffect(() => {
    if (!isOpen || !currentImageUrl) return
    if (isVideoUrl(currentImageUrl)) {
      setImageLoaded(true)
    } else {
      setImageLoaded(false)
    }
    let isSubscribed = true
    const fetchLikes = async () => {
      try {
        const countPromise = supabase
          .from('media_likes')
          .select('*', { count: 'exact', head: true })
          .eq('media_url', currentImageUrl)
        const userLikedPromise = profile
          ? supabase
              .from('media_likes')
              .select('id')
              .eq('media_url', currentImageUrl)
              .eq('user_id', profile.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null })
        const [countRes, userLikedRes] = await Promise.all([countPromise, userLikedPromise])
        if (!isSubscribed) return
        if (countRes.error) throw countRes.error
        if (userLikedRes.error) throw userLikedRes.error
        setLikeCount(countRes.count || 0)
        setIsLiked(!!userLikedRes.data)
      } catch (err) {
        console.error('Error fetching likes:', err)
      }
    }
    fetchLikes()
    return () => { isSubscribed = false }
  }, [isOpen, currentImageUrl, profile])

  useEffect(() => {
    if (!isOpen || !currentImageUrl) return
    let isSubscribed = true
    const fetchMediaLikers = async () => {
      try {
        const { data, error } = await supabase
          .from('media_likes')
          .select('user_id, profiles(id, full_name, avatar_url)')
          .eq('media_url', currentImageUrl)
          .limit(10)

        if (!isSubscribed) return
        if (error) throw error
        if (data) {
          const users = data
            .map((item: any) => item.profiles)
            .filter(Boolean)
          setMediaLikers(users)
        }
      } catch (err) {
        console.error('Error fetching media likers:', err)
      }
    }
    fetchMediaLikers()
    return () => { isSubscribed = false }
  }, [isOpen, currentImageUrl])

  useEffect(() => {
    if (!isOpen) { setComments([]); return }
    let isSubscribed = true

    const fetchComments = async () => {
      try {
        let commentsList: MediaComment[] = []
        if (postContext?.id) {
          // Комментарии поста
          const { data, error } = await supabase
            .from('comments')
            .select('*, author:profiles(id, full_name, avatar_url, username, role)')
            .eq('post_id', postContext.id)
            .order('created_at', { ascending: true })
          if (!isSubscribed) return
          if (error) throw error
          commentsList = (data as unknown as MediaComment[]) || []
        } else if (currentImageUrl) {
          // Комментарии к фото (аватарка и т.д.)
          const { data, error } = await supabase
            .from('photo_comments')
            .select('*, author:profiles(id, full_name, avatar_url, username, role)')
            .eq('photo_url', currentImageUrl)
            .order('created_at', { ascending: true })
          if (!isSubscribed) return
          if (error) throw error
          commentsList = (data as unknown as MediaComment[]) || []
        }

        setComments(commentsList)

        // Загружаем лайки
        if (commentsList.length > 0) {
          if (postContext?.id) {
            // Лайки обычных комментариев к посту
            const commentIds = commentsList.map(c => c.id)
            const { data: likes, error: likesError } = await supabase
              .from('comment_likes')
              .select('comment_id, user_id')
              .in('comment_id', commentIds)

            const counts: Record<string, number> = {}
            const userLiked: Record<string, boolean> = {}

            commentIds.forEach(id => {
              counts[id] = 0
              userLiked[id] = false
            })

            if (!likesError && likes) {
              likes.forEach((l: any) => {
                counts[l.comment_id] = (counts[l.comment_id] || 0) + 1
                if (profile && l.user_id === profile.id) {
                  userLiked[l.comment_id] = true
                }
              })
            }

            if (isSubscribed) {
              setCommentLikesCountMap(counts)
              setLikedCommentIds(userLiked)
            }
          } else if (currentImageUrl) {
            // Лайки комментариев к фотографии
            const commentUrls = commentsList.map(c => `photo_comment_like:${c.id}`)
            const { data: likesData, error: likesError } = await supabase
              .from('media_likes')
              .select('media_url, user_id')
              .in('media_url', commentUrls)

            if (!likesError && likesData && isSubscribed) {
              const counts: Record<string, number> = {}
              const userLiked: Record<string, boolean> = {}
              commentsList.forEach(c => { counts[c.id] = 0 })
              likesData.forEach((like: any) => {
                const commentId = like.media_url.replace('photo_comment_like:', '')
                counts[commentId] = (counts[commentId] || 0) + 1
                if (profile && like.user_id === profile.id) {
                  userLiked[commentId] = true
                }
              })
              setCommentLikesCountMap(counts)
              setLikedCommentIds(userLiked)
            }
          }
        }
      } catch (err) {
        console.error('Error fetching comments:', err)
      }
    }

    fetchComments()
    return () => { isSubscribed = false }
  }, [isOpen, postContext?.id, currentImageUrl, profile])

  useEffect(() => {
    if (!isOpen) return

    let channelName = ''
    let tableName = ''

    if (postContext?.id) {
      channelName = `gallery-comments-${postContext.id}`
      tableName = 'comments'
    } else if (currentImageUrl) {
      channelName = `gallery-photo-comments`
      tableName = 'photo_comments'
    } else {
      return
    }

    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: tableName
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newComment = payload.new as any
          
          if (tableName === 'photo_comments' && newComment.photo_url !== currentImageUrl) return
          if (tableName === 'comments' && newComment.post_id !== postContext?.id) return

          const { data: author } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, username, role')
            .eq('id', newComment.author_id)
            .single()

          if (author) {
            const commentWithAuthor: MediaComment = {
              id: newComment.id,
              media_url: newComment.media_url || '',
              content: newComment.content,
              created_at: newComment.created_at,
              author: author,
              likes_count: 0
            }

            setComments(prev => {
              if (prev.some(c => c.id === newComment.id)) return prev
              return [...prev, commentWithAuthor]
            })
          }
        } else if (payload.eventType === 'DELETE') {
          setComments(prev => prev.filter(c => c.id !== payload.old.id))
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any
          setComments(prev => prev.map(c => {
            if (c.id === updated.id) {
              return {
                ...c,
                content: updated.content
              }
            }
            return c
          }))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [isOpen, postContext?.id, currentImageUrl])

  const handleLikeGalleryComment = async (commentId: string) => {
    if (!profile) return
    const isLiked = !!likedCommentIds[commentId]
    const currentCount = commentLikesCountMap[commentId] || 0

    setLikedCommentIds(prev => ({ ...prev, [commentId]: !isLiked }))
    setCommentLikesCountMap(prev => ({ ...prev, [commentId]: Math.max(0, currentCount + (isLiked ? -1 : 1)) }))

    try {
      if (postContext?.id) {
        if (isLiked) {
          await supabase
            .from('comment_likes_users')
            .delete()
            .eq('comment_id', commentId)
            .eq('user_id', profile.id)
        } else {
          await supabase
            .from('comment_likes_users')
            .insert({ comment_id: commentId, user_id: profile.id })
        }
      } else {
        const mediaUrl = `photo_comment_like:${commentId}`
        if (isLiked) {
          await supabase
            .from('media_likes')
            .delete()
            .eq('media_url', mediaUrl)
            .eq('user_id', profile.id)
        } else {
          await supabase
            .from('media_likes')
            .insert({ media_url: mediaUrl, user_id: profile.id })
        }
      }
    } catch (err) {
      console.error('Error toggling comment like:', err)
      setLikedCommentIds(prev => ({ ...prev, [commentId]: isLiked }))
      setCommentLikesCountMap(prev => ({ ...prev, [commentId]: currentCount }))
    }
  }

  const handleNext = () => {
    if (images.length <= 1) return
    setImageLoaded(false)
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }
  const handlePrev = () => {
    if (images.length <= 1) return
    setImageLoaded(false)
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!profile || !currentImageUrl) return
    const prevIsLiked = isLiked
    const prevCount = likeCount
    setIsLiked(!prevIsLiked)
    setLikeCount((prev) => prev + (prevIsLiked ? -1 : 1))

    // Мгновенное онлайн обновление списка лайкнувших фото
    if (prevIsLiked) {
      setMediaLikers(prev => prev.filter(x => x.id !== profile.id))
    } else {
      const myUser = {
        id: profile.id,
        full_name: profile.full_name || 'Я',
        avatar_url: profile.avatar_url
      }
      setMediaLikers(prev => {
        if (prev.some(x => x.id === profile.id)) return prev
        return [myUser, ...prev]
      })
    }

    try {
      if (prevIsLiked) {
        const { error } = await supabase.from('media_likes').delete().eq('media_url', currentImageUrl).eq('user_id', profile.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('media_likes').insert({ media_url: currentImageUrl, user_id: profile.id })
        if (error) throw error
      }
    } catch (err) {
      console.error('Error toggling like:', err)
      setIsLiked(prevIsLiked)
      setLikeCount(prevCount)
    }
  }

  const handleSendStickerInComment = async (stickerUrl: string) => {
    if (!profile) return
    const text = stickerUrl + '?sticker=true'
    const replyText = replyingTo ? `@${replyingTo.author.username || replyingTo.author.full_name}, ${text}` : text
    setReplyingTo(null)

    try {
      if (postContext?.id) {
        const { data, error } = await supabase
          .from('comments')
          .insert({ post_id: postContext.id, author_id: profile.id, content: replyText })
          .select('*, author:profiles(id, full_name, avatar_url, username, role)')
          .single()
        if (error) throw error
        if (data) setComments(prev => [...prev, data as unknown as MediaComment])
      } else if (currentImageUrl) {
        const { data, error } = await supabase
          .from('photo_comments')
          .insert({ photo_url: currentImageUrl, author_id: profile.id, content: replyText })
          .select('*, author:profiles(id, full_name, avatar_url, username, role)')
          .single()
        if (error) throw error
        if (data) setComments(prev => [...prev, data as unknown as MediaComment])
      }
    } catch (err) {
      console.error('Error sending sticker comment in gallery:', err)
    }
  }

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!profile || !newCommentText.trim()) return
    const text = newCommentText.trim()
    setNewCommentText('')
    setReplyingTo(null)

    try {
      if (editingComment) {
        const tableName = postContext?.id ? 'comments' : 'photo_comments'
        const { error } = await supabase
          .from(tableName)
          .update({ content: text })
          .eq('id', editingComment.id)
        if (error) throw error
        setComments(prev => prev.map(c => c.id === editingComment.id ? { ...c, content: text } : c))
        setEditingComment(null)
      } else {
        if (postContext?.id) {
          // Комментарий к посту
          const { data, error } = await supabase
            .from('comments')
            .insert({ post_id: postContext.id, author_id: profile.id, content: text })
            .select('*, author:profiles(id, full_name, avatar_url, username, role)')
            .single()
          if (error) throw error
          if (data) setComments(prev => [...prev, data as unknown as MediaComment])
        } else if (currentImageUrl) {
          // Комментарий к фото
          const { data, error } = await supabase
            .from('photo_comments')
            .insert({ photo_url: currentImageUrl, author_id: profile.id, content: text })
            .select('*, author:profiles(id, full_name, avatar_url, username, role)')
            .single()
          if (error) throw error
          if (data) setComments(prev => [...prev, data as unknown as MediaComment])
        }
      }
    } catch (err) {
      console.error('Error adding comment:', err)
    }
  }

  const handleCommentReact = async (commentId: string, emoji: string) => {
    if (!profile) return
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return

    const reactions = { ...(comment.reactions || {}) }
    const users = [...(reactions[emoji] || [])]
    const userIndex = users.indexOf(profile.id)

    if (userIndex >= 0) {
      users.splice(userIndex, 1)
    } else {
      users.push(profile.id)
    }

    if (!users.length) {
      delete reactions[emoji]
    } else {
      reactions[emoji] = users
    }

    setComments(prev => prev.map(c => c.id === commentId ? { ...c, reactions } : c))

    try {
      const tableName = postContext?.id ? 'comments' : 'photo_comments'
      await supabase.from(tableName).update({ reactions }).eq('id', commentId)
    } catch (err) {
      console.error('Error updating comment reaction in gallery:', err)
      // Revert if error
      if (postContext?.id) {
        const { data } = await supabase
          .from('comments')
          .select('*, author:profiles(id, full_name, avatar_url, username, role)')
          .eq('post_id', postContext.id)
          .order('created_at', { ascending: true })
        if (data) setComments(data as unknown as MediaComment[])
      } else if (currentImageUrl) {
        const { data } = await supabase
          .from('photo_comments')
          .select('*, author:profiles(id, full_name, avatar_url, username, role)')
          .eq('photo_url', currentImageUrl)
          .order('created_at', { ascending: true })
        if (data) setComments(data as unknown as MediaComment[])
      }
    }
  }

  useEffect(() => {
    const handleReactCommentEvent = async (e: Event) => {
      const { id, emoji } = (e as CustomEvent).detail
      const hasComment = comments.some(c => c.id === id)
      if (!hasComment) return
      await handleCommentReact(id, emoji)
    }

    const handleReplyCommentEvent = (e: Event) => {
      const { id, postId, photoUrl } = (e as CustomEvent).detail
      // Проверяем соответствие контексту поста или фотографии
      if (postContext?.id && postId !== postContext.id) return
      if (!postContext?.id && photoUrl !== currentImageUrl) return
      
      const cmt = comments.find(c => c.id === id)
      if (cmt) {
        setReplyingTo(cmt)
        setNewCommentText(`@${cmt.author.username || cmt.author.full_name}, `)
      }
    }

    const handleEditCommentEvent = (e: Event) => {
      const { id, postId, photoUrl } = (e as CustomEvent).detail
      if (postContext?.id && postId !== postContext.id) return
      if (!postContext?.id && photoUrl !== currentImageUrl) return

      const cmt = comments.find(c => c.id === id)
      if (cmt) {
        setEditingComment(cmt)
        setNewCommentText(cmt.content)
      }
    }

    const handleDeleteCommentEvent = (e: Event) => {
      const { id, postId, photoUrl } = (e as CustomEvent).detail
      if (postContext?.id && postId !== postContext.id) return
      if (!postContext?.id && photoUrl !== currentImageUrl) return
      handleDeleteComment(id)
    }

    window.addEventListener('react-comment', handleReactCommentEvent)
    window.addEventListener('reply-comment', handleReplyCommentEvent)
    window.addEventListener('edit-comment', handleEditCommentEvent)
    window.addEventListener('delete-comment', handleDeleteCommentEvent)

    return () => {
      window.removeEventListener('react-comment', handleReactCommentEvent)
      window.removeEventListener('reply-comment', handleReplyCommentEvent)
      window.removeEventListener('edit-comment', handleEditCommentEvent)
      window.removeEventListener('delete-comment', handleDeleteCommentEvent)
    }
  }, [comments, postContext?.id, currentImageUrl])

  const handleDeleteComment = async (commentId: string) => {
    try {
      const isAdmin = profile?.id === 'fee894db-c5b0-4022-bb9f-56c60decac86' || profile?.username === 'viht' || profile?.username === 'adm' || profile?.role === 'admin' || profile?.role === 'moderator' || (profile?.roles && (profile.roles.includes('admin') || profile.roles.includes('moderator') || profile.roles.includes('creator')))
      const tableName = postContext?.id ? 'comments' : 'photo_comments'
      let query = supabase.from(tableName).delete().eq('id', commentId)
      if (!isAdmin) query = query.eq('author_id', profile?.id)
      const { error } = await query
      if (error) throw error
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  if (!isOpen || images.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        userSelect: 'none',
        overflow: 'hidden',
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.88)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: isVisible ? 'blur(32px)' : 'blur(0px)',
        WebkitBackdropFilter: isVisible ? 'blur(32px)' : 'blur(0px)',
        transition: 'background-color 0.3s ease, backdrop-filter 0.3s ease',
      }}
      onClick={handleClose}
    >
      {notification && (
        <div style={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%) translateY(0)',
          background: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(16px)',
          color: '#fff',
          padding: '10px 22px',
          borderRadius: 14,
          fontSize: 13,
          fontWeight: 500,
          zIndex: 100200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
          animation: 'galleryToastIn 0.25s ease',
        }}>
          {notification}
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); handleClose() }}
        style={{
          position: 'fixed',
          top: isMobile ? 12 : 20,
          right: isMobile ? 12 : 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100150,
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        <Icon24Dismiss width={22} height={22} />
      </button>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          width: isMobile ? '100%' : 'min(1200px, 92vw)',
          height: isMobile ? '100%' : 'min(800px, 90vh)',
          borderRadius: isMobile ? 0 : 16,
          overflow: 'hidden',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.95)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: isMobile ? 'none' : '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Image Area */}
        <div
          className="gallery-image-area"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0a0a0a',
            position: 'relative',
            overflow: 'hidden',
            minWidth: 0,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {!imageLoaded && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a0a',
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  border: '3px solid rgba(255,255,255,0.1)',
                  borderTopColor: 'rgba(255,255,255,0.6)',
                  borderRadius: '50%',
                  animation: 'ios-spin 0.8s linear infinite',
                }} />
              </div>
            )}

            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `translateY(${translateY}px) scale(${scale})`,
              transition: isSwipingY || startPinchDist ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              {isVideoUrl(currentImageUrl) ? (
                <VideoPlayer 
                  src={currentImageUrl} 
                  style={{ width: '100%', height: '100%', maxHeight: '100%' }} 
                  onEnded={handleNext}
                />
              ) : (
                <img
                  src={currentImageUrl}
                  alt=""
                  onLoad={() => setImageLoaded(true)}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    opacity: imageLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                  }}
                />
              )}
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); handlePrev() }}
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)' }}
                >
                  <Icon24ChevronLeft width={24} height={24} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleNext() }}
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)' }}
                >
                  <Icon24ChevronRight width={24} height={24} />
                </button>

                <div style={{
                  position: 'absolute',
                  top: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)',
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {currentIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>

          {/* Bottom action bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 5,
          }}>
            {isChannelPost ? (
              <>
                <div />
                <button
                  onClick={e => { e.stopPropagation(); handleDownload() }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: 12,
                    padding: '8px 16px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(8px)',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                  <Icon24Download width={20} height={20} />
                  <span>Скачать</span>
                </button>
              </>
            ) : (
              <>
                {postContext ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CustomAvatar size={32} src={postContext.author.avatar_url} name={postContext.author.full_name} id={postContext.author.id} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>
                        {postContext.author.full_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
                        {new Date(postContext.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ) : <div />}

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div 
                    className="gallery-like-container"
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    onMouseEnter={() => setShowMediaLikersTooltip(true)}
                    onMouseLeave={() => setShowMediaLikersTooltip(false)}
                  >
                    <button
                      onClick={handleToggleLike}
                      disabled={!profile}
                      style={{
                        background: isLiked ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: 12,
                        padding: '8px 14px',
                        color: isLiked ? '#ff3b30' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backdropFilter: 'blur(8px)',
                      }}
                      onMouseEnter={e => { if (!isLiked) e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
                      onMouseLeave={e => { if (!isLiked) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                    >
                      {isLiked ? <Icon28Like width={20} height={20} fill="#ff3b30" /> : <Icon28LikeOutline width={20} height={20} />}
                      {likeCount > 0 && <span>{likeCount}</span>}
                    </button>

                    {/* Стопка аватарок */}
                    {mediaLikers.length > 0 && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowMediaLikersTooltip(!showMediaLikersTooltip)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px 6px',
                          borderRadius: 12,
                          background: 'rgba(255,255,255,0.1)',
                          cursor: 'pointer',
                          height: 28,
                          boxSizing: 'border-box',
                          backdropFilter: 'blur(8px)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {mediaLikers.slice(0, 3).map((liker, idx) => (
                            <div 
                              key={liker.id}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                overflow: 'hidden',
                                border: '1.5px solid #1a1a1a',
                                marginLeft: idx > 0 ? -6 : 0,
                                zIndex: 10 - idx,
                                background: '#333',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 7,
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

                    {/* Всплывающий список лайкнувших */}
                    {showMediaLikersTooltip && mediaLikers.length > 0 && (
                      <div 
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: 0,
                          marginBottom: 8,
                          background: '#222222',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 14,
                          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                          padding: '8px 12px',
                          width: 'max-content',
                          minWidth: 160,
                          maxWidth: 240,
                          zIndex: 9999,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
                          Оценили:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                          {mediaLikers.map(liker => (
                            <div 
                              key={liker.id} 
                              onClick={(e) => { e.stopPropagation(); setShowMediaLikersTooltip(false); setIsOpen(false); selectProfile(liker.id); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                              <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: '#333', flexShrink: 0 }}>
                                {liker.avatar_url ? (
                                  <img src={liker.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#0077ff', color: '#fff', fontWeight: 'bold' }}>{liker.full_name?.charAt(0)}</span>
                                )}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{liker.full_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isMobile && !disableComments && (
                    <button
                      onClick={() => setShowComments(!showComments)}
                      style={{
                        background: showComments ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: 12,
                        padding: '8px 14px',
                        color: showComments ? '#007aff' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backdropFilter: 'blur(8px)',
                      }}
                      onMouseEnter={e => { if (!showComments) e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
                      onMouseLeave={e => { if (!showComments) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                    >
                      <Icon28CommentOutline width={20} height={20} />
                      {comments.length > 0 && <span>{comments.length}</span>}
                    </button>
                  )}

                  {!isMobile && (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); setNotification('скоро') }}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: 12,
                          padding: '8px 12px',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          outline: 'none',
                          transition: 'all 0.2s ease',
                          backdropFilter: 'blur(8px)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      >
                        <Icon24Share width={20} height={20} />
                      </button>

                      <button
                        onClick={e => { e.stopPropagation(); handleDownload() }}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: 12,
                          padding: '8px 12px',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          outline: 'none',
                          transition: 'all 0.2s ease',
                          backdropFilter: 'blur(8px)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      >
                        <Icon24Download width={20} height={20} />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Comments Panel */}
        {!disableComments && <div
          style={{
            width: isMobile ? '100%' : showComments ? 380 : 0,
            height: isMobile ? (showComments ? '50vh' : 0) : '100%',
            backgroundColor: '#1a1a1a',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: isMobile ? 'height 0.35s cubic-bezier(0.16, 1, 0.3, 1)' : 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0,
            borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
              Комментарии {comments.length > 0 && `(${comments.length})`}
            </span>
            {isMobile && (
              <button
                onClick={() => setShowComments(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  fontSize: 13,
                  outline: 'none',
                  padding: '4px 8px',
                }}
              >
                Скрыть
              </button>
            )}
          </div>

          {postContext && postContext.content && (
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <CustomAvatar size={32} src={postContext.author.avatar_url} name={postContext.author.full_name} id={postContext.author.id} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{postContext.author.full_name}</span>
                    <AdminBadge username={postContext.author.username} role={postContext.author.role} />
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1, display: 'block' }}>
                    {new Date(postContext.created_at).toLocaleString('ru-RU')}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                <FormattedText content={postContext.content} />
              </div>
            </div>
          )}

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                Нет комментариев
              </div>
            ) : (
              comments.map(c => {
                const isMyComment = profile && c.author.id === profile.id
                const canDelete = isMyComment || profile?.id === 'fee894db-c5b0-4022-bb9f-56c60decac86' || profile?.username === 'viht' || profile?.username === 'adm' || profile?.role === 'admin' || profile?.role === 'moderator' || (profile?.roles && (profile.roles.includes('admin') || profile.roles.includes('moderator') || profile.roles.includes('creator')))
                
                const replyMatch = c.content?.match(/^@([a-zA-Z0-9_.-]+),?\s+/)
                const isReply = !!replyMatch
                
                const renderCommentText = (content: string) => {
                  if (content.includes('sticker=true')) {
                    return (
                      <img 
                        src={content} 
                        alt="Стикер" 
                        style={{ 
                          maxWidth: 200, 
                          maxHeight: 200, 
                          width: 'auto',
                          height: 'auto',
                          objectFit: 'contain', 
                          display: 'block', 
                          marginTop: 4,
                          cursor: 'default',
                          userSelect: 'none'
                        }} 
                      />
                    )
                  }

                  if (replyMatch) {
                    const username = replyMatch[1]
                    const restText = content.substring(replyMatch[0].length)
                    if (restText.includes('sticker=true')) {
                      return (
                        <>
                          <span style={{ color: '#007aff', fontWeight: 600, marginRight: 4 }}>@{username}</span>
                          <img 
                            src={restText} 
                            alt="Стикер" 
                            style={{ 
                              maxWidth: 200, 
                              maxHeight: 200, 
                              width: 'auto',
                              height: 'auto',
                              objectFit: 'contain', 
                              display: 'block', 
                              marginTop: 4,
                              cursor: 'default',
                              userSelect: 'none'
                            }} 
                          />
                        </>
                      )
                    }
                    return (
                      <>
                        <span style={{ color: '#007aff', fontWeight: 600, marginRight: 4 }}>@{username}</span>
                        <FormattedText content={restText} />
                      </>
                    )
                  }
                  return <FormattedText content={content} />
                }

                return (
                  <div 
                    key={c.id} 
                    style={{ 
                      display: 'flex', 
                      gap: 10,
                      marginLeft: isReply ? '32px' : '0px',
                      borderLeft: isReply ? '2px solid rgba(255,255,255,0.08)' : 'none',
                      paddingLeft: isReply ? '10px' : '0px',
                      marginTop: isReply ? '-4px' : '0px'
                    }}
                    data-comment-id={c.id}
                    data-comment-post-id={postContext?.id || ''}
                    data-comment-photo-url={currentImageUrl || ''}
                    data-comment-content={c.content}
                    data-comment-author-id={c.author.id}
                    data-comment-is-photo={!postContext?.id ? 'true' : 'false'}
                  >
                    <CustomAvatar size={32} src={c.author.avatar_url} name={c.author.full_name} id={c.author.id} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{c.author.full_name}</span>
                        <AdminBadge username={c.author.username} role={c.author.role} />
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ff4530',
                              cursor: 'pointer',
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              outline: 'none',
                              marginLeft: 'auto',
                              opacity: 0.7,
                              transition: 'opacity 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                      <div style={{
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.85)',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '8px 12px',
                        borderRadius: '4px 12px 12px 12px',
                      }}>
                        {renderCommentText(c.content)}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        <button
                          onClick={() => {
                            setReplyingTo(c)
                            const name = c.author.username || c.author.full_name || 'id'
                            setNewCommentText(`@${name}, `)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#007aff',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '2px 0',
                            outline: 'none',
                          }}
                        >
                          Ответить
                        </button>

                        <span 
                          onClick={() => handleLikeGalleryComment(c.id)} 
                          style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: likedCommentIds[c.id] ? '#ff3b30' : 'rgba(255,255,255,0.4)' }}
                        >
                          {likedCommentIds[c.id] ? '❤️' : '♡'} {commentLikesCountMap[c.id] || 0}
                        </span>
                      </div>

                      {c.reactions && Object.keys(c.reactions).length > 0 && (
                        <ReactionBar
                          reactions={c.reactions}
                          myId={profile?.id || ''}
                          onReact={(emoji) => handleCommentReact(c.id, emoji)}
                        />
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={commentsEndRef} />
          </div>

          {profile && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(26,26,26,0.95)' }}>
              {replyingTo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px 8px 0 0', fontSize: 11, marginBottom: 4, color: 'rgba(255,255,255,0.6)' }}>
                  <span>Ответ пользователю {replyingTo.author.full_name}</span>
                  <span onClick={() => { setReplyingTo(null); setNewCommentText(''); }} style={{ cursor: 'pointer', fontWeight: 'bold', color: '#fff' }}>×</span>
                </div>
              )}
              <WriteBar
                value={newCommentText}
                onChange={e => setNewCommentText(e.target.value)}
                placeholder={editingComment ? 'Редактировать комментарий...' : 'Написать комментарий...'}
                style={{ borderRadius: replyingTo ? '0 0 12px 12px' : 12, backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff' }}
                after={
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <StickerPicker
                      onSelectSticker={handleSendStickerInComment}
                      placement="up"
                      customTrigger={
                        <WriteBarIcon aria-label="Стикеры">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </WriteBarIcon>
                      }
                    />
                    <EmojiPicker
                      onSelect={emoji => setNewCommentText(prev => prev + emoji)}
                      placement="up"
                      customTrigger={
                        <WriteBarIcon aria-label="Эмодзи">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                            <line x1="9" y1="9" x2="9.01" y2="9" />
                            <line x1="15" y1="9" x2="15.01" y2="9" />
                          </svg>
                        </WriteBarIcon>
                      }
                    />
                    <WriteBarIcon
                      mode="send"
                      onClick={() => handleAddComment()}
                      disabled={!newCommentText.trim()}
                      aria-label="Отправить комментарий"
                      style={{ color: newCommentText.trim() ? '#007aff' : 'rgba(255,255,255,0.3)' }}
                    >
                      <Icon28SendOutline />
                    </WriteBarIcon>
                  </div>
                }
              />
            </div>
          )}
        </div>}

        {isMobile && !showComments && !disableComments && (
          <button
            onClick={e => { e.stopPropagation(); setShowComments(true) }}
            style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              padding: '10px 20px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
              outline: 'none',
              zIndex: 10,
            }}
          >
            <Icon28CommentOutline width={20} height={20} />
            Комментарии {comments.length > 0 && `(${comments.length})`}
          </button>
        )}
      </div>

      <style>{`
        @keyframes galleryToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .gallery-comment-input::placeholder {
          color: rgba(255,255,255,0.35);
        }
        .gallery-comment-input:focus::placeholder {
          color: rgba(255,255,255,0.25);
        }
      `}</style>
    </div>
  )
}
