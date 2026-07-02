import React from 'react'
import {
  SimpleCell,
  Group,
  Button
} from '@vkontakte/vkui'
import {
  Icon28NewsfeedOutline,
  Icon28MessageOutline,
  Icon28UsersOutline,
  Icon28Users3Outline,
  Icon28UserOutline,
  Icon28BookmarkOutline
} from '@vkontakte/icons'
import { useAppStore } from '../store/useAppStore'
import type { StoryType } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { AdminBadge } from './AdminBadge'
import { CustomAvatar } from './CustomAvatar'

export const Sidebar: React.FC = () => {
  const { activeStory, setStory, unreadMessagesCount, menuItems } = useAppStore()
  const { profile, signOut } = useAuthStore()

  const defaultNavItems: { story: StoryType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { story: 'profile', label: 'Моя страница', icon: <Icon28UserOutline /> },
    { story: 'messages', label: 'Сообщения', icon: <Icon28MessageOutline />, badge: unreadMessagesCount },
    { story: 'friends', label: 'Друзья', icon: <Icon28UsersOutline /> },
    { story: 'groups', label: 'Сообщества', icon: <Icon28Users3Outline /> },
    { story: 'feed', label: 'Новости', icon: <Icon28NewsfeedOutline /> },
    { story: 'bookmarks', label: 'Закладки', icon: <Icon28BookmarkOutline /> }
  ]

  const navItems = menuItems
    .filter(item => item.visible)
    .map(item => {
      const found = defaultNavItems.find(d => d.story === item.story)
      return found ? { ...found, label: item.label } : null
    })
    .filter((item): item is typeof defaultNavItems[0] => item !== null)

  return (
    <Group style={{ padding: '12px', background: 'var(--vkui--color_background_content)', borderRadius: 12 }}>
      {profile && (
        <SimpleCell
          before={<CustomAvatar size={36} src={profile.avatar_url} name={profile.full_name} id={profile.id} decoration={profile.avatar_decoration} />}
          subtitle={`@${profile.username || 'user'}`}
          onClick={() => setStory('profile')}
          style={{ cursor: 'pointer', marginBottom: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{profile.full_name}</span>
            <AdminBadge username={profile.username} role={profile.role} />
          </div>
        </SimpleCell>
      )}

      {navItems.map(item => {
        const isSelected = activeStory === item.story
        return (
          <SimpleCell
            key={item.story}
            before={item.icon}
            indicator={item.badge && item.badge > 0 ? <span style={{
              background: 'var(--vkui--color_background_accent)', color: '#fff', padding: '2px 6px',
              borderRadius: 10, fontSize: 11, fontWeight: 'bold'
            }}>{item.badge}</span> : null}
            onClick={() => setStory(item.story)}
            style={{
              cursor: 'pointer',
              borderRadius: 8,
              background: isSelected ? 'var(--vkui--color_background_secondary)' : 'transparent',
              color: isSelected ? 'var(--vkui--color_text_accent)' : 'var(--vkui--color_text_primary)'
            }}
          >
            {item.label}
          </SimpleCell>
        )
      })}

      <div style={{ marginTop: 24, padding: '0 8px' }}>
        <Button mode="secondary" appearance="negative" stretched onClick={signOut}>
          Выйти
        </Button>
      </div>
    </Group>
  )
}
