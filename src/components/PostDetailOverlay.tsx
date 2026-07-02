import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import {
  Icon28SendOutline,
  Icon28Play,
  Icon28Pause,
  Icon24Like,
  Icon24LikeOutline,
  Icon24CommentOutline
} from '@vkontakte/icons'
import { useMusicStore } from '../store/useMusicStore'
import {
  WriteBar,
  WriteBarIcon,
  Text,
  Spinner,
  IconButton,
  Button
} from '@vkontakte/vkui'
import { CustomAvatar } from './CustomAvatar'
import { AdminBadge } from './AdminBadge'
import { FormattedText } from './FormattedText'
import { EmojiPicker } from './EmojiPicker'
import { StickerPicker } from './StickerPicker'

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

interface PostAuthor {
  id: string
  full_name: string | null
  avatar_url: string | null
  username: string | null
  role?: string | null
}

interface PostDetail {
  id: string
  author_id: string
  content: string
  images: string[] | null
  likes_count: number
  comments_count: number
  views_count: number | null
  created_at: string
  audio_id?: string | null
  audio?: {
    id: string
    title: string
    artist: string
    duration: number
    file_url: string
    cover_url?: string | null
  } | null
  author: PostAuthor
}

interface PostComment {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
  reactions?: Record<string, string[]> | null
  author: PostAuthor
}

export const PostDetailOverlay: React.FC = () => {
  const { profile } = useAuthStore()
  const { selectProfile } = useAppStore()
  const { currentTrack, isPlaying } = useMusicStore()
  const [isOpen, setIsOpen] = useState(false)
  const [postId, setPostId] = useState<string | null>(null)
  const [post, setPost] = useState<PostDetail | null>(null)
  const [likers, setLikers] = useState<{ id: string; full_name: string | null; avatar_url: string | null }[]>([])
  const [showLikersTooltip, setShowLikersTooltip] = useState(false)

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
  const [comments, setComments] = useState<PostComment[]>([])
  const [isLiked, setIsLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [newCommentText, setNewCommentText] = useState('')
  const [loading, setLoading] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Comment Actions and Likes State
  const [replyingTo, setReplyingTo] = useState<PostComment | null>(null)
  const [editingComment, setEditingComment] = useState<PostComment | null>(null)
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({})
  const [commentLikesCount, setCommentLikesCount] = useState<Record<string, number>>({})

  useEffect(() => {
    const handleOpenPost = (e: Event) => {
      const customEvent = e as CustomEvent<{ postId: string }>
      if (customEvent.detail && customEvent.detail.postId) {
        setPostId(customEvent.detail.postId)
        setIsOpen(true)
      }
    }

    window.addEventListener('open-post', handleOpenPost)
    return () => window.removeEventListener('open-post', handleOpenPost)
  }, [])

  useEffect(() => {
    if (!isOpen || !postId) return
    let isSubscribed = true
    const fetchLikers = async () => {
      try {
        const { data, error } = await supabase
          .from('post_likes')
          .select('user_id, profiles(id, full_name, avatar_url)')
          .eq('post_id', postId)
          .limit(10)
        if (!isSubscribed) return
        if (error) throw error
        if (data) {
          const users = data.map((item: any) => item.profiles).filter(Boolean)
          setLikers(users)
        }
      } catch (err) {
        console.error('Error fetching likers in overlay:', err)
      }
    }
    fetchLikers()
    return () => { isSubscribed = false }
  }, [isOpen, postId])

  useEffect(() => {
    if (!isOpen || !postId || !profile) return

    const loadPostData = async () => {
      setLoading(true)
      try {
        // 1. Fetch Post Detail
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select('*, author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role), audio:music_tracks(id, title, artist, duration, file_url, cover_url)')
          .eq('id', postId)
          .single()

        if (postError) throw postError
        setPost(postData as unknown as PostDetail)
        setLikesCount(postData.likes_count || 0)

        // 2. Increment Views Count
        await supabase
          .from('posts')
          .update({ views_count: (postData.views_count || 0) + 1 })
          .eq('id', postId)
        
        setPost(prev => prev ? { ...prev, views_count: (prev.views_count || 0) + 1 } : null)

        // 3. Fetch Comments
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('*, author:profiles(id, full_name, avatar_url, username, role)')
          .eq('post_id', postId)
          .order('created_at', { ascending: true })

        if (commentsError) throw commentsError
        const commentsList = commentsData as unknown as PostComment[]
        setComments(commentsList)

        if (commentsList.length > 0) {
          const commentIds = commentsList.map(c => c.id)
          const { data: likes, error: likesError } = await supabase
            .from('comment_likes')
            .select('comment_id, user_id')
            .in('comment_id', commentIds)

          const countsMap: Record<string, number> = {}
          const likedMap: Record<string, boolean> = {}

          // Инициализируем нулями
          commentIds.forEach(id => {
            countsMap[id] = 0
            likedMap[id] = false
          })

          if (!likesError && likes) {
            likes.forEach((l: any) => {
              countsMap[l.comment_id] = (countsMap[l.comment_id] || 0) + 1
              if (profile && l.user_id === profile.id) {
                likedMap[l.comment_id] = true
              }
            })
          }
          setCommentLikesCount(countsMap)
          setLikedComments(likedMap)
        }

        // 4. Check if Liked by current user
        const { data: likeData } = await supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', profile.id)
          .maybeSingle()

        setIsLiked(!!likeData)
      } catch (err) {
        console.error('Error loading post details:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPostData()
  }, [isOpen, postId, profile])

  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments])

  const handleLike = async () => {
    if (!profile || !post) return
    const wasLiked = isLiked
    const newLiked = !wasLiked
    setIsLiked(newLiked)
    setLikesCount(prev => prev + (newLiked ? 1 : -1))

    // Мгновенное онлайн обновление списка лайкнувших в оверлее
    if (wasLiked) {
      setLikers(prev => prev.filter(x => x.id !== profile.id))
    } else {
      const myUser = {
        id: profile.id,
        full_name: profile.full_name || 'Я',
        avatar_url: profile.avatar_url
      }
      setLikers(prev => {
        if (prev.some(x => x.id === profile.id)) return prev
        return [myUser, ...prev]
      })
    }

    try {
      if (wasLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', profile.id)
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: profile.id })
      }
    } catch (err) {
      console.error('Like error:', err)
      // Revert state
      setIsLiked(wasLiked)
      setLikesCount(prev => prev + (wasLiked ? 1 : -1))
      if (wasLiked) {
        const myUser = {
          id: profile.id,
          full_name: profile.full_name || 'Я',
          avatar_url: profile.avatar_url
        }
        setLikers(prev => [myUser, ...prev])
      } else {
        setLikers(prev => prev.filter(x => x.id !== profile.id))
      }
    }
  }

  const handleSendStickerInComment = async (stickerUrl: string) => {
    if (!profile || !post) return
    const text = stickerUrl + '?sticker=true'
    const replyText = replyingTo ? `@${replyingTo.author.username || replyingTo.author.full_name}, ${text}` : text
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: post.id,
          author_id: profile.id,
          content: replyText
        })
        .select('*, author:profiles(id, full_name, avatar_url, username, role)')
        .single()

      if (error) throw error
      if (data) {
        setComments(prev => [...prev, data as unknown as PostComment])
        setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : null)
      }
    } catch (err) {
      console.error('Error sending sticker comment:', err)
    }
  }

  const handleAddComment = async () => {
    if (!profile || !post || !newCommentText.trim() || submittingComment) return
    const text = newCommentText.trim()
    setNewCommentText('')
    setSubmittingComment(true)
    setReplyingTo(null)

    try {
      if (editingComment) {
        const { error } = await supabase
          .from('comments')
          .update({ content: text })
          .eq('id', editingComment.id)
        if (error) throw error
        setComments(prev => prev.map(c => c.id === editingComment.id ? { ...c, content: text } : c))
        setEditingComment(null)
      } else {
        const { data, error } = await supabase
          .from('comments')
          .insert({
            post_id: post.id,
            author_id: profile.id,
            content: text
          })
          .select('*, author:profiles(id, full_name, avatar_url, username, role)')
          .single()

        if (error) throw error
        if (data) {
          setComments(prev => [...prev, data as unknown as PostComment])
          setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : null)
        }
      }
    } catch (err) {
      console.error('Error adding/editing comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleLikeComment = async (commentId: string) => {
    if (!profile) return
    const isLiked = !!likedComments[commentId]
    const currentLikes = commentLikesCount[commentId] || 0

    setLikedComments(prev => ({ ...prev, [commentId]: !isLiked }))
    setCommentLikesCount(prev => ({ ...prev, [commentId]: currentLikes + (isLiked ? -1 : 1) }))

    try {
      if (isLiked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', profile.id)
      } else {
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: profile.id })
      }
    } catch (err) {
      console.error('Error liking comment:', err)
      setLikedComments(prev => ({ ...prev, [commentId]: isLiked }))
      setCommentLikesCount(prev => ({ ...prev, [commentId]: currentLikes }))
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
      await supabase.from('comments').update({ reactions }).eq('id', commentId)
    } catch (err) {
      console.error('Error updating comment reaction:', err)
      // Revert if error
      const { data: commentsData } = await supabase
        .from('comments')
        .select('*, author:profiles(id, full_name, avatar_url, username, role)')
        .eq('post_id', postId || '')
        .order('created_at', { ascending: true })
      if (commentsData) setComments(commentsData as unknown as PostComment[])
    }
  }

  useEffect(() => {
    const handleReactCommentEvent = async (e: Event) => {
      const { id, emoji, isPhoto } = (e as CustomEvent).detail
      if (isPhoto) return
      const hasComment = comments.some(c => c.id === id)
      if (!hasComment) return
      await handleCommentReact(id, emoji)
    }

    const handleReplyCommentEvent = (e: Event) => {
      const { id, postId: replyPostId } = (e as CustomEvent).detail
      if (replyPostId !== postId) return
      const cmt = comments.find(c => c.id === id)
      if (cmt) {
        setReplyingTo(cmt)
        setNewCommentText(`@${cmt.author.username || cmt.author.full_name}, `)
      }
    }

    const handleEditCommentEvent = (e: Event) => {
      const { id, postId: editPostId } = (e as CustomEvent).detail
      if (editPostId !== postId) return
      const cmt = comments.find(c => c.id === id)
      if (cmt) {
        setEditingComment(cmt)
        setNewCommentText(cmt.content)
      }
    }

    const handleDeleteCommentEvent = (e: Event) => {
      const { id, postId: deletePostId } = (e as CustomEvent).detail
      if (deletePostId !== postId) return
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
  }, [comments, postId])

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error
      setComments(prev => prev.filter(c => c.id !== commentId))
      setPost(prev => prev ? { ...prev, comments_count: Math.max(0, prev.comments_count - 1) } : null)
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  const handleImageClick = (imagesList: string[], index: number, postContext?: any) => {
    window.dispatchEvent(
      new CustomEvent('open-gallery', {
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
      })
    )
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out'
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          background: 'var(--vkui--color_background_content)',
          width: '100%',
          maxWidth: '680px',
          height: '85vh',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--vkui--color_separator_primary_alpha)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Text weight="2" style={{ fontSize: 16 }}>Запись</Text>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--vkui--color_text_secondary)',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content & Comments */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 12 }}>
              <Spinner size="m" />
              <Text style={{ color: 'var(--vkui--color_text_secondary)' }}>Загрузка записи...</Text>
            </div>
          ) : !post ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <Text style={{ color: 'var(--vkui--color_text_secondary)' }}>Запись не найдена или удалена.</Text>
            </div>
          ) : (
            <>
              {/* Post Container */}
              <div className="post-detail-card" style={{ padding: '20px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha)' }}>
                {/* Author Info */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                  <CustomAvatar size={44} src={post.author.avatar_url} name={post.author.full_name} id={post.author.id} />
                  <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{post.author.full_name}</span>
                      <AdminBadge username={post.author.username} role={post.author.role} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', marginTop: 2 }}>
                      {new Date(post.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Post Content */}
                <div style={{ fontSize: 15, lineHeight: '1.5', textAlign: 'left', marginBottom: 14, wordBreak: 'break-word' }}>
                  <FormattedText content={post.content} />
                </div>

                {/* Post Images Grid */}
                {post.images && post.images.length > 0 && (
                  <div
                    className={`post-images-grid ${post.images.length <= 10 ? `grid-${post.images.length}` : 'grid-generic'}`}
                    style={{ marginBottom: 14, borderRadius: 8, overflow: 'hidden' }}
                  >
                    {post.images.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="post-image-item"
                        onClick={() => handleImageClick(post.images!, i, post)}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                )}

                {/* Audio rendering */}
                {post.audio && (
                  <div 
                    onClick={(e) => { e.stopPropagation(); handlePlayAudio(post.audio); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--vkui--color_background_secondary_alpha, rgba(255,255,255,0.03))',
                      border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))',
                      cursor: 'pointer',
                      marginBottom: 14,
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--vkui--color_background_secondary, rgba(255,255,255,0.08))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--vkui--color_background_secondary_alpha, rgba(255,255,255,0.03))'}
                  >
                    {/* Play/Pause icon or cover */}
                    <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#1c1c1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {post.audio.cover_url ? (
                        <img src={post.audio.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                        {currentTrack?.id === post.audio.id && isPlaying ? (
                          <Icon28Pause width={22} height={22} fill="#fff" />
                        ) : (
                          <Icon28Play width={22} height={22} fill="#fff" style={{ marginLeft: 2 }} />
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {post.audio.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                        {post.audio.artist}
                      </div>
                    </div>

                    {/* Duration */}
                    <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.floor(post.audio.duration / 60)}:{(post.audio.duration % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div 
                      className="post-like-container"
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      onMouseEnter={() => setShowLikersTooltip(true)}
                      onMouseLeave={() => setShowLikersTooltip(false)}
                    >
                      <IconButton onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-label="Нравится">
                        {isLiked ? <Icon24Like fill="var(--vkui--color_icon_accent)" /> : <Icon24LikeOutline />}
                        <Text style={{ fontSize: 13.5, fontWeight: 500 }}>{likesCount}</Text>
                      </IconButton>

                      {/* Стопка аватарок */}
                      {likers.length > 0 && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowLikersTooltip(!showLikersTooltip)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px 6px',
                            borderRadius: 12,
                            background: 'var(--vkui--color_background_secondary_alpha, rgba(255,255,255,0.02))',
                            cursor: 'pointer',
                            marginRight: 4,
                            height: 28,
                            boxSizing: 'border-box'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {likers.slice(0, 3).map((liker, idx) => (
                              <div 
                                key={liker.id}
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  border: '1.5px solid var(--vkui--color_background_content)',
                                  marginLeft: idx > 0 ? -6 : 0,
                                  zIndex: 10 - idx,
                                  background: 'var(--vkui--color_background_secondary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 7,
                                  fontWeight: 'bold',
                                  color: 'var(--vkui--color_text_secondary)'
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
                      {showLikersTooltip && likers.length > 0 && (
                        <div 
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: 0,
                            marginBottom: 8,
                            background: 'var(--vkui--color_background_modal, var(--vkui--color_background_content, #ffffff))',
                            border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.12))',
                            borderRadius: 14,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
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
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha)', paddingBottom: 4 }}>
                            Оценили:
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                            {likers.map(liker => (
                              <div 
                                key={liker.id} 
                                onClick={(e) => { e.stopPropagation(); setShowLikersTooltip(false); setIsOpen(false); selectProfile(liker.id); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                              >
                                <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: '#ccc', flexShrink: 0 }}>
                                  {liker.avatar_url ? (
                                    <img src={liker.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#0077ff', color: '#fff', fontWeight: 'bold' }}>{liker.full_name?.charAt(0)}</span>
                                  )}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{liker.full_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--vkui--color_text_secondary)', padding: '0 8px' }}>
                      <Icon24CommentOutline style={{ width: 20, height: 20 }} />
                      <Text style={{ fontSize: 13.5, fontWeight: 500 }}>{post.comments_count}</Text>
                    </div>
                  </div>

                  {/* Views */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--vkui--color_text_secondary)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <Text style={{ fontSize: 13, fontWeight: 500 }}>{post.views_count || 0}</Text>
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Text weight="2" style={{ fontSize: 14, textAlign: 'left', color: 'var(--vkui--color_text_secondary)' }}>Комментарии</Text>
                
                {comments.length === 0 ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--vkui--color_text_secondary)' }}>
                    Нет комментариев. Будьте первым!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {comments.map(c => {
                      const isMyComment = profile && c.author.id === profile.id
                      const replyMatch = c.content?.match(/^@([a-zA-Z0-9_.-]+),?\s+/)

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
                          style={{ display: 'flex', gap: 10, textAlign: 'left' }}
                          data-comment-id={c.id}
                          data-comment-post-id={postId}
                          data-comment-content={c.content}
                          data-comment-author-id={c.author.id}
                          data-comment-is-photo="false"
                        >
                          <CustomAvatar size={32} src={c.author.avatar_url} name={c.author.full_name} id={c.author.id} />
                          <div style={{ flex: 1, background: 'var(--vkui--color_background_secondary)', padding: '8px 12px', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Text weight="2" style={{ fontSize: 13 }}>{c.author.full_name}</Text>
                                <AdminBadge username={c.author.username} role={c.author.role} />
                              </div>
                              {(isMyComment || profile?.id === 'fee894db-c5b0-4022-bb9f-56c60decac86' || profile?.username === 'viht' || profile?.username === 'adm' || profile?.role === 'admin' || profile?.role === 'moderator' || (profile?.roles && (profile.roles.includes('admin') || profile.roles.includes('moderator') || profile.roles.includes('creator')))) && (
                                <button
                                  onClick={() => handleDeleteComment(c.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--vkui--color_text_negative)',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    padding: '0 4px'
                                  }}
                                >
                                  Удалить
                                </button>
                              )}
                            </div>
                            <div style={{ fontSize: 13, marginTop: 4, color: 'var(--vkui--color_text_primary)' }}>
                              {renderCommentText(c.content)}
                            </div>
                            
                            <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
                              <Button 
                                mode="tertiary" 
                                size="s" 
                                onClick={() => {
                                  setReplyingTo(c)
                                  setNewCommentText(`@${c.author.username || c.author.full_name}, `)
                                }}
                                style={{ padding: 0, height: 'auto', minHeight: 'auto', fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}
                              >
                                Ответить
                              </Button>

                              <span 
                                onClick={() => handleLikeComment(c.id)} 
                                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: likedComments[c.id] ? 'var(--vkui--color_icon_accent)' : 'var(--vkui--color_text_secondary)' }}
                              >
                                {likedComments[c.id] ? '❤️' : '♡'} {commentLikesCount[c.id] || 0}
                              </span>
                              
                              <span style={{ fontSize: 10, color: 'var(--vkui--color_text_secondary)' }}>
                                {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    })}
                    <div ref={commentsEndRef} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer: Add Comment */}
        {post && !loading && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--vkui--color_separator_primary_alpha)' }}>
            {replyingTo && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', background: 'var(--vkui--color_background_secondary)', borderRadius: '8px 8px 0 0', fontSize: 11, marginBottom: 4 }}>
                <span>Ответ пользователю {replyingTo.author.full_name}</span>
                <span onClick={() => { setReplyingTo(null); setNewCommentText(''); }} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
              </div>
            )}
            <WriteBar
              value={newCommentText}
              onChange={e => setNewCommentText(e.target.value)}
              placeholder={editingComment ? 'Редактировать комментарий...' : 'Написать комментарий...'}
              style={{ borderRadius: replyingTo ? '0 0 12px 12px' : 12 }}
              after={
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <StickerPicker
                    onSelectSticker={handleSendStickerInComment}
                    placement="up"
                    customTrigger={
                      <WriteBarIcon aria-label="Стикеры">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--vkui--color_icon_medium)' }}>
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
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--vkui--color_icon_medium)' }}>
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
                    onClick={handleAddComment}
                    disabled={!newCommentText.trim() || submittingComment}
                    aria-label="Отправить комментарий"
                  >
                    <Icon28SendOutline />
                  </WriteBarIcon>
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
