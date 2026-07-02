import React from 'react'
import { CustomAvatar } from './CustomAvatar'

export interface Conversation {
  id: string
  updated_at: string
  is_group?: boolean
  group_name?: string | null
  group_avatar_url?: string | null
  created_by?: string | null
  deleted_by?: string[]
  participant: {
    id: string
    full_name: string | null
    avatar_url: string | null
    is_online: boolean
    username: string | null
    num_id?: number | null
    last_seen?: string | null
    role?: string | null
    status_preference?: string | null
  }
  lastMessage?: {
    content: string | null
    created_at: string
    sender_id: string
    is_read: boolean
  }
}

interface DialogsListProps {
  conversations: Conversation[]
  selectedChatId: string | null
  profileId: string | undefined
  selectChat: (chatId: string, participant: any) => void
  isRecentlyOnline: (lastSeen?: string | null) => boolean
  GroupAvatar: React.ComponentType<{ size: number; src: string | null | undefined }>
}

export const DialogsList: React.FC<DialogsListProps> = ({
  conversations,
  selectedChatId,
  profileId,
  selectChat,
  isRecentlyOnline,
  GroupAvatar
}) => {
  return (
    <div className="v-chat-sidebar">
      {conversations.map(c => {
        const isActive = selectedChatId === c.id
        const isSaved = !c.is_group && c.participant.id === profileId
        const isOnline = !c.is_group && c.participant.status_preference !== 'offline' && isRecentlyOnline(c.participant.last_seen)
        const hasUnread = c.lastMessage && !c.lastMessage.is_read && c.lastMessage.sender_id !== profileId
        return (
          <div key={c.id}
            onClick={(e) => { 
              e.stopPropagation()
              selectChat(c.id, c.is_group ? { 
                id: c.id, 
                full_name: c.group_name || 'Группа', 
                avatar_url: c.group_avatar_url || null, 
                is_online: false, 
                username: null, 
                is_group: true 
              } : c.participant) 
            }}
            style={{ 
              position: 'relative', 
              cursor: 'pointer', 
              padding: '2px', 
              borderRadius: '50%', 
              border: isActive ? '2.5px solid #007aff' : '2.5px solid transparent', 
              transition: 'all 0.25s', 
              transform: isActive ? 'scale(1.06)' : 'none', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              boxSizing: 'border-box' 
            }}
            title={isSaved ? 'Избранное' : c.is_group ? (c.group_name || 'Группа') : c.participant.full_name || ''}
          >
            {isSaved ? (
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #2f80ed, #007aff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
            ) : c.is_group ? (
              <GroupAvatar size={44} src={c.group_avatar_url} />
            ) : (
              <CustomAvatar size={44} src={c.participant.avatar_url} name={c.participant.full_name} id={c.participant.id} />
            )}
            {!isSaved && isOnline && (
              <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#30d158', border: '2px solid var(--vkui--color_background_content)' }} />
            )}
            {hasUnread && (
              <div style={{ position: 'absolute', top: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#ff3b30', border: '2px solid var(--vkui--color_background_content)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
