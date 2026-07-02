import React, { useEffect, useState } from 'react'
import {
  Button,
  Text,
  Spinner,
  IconButton,
  WriteBar,
  WriteBarIcon
} from '@vkontakte/vkui'
import { Icon24Dismiss, Icon28SendOutline } from '@vkontakte/icons'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { CustomAvatar } from './CustomAvatar'

interface Post {
  id: string
  content: string
  images: string[] | null
  author: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
  }
}

interface Story {
  id: string
  user_id: string
  media_url: string
  created_at: string
  author: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

interface Conversation {
  id: string
  participant: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

interface ShareModalProps {
  post?: Post | null
  story?: Story | null
  mode?: 'all' | 'dm_only'
  onClose: () => void
  onSuccess?: () => void
}

export const ShareModal: React.FC<ShareModalProps> = ({ 
  post = null, 
  story = null, 
  mode = 'all', 
  onClose, 
  onSuccess 
}) => {
  const { profile } = useAuthStore()
  const [commentText, setCommentText] = useState('')
  const [reposting, setReposting] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [sendingToChatId, setSendingToChatId] = useState<string | null>(null)
  const [sentChats, setSentChats] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if ((!post && !story) || !profile) return

    const loadConversations = async () => {
      setLoadingChats(true)
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select(`
            id,
            participant_1:profiles!conversations_participant_1_fkey(id, full_name, avatar_url),
            participant_2:profiles!conversations_participant_2_fkey(id, full_name, avatar_url)
          `)
          .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`)
          .order('updated_at', { ascending: false })

        if (error) throw error
        if (data) {
          const list = data.map((item: any) => {
            const other = item.participant_1.id === profile.id ? item.participant_2 : item.participant_1
            return {
              id: item.id,
              participant: other
            }
          })
          setConversations(list)
        }
      } catch (err) {
        console.error('Error loading conversations for share:', err)
      } finally {
        setLoadingChats(false)
      }
    }

    loadConversations()
  }, [post, story, profile])

  if (!post && !story) return null

  const handleRepostToWall = async () => {
    if (!profile || !post) return
    setReposting(true)
    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          author_id: profile.id,
          content: commentText,
          repost_source_id: post.id
        })

      if (error) throw error

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          title: 'Поделиться',
          text: 'Запись опубликована на вашей стене!'
        }
      }))
      
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error('Error reposting to wall:', err)
    } finally {
      setReposting(false)
    }
  }

  const handleSendToMessage = async (convId: string) => {
    if (!profile) return
    setSendingToChatId(convId)
    try {
      let shareMessage = ''
      if (post) {
        shareMessage = `${window.location.origin}/post/${post.id}`
      } else if (story) {
        shareMessage = `${window.location.origin}/story/${story.id}`
      }
      
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_id: profile.id,
          content: shareMessage
        })

      if (error) throw error

      setSentChats(prev => ({ ...prev, [convId]: true }))

      if (story) {
        await supabase.rpc('increment_story_shares', { story_id: story.id })
      }

      if (onSuccess) onSuccess()

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          title: 'Поделиться',
          text: 'Отправлено!'
        }
      }))
    } catch (err) {
      console.error('Error sending share message:', err)
    } finally {
      setSendingToChatId(null)
    }
  }

  const headerTitle = mode === 'dm_only' ? 'Поделиться в личных сообщениях' : (story ? 'Поделиться историей' : 'Поделиться записью')

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20000, // Make sure it sits above the story viewer overlay (which is 11000)
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }}
      />

      {/* Modal Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 480,
        backgroundColor: 'var(--vkui--color_background_content, #ffffff)',
        border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.12))',
        borderRadius: 20,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '85vh',
        overflow: 'hidden',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0, 0, 0, 0.08))'
        }}>
          <Text weight="1" style={{ fontSize: 17 }}>{headerTitle}</Text>
          <IconButton onClick={onClose} aria-label="Закрыть">
            <Icon24Dismiss />
          </IconButton>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}>
          {/* Option 1: Wall Repost */}
          {mode === 'all' && post && (
            <>
              <div>
                <Text weight="2" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--vkui--color_text_secondary)', marginBottom: 8 }}>
                  На своей стене
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <WriteBar
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Ваш комментарий (необязательно)"
                    style={{ padding: 0 }}
                    after={
                      <WriteBarIcon 
                        mode="send" 
                        onClick={handleRepostToWall} 
                        disabled={reposting} 
                        aria-label="Опубликовать"
                      >
                        <Icon28SendOutline />
                      </WriteBarIcon>
                    }
                  />
                  <Button size="m" stretched onClick={handleRepostToWall} loading={reposting}>
                    Опубликовать на стене
                  </Button>
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--vkui--color_separator_primary_alpha, rgba(0, 0, 0, 0.08))' }} />
            </>
          )}

          {/* Option 2: DM share */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 200 }}>
            {mode !== 'dm_only' && (
              <Text weight="2" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--vkui--color_text_secondary)', marginBottom: 12 }}>
                В личных сообщениях
              </Text>
            )}
            
            {loadingChats ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                <Spinner size="s" />
              </div>
            ) : conversations.length === 0 ? (
              <Text style={{ fontSize: 14, color: 'var(--vkui--color_text_secondary)', textAlign: 'center', padding: 20 }}>
                У вас нет активных бесед.
              </Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 300 }}>
                {conversations.map(conv => {
                  const isSent = !!sentChats[conv.id]
                  const isSending = sendingToChatId === conv.id

                  return (
                    <div 
                      key={conv.id} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CustomAvatar size={36} src={conv.participant.avatar_url} name={conv.participant.full_name} id={conv.participant.id} />
                        <Text style={{ fontSize: 14, fontWeight: 500 }}>
                          {conv.participant.full_name}
                        </Text>
                      </div>

                      <Button 
                        size="s" 
                        mode={isSent ? 'secondary' : 'primary'}
                        disabled={isSent || isSending}
                        onClick={() => handleSendToMessage(conv.id)}
                      >
                        {isSending ? <Spinner size="s" /> : isSent ? 'Отправлено' : 'Отправить'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
