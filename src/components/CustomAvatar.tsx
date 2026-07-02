import React from 'react'
import { Avatar } from '@vkontakte/vkui'

interface CustomAvatarProps {
  src?: string | null
  size?: number
  name?: string | null
  id?: string | null
  onClick?: (e: React.MouseEvent) => void
  style?: React.CSSProperties
  className?: string
  decoration?: string | null
}

const colors = [
  '#ff9500', // iOS Orange
  '#ff2d55', // iOS Pink
  '#5856d6', // iOS Purple
  '#34c759', // iOS Green
  '#007aff', // iOS Blue
  '#af52de', // iOS Indigo
  '#ff3b30', // iOS Red
  '#5ac8fa', // iOS Teal
  '#30d158', // System Green Light
  '#bf5af2'  // Dark Purple
]

const getAvatarColor = (identifier: string) => {
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

const getInitials = (name?: string | null) => {
  if (!name) return '?'
  const cleanName = name.trim()
  if (!cleanName) return '?'
  return cleanName[0].toUpperCase()
}

export const CustomAvatar: React.FC<CustomAvatarProps> = ({
  src,
  size = 40,
  name,
  id,
  onClick,
  style,
  className,
  decoration
}) => {
  const renderAvatar = () => {
    if (src) {
      return (
        <Avatar
          src={src}
          size={size}
          style={style}
          className={className}
        />
      )
    }

    const initials = getInitials(name)
    const identifier = id || name || 'default'
    const bgColor = getAvatarColor(identifier)

    return (
      <Avatar
        size={size}
        className={className}
        style={{
          ...style,
          backgroundColor: bgColor,
          color: '#ffffff',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size ? Math.max(10, Math.round(size * 0.38)) : 14,
          userSelect: 'none'
        }}
      >
        {initials}
      </Avatar>
    )
  }

  if (decoration) {
    const decorationSize = size * 1.2
    const offset = (decorationSize - size) / 2
    return (
      <div 
        onClick={onClick}
        style={{ 
          position: 'relative', 
          width: size, 
          height: size, 
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default'
        }}
      >
        {renderAvatar()}
        <img 
          src={decoration} 
          alt=""
          style={{
            position: 'absolute',
            top: -offset,
            left: -offset,
            width: decorationSize,
            height: decorationSize,
            pointerEvents: 'none',
            zIndex: 2
          }}
        />
      </div>
    )
  }

  return (
    <div onClick={onClick} style={{ display: 'inline-flex', cursor: onClick ? 'pointer' : 'default' }}>
      {renderAvatar()}
    </div>
  )
}
