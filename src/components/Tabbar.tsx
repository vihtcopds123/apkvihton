import React from 'react'
import {
  IconButton
} from '@vkontakte/vkui'
import {
  Icon24UserOutline,
  Icon24MessageOutline,
  Icon24UsersOutline,
  Icon24Users3Outline,
  Icon24NewsfeedOutline,
  Icon24BookmarkOutline,
  Icon24MusicOutline
} from '@vkontakte/icons'
import { useAppStore } from '../store/useAppStore'
import type { StoryType } from '../store/useAppStore'

export const Tabbar: React.FC = () => {
  const { activeStory, setStory, unreadMessagesCount, menuItems } = useAppStore()

  const defaultNavItems: { story: StoryType; icon: React.ReactNode; label: string; badge?: number }[] = [
    { story: 'profile', label: 'Моя страница', icon: <Icon24UserOutline /> },
    { story: 'messages', label: 'Сообщения', icon: <Icon24MessageOutline />, badge: unreadMessagesCount },
    { story: 'friends', label: 'Друзья', icon: <Icon24UsersOutline /> },
    { story: 'groups', label: 'Сообщества', icon: <Icon24Users3Outline /> },
    { story: 'feed', label: 'Новости', icon: <Icon24NewsfeedOutline /> },
    { story: 'bookmarks', label: 'Закладки', icon: <Icon24BookmarkOutline /> }
  ]

  const navItems = menuItems
    .filter(item => item.visible)
    .map(item => {
      const found = defaultNavItems.find(d => d.story === item.story)
      return found ? { ...found, label: item.label } : null
    })
    .filter((item): item is typeof defaultNavItems[0] => item !== null)

  const allItems: { story: StoryType; icon: React.ReactNode; label: string; badge?: number }[] = [
    ...navItems,
    { story: 'music', label: 'Музыка', icon: <Icon24MusicOutline /> }
  ]

  return (
    <div className="floating-tabbar">
      {allItems.map(item => {
        const isSelected = activeStory === item.story
        return (
          <div key={item.story} style={{ position: 'relative' }}>
            <IconButton
              onClick={() => {
                setStory(item.story)
              }}
              aria-label={item.label}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: isSelected ? 'rgba(0, 119, 255, 0.15)' : 'transparent',
                color: isSelected ? '#0077ff' : '#828892',
                transition: 'all 0.2s ease-in-out',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {item.icon}
            </IconButton>
            
            {item.badge && item.badge > 0 ? (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                background: '#ff3b30',
                color: '#fff',
                padding: '1.5px 5px',
                borderRadius: 8,
                fontSize: 8,
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(255,59,48,0.3)',
                border: '1px solid rgba(255, 255, 255, 0.6)'
              }}>
                {item.badge}
              </span>
            ) : null}
            
            {isSelected && (
              <span style={{
                position: 'absolute',
                bottom: 2,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 3,
                height: 3,
                borderRadius: '50%',
                backgroundColor: '#0077ff',
                boxShadow: '0 0 6px #0077ff'
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
