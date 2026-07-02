import React from 'react'

interface AdminBadgeProps {
  username?: string | null | undefined
  role?: string | null | undefined
  roles?: string[] | null | undefined
}

const ROLE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  creator:   { label: 'Создатель', color: 'creator',  emoji: '' },
  donator:   { label: 'Донатер',   color: '#ffd700',  emoji: '💎' },
  sponsor:   { label: 'Спонсор',   color: '#aa3bff',  emoji: '🤝' },
  first:     { label: 'Первый',    color: '#007aff',  emoji: '1️⃣' },
  cool:      { label: 'Крутой',    color: '#a0a0a0',  emoji: '😎' },
  star:      { label: 'Звёздочка', color: '#ffd700',  emoji: '⭐' },
  heart:     { label: 'Сердечко',  color: '#ff2d55',  emoji: '❤️' },
  moderator: { label: 'Модер',     color: '#5ac8fa',  emoji: '🛠️' },
  admin:     { label: 'Админ',     color: '#ff2d55',  emoji: '🛡️' },
}

export { ROLE_CONFIG }

export const AdminBadge: React.FC<AdminBadgeProps> = ({ username, role, roles }) => {
  const isAdm = username === 'viht'

  // Collect all active roles
  const activeRoles: string[] = []

  if (roles && roles.length > 0) {
    activeRoles.push(...roles)
  } else if (role) {
    activeRoles.push(role)
  } else if (isAdm) {
    activeRoles.push('creator')
  }

  // Filter out 'creator' role if username is not 'viht'
  const filteredActiveRoles = activeRoles.filter(r => r !== 'creator' || username === 'viht')

  if (filteredActiveRoles.length === 0) return null

  const plainStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 11,
    fontWeight: 700,
    verticalAlign: 'middle',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
    lineHeight: 1,
    whiteSpace: 'nowrap'
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {filteredActiveRoles.map((r) => {
        const cfg = ROLE_CONFIG[r]
        if (!cfg) return null

        if (r === 'creator') {
          return (
            <span key={r} style={plainStyle}>
              <span className="creator-badge-text">Создатель</span>
            </span>
          )
        }

        return (
          <span key={r} style={{ ...plainStyle, color: cfg.color }}>
            {cfg.emoji} {cfg.label}
          </span>
        )
      })}
    </span>
  )
}
