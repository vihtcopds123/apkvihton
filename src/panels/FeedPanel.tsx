import React, { useEffect, useState } from 'react'
import {
  Panel,
  Spinner
} from '@vkontakte/vkui'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { CustomAvatar } from '../components/CustomAvatar'
import { EmojiPicker } from '../components/EmojiPicker'
import { SkeletonPost } from '../components/SkeletonLoader'
import { ShareModal } from '../components/ShareModal'
import { StoryViewerOverlay } from '../components/StoryViewerOverlay'
import type { Story } from '../components/StoryViewerOverlay'
import { PostCard } from '../components/PostCard'
import type { Post } from '../components/PostCard'
import { StoryCreator } from '../components/StoryCreator'
import { useFeedPosts, useStories } from '../hooks/useQueries'
import { useQueryClient } from '@tanstack/react-query'
import { uploadToTelegram } from '../utils/telegramStorage'
import type { Track } from '../store/useMusicStore'
import { MusicSelectModal } from '../components/MusicSelectModal'


interface FeedPanelProps {
  id: string
}

export const FeedPanel: React.FC<FeedPanelProps> = ({ id }) => {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()
  const { data: posts = [], isLoading: loading } = useFeedPosts(profile?.id)
  const { data: stories = [] } = useStories()
  
  const [activeStoriesList, setActiveStoriesList] = useState<Story[] | null>(null)

  // Poll state
  const [isAddingPoll, setIsAddingPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [sharingPost, setSharingPost] = useState<Post | null>(null)

  // New Post State
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
  const [uploadingPost, setUploadingPost] = useState(false)
  const [attachedAudio, setAttachedAudio] = useState<Track | null>(null)
  const [showMusicModal, setShowMusicModal] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Post creator widget state
  const [showPostModal, setShowPostModal] = useState(false)
  const [markdownMenu, setMarkdownMenu] = useState<{ visible: boolean; x: number; y: number; start: number; end: number } | null>(null)
  const postTextareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleOpenPostModal = () => {
    setShowPostModal(true)
  }

  const handleClosePostModal = () => {
    setShowPostModal(false)
    setNewPostText('')
    setAttachedMedias([])
    setIsAddingPoll(false)
    setPollQuestion('')
    setPollOptions(['', ''])
    setAttachedAudio(null)
  }

  const postCreatorRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (
        showPostModal && 
        !uploadingPost &&
        postCreatorRef.current && 
        !postCreatorRef.current.contains(event.target as Node)
      ) {
        const target = event.target as HTMLElement
        // Не закрывать форму, если кликнули на селекторы смайликов или поповеры VKUI
        if (target.closest('.emoji-picker-dropdown') || target.closest('.vkuiPopover') || target.closest('.vkuiAppRoot')) {
          return
        }
        handleClosePostModal()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showPostModal, uploadingPost])

  const handleTextareaContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const ta = e.currentTarget
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (start === end) { setMarkdownMenu(null); return }
    setMarkdownMenu({ visible: true, x: e.clientX, y: e.clientY, start, end })
  }

  const applyMarkdown = (prefix: string, suffix: string) => {
    if (!markdownMenu) return
    const { start, end } = markdownMenu
    const selected = newPostText.substring(start, end)
    const before = newPostText.substring(0, start)
    const after = newPostText.substring(end)
    setNewPostText(`${before}${prefix}${selected}${suffix}${after}`)
    setMarkdownMenu(null)
    setTimeout(() => {
      const ta = postTextareaRef.current
      if (ta) {
        ta.focus()
        ta.setSelectionRange(start + prefix.length, end + prefix.length)
      }
    }, 10)
  }


  const handleInsertEmoji = (emoji: string) => {
    setNewPostText(prev => prev + emoji)
  }



  useEffect(() => {
    const handleStoryDeleted = () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    }
    window.addEventListener('story-deleted-global', handleStoryDeleted)
    return () => {
      window.removeEventListener('story-deleted-global', handleStoryDeleted)
    }
  }, [queryClient])

  useEffect(() => {
    if (!profile?.id) return

    const postsSubscription = supabase
      .channel('feed-posts-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['feed-posts', profile.id] })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_likes'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['feed-posts', profile.id] })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `user_id=eq.${profile.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['feed-posts', profile.id] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(postsSubscription)
    }
  }, [profile?.id, queryClient])

  const handleViewStories = (userStories: Story[]) => {
    setActiveStoriesList(userStories)
  }

  const handleCreatePost = async () => {
    if (!profile || (!newPostText.trim() && attachedMedias.length === 0 && !isAddingPoll && !attachedAudio)) return
    if (attachedMedias.some(m => m.isUploading)) {
      alert('Пожалуйста, подождите завершения загрузки файлов.')
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
          author_id: profile.id,
          content: newPostText,
          images: imageUrls.length > 0 ? imageUrls : null,
          poll_id: createdPollId,
          audio_id: attachedAudio ? attachedAudio.id : null
        })
        .select(`
          *,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, avatar_decoration),
          group:groups(id, name, avatar_url),
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
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] })
      setNewPostText('')
      setAttachedMedias([])
      setIsAddingPoll(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      handleClosePostModal()
    } catch (err) {
      console.error('Error creating post:', err)
    } finally {
      setUploadingPost(false)
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
          // Upload aborted
          continue
        }
        console.error('File upload error:', err)
        alert('Ошибка при загрузке файла')
        setAttachedMedias(prev => prev.filter(m => m.id !== item.id))
      }
    }
  }



  return (
    <Panel id={id} onContextMenu={(e) => { if (!(e.target as HTMLElement).closest('textarea') && !(e.target as HTMLElement).closest('input')) e.preventDefault() }}>

      {/* Stories list */}
      {stories.length >= 0 && (() => {
        const groupedStories: Record<string, Story[]> = stories.reduce((acc, story) => {
          if (!acc[story.user_id]) {
            acc[story.user_id] = []
          }
          acc[story.user_id].push(story)
          return acc
        }, {} as Record<string, Story[]>)

        const myStories = profile ? (groupedStories[profile.id] || []) : []
        const hasMyStories = myStories.length > 0

        return (
          <div 
            style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '8px 16px 16px 16px', 
              overflowX: 'auto', 
              background: 'transparent', 
              marginBottom: 16,
              scrollbarWidth: 'none'
            }}
          >
            {/* Own Story slot */}
            <div 
              className="my-story-card"
              style={{ 
                position: 'relative', 
                width: 80, 
                height: 120, 
                borderRadius: 12, 
                overflow: 'hidden', 
                flexShrink: 0, 
                cursor: 'pointer',
                background: hasMyStories 
                  ? `url(${myStories[0].media_url}) center/cover no-repeat` 
                  : (profile?.avatar_url 
                      ? `url(${profile.avatar_url}) center/cover no-repeat` 
                      : 'linear-gradient(135deg, var(--vkui--color_background_accent) 0%, #aa3bff 100%)'
                    ),
              }}
              onClick={() => {
                if (hasMyStories) {
                  handleViewStories(myStories)
                }
              }}
            >
              {hasMyStories && (
                <div 
                  className="add-more-story-btn"
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    zIndex: 10
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <StoryCreator>
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#007aff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      color: '#ffffff',
                      border: '1.5px solid #ffffff'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </div>
                  </StoryCreator>
                </div>
              )}

              {/* Dark overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.7) 100%)',
                zIndex: 1
              }} />

              {/* + Plus button or Avatar in bottom center */}
              <div 
                style={{ 
                  position: 'absolute', 
                  bottom: 24, 
                  left: '50%', 
                  transform: 'translateX(-50%)', 
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {hasMyStories ? (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #0077ff', overflow: 'hidden', background: '#fff' }}>
                    <img src={profile?.avatar_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                )}
              </div>

              {/* Story Creator Input Layer */}
              {!hasMyStories && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 3 }} onClick={e => e.stopPropagation()}>
                  <StoryCreator />
                </div>
              )}

              {/* Label */}
              <span style={{ 
                position: 'absolute', 
                bottom: 6, 
                left: 4, 
                right: 4, 
                fontSize: 10, 
                color: '#ffffff', 
                fontWeight: 600, 
                textAlign: 'center', 
                zIndex: 2,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}>
                {hasMyStories ? 'Мои' : 'История'}
              </span>
            </div>

            {/* Other stories */}
            {Object.values(groupedStories)
              .filter(userStories => userStories[0].user_id !== profile?.id)
              .map((userStories) => {
                const firstStory = userStories[0]
                return (
                  <div 
                    key={firstStory.user_id} 
                    onClick={() => handleViewStories(userStories)}
                    style={{ 
                      position: 'relative', 
                      width: 80, 
                      height: 120, 
                      borderRadius: 12, 
                      overflow: 'hidden', 
                      flexShrink: 0, 
                      cursor: 'pointer',
                      background: `url(${firstStory.media_url}) center/cover no-repeat`,
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {/* Dark overlay */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.7) 100%)',
                      zIndex: 1
                    }} />

                    {/* User Avatar with Blue Border */}
                    <div 
                      style={{ 
                        position: 'absolute', 
                        bottom: 24, 
                        left: '50%', 
                        transform: 'translateX(-50%)', 
                        zIndex: 2,
                        width: 28, 
                        height: 28, 
                        borderRadius: '50%', 
                        border: '2px solid #0077ff', 
                        overflow: 'hidden', 
                        background: '#fff' 
                      }}
                    >
                      <img src={firstStory.author.avatar_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    {/* User Name */}
                    <span style={{ 
                      position: 'absolute', 
                      bottom: 6, 
                      left: 4, 
                      right: 4, 
                      fontSize: 10, 
                      color: '#ffffff', 
                      fontWeight: 600, 
                      textAlign: 'center', 
                      zIndex: 2,
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {firstStory.author.full_name?.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
          </div>
        )
      })()}

      {/* Post Creator Widget */}
      {profile && (
        <div 
          ref={postCreatorRef}
          className={`post-creator-widget ${showPostModal ? 'expanded' : 'collapsed'}`}
          onClick={() => {
            if (!showPostModal) {
              handleOpenPostModal()
            }
          }}
        >
          {!showPostModal ? (
            <>
              <CustomAvatar size={44} src={profile.avatar_url} name={profile.full_name} id={profile.id} decoration={profile.avatar_decoration} />
              <span style={{ flex: 1, fontSize: 15, color: 'var(--vkui--color_text_secondary)', fontWeight: 400 }}>
                Опубликуйте свою новость...
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
              </div>
            </>
          ) : (
            <div className="expanded-view" style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
              {uploadingPost && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  zIndex: 100,
                  gap: 12,
                  padding: 16,
                  borderRadius: 16
                }}>
                  <Spinner size="m" style={{ color: '#fff' }} />
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    Публикация записи...
                  </div>
                </div>
              )}
              
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CustomAvatar size={40} src={profile?.avatar_url} name={profile?.full_name} id={profile?.id} decoration={profile?.avatar_decoration} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--vkui--color_text_primary)' }}>{profile?.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>Новая запись</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); if (!uploadingPost) handleClosePostModal() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', fontSize: 24, lineHeight: 1, padding: 4, borderRadius: 8, transition: 'transform 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  ×
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={postTextareaRef}
                autoFocus
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                onClick={e => e.stopPropagation()}
                onContextMenu={handleTextareaContextMenu}
                onMouseUp={() => {
                  const ta = postTextareaRef.current
                  if (ta && ta.selectionStart === ta.selectionEnd) setMarkdownMenu(null)
                }}
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
                style={{
                  width: '100%',
                  minHeight: 120,
                  padding: '14px 16px',
                  fontSize: 15,
                  lineHeight: 1.5,
                  borderRadius: 14,
                  border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.12))',
                  background: 'var(--vkui--color_background_secondary, #f2f3f5)',
                  color: 'var(--vkui--color_text_primary)',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />

              {/* Markdown context menu */}
              {markdownMenu?.visible && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  style={{ position: 'fixed', top: markdownMenu.y, left: markdownMenu.x, zIndex: 20000, background: 'var(--vkui--color_background_content)', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.25)', border: '1px solid var(--vkui--color_separator_primary_alpha)', padding: '4px 0', minWidth: 180 }}
                >
                  {[
                    { label: 'Жирный', icon: 'B', prefix: '**', suffix: '**', bold: true },
                    { label: 'Курсив', icon: 'I', prefix: '*', suffix: '*', italic: true },
                    { label: 'Зачёркнутый', icon: 'S', prefix: '~~', suffix: '~~', strike: true },
                    { label: 'Код', icon: '<>', prefix: '`', suffix: '`', mono: true },
                    { label: 'Блок кода', icon: '{}', prefix: '```\n', suffix: '\n```', mono: true },
                    { label: 'Ссылка', icon: '🔗', prefix: '[', suffix: '](url)', link: true },
                  ].map(item => (
                    <div
                      key={item.label}
                      onClick={() => applyMarkdown(item.prefix, item.suffix)}
                      style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--vkui--color_text_primary)', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--vkui--color_background_secondary)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ width: 22, fontWeight: item.bold ? 700 : 400, fontStyle: item.italic ? 'italic' : 'normal', textDecoration: item.strike ? 'line-through' : 'none', fontFamily: item.mono ? 'monospace' : 'inherit', fontSize: item.link ? 16 : 13 }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Image previews */}
              {attachedMedias.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                  {attachedMedias.map((item) => {
                    const isVideo = item.file.type.startsWith('video/') || item.file.name.toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)
                    if (isVideo) {
                      return (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', width: 140, height: 82, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--vkui--color_separator_primary_alpha)' }}>
                          <div style={{ position: 'relative', width: '100%', height: 52, backgroundColor: '#000' }}>
                            <video src={item.previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                            {item.isUploading && (
                              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, zIndex: 3, gap: 4 }}>
                                <Spinner size="s" style={{ color: '#fff' }} />
                                <span>{item.progress}%</span>
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                item.abortController?.abort()
                                URL.revokeObjectURL(item.previewUrl)
                                setAttachedMedias(prev => prev.filter(m => m.id !== item.id))
                              }}
                              style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4 }}
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
                            style={{ width: '100%', height: 30, border: 'none', padding: '4px 8px', boxSizing: 'border-box', fontSize: 11, background: 'var(--vkui--color_background_secondary)', color: 'var(--vkui--color_text_primary)', outline: 'none' }}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={item.id} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden' }}>
                        <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {item.isUploading && (
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 'bold', zIndex: 3, gap: 4 }}>
                            <Spinner size="s" style={{ color: '#fff' }} />
                            <span>{item.progress}%</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            item.abortController?.abort()
                            URL.revokeObjectURL(item.previewUrl)
                            setAttachedMedias(prev => prev.filter(m => m.id !== item.id))
                          }}
                          style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4 }}
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Attached audio preview */}
              {attachedAudio && (
                <div 
                  onClick={e => e.stopPropagation()}
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

              {/* Poll section */}
              {isAddingPoll && (
                <div style={{ padding: 16, borderRadius: 14, background: 'var(--vkui--color_background_secondary, #f2f3f5)', display: 'flex', flexDirection: 'column', gap: 12 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>Опрос</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Тема опроса"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', fontSize: 14, fontWeight: 500, borderRadius: 10, border: '1px solid var(--vkui--color_separator_primary_alpha)', background: 'var(--vkui--color_background_content)', color: 'var(--vkui--color_text_primary)', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pollOptions.map((opt, oIdx) => (
                      <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#99a2ad', flexShrink: 0 }} />
                        <input
                          type="text"
                          placeholder={`Вариант ${oIdx + 1}`}
                          value={opt}
                          onChange={(e) => setPollOptions(prev => prev.map((o, idx) => idx === oIdx ? e.target.value : o))}
                          style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--vkui--color_separator_primary_alpha)', background: 'var(--vkui--color_background_content)', color: 'var(--vkui--color_text_primary)', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {pollOptions.length > 2 && (
                          <button onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== oIdx))} style={{ background: 'none', border: 'none', color: '#ff453a', cursor: 'pointer', fontSize: 16, padding: 4 }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {pollOptions.length < 10 && (
                      <button onClick={() => setPollOptions(prev => [...prev, ''])} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--vkui--color_separator_primary_alpha)', background: 'transparent', color: '#007aff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Вариант</button>
                    )}
                    <button onClick={() => { setIsAddingPoll(false); setPollQuestion(''); setPollOptions(['', '']) }} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--vkui--color_text_secondary)', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
                  </div>
                </div>
              )}

              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--vkui--color_separator_primary_alpha)', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: 'var(--vkui--color_background_secondary)', color: 'var(--vkui--color_text_primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s', flexShrink: 0 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--vkui--color_background_secondary)')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Фото
                </button>
                <button onClick={() => setIsAddingPoll(!isAddingPoll)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: isAddingPoll ? 'rgba(0,122,255,0.12)' : 'var(--vkui--color_background_secondary)', color: isAddingPoll ? '#007aff' : 'var(--vkui--color_text_primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s', flexShrink: 0 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.08)')} onMouseLeave={e => (e.currentTarget.style.background = isAddingPoll ? 'rgba(0,122,255,0.12)' : 'var(--vkui--color_background_secondary)')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Опрос
                </button>
                <button onClick={() => setShowMusicModal(true)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: attachedAudio ? 'rgba(0,122,255,0.12)' : 'var(--vkui--color_background_secondary)', color: attachedAudio ? '#007aff' : 'var(--vkui--color_text_primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s', flexShrink: 0 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.08)')} onMouseLeave={e => (e.currentTarget.style.background = attachedAudio ? 'rgba(0,122,255,0.12)' : 'var(--vkui--color_background_secondary)')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  Аудио
                </button>
                <EmojiPicker onSelect={handleInsertEmoji} placement="up" />
                <div style={{ flex: 1 }} />
                <button
                  onClick={handleCreatePost}
                  disabled={uploadingPost || attachedMedias.some(m => m.isUploading) || (!newPostText.trim() && attachedMedias.length === 0 && !isAddingPoll && !attachedAudio)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 12,
                    border: 'none',
                    background: (attachedMedias.some(m => m.isUploading) || (!newPostText.trim() && attachedMedias.length === 0 && !isAddingPoll && !attachedAudio)) ? 'rgba(0,122,255,0.35)' : '#007aff',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: (attachedMedias.some(m => m.isUploading) || (!newPostText.trim() && attachedMedias.length === 0 && !isAddingPoll && !attachedAudio)) ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s',
                    flexShrink: 0
                  }}
                >
                  {uploadingPost && <Spinner size="s" style={{ color: '#fff' }} />}
                  {uploadingPost ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feed List - Separated Cards */}
      <div className="feed-posts-list" style={{ display: 'flex', flexDirection: 'column' }}>
        {loading && posts.length === 0 ? (
          <>
            <SkeletonPost />
            <SkeletonPost />
            <SkeletonPost />
          </>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--vkui--color_text_secondary)' }}>
            Лента пуста. Добавьте друзей или напишите что-нибудь на своей стене!
          </div>
        ) : (
          posts.map(post => (
            <PostCard 
              key={post.id}
              post={post}
              onDeleteSuccess={() => queryClient.invalidateQueries({ queryKey: ['feed-posts', profile?.id] })}
              onShareClick={(postObj) => setSharingPost(postObj)}
            />
          ))
        )}
      </div>

      {sharingPost && (
        <ShareModal 
          post={sharingPost} 
          onClose={() => setSharingPost(null)} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['feed-posts'] })
          }}
        />
      )}

      {activeStoriesList && (
        <StoryViewerOverlay 
          stories={activeStoriesList} 
          onClose={() => setActiveStoriesList(null)} 
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
    </Panel>
  )
}
