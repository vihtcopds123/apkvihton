import React, { useEffect, useState } from 'react'
import {
  Panel,
  PanelHeader,
  SimpleCell,
  Box,
  Text,
  IconButton,
  WriteBar,
  WriteBarIcon,
  Spinner,
  Button
} from '@vkontakte/vkui'
import {
  Icon28LikeOutline,
  Icon28Like,
  Icon28CommentOutline,
  Icon28MoreHorizontal,
  Icon28UsersOutline,
  Icon28BookmarkOutline,
  Icon28Bookmark,
  Icon28SendOutline
} from '@vkontakte/icons'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { AdminBadge } from '../components/AdminBadge'
import { FormattedText } from '../components/FormattedText'
import { CustomAvatar } from '../components/CustomAvatar'
import { SkeletonPost } from '../components/SkeletonLoader'
import { EmojiPicker } from '../components/EmojiPicker'


interface Post {
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
  }
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
}

interface Comment {
  id: string
  content: string
  created_at: string
  likes_count?: number
  author: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
    role?: string | null
  }
}

interface BookmarksPanelProps {
  id: string
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({ id }) => {
  const { profile } = useAuthStore()
  const { selectProfile } = useAppStore()
  const [posts, setPosts] = useState<Post[]>([])
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Comments State
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({})
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({})
  const [postCommentsInput, setPostCommentsInput] = useState<Record<string, string>>({})
  const [loadingCommentsPostIds, setLoadingCommentsPostIds] = useState<Record<string, boolean>>({})
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({})
  const [commentLikesCount, setCommentLikesCount] = useState<Record<string, number>>({})
  const [editingComment, setEditingComment] = useState<{ id: string; postId: string; content: string } | null>(null)
  
  const [commentContextMenu, setCommentContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    comment: Comment
    postId: string
  } | null>(null)
  
  const [postContextMenu, setPostContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    postId: string
    authorId: string
  } | null>(null)

  useEffect(() => {
    const handleCloseMenu = () => {
      setCommentContextMenu(null)
      setPostContextMenu(null)
    }
    document.addEventListener('click', handleCloseMenu)
    return () => document.removeEventListener('click', handleCloseMenu)
  }, [])

  const fetchBookmarks = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select(`
          post_id,
          post:posts(
            *,
            author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, avatar_decoration),
            group:groups(id, name, avatar_url),
            repost_source:repost_source_id(
              *,
              author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, avatar_decoration),
              group:groups(id, name, avatar_url)
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
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) {
        // Extract posts from join
        const extractedPosts = data
          .map((row: any) => row.post)
          .filter(Boolean) as Post[]
        
        setPosts(extractedPosts)

        // Fetch liked status
        const postIds = extractedPosts.map(p => p.id)
        if (postIds.length > 0) {
          const { data: likes } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', profile.id)
            .in('post_id', postIds)

          if (likes) {
            const likedMap: Record<string, boolean> = {}
            likes.forEach(like => {
              likedMap[like.post_id] = true
            })
            setLikedPosts(likedMap)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching bookmarked posts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookmarks()
  }, [profile?.id])

  const handleRemoveBookmark = async (postId: string) => {
    if (!profile) return
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', profile.id)
        .eq('post_id', postId)

      if (error) throw error
      setPosts(prev => prev.filter(p => p.id !== postId))
      
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          title: 'Закладки',
          text: 'Запись удалена из закладок'
        }
      }))
    } catch (err) {
      console.error('Error removing bookmark:', err)
    }
  }

  const handleLike = async (postId: string) => {
    if (!profile) return
    const isLiked = likedPosts[postId]
    
    // Optimistic UI Update
    setLikedPosts(prev => ({ ...prev, [postId]: !isLiked }))
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, likes_count: p.likes_count + (isLiked ? -1 : 1) }
      }
      return p
    }))

    try {
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', profile.id)
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: profile.id })
      }
    } catch (err) {
      console.error('Like error:', err)
      // Revert if error
      setLikedPosts(prev => ({ ...prev, [postId]: isLiked }))
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, likes_count: p.likes_count + (isLiked ? 1 : -1) }
        }
        return p
      }))
    }
  }

  const loadCommentsForPost = async (postId: string) => {
    setLoadingCommentsPostIds(prev => ({ ...prev, [postId]: true }))
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles(id, full_name, avatar_url, username, role)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      if (data) {
        const commentsData = data as unknown as Comment[]
        setPostComments(prev => ({ ...prev, [postId]: commentsData }))
        
        const countsMap: Record<string, number> = {}
        commentsData.forEach(c => {
          countsMap[c.id] = c.likes_count || 0
        })
        setCommentLikesCount(prev => ({ ...prev, ...countsMap }))

        if (profile && commentsData.length > 0) {
          const commentIds = commentsData.map(c => c.id)
          const { data: likes } = await supabase
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', profile.id)
            .in('comment_id', commentIds)
          
          if (likes) {
            const likedMap: Record<string, boolean> = {}
            likes.forEach(like => {
              likedMap[like.comment_id] = true
            })
            setLikedComments(prev => ({ ...prev, ...likedMap }))
          }
        }
      }
    } catch (err) {
      console.error('Error loading comments:', err)
    } finally {
      setLoadingCommentsPostIds(prev => ({ ...prev, [postId]: false }))
    }
  }

  const toggleComments = (postId: string) => {
    const isExpanded = !!expandedPostIds[postId]
    setExpandedPostIds(prev => ({ ...prev, [postId]: !isExpanded }))
    if (!isExpanded) {
      loadCommentsForPost(postId)
    }
  }

  const handleLikeComment = async (commentId: string) => {
    if (!profile) return
    const isLiked = !!likedComments[commentId]
    const currentCount = commentLikesCount[commentId] || 0
    
    setLikedComments(prev => ({ ...prev, [commentId]: !isLiked }))
    setCommentLikesCount(prev => ({ ...prev, [commentId]: Math.max(0, currentCount + (isLiked ? -1 : 1)) }))

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
      setCommentLikesCount(prev => ({ ...prev, [commentId]: currentCount }))
    }
  }

  const handleSendComment = async (postId: string) => {
    if (!profile) return
    const text = postCommentsInput[postId]?.trim() || ''
    if (!text) return

    if (editingComment && editingComment.postId === postId) {
      const commentId = editingComment.id
      setEditingComment(null)
      setPostCommentsInput(prev => ({ ...prev, [postId]: '' }))
      
      try {
        const { error } = await supabase
          .from('comments')
          .update({ content: text })
          .eq('id', commentId)
        
        if (error) throw error
        loadCommentsForPost(postId)
      } catch (err) {
        console.error('Error updating comment:', err)
      }
      return
    }

    setPostCommentsInput(prev => ({ ...prev, [postId]: '' }))
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: profile.id,
          content: text
        })
        .select('*, author:profiles(id, full_name, avatar_url, username)')
        .single()
      
      if (error) throw error
      if (data) {
        setPostComments(prev => {
          const list = prev[postId] || []
          return { ...prev, [postId]: [...list, data as unknown as Comment] }
        })
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, comments_count: p.comments_count + 1 }
          }
          return p
        }))
        setCommentLikesCount(prev => ({ ...prev, [data.id]: 0 }))
      }
    } catch (err) {
      console.error('Error adding comment:', err)
    }
  }

  const handleDeleteComment = async (commentId: string, postId: string) => {
    if (!window.confirm('Удалить этот комментарий?')) return

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
      
      if (error) throw error
      
      setPostComments(prev => {
        const list = prev[postId] || []
        return { ...prev, [postId]: list.filter(c => c.id !== commentId) }
      })
      
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, comments_count: Math.max(0, p.comments_count - 1) }
        }
        return p
      }))
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  const handleReplyToComment = (comment: Comment, postId: string) => {
    const name = comment.author.username || comment.author.full_name || 'id'
    const prefix = `@${name}, `
    setPostCommentsInput(prev => ({
      ...prev,
      [postId]: prefix + (prev[postId] || '')
    }))
  }

  const handleStartEditComment = (comment: Comment, postId: string) => {
    setEditingComment({ id: comment.id, postId, content: comment.content })
    setPostCommentsInput(prev => ({
      ...prev,
      [postId]: comment.content
    }))
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

  return (
    <Panel id={id}>
      <PanelHeader fixed={false} style={{ textAlign: 'left' }}>Закладки</PanelHeader>

      <div className="feed-posts-list" style={{ display: 'flex', flexDirection: 'column', padding: '12px 0' }}>
        {loading ? (
          <>
            <SkeletonPost />
            <SkeletonPost />
          </>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--vkui--color_text_secondary)' }}>
            У вас нет сохраненных закладок.
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="posts-card" style={{ padding: '16px', borderRadius: 12, position: 'relative', marginBottom: 12 }}>
              {post.group && (
                <div
                  onClick={() => useAppStore.getState().selectGroup(post.group!.id)}
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
                </div>
              )}
              
              <SimpleCell
                before={<CustomAvatar size={40} src={post.author.avatar_url} name={post.author.full_name} id={post.author.id} onClick={() => selectProfile(post.author.id)} style={{ cursor: 'pointer' }} />}
                subtitle={new Date(post.created_at).toLocaleString()}
                style={{ padding: 0 }}
                after={
                  <IconButton 
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPostContextMenu({
                        visible: true,
                        x: rect.left,
                        y: rect.bottom,
                        postId: post.id,
                        authorId: post.author.id
                      });
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
                  onClick={() => selectProfile(post.author.id)}
                >
                  <span style={{ fontWeight: 500 }}>{post.author.full_name}</span>
                  <AdminBadge username={post.author.username} role={post.author.role} />
                </div>
              </SimpleCell>

              <Box style={{ padding: '8px 0', textAlign: 'left' }}>
                <FormattedText content={post.content} />
              </Box>

              {post.images && post.images.length > 0 && (
                <div className={`post-images-grid ${post.images.length <= 10 ? `grid-${post.images.length}` : 'grid-generic'}`} style={{ marginBottom: 12 }}>
                  {post.images.map((url, i) => (
                    <img 
                      key={i} 
                      src={url} 
                      alt="" 
                      className="post-image-item" 
                      onClick={() => handleImageClick(post.images!, i, post)} 
                    />
                  ))}
                </div>
              )}

              {/* Repost content rendering */}
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
                    before={<CustomAvatar size={32} src={post.repost_source.author.avatar_url} name={post.repost_source.author.full_name} id={post.repost_source.author.id} onClick={() => selectProfile(post.repost_source!.author.id)} style={{ cursor: 'pointer' }} />}
                    subtitle={new Date(post.repost_source.created_at).toLocaleString()}
                    style={{ padding: 0 }}
                  >
                    <span style={{ fontWeight: 500, fontSize: 13, cursor: 'pointer' }} onClick={() => selectProfile(post.repost_source!.author.id)}>
                      {post.repost_source.author.full_name}
                    </span>
                  </SimpleCell>
                  <Box style={{ padding: '6px 0', fontSize: 13, textAlign: 'left' }}>
                    <FormattedText content={post.repost_source.content} />
                  </Box>
                  {post.repost_source.images && post.repost_source.images.length > 0 && (
                    <div className={`post-images-grid ${post.repost_source.images.length <= 10 ? `grid-${post.repost_source.images.length}` : 'grid-generic'}`}>
                      {post.repost_source.images.map((url, i) => (
                        <img 
                          key={i} 
                          src={url} 
                          alt="" 
                          className="post-image-item" 
                          onClick={() => handleImageClick(post.repost_source!.images!, i, post.repost_source)} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <IconButton
                    onClick={() => handleLike(post.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    className={`like-button-animated ${likedPosts[post.id] ? 'liked' : ''}`}
                    aria-label="Нравится"
                  >
                    {likedPosts[post.id] ? <Icon28Like fill="var(--vkui--color_icon_accent)" /> : <Icon28LikeOutline />}
                    <Text style={{ fontSize: 14 }}>{post.likes_count}</Text>
                  </IconButton>
                  
                  <IconButton onClick={() => toggleComments(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }} aria-label="Комментарии">
                    <Icon28CommentOutline />
                    <Text style={{ fontSize: 14 }}>{post.comments_count}</Text>
                  </IconButton>

                  {/* Bookmark Button */}
                  <IconButton 
                    onClick={() => handleRemoveBookmark(post.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0077ff' }}
                    title="Удалить из закладок"
                    aria-label="Удалить из закладок"
                  >
                    <Icon28Bookmark />
                  </IconButton>
                </div>
              </div>

              {/* Comments Section */}
              {expandedPostIds[post.id] && (
                <div className="post-comments-section">
                  {loadingCommentsPostIds[post.id] && !(postComments[post.id]?.length) ? (
                    <div style={{ textAlign: 'center', padding: 8 }}><Spinner size="s" /></div>
                  ) : !postComments[post.id] || postComments[post.id].length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 12, color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>
                      Нет комментариев
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {postComments[post.id].map(c => {
                        const isLiked = !!likedComments[c.id]
                        const likesCount = commentLikesCount[c.id] || 0

                        const replyMatch = c.content?.match(/^@([a-zA-Z0-9_.-]+),?\s+/)
                        const isReply = !!replyMatch

                        const renderCommentText = (content: string) => {
                          if (replyMatch) {
                            const username = replyMatch[1]
                            const restText = content.substring(replyMatch[0].length)
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
                            className="post-comment-row"
                            style={{
                              marginLeft: isReply ? '28px' : '0px',
                              borderLeft: isReply ? '2px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))' : 'none',
                              paddingLeft: isReply ? '10px' : '0px',
                              marginTop: isReply ? '-4px' : '0px'
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              setCommentContextMenu({
                                visible: true,
                                x: e.clientX,
                                y: e.clientY,
                                comment: c,
                                postId: post.id
                              })
                            }}
                          >
                            <CustomAvatar size={isReply ? 26 : 32} src={c.author.avatar_url} name={c.author.full_name} id={c.author.id} />
                            <div className="post-comment-bubble" style={{ padding: '6px 10px', borderRadius: isReply ? '4px 10px 10px 10px' : '10px' }}>
                              <div className="post-comment-header">
                                <span className="post-comment-author-name" onClick={() => selectProfile(c.author.id)}>
                                  {c.author.full_name}
                                </span>
                              </div>
                              <div className="post-comment-text">
                                {renderCommentText(c.content)}
                              </div>
                              <div className="post-comment-footer" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, justifyContent: 'flex-start' }}>
                                <span className="post-comment-date">{new Date(c.created_at).toLocaleString()}</span>
                                
                                <button 
                                  onClick={() => handleReplyToComment(c, post.id)}
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

                                <button 
                                  className={`comment-like-button ${isLiked ? 'liked' : ''}`} 
                                  onClick={() => handleLikeComment(c.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '2px 6px',
                                    borderRadius: 10,
                                    color: isLiked ? 'var(--vkui--color_text_accent, #0077ff)' : 'var(--vkui--color_text_secondary)',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    marginLeft: 'auto'
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                  </svg>
                                  <span>{likesCount}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {profile && (
                    <div style={{ marginTop: 8 }}>
                      <WriteBar
                        className="comment-write-bar"
                        value={postCommentsInput[post.id] || ''}
                        onChange={(e) => setPostCommentsInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendComment(post.id)
                          }
                        }}
                        placeholder={editingComment && editingComment.postId === post.id ? "Редактирование комментария..." : "Напишите комментарий..."}
                        after={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {editingComment && editingComment.postId === post.id && (
                              <Button 
                                mode="tertiary" 
                                size="s" 
                                onClick={() => {
                                  setEditingComment(null)
                                  setPostCommentsInput(prev => ({ ...prev, [post.id]: '' }))
                                }}
                                style={{ marginRight: 4 }}
                              >
                                Отмена
                              </Button>
                            )}
                            <EmojiPicker 
                              onSelect={emoji => {
                                setPostCommentsInput(prev => ({
                                  ...prev,
                                  [post.id]: (prev[post.id] || '') + emoji
                                }))
                              }} 
                              placement="up" 
                            />
                            <WriteBarIcon 
                              mode="send" 
                              onClick={() => handleSendComment(post.id)} 
                              disabled={!(postCommentsInput[post.id]?.trim())} 
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
              )}
            </div>
          ))
        )}
      </div>

      {/* Context Menu for Posts */}
      {postContextMenu && postContextMenu.visible && (
        <div
          style={{ position: 'fixed', top: postContextMenu.y, left: Math.max(10, postContextMenu.x - 140), zIndex: 9999 }}
          className="custom-context-menu"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleRemoveBookmark(postContextMenu.postId)
              setPostContextMenu(null)
            }}
            className="context-menu-item context-menu-item-danger"
          >
            <Icon28BookmarkOutline width={16} height={16} />
            <span>Убрать из закладок</span>
          </button>
        </div>
      )}
      {/* Context Menu for Comments */}
      {commentContextMenu && commentContextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            top: commentContextMenu.y,
            left: commentContextMenu.x,
            zIndex: 9999
          }}
          className="custom-context-menu"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleReplyToComment(commentContextMenu.comment, commentContextMenu.postId)
              setCommentContextMenu(null)
            }}
            className="context-menu-item"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
            <span>Ответить</span>
          </button>

          {profile && commentContextMenu.comment.author.id === profile.id && (
            <button
              onClick={() => {
                handleStartEditComment(commentContextMenu.comment, commentContextMenu.postId)
                setCommentContextMenu(null)
              }}
              className="context-menu-item"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>Редактировать</span>
            </button>
          )}

          {profile && (commentContextMenu.comment.author.id === profile.id || profile.id === 'fee894db-c5b0-4022-bb9f-56c60decac86' || profile.username === 'viht' || profile.username === 'adm' || profile.role === 'admin' || profile.role === 'moderator' || (profile.roles && (profile.roles.includes('admin') || profile.roles.includes('moderator') || profile.roles.includes('creator')))) && (
            <>
              <div style={{ height: '1px', background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '4px 0' }} />
              <button
                onClick={() => {
                  handleDeleteComment(commentContextMenu.comment.id, commentContextMenu.postId)
                  setCommentContextMenu(null)
                }}
                className="context-menu-item context-menu-item-danger"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Удалить</span>
              </button>
            </>
          )}
        </div>
      )}
    </Panel>
  )
}
