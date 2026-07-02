import React, { useEffect, useState, useRef } from 'react'
import {
  SimpleCell,
  Box,
  Text,
  IconButton,
  Button,
  Spinner,
  WriteBar,
  WriteBarIcon
} from '@vkontakte/vkui'
import {
  Icon28MoreHorizontal,
  Icon28UsersOutline,
  Icon28SendOutline,
  Icon28Play,
  Icon28Pause,
  Icon24LikeOutline,
  Icon24Like,
  Icon24CommentOutline,
  Icon24ShareOutline,
  Icon24BookmarkOutline,
  Icon24Bookmark
} from '@vkontakte/icons'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { useMusicStore } from '../store/useMusicStore'
import { AdminBadge } from './AdminBadge'
import { FormattedText } from './FormattedText'
import { CustomAvatar } from './CustomAvatar'
import { EmojiPicker } from './EmojiPicker'
import { StickerPicker } from './StickerPicker'

export interface Post {
  id: string
  content: string
  images: string[] | null
  likes_count: number
  comments_count: number
  views_count?: number
  created_at: string
  group_id?: string | null
  poll_id?: string | null
  repost_source_id?: string | null
  audio_id?: string | null
  audio?: {
    id: string
    title: string
    artist: string
    duration: number
    file_url: string
    cover_url?: string | null
  } | null
  by_group?: boolean
  group?: {
    id: string
    name: string
    avatar_url: string | null
  } | null
  author: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
    role?: string | null
    emoji_status?: string | null
    avatar_decoration?: string | null
  }
  isDeleting?: boolean
  repost_source?: Post | null
  poll?: {
    id: string
    question: string
    options: {
      id: string
      poll_id: string
      text: string
      votes_count: number
    }[]
  } | null
  reactions?: Record<string, string[]> | null
}

interface Comment {
  id: string
  content: string
  created_at: string
  likes_count?: number
  reactions?: Record<string, string[]> | null
  author: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
    role?: string | null
    emoji_status?: string | null
    avatar_decoration?: string | null
  }
}

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

interface CommentItemProps {
  c: Comment
  liked: boolean
  commentLikes: number
  isReply: boolean
  postId: string
  onLike: (commentId: string) => void
  onReply: (c: Comment) => void
  onReactComment: (commentId: string, emoji: string) => void
  onContextMenu: (e: React.MouseEvent, c: Comment) => void
  onAuthorClick: (authorId: string) => void
  selectProfile: (id: string) => void
}

const CommentItem: React.FC<CommentItemProps> = ({
  c,
  liked,
  commentLikes,
  isReply,
  postId,
  onLike,
  onReply,
  onReactComment,
  onContextMenu,
  onAuthorClick,
  selectProfile
}) => {
  const { profile } = useAuthStore()
  const [likers, setLikers] = useState<{ id: string; full_name: string | null; avatar_url: string | null }[]>([])
  const [showTooltip, setShowTooltip] = useState(false)
  const isFirstRender = useRef(true)

  useEffect(() => {
    let isSubscribed = true
    const fetchLikers = async () => {
      try {
        const { data, error } = await supabase
          .from('comment_likes_users')
          .select('user_id, profiles(id, full_name, avatar_url)')
          .eq('comment_id', c.id)
          .limit(5)
        if (!isSubscribed) return
        if (error) throw error
        if (data) {
          const users = data.map((item: any) => item.profiles).filter(Boolean)
          setLikers(users)
        }
      } catch (err) {
        console.error('Error fetching comment likers:', err)
      }
    }
    fetchLikers()
    return () => { isSubscribed = false }
  }, [c.id])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (!profile) return

    if (liked) {
      const myUser = {
        id: profile.id,
        full_name: profile.full_name || 'Я',
        avatar_url: profile.avatar_url
      }
      setLikers(prev => {
        if (prev.some(x => x.id === profile.id)) return prev
        return [myUser, ...prev]
      })
    } else {
      setLikers(prev => prev.filter(x => x.id !== profile.id))
    }
  }, [liked])

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
      className="post-comment-row"
      style={{
        marginLeft: isReply ? '28px' : '0px',
        borderLeft: isReply ? '2px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))' : 'none',
        paddingLeft: isReply ? '10px' : '0px',
        marginTop: isReply ? '-4px' : '0px'
      }}
      onContextMenu={(e) => onContextMenu(e, c)}
      data-comment-id={c.id}
      data-comment-post-id={postId}
      data-comment-content={c.content}
      data-comment-author-id={c.author.id}
      data-comment-is-photo="false"
    >
      <CustomAvatar size={isReply ? 26 : 32} src={c.author.avatar_url} name={c.author.full_name} id={c.author.id} decoration={c.author.avatar_decoration} />
      <div className="post-comment-bubble" style={{ padding: '6px 10px', borderRadius: isReply ? '4px 10px 10px 10px' : '10px', flex: 1 }}>
        <div className="post-comment-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="post-comment-author-name" onClick={() => onAuthorClick(c.author.id)} style={{ fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              {c.author.full_name}
              {c.author.emoji_status && (
                <span style={{ fontSize: 14, marginLeft: 4 }} title="Эмодзи-статус">{c.author.emoji_status}</span>
              )}
            </span>
            <AdminBadge username={c.author.username} role={c.author.role} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--vkui--color_text_secondary)' }}>
            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--vkui--color_text_primary)', marginTop: 4, textAlign: 'left' }}>
          {renderCommentText(c.content)}
        </div>
        
        <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
          <Button 
            mode="tertiary" 
            size="s" 
            onClick={() => onReply(c)}
            style={{ padding: 0, height: 'auto', minHeight: 'auto', fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}
          >
            Ответить
          </Button>

          {/* Лайк комментария и стопка аватарок */}
          <div 
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <span 
              onClick={() => onLike(c.id)} 
              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: liked ? 'var(--vkui--color_icon_accent)' : 'var(--vkui--color_text_secondary)' }}
            >
              {liked ? '❤️' : '♡'} {commentLikes}
            </span>

            {likers.length > 0 && (
              <div 
                onClick={(e) => {
                  e.stopPropagation()
                  setShowTooltip(!showTooltip)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                {likers.slice(0, 2).map((liker, idx) => (
                  <div 
                    key={liker.id}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '1px solid var(--vkui--color_background_content)',
                      marginLeft: idx > 0 ? -4 : 2,
                      zIndex: 10 - idx,
                      background: 'var(--vkui--color_background_secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 5,
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
            )}

            {/* Всплывающий список лайкнувших комментарий */}
            {showTooltip && likers.length > 0 && (
              <div 
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: 6,
                  background: 'var(--vkui--color_background_modal, var(--vkui--color_background_content, #ffffff))',
                  border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.12))',
                  borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  padding: '6px 8px',
                  width: 'max-content',
                  minWidth: 120,
                  maxWidth: 200,
                  zIndex: 9999,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  animation: 'scaleIn 0.12s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {likers.map(liker => (
                    <div 
                      key={liker.id} 
                      onClick={(e) => { e.stopPropagation(); setShowTooltip(false); selectProfile(liker.id); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      <div style={{ width: 14, height: 14, borderRadius: '50%', overflow: 'hidden', background: '#ccc', flexShrink: 0 }}>
                        {liker.avatar_url ? (
                          <img src={liker.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#0077ff', color: '#fff', fontWeight: 'bold' }}>{liker.full_name?.charAt(0)}</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{liker.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {c.reactions && Object.keys(c.reactions).length > 0 && (
          <ReactionBar
            reactions={c.reactions}
            myId={profile?.id || ''}
            onReact={(emoji) => onReactComment(c.id, emoji)}
          />
        )}
      </div>
    </div>
  )
}

interface PostCardProps {
  post: Post
  onDeleteSuccess?: (postId: string) => void
  onImageClick?: (images: string[], index: number, post: any) => void
  onShareClick?: (post: Post) => void
  commentsDisabled?: boolean
  isAdmin?: boolean
  hideGroupBadge?: boolean
  hideBookmark?: boolean
  isChannel?: boolean
}

export const PostCard: React.FC<PostCardProps> = ({ 
  post: initialPost, 
  onDeleteSuccess, 
  onImageClick,
  onShareClick,
  commentsDisabled = false,
  isAdmin = false,
  hideGroupBadge = false,
  hideBookmark = false,
  isChannel = false
}) => {
  const { profile } = useAuthStore()
  const { selectProfile, selectGroup } = useAppStore()
  const { currentTrack, isPlaying } = useMusicStore()

  const [post, setPost] = useState<Post>(initialPost)
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const [isEditingPost, setIsEditingPost] = useState(false)
  const [editPostContent, setEditPostContent] = useState(post.content)
  const [likers, setLikers] = useState<{ id: string; full_name: string | null; avatar_url: string | null }[]>([])
  const [showLikersTooltip, setShowLikersTooltip] = useState(false)
  
  // Comments state
  const [commentsExpanded, setCommentsExpanded] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null)
  const [editingComment, setEditingComment] = useState<Comment | null>(null)
  
  // Likes and mutes
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({})
  const [commentLikesCount, setCommentLikesCount] = useState<Record<string, number>>({})

  // Poll state
  const [userVoteOptionId, setUserVoteOptionId] = useState<string | null>(null)
  const [pollOptions, setPollOptions] = useState<any[]>(post.poll?.options || [])
  const [totalVotes, setTotalVotes] = useState(0)

  // Dropdowns/menus
  const [postMenuCoords, setPostMenuCoords] = useState<{ x: number; y: number } | null>(null)
  const [commentMenu, setCommentMenu] = useState<{ x: number; y: number; comment: Comment } | null>(null)

  useEffect(() => {
    setPost(initialPost)
    setLikesCount(initialPost.likes_count)
    if (initialPost.poll?.options) {
      setPollOptions(initialPost.poll.options)
      setTotalVotes(initialPost.poll.options.reduce((sum, o) => sum + (o.votes_count || 0), 0))
    }
  }, [initialPost])

  // Check initial like, bookmark and poll vote states
  useEffect(() => {
    if (!profile) return

    const checkStates = async () => {
      // Like
      const { data: like } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', profile.id)
        .maybeSingle()
      setIsLiked(!!like)

      // Bookmark
      const { data: bookmark } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', profile.id)
        .maybeSingle()
      setIsBookmarked(!!bookmark)

      // Poll vote
      if (post.poll_id) {
        const { data: vote } = await supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', post.poll_id)
          .eq('user_id', profile.id)
          .maybeSingle()
        if (vote) {
          setUserVoteOptionId(vote.option_id)
        }
      }
    }

    checkStates()
  }, [post.id, post.poll_id, profile])

  // Realtime view count incrementer (runs once on mount per user-post pair)
  useEffect(() => {
    if (!profile || !post.id) return

    const markAsViewed = async () => {
      try {
        const { error } = await supabase
          .from('post_views')
          .upsert({ post_id: post.id, user_id: profile.id }, { onConflict: 'post_id,user_id' })
        
        if (!error) {
          setPost(prev => ({ ...prev, views_count: (prev.views_count || 0) + 1 }))
          
          if (post.group_id) {
            const groupChan = supabase.channel(`group:${post.group_id}`)
            groupChan.send({
              type: 'broadcast',
              event: 'post-view-increment',
              payload: { postId: post.id }
            }).then((status) => {
              if (status !== 'ok') {
                groupChan.subscribe((subStatus) => {
                  if (subStatus === 'SUBSCRIBED') {
                    groupChan.send({
                      type: 'broadcast',
                      event: 'post-view-increment',
                      payload: { postId: post.id }
                    })
                  }
                })
              }
            })
          }
        }
      } catch (err) {
        // Ignored
      }
    }

    const timer = setTimeout(markAsViewed, 500)
    return () => clearTimeout(timer)
  }, [post.id, profile?.id])

  useEffect(() => {
    const fetchLikers = async () => {
      try {
        const { data, error } = await supabase
          .from('post_likes')
          .select('user_id, profiles(id, full_name, avatar_url)')
          .eq('post_id', post.id)
          .limit(10)

        if (error) throw error
        if (data) {
          const users = data
            .map((item: any) => item.profiles)
            .filter(Boolean)
          setLikers(users)
        }
      } catch (err) {
        console.error('Error fetching likers:', err)
      }
    }
    fetchLikers()
  }, [post.id])

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

  const handleLike = async () => {
    if (!profile) return
    const prevLiked = isLiked
    const prevCount = likesCount

    setIsLiked(!prevLiked)
    setLikesCount(prevCount + (prevLiked ? -1 : 1))

    // Мгновенное онлайн обновление списка лайкнувших
    if (prevLiked) {
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
      if (prevLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', profile.id)
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: profile.id })
        
        // Notify author
        if (post.author.id !== profile.id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: post.author.id,
              type: 'like',
              from_user_id: profile.id,
              post_id: post.id
            })
        }
      }
    } catch (err) {
      console.error('Error liking post:', err)
      setIsLiked(prevLiked)
      setLikesCount(prevCount)
    }
  }

  const handleToggleBookmark = async () => {
    if (!profile) return
    const prevBookmarked = isBookmarked
    setIsBookmarked(!prevBookmarked)

    try {
      if (prevBookmarked) {
        await supabase
          .from('bookmarks')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', profile.id)
      } else {
        await supabase
          .from('bookmarks')
          .insert({ post_id: post.id, user_id: profile.id })
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err)
      setIsBookmarked(prevBookmarked)
    }
  }

  const handlePollVote = async (optionId: string) => {
    if (!profile || !post.poll_id) return
    setUserVoteOptionId(optionId)
    setPollOptions(prev => prev.map(o => o.id === optionId ? { ...o, votes_count: (o.votes_count || 0) + 1 } : o))
    setTotalVotes(prev => prev + 1)

    try {
      await supabase
        .from('poll_votes')
        .insert({ poll_id: post.poll_id, option_id: optionId, user_id: profile.id })
    } catch (err) {
      console.error('Error casting vote:', err)
    }
  }

  const handleRetractPollVote = async () => {
    if (!profile || !post.poll_id || !userVoteOptionId) return
    const prevOptionId = userVoteOptionId
    setUserVoteOptionId(null)
    setPollOptions(prev => prev.map(o => o.id === prevOptionId ? { ...o, votes_count: Math.max(0, (o.votes_count || 0) - 1) } : o))
    setTotalVotes(prev => Math.max(0, prev - 1))

    try {
      await supabase
        .from('poll_votes')
        .delete()
        .eq('poll_id', post.poll_id)
        .eq('user_id', profile.id)
    } catch (err) {
      console.error('Error retracting vote:', err)
    }
  }

  const loadComments = async () => {
    setLoadingComments(true)
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!comments_author_id_fkey(id, full_name, avatar_url, username, role, emoji_status, avatar_decoration)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])

      // Load comment likes
      if (data && data.length > 0) {
        const commentIds = data.map(c => c.id)
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
    } catch (err) {
      console.error('Error loading comments:', err)
    } finally {
      setLoadingComments(false)
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
      loadComments()
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
      const { id, postId } = (e as CustomEvent).detail
      if (postId !== post.id) return
      const cmt = comments.find(c => c.id === id)
      if (cmt) {
        setReplyingTo(cmt)
        setCommentInput(`@${cmt.author.username || cmt.author.full_name}, `)
      }
    }

    const handleEditCommentEvent = (e: Event) => {
      const { id, postId } = (e as CustomEvent).detail
      if (postId !== post.id) return
      const cmt = comments.find(c => c.id === id)
      if (cmt) {
        handleStartEditComment(cmt)
      }
    }

    const handleDeleteCommentEvent = (e: Event) => {
      const { id, postId } = (e as CustomEvent).detail
      if (postId !== post.id) return
      handleDeleteComment(id)
    }

    const handleReactPostEvent = async (e: Event) => {
      const { id, emoji } = (e as CustomEvent).detail
      if (id !== post.id) return
      await handlePostReact(emoji)
    }

    const handleEditChannelPostEvent = (e: Event) => {
      const { id } = (e as CustomEvent).detail
      if (id === post.id) setIsEditingPost(true)
    }

    const handleDeleteChannelPostEvent = (e: Event) => {
      const { id } = (e as CustomEvent).detail
      if (id === post.id) handleDeletePost()
    }

    window.addEventListener('react-comment', handleReactCommentEvent)
    window.addEventListener('reply-comment', handleReplyCommentEvent)
    window.addEventListener('edit-comment', handleEditCommentEvent)
    window.addEventListener('delete-comment', handleDeleteCommentEvent)
    window.addEventListener('react-post', handleReactPostEvent)
    window.addEventListener('edit-channel-post', handleEditChannelPostEvent)
    window.addEventListener('delete-channel-post', handleDeleteChannelPostEvent)

    return () => {
      window.removeEventListener('react-comment', handleReactCommentEvent)
      window.removeEventListener('reply-comment', handleReplyCommentEvent)
      window.removeEventListener('edit-comment', handleEditCommentEvent)
      window.removeEventListener('delete-comment', handleDeleteCommentEvent)
      window.removeEventListener('react-post', handleReactPostEvent)
      window.removeEventListener('edit-channel-post', handleEditChannelPostEvent)
      window.removeEventListener('delete-channel-post', handleDeleteChannelPostEvent)
    }
  }, [comments, post.id, post.reactions, profile?.id])

  const handleToggleComments = () => {
    const nextState = !commentsExpanded
    setCommentsExpanded(nextState)
    if (nextState) {
      loadComments()
    }
  }

  const handleSendStickerInComment = async (stickerUrl: string) => {
    if (!profile) return
    const text = stickerUrl + '?sticker=true'
    const replyText = replyingTo ? `@${replyingTo.author.username || replyingTo.author.full_name}, ${text}` : text
    setReplyingTo(null)

    try {
      const { data: newComment, error } = await supabase
        .from('comments')
        .insert({
          post_id: post.id,
          author_id: profile.id,
          content: replyText
        })
        .select('*, author:profiles!comments_author_id_fkey(id, full_name, avatar_url, username, role, emoji_status, avatar_decoration)')
        .single()

      if (error) throw error

      setComments(prev => [...prev, newComment])
      setPost(prev => ({ ...prev, comments_count: prev.comments_count + 1 }))

      // Notify post author
      if (post.author.id !== profile.id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: post.author.id,
            type: 'comment',
            from_user_id: profile.id,
            post_id: post.id
          })
      }
    } catch (err) {
      console.error('Error sending sticker comment:', err)
    }
  }

  const handleAddComment = async () => {
    if (!profile || !commentInput.trim()) return
    const text = commentInput.trim()
    setCommentInput('')
    setReplyingTo(null)

    try {
      const { data: newComment, error } = await supabase
        .from('comments')
        .insert({
          post_id: post.id,
          author_id: profile.id,
          content: text
        })
        .select('*, author:profiles!comments_author_id_fkey(id, full_name, avatar_url, username, role, emoji_status, avatar_decoration)')
        .single()

      if (error) throw error

      setComments(prev => [...prev, newComment])
      setPost(prev => ({ ...prev, comments_count: prev.comments_count + 1 }))

      // Notify post author
      if (post.author.id !== profile.id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: post.author.id,
            type: 'comment',
            from_user_id: profile.id,
            post_id: post.id
          })
      }
    } catch (err) {
      console.error('Error adding comment:', err)
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

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
      if (error) throw error

      setComments(prev => prev.filter(c => c.id !== commentId))
      setPost(prev => ({ ...prev, comments_count: Math.max(0, prev.comments_count - 1) }))
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  const handleStartEditComment = (c: Comment) => {
    setEditingComment(c)
    setCommentInput(c.content)
  }

  const handleSaveEditComment = async () => {
    if (!editingComment || !commentInput.trim()) return
    const text = commentInput.trim()
    const targetId = editingComment.id
    setEditingComment(null)
    setCommentInput('')

    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: text })
        .eq('id', targetId)

      if (error) throw error

      setComments(prev => prev.map(c => c.id === targetId ? { ...c, content: text } : c))
    } catch (err) {
      console.error('Error editing comment:', err)
    }
  }

  const handlePostReact = async (emoji: string) => {
    if (!profile) return
    const reactions = { ...(post.reactions || {}) }
    const users = [...(reactions[emoji] || [])]
    const userIndex = users.indexOf(profile.id)

    if (userIndex >= 0) {
      users.splice(userIndex, 1)
    } else {
      // Ограничиваем: пользователь может поставить только одну реакцию на пост в канале
      Object.keys(reactions).forEach(emo => {
        reactions[emo] = (reactions[emo] || []).filter((uid: string) => uid !== profile.id)
        if (!reactions[emo].length) delete reactions[emo]
      })
      users.push(profile.id)
    }

    if (!users.length) {
      delete reactions[emoji]
    } else {
      reactions[emoji] = users
    }

    setPost(prev => ({ ...prev, reactions }))

    try {
      await supabase.from('posts').update({ reactions }).eq('id', post.id)
      if (post.group_id) {
        const groupChan = supabase.channel(`group:${post.group_id}`)
        groupChan.send({
          type: 'broadcast',
          event: 'post-reaction',
          payload: { postId: post.id, reactions }
        }).then((status) => {
          if (status !== 'ok') {
            groupChan.subscribe((subStatus) => {
              if (subStatus === 'SUBSCRIBED') {
                groupChan.send({
                  type: 'broadcast',
                  event: 'post-reaction',
                  payload: { postId: post.id, reactions }
                })
              }
            })
          }
        })
      }
    } catch (err) {
      console.error('Error updating post reaction:', err)
    }
  }

  const handleDeletePost = async () => {
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
      if (error) throw error

      if (onDeleteSuccess) {
        onDeleteSuccess(post.id)
      }
    } catch (err) {
      console.error('Error deleting post:', err)
      setIsDeleting(false)
    }
  }

  const handleSaveEditPost = async () => {
    const text = editPostContent.trim()
    if (!text) {
      alert('Текст записи не может быть пустым')
      return
    }
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: text })
        .eq('id', post.id)

      if (error) throw error

      setPost(prev => ({ ...prev, content: text }))
      setIsEditingPost(false)
    } catch (err) {
      console.error('Error saving post edit:', err)
      alert('Не удалось сохранить изменения')
    }
  }

  const handleImageClick = (urls: string[], index: number) => {
    console.log('PostCard: handleImageClick called', urls, index, 'hasPropsOnImageClick:', !!onImageClick)
    if (onImageClick) {
      onImageClick(urls, index, post)
    } else {
      console.log('PostCard: dispatching open-gallery event', urls, index)
      window.dispatchEvent(new CustomEvent('open-gallery', { 
        detail: { 
          images: urls, 
          startIndex: index, 
          postContext: {
            id: post.id,
            author: post.author,
            content: post.content,
            created_at: post.created_at
          },
          disableComments: isChannel,
          isChannel: isChannel
        } 
      }))
    }
  }

  if (isChannel) {
    const inlinePhotoIndices = new Set<number>()
    if (post.content && post.images) {
      const matches = post.content.match(/\[photo([1-5])\]/gi)
      if (matches) {
        matches.forEach(m => {
          const numMatch = m.match(/\d+/)
          if (numMatch) {
            const idx = parseInt(numMatch[0], 10) - 1
            if (idx >= 0 && idx < post.images!.length) {
              inlinePhotoIndices.add(idx)
            }
          }
        })
      }
    }

    const bottomGridImages = post.images 
      ? post.images.filter((_, idx) => !inlinePhotoIndices.has(idx)) 
      : []

    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, width: '100%', marginBottom: 12, justifyContent: 'flex-start', position: 'relative', opacity: isDeleting ? 0.5 : 1 }} className="tg-channel-bubble-row">
        <div 
          data-channel-post-id={post.id}
          data-channel-post-content={post.content}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px 16px 16px 4px',
            padding: '10px 14px',
            maxWidth: '520px',
            width: 'fit-content',
            minWidth: '220px',
            boxSizing: 'border-box',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            userSelect: 'none'
          }}
          className="tg-channel-bubble"
        >
          {/* Имя канала сверху */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 12 }}>
            <span 
              onClick={() => post.group && selectGroup(post.group.id)}
              style={{ fontWeight: 600, fontSize: 13, color: '#0077ff', cursor: 'pointer' }}
            >
              {post.group?.name || 'Канал'}
            </span>
            
            {/* Кнопка три точки для админа / автора */}
            {isAdmin && (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  setPostMenuCoords({ x: rect.left - 120, y: rect.bottom })
                }}
                style={{ 
                  color: 'var(--vkui--color_text_secondary)', 
                  background: 'none',
                  border: 'none',
                  padding: 4, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  transition: 'background 0.2s ease',
                  outline: 'none',
                  flexShrink: 0
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                title="Опции записи"
              >
                <Icon28MoreHorizontal width={18} height={18} />
              </button>
            )}
          </div>

          {/* Текст поста */}
          {isEditingPost ? (
            <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={editPostContent}
                onChange={(e) => setEditPostContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--vkui--color_text_primary)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setIsEditingPost(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--vkui--color_text_primary)', cursor: 'pointer' }}>Отмена</button>
                <button onClick={handleSaveEditPost} style={{ background: '#007aff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#fff', cursor: 'pointer' }}>Сохранить</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--vkui--color_text_primary)', textAlign: 'left', lineHeight: '1.45', wordBreak: 'break-word' }}>
              <FormattedText content={post.content} images={post.images} onImageClick={(urls, idx) => handleImageClick(urls, idx)} />
            </div>
          )}

          {/* Картинки и видео */}
          {bottomGridImages.length > 0 && (
            <div className={`post-images-grid ${bottomGridImages.length <= 10 ? `grid-${bottomGridImages.length}` : 'grid-generic'}`} style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden' }}>
              {bottomGridImages.map((url, i) => {
                const isVideo = url.split(/[?#]/)[0].toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)
                const globalIndex = post.images ? post.images.indexOf(url) : i
                if (isVideo) {
                  return (
                    <div key={i} className="post-image-item" onClick={() => handleImageClick(post.images || bottomGridImages, globalIndex >= 0 ? globalIndex : i)} style={{ position: 'relative', cursor: 'pointer', backgroundColor: '#000', overflow: 'hidden', minHeight: 150 }}>
                      <video src={`${url}#t=0.001`} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} muted playsInline preload="auto" />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        <Icon28Play fill="#ffffff" width={20} height={20} style={{ marginLeft: 2 }} />
                      </div>
                    </div>
                  )
                }
                return (
                  <img key={i} src={url} alt="" loading="lazy" className="post-image-item" onClick={() => handleImageClick(post.images || bottomGridImages, globalIndex >= 0 ? globalIndex : i)} style={{ cursor: 'pointer', objectFit: 'cover' }} />
                )
              })}
            </div>
          )}

          {/* Опросы */}
          {post.poll && (
            <div style={{ padding: '8px 10px', marginTop: 8, borderRadius: 10, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <Text weight="2" style={{ fontSize: 13, marginBottom: 8, display: 'block', color: 'var(--vkui--color_text_primary)' }}>📊 {post.poll.question}</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pollOptions.map(opt => {
                  const isMyVote = userVoteOptionId === opt.id
                  const percentage = totalVotes > 0 ? Math.round(((opt.votes_count || 0) / totalVotes) * 100) : 0
                  if (userVoteOptionId) {
                    return (
                      <div key={opt.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: isMyVote ? 'rgba(0, 119, 255, 0.08)' : 'rgba(0, 0, 0, 0.02)', overflow: 'hidden', fontSize: 12 }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${percentage}%`, background: isMyVote ? 'rgba(0, 119, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)', zIndex: 1, transition: 'width 0.3s ease' }} />
                        <span style={{ zIndex: 2, fontWeight: isMyVote ? 600 : 500 }}>{isMyVote && '✓ '}{opt.text}</span>
                        <span style={{ zIndex: 2, color: 'var(--vkui--color_text_secondary)', fontSize: 11 }}>{percentage}% ({opt.votes_count || 0})</span>
                      </div>
                    )
                  }
                  return (
                    <button key={opt.id} onClick={() => handlePollVote(opt.id)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--vkui--color_text_primary)', textAlign: 'left', cursor: 'pointer', fontSize: 12 }}>{opt.text}</button>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>
                  <span>Голосов: {totalVotes}</span>
                  {userVoteOptionId && <Button mode="tertiary" size="s" onClick={handleRetractPollVote} style={{ padding: 0, height: 'auto', minHeight: 'auto', fontSize: 11 }}>Снять голос</Button>}
                </div>
              </div>
            </div>
          )}

          {/* Музыка */}
          {post.audio && (
            <div onClick={(e) => { e.stopPropagation(); handlePlayAudio(post.audio); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', marginTop: 8 }}>
              <div style={{ position: 'relative', width: 34, height: 34, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#1c1c1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {post.audio.cover_url ? <img src={post.audio.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #3498db, #8e44ad)', color: '#fff', fontSize: 12 }}>🎵</div>}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  {currentTrack?.id === post.audio.id && isPlaying ? <Icon28Pause width={18} height={18} fill="#fff" /> : <Icon28Play width={18} height={18} fill="#fff" style={{ marginLeft: 1 }} />}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.audio.title}</div>
                <div style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{post.audio.artist}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>{Math.floor(post.audio.duration / 60)}:{(post.audio.duration % 60).toString().padStart(2, '0')}</div>
            </div>
          )}

          {/* Репосты */}
          {post.repost_source && (
            <div className="repost-container" style={{ padding: 10, marginTop: 8, borderLeft: '2px solid rgba(0, 119, 255, 0.4)', background: 'rgba(0, 0, 0, 0.02)', borderRadius: '0 6px 6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <CustomAvatar size={24} src={post.repost_source.author.avatar_url} name={post.repost_source.author.full_name} id={post.repost_source.author.id} decoration={post.repost_source.author.avatar_decoration} onClick={() => selectProfile(post.repost_source!.author.id)} style={{ cursor: 'pointer' }} />
                <span style={{ fontWeight: 500, fontSize: 12, cursor: 'pointer' }} onClick={() => selectProfile(post.repost_source!.author.id)}>{post.repost_source.author.full_name}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--vkui--color_text_primary)' }}><FormattedText content={post.repost_source.content} /></div>
              {post.repost_source.images && post.repost_source.images.length > 0 && (
                <div className={`post-images-grid ${post.repost_source.images.length <= 10 ? `grid-${post.repost_source.images.length}` : 'grid-generic'}`} style={{ marginTop: 6 }}>
                  {post.repost_source.images.map((url, i) => (
                    <img key={i} src={url} alt="" className="post-image-item" onClick={() => handleImageClick(post.repost_source!.images!, i)} style={{ cursor: 'pointer', maxHeight: 100, objectFit: 'cover' }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Реакции (в стиле Telegram) */}
          {post.reactions && Object.keys(post.reactions).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6, marginBottom: 4 }}>
              {Object.entries(post.reactions).map(([emoji, val]) => {
                const userIds = val as string[]
                const hasReacted = !!(profile && userIds.includes(profile.id))
                return (
                  <div 
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePostReact(emoji)
                    }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 5, 
                      cursor: 'pointer', 
                      background: hasReacted ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      padding: '4px 10px',
                      borderRadius: 12,
                      border: hasReacted ? '1px solid rgba(0, 122, 255, 0.3)' : '1px solid transparent',
                      color: hasReacted ? '#007aff' : '#8e8e93',
                      transition: 'all 0.2s ease',
                      fontSize: 12,
                      fontWeight: 500
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{userIds.length}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Просмотры и время */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, paddingTop: 4, borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: 11, color: '#8e8e93' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg 
                  width="13" 
                  height="13" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  style={{ opacity: 0.7 }}
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{post.views_count || 0}</span>
              </span>
              <span>{new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Кнопка репоста / поделиться */}
        <button
          onClick={() => onShareClick && onShareClick(post)}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            flexShrink: 0
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 119, 255, 0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
          title="Поделиться"
        >
          <Icon24ShareOutline width={18} height={18} />
        </button>

        {/* Пост-меню для админа */}
        {postMenuCoords && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setPostMenuCoords(null)}>
            <div 
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: postMenuCoords.x,
                top: postMenuCoords.y,
                zIndex: 99999,
                background: 'var(--vkui--color_background_modal, #1c1c1e)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: 4,
                minWidth: 140,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
              }}
            >
              <button 
                onClick={() => { setPostMenuCoords(null); setIsEditingPost(true); }}
                className="context-menu-item"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
              >
                ✏️ Редактировать
              </button>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              <button 
                onClick={() => { setPostMenuCoords(null); handleDeletePost(); }}
                className="context-menu-item context-menu-item-danger"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', color: '#ff3b30', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
              >
                🗑️ Удалить
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="posts-card" style={{ padding: '16px', borderRadius: 12, position: 'relative', opacity: isDeleting ? 0.5 : 1 }}>
      {post.group && !hideGroupBadge && (
        <div
          onClick={() => selectGroup(post.group!.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            marginBottom: 8,
            borderRadius: 12,
            background: 'var(--vkui--color_background_secondary_alpha)',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--vkui--color_text_accent)',
            cursor: 'pointer',
            border: '1px solid var(--vkui--color_separator_primary_alpha)'
          }}
        >
          <Icon28UsersOutline width={14} height={14} />
          <span>{post.group.name}</span>
          <span style={{ opacity: 0.6, fontSize: 11 }}>· сообщество</span>
        </div>
      )}
      
      {(() => {
        const authorAvatar = (post.by_group && post.group) ? post.group.avatar_url : post.author.avatar_url;
        const authorName = (post.by_group && post.group) ? post.group.name : post.author.full_name;
        const handleAuthorClick = () => {
          if (post.by_group && post.group) {
            selectGroup(post.group.id);
          } else {
            selectProfile(post.author.id);
          }
        };

        return (
          <SimpleCell
            before={
              <CustomAvatar 
                size={40} 
                src={authorAvatar} 
                name={authorName || ''} 
                id={(post.by_group && post.group) ? post.group.id : post.author.id} 
                decoration={(!post.by_group) ? post.author.avatar_decoration : undefined} 
                onClick={handleAuthorClick} 
                style={{ cursor: 'pointer' }} 
              />
            }
            subtitle={new Date(post.created_at).toLocaleString()}
            style={{ padding: 0 }}
            after={
              <IconButton 
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  setPostMenuCoords({ x: rect.left - 120, y: rect.bottom })
                }}
                style={{ color: 'var(--vkui--color_text_secondary)' }}
                title="Опции записи"
                aria-label="Опции записи"
              >
                <Icon28MoreHorizontal />
              </IconButton>
            }
          >
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              onClick={handleAuthorClick}
            >
              <span style={{ fontWeight: 500 }}>{authorName}</span>
              {!post.by_group && post.author.emoji_status && (
                <span style={{ fontSize: 16, marginLeft: 4 }} title="Эмодзи-статус">{post.author.emoji_status}</span>
              )}
              {!post.by_group && <AdminBadge username={post.author.username} role={post.author.role} />}
            </div>
          </SimpleCell>
        );
      })()}
      
      {(() => {
        const inlinePhotoIndices = new Set<number>()
        if (post.content && post.images) {
          const matches = post.content.match(/\[photo([1-5])\]/gi)
          if (matches) {
            matches.forEach(m => {
              const numMatch = m.match(/\d+/)
              if (numMatch) {
                const idx = parseInt(numMatch[0], 10) - 1
                if (idx >= 0 && idx < post.images!.length) {
                  inlinePhotoIndices.add(idx)
                }
              }
            })
          }
        }

        const bottomGridImages = post.images 
          ? post.images.filter((_, idx) => !inlinePhotoIndices.has(idx)) 
          : []

        return (
          <>
            {isEditingPost ? (
              <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={editPostContent}
                  onChange={(e) => setEditPostContent(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 100,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.12))',
                    background: 'var(--vkui--color_background_secondary, rgba(255,255,255,0.05))',
                    color: 'var(--vkui--color_text_primary)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Текст записи..."
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setIsEditingPost(false)}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--vkui--color_text_primary)',
                      cursor: 'pointer'
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSaveEditPost}
                    style={{
                      background: '#007aff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            ) : (
              <Box style={{ padding: '8px 0', textAlign: 'left' }}>
                <FormattedText content={post.content} images={post.images} onImageClick={(urls, idx) => handleImageClick(urls, idx)} />
              </Box>
            )}

            {bottomGridImages.length > 0 && (
              <div className={`post-images-grid ${bottomGridImages.length <= 10 ? `grid-${bottomGridImages.length}` : 'grid-generic'}`} style={{ marginBottom: 12 }}>
                {bottomGridImages.map((url, i) => {
                  const isVideo = url.split(/[?#]/)[0].toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)
                  if (isVideo) {
                    return (
                      <div 
                        key={i} 
                        className="post-image-item" 
                        onClick={() => handleImageClick(bottomGridImages, i)} 
                        style={{ position: 'relative', cursor: 'pointer', backgroundColor: '#000', overflow: 'hidden', minHeight: 150 }}
                      >
                        <video 
                          src={`${url}#t=0.001`} 
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
                          backdropFilter: 'blur(4px)',
                          zIndex: 2
                        }}>
                          <Icon28Play fill="#ffffff" width={24} height={24} style={{ marginLeft: 2 }} />
                        </div>
                        {(() => {
                          let title = ''
                          try {
                            const titleParam = url.match(/[?&]title=([^&]+)/)?.[1]
                            if (titleParam) title = decodeURIComponent(titleParam)
                          } catch(e){}
                          if (!title) return null
                          return (
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
                              textOverflow: 'ellipsis',
                              zIndex: 2
                            }}>
                              {title}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  }
                  return (
                    <img 
                      key={i} 
                      src={url} 
                      alt="" 
                      loading="lazy"
                      className="post-image-item" 
                      onClick={() => handleImageClick(bottomGridImages, i)} 
                    />
                  )
                })}
              </div>
            )}
          </>
        )
      })()}

      {/* Repost rendering */}
      {post.repost_source && (
        <div className="repost-container" style={{
          padding: 12,
          marginTop: 8,
          marginBottom: 12,
          borderLeft: '3px solid var(--vkui--color_separator_primary_alpha, rgba(0, 119, 255, 0.4))',
          background: 'var(--vkui--color_background_secondary_alpha, rgba(0, 0, 0, 0.02))',
          borderRadius: '0 8px 8px 0'
        }}>
          <SimpleCell
            before={<CustomAvatar size={32} src={post.repost_source.author.avatar_url} name={post.repost_source.author.full_name} id={post.repost_source.author.id} decoration={post.repost_source.author.avatar_decoration} onClick={() => selectProfile(post.repost_source!.author.id)} style={{ cursor: 'pointer' }} />}
            subtitle={new Date(post.repost_source.created_at).toLocaleString()}
            style={{ padding: 0 }}
          >
            <span style={{ fontWeight: 500, fontSize: 13, cursor: 'pointer' }} onClick={() => selectProfile(post.repost_source!.author.id)}>
              {post.repost_source.author.full_name}
              {post.repost_source.author.emoji_status && (
                <span style={{ fontSize: 14, marginLeft: 4 }} title="Эмодзи-статус">{post.repost_source.author.emoji_status}</span>
              )}
            </span>
          </SimpleCell>
          <Box style={{ padding: '6px 0', fontSize: 13, textAlign: 'left' }}>
            <FormattedText content={post.repost_source.content} />
          </Box>
          {post.repost_source.images && post.repost_source.images.length > 0 && (
            <div className={`post-images-grid ${post.repost_source.images.length <= 10 ? `grid-${post.repost_source.images.length}` : 'grid-generic'}`}>
              {post.repost_source.images.map((url, i) => {
                const isVideo = url.split(/[?#]/)[0].toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)
                if (isVideo) {
                  return (
                    <div 
                      key={i} 
                      className="post-image-item" 
                      onClick={() => handleImageClick(post.repost_source!.images!, i)} 
                      style={{ position: 'relative', cursor: 'pointer', backgroundColor: '#000', overflow: 'hidden', minHeight: 150 }}
                    >
                      <video 
                        src={`${url}#t=0.001`} 
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
                        backdropFilter: 'blur(4px)',
                        zIndex: 2
                      }}>
                        <Icon28Play fill="#ffffff" width={24} height={24} style={{ marginLeft: 2 }} />
                      </div>
                      {(() => {
                        let title = ''
                        try {
                          const titleParam = url.match(/[?&]title=([^&]+)/)?.[1]
                          if (titleParam) title = decodeURIComponent(titleParam)
                        } catch(e){}
                        if (!title) return null
                        return (
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
                            textOverflow: 'ellipsis',
                            zIndex: 2
                          }}>
                            {title}
                          </div>
                        )
                      })()}
                    </div>
                  )
                }
                return (
                  <img 
                    key={i} 
                    src={url} 
                    alt="" 
                    className="post-image-item" 
                    onClick={() => handleImageClick(post.repost_source!.images!, i)} 
                  />
                )
              })}
            </div>
          )}
          {post.repost_source.audio && (
            <div 
              onClick={(e) => { e.stopPropagation(); handlePlayAudio(post.repost_source!.audio); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 10,
                background: 'var(--vkui--color_background_secondary_alpha, rgba(255,255,255,0.02))',
                border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.05))',
                cursor: 'pointer',
                marginTop: 8,
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--vkui--color_background_secondary, rgba(255,255,255,0.06))'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--vkui--color_background_secondary_alpha, rgba(255,255,255,0.02))'}
            >
              <div style={{ position: 'relative', width: 34, height: 34, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#1c1c1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {post.repost_source.audio.cover_url ? (
                  <img src={post.repost_source.audio.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7f8c8d, #95a5a6)', color: '#fff', fontSize: 13 }}>
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
                  {currentTrack?.id === post.repost_source.audio.id && isPlaying ? (
                    <Icon28Pause width={18} height={18} fill="#fff" />
                  ) : (
                    <Icon28Play width={18} height={18} fill="#fff" style={{ marginLeft: 1 }} />
                  )}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {post.repost_source.audio.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                  {post.repost_source.audio.artist}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>
                {Math.floor(post.repost_source.audio.duration / 60)}:{(post.repost_source.audio.duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio rendering for own post */}
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
            marginBottom: 12,
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

      {/* Poll rendering */}
      {post.poll && (
        <div style={{
          padding: '14px 16px',
          marginTop: 8,
          marginBottom: 12,
          borderRadius: 12,
          background: 'var(--vkui--color_background_secondary_alpha, rgba(0, 0, 0, 0.03))',
          border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0, 0, 0, 0.06))'
        }}>
          <Text weight="2" style={{ fontSize: 14, marginBottom: 12, display: 'block', color: 'var(--vkui--color_text_primary)' }}>
            📊 {post.poll.question}
          </Text>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pollOptions.map(opt => {
              const isMyVote = userVoteOptionId === opt.id
              const percentage = totalVotes > 0 ? Math.round(((opt.votes_count || 0) / totalVotes) * 100) : 0

              if (userVoteOptionId) {
                return (
                  <div 
                    key={opt.id}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: isMyVote ? 'rgba(0, 119, 255, 0.08)' : 'rgba(0, 0, 0, 0.02)',
                      border: isMyVote ? '1px solid rgba(0, 119, 255, 0.2)' : '1px solid transparent',
                      overflow: 'hidden',
                      fontSize: 13
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${percentage}%`,
                      background: isMyVote ? 'rgba(0, 119, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                      zIndex: 1,
                      transition: 'width 0.3s ease'
                    }} />
                    
                    <span style={{ zIndex: 2, fontWeight: isMyVote ? 600 : 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isMyVote && <span>✓</span>}
                      {opt.text}
                    </span>
                    <span style={{ zIndex: 2, color: 'var(--vkui--color_text_secondary)', fontSize: 12 }}>
                      {percentage}% ({opt.votes_count || 0})
                    </span>
                  </div>
                )
              } else {
                return (
                  <button
                    key={opt.id}
                    onClick={() => handlePollVote(opt.id)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--vkui--color_background_content, #fff)',
                      border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.12))',
                      color: 'var(--vkui--color_text_primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {opt.text}
                  </button>
                )
              }
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>
              <span>Всего голосов: {totalVotes}</span>
              {userVoteOptionId && (
                <Button 
                  mode="tertiary" 
                  size="s" 
                  onClick={handleRetractPollVote}
                  style={{ padding: 0, height: 'auto', minHeight: 'auto' }}
                >
                  Снять голос
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
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
            <IconButton
              onClick={handleLike}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              className={`like-button-animated ${isLiked ? 'liked' : ''}`}
              aria-label="Нравится"
            >
              {isLiked ? <Icon24Like fill="var(--vkui--color_icon_accent)" /> : <Icon24LikeOutline />}
              <Text style={{ fontSize: 13.5 }}>{likesCount}</Text>
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
                      onClick={(e) => { e.stopPropagation(); setShowLikersTooltip(false); selectProfile(liker.id); }}
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
          {!commentsDisabled && (
            <IconButton onClick={handleToggleComments} style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-label="Комментарии">
              <Icon24CommentOutline />
              <Text style={{ fontSize: 13.5 }}>{post.comments_count}</Text>
            </IconButton>
          )}
          <IconButton onClick={() => onShareClick && onShareClick(post)} style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-label="Поделиться">
            <Icon24ShareOutline />
          </IconButton>
          {!hideBookmark && (
            <IconButton 
              onClick={handleToggleBookmark} 
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: isBookmarked ? '#0077ff' : 'inherit' }} 
              aria-label="В закладки"
            >
              {isBookmarked ? <Icon24Bookmark /> : <Icon24BookmarkOutline />}
            </IconButton>
          )}
        </div>
        
        {/* Views Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--vkui--color_text_secondary)', paddingRight: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{post.views_count || 0}</Text>
        </div>
      </div>

      {/* Comments Section */}
      {commentsExpanded && (
        <div className="post-comments-section" style={{ marginTop: 12 }}>
          {loadingComments && comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 8 }}><Spinner size="s" /></div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 12, color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>
              Нет комментариев
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comments.map(c => {
                const liked = !!likedComments[c.id]
                const commentLikes = commentLikesCount[c.id] || 0
                const isReply = !!c.content?.match(/^@([a-zA-Z0-9_.-]+),?\s+/)

                return (
                  <CommentItem
                    key={c.id}
                    c={c}
                    liked={liked}
                    commentLikes={commentLikes}
                    isReply={isReply}
                    postId={post.id}
                    onLike={handleLikeComment}
                    onReply={(cmt) => {
                      setReplyingTo(cmt)
                      setCommentInput(`@${cmt.author.username || cmt.author.full_name}, `)
                    }}
                    onReactComment={handleCommentReact}
                    onContextMenu={(e, cmt) => {
                      e.preventDefault()
                      setCommentMenu({
                        x: e.clientX,
                        y: e.clientY + window.scrollY,
                        comment: cmt
                      })
                    }}
                    onAuthorClick={(authorId) => selectProfile(authorId)}
                    selectProfile={selectProfile}
                  />
                )
              })}
            </div>
          )}

          {/* Comment input area */}
          <div style={{ position: 'relative', marginTop: 12 }}>
            {replyingTo && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', background: 'var(--vkui--color_background_secondary)', borderRadius: '8px 8px 0 0', fontSize: 11 }}>
                <span>Ответ пользователю {replyingTo.author.full_name}</span>
                <span onClick={() => { setReplyingTo(null); setCommentInput(''); }} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
              </div>
            )}
            <WriteBar
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
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
                    onSelect={(emoji) => setCommentInput(prev => prev + emoji)}
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
                    onClick={editingComment ? handleSaveEditComment : handleAddComment} 
                    disabled={!commentInput.trim()} 
                    aria-label="Отправить"
                  >
                    <Icon28SendOutline />
                  </WriteBarIcon>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Post Context Menu */}
      {postMenuCoords && (
        <>
          <div 
            onClick={() => setPostMenuCoords(null)} 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, cursor: 'default' }} 
          />
          <div 
            style={{
              position: 'fixed',
              top: postMenuCoords.y,
              left: postMenuCoords.x,
              background: 'var(--vkui--color_background_content)',
              border: '1px solid var(--vkui--color_separator_primary_alpha)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              zIndex: 10000,
              padding: '6px 0',
              width: 160
            }}
          >
            {profile?.id === post.author.id && (
              <button 
                onClick={() => { setIsEditingPost(true); setEditPostContent(post.content); setPostMenuCoords(null); }} 
                className="context-menu-item"
                style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: '8px 16px', fontSize: 13, color: 'var(--vkui--color_text_primary)' }}
              >
                Редактировать
              </button>
            )}
            {(profile?.id === post.author.id || isAdmin) && (
              <button 
                onClick={() => { handleDeletePost(); setPostMenuCoords(null); }} 
                className="context-menu-item context-menu-item-danger"
                style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: '8px 16px', fontSize: 13 }}
              >
                Удалить запись
              </button>
            )}
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`)
                window.dispatchEvent(new CustomEvent('show-toast', { detail: { title: 'Поделиться', text: 'Ссылка скопирована в буфер обмена' } }))
                setPostMenuCoords(null)
              }} 
              className="context-menu-item"
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: '8px 16px', fontSize: 13, color: 'var(--vkui--color_text_primary)' }}
            >
              Копировать ссылку
            </button>
          </div>
        </>
      )}

      {/* Comment Context Menu */}
      {commentMenu && (
        <>
          <div 
            onClick={() => setCommentMenu(null)} 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, cursor: 'default' }} 
          />
          <div 
            style={{
              position: 'fixed',
              top: commentMenu.y - window.scrollY,
              left: commentMenu.x,
              background: 'var(--vkui--color_background_content)',
              border: '1px solid var(--vkui--color_separator_primary_alpha)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              zIndex: 10000,
              padding: '6px 0',
              width: 160
            }}
          >
            {profile?.id === commentMenu.comment.author.id && (
              <>
                <button 
                  onClick={() => { handleStartEditComment(commentMenu.comment); setCommentMenu(null); }} 
                  className="context-menu-item"
                  style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: '8px 16px', fontSize: 13, color: 'var(--vkui--color_text_primary)' }}
                >
                  Редактировать
                </button>
                <button 
                  onClick={() => { handleDeleteComment(commentMenu.comment.id); setCommentMenu(null); }} 
                  className="context-menu-item context-menu-item-danger"
                  style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: '8px 16px', fontSize: 13 }}
                >
                  Удалить
                </button>
              </>
            )}
            <button 
              onClick={() => {
                navigator.clipboard.writeText(commentMenu.comment.content)
                window.dispatchEvent(new CustomEvent('show-toast', { detail: { title: 'Буфер обмена', text: 'Текст комментария скопирован' } }))
                setCommentMenu(null)
              }} 
              className="context-menu-item"
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: '8px 16px', fontSize: 13, color: 'var(--vkui--color_text_primary)' }}
            >
              Копировать текст
            </button>
          </div>
        </>
      )}
    </div>
  )
}
