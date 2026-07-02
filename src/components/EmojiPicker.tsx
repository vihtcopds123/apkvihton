import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  placement?: 'up' | 'down'
  isSidebar?: boolean
  customTrigger?: React.ReactNode
}

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: 'Часто',
    icon: '⏱',
    emojis: ['😊', '😂', '❤️', '🔥', '👍', '🎉', '😍', '🙏', '😢', '💯', '✨', '😎', '🤣', '💪', '🥰', '😭', '🤩', '😅', '🤔', '👏']
  },
  {
    label: 'Смайлы',
    icon: '😀',
    emojis: [
      '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊',
      '😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗',
      '🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥',
      '😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜',
      '😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','🙁',
      '😖','😞','😟','😤','😢','😭','😦','😧','😨','😩',
      '🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡',
      '😠','🤬','😷','🤒','🤕','🤢','🤮','🤧','🥴','😇'
    ]
  },
  {
    label: 'Жесты',
    icon: '👋',
    emojis: [
      '👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞',
      '🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍',
      '👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🙏',
      '💪','🦾','🦵','🦶','👂','🦻','👃','💅','🤳','🫶'
    ]
  },
  {
    label: 'Сердца',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','❤️‍🔥',
      '❤️‍🩹','💔','💕','💞','💓','💗','💖','💘','💝','💟',
      '♥️','💌','💋','💯','✨','⭐','🌟','💫','⚡','🎀'
    ]
  },
  {
    label: 'Природа',
    icon: '🌿',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
      '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅',
      '🌸','🌺','🌹','🌷','🌻','🌼','🍀','🌿','🌱','🌲',
      '🌴','🌵','🍂','🍃','☀️','🌤','⛅','🌈','❄️','⛄'
    ]
  },
  {
    label: 'Еда',
    icon: '🍕',
    emojis: [
      '🍕','🍔','🌮','🌯','🥪','🥗','🍣','🍜','🍝','🍛',
      '🍱','🥡','🍦','🍩','🍪','🎂','🍰','🧁','🍫','🍬',
      '🍭','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧋','☕',
      '🍵','🥤','🍓','🍒','🍑','🥭','🍇','🍉','🍊','🍋'
    ]
  },
  {
    label: 'Активность',
    icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
      '🏓','🏸','🏒','🥊','⛷','🏂','🏋️','🤸','🏄','🚴',
      '🏆','🥇','🥈','🥉','🎖','🎪','🎭','🎨','🎬','🎤',
      '🎧','🎵','🎶','🎸','🎹','🎺','🎻','🥁','🎷','🎮'
    ]
  },
  {
    label: 'Вещи',
    icon: '💡',
    emojis: [
      '💻','📱','⌨️','🖥','🖨','🖱','💾','💿','📷','📸',
      '📹','🎥','📞','☎️','📺','📻','🧭','⏱','⏰','🕰',
      '💡','🔦','🕯','🔋','🔌','🔧','🔨','⚙️','🔑','🗝',
      '📦','📫','💰','💳','🧳','🎁','📚','📝','✏️','🖊'
    ]
  },
  {
    label: 'Символы',
    icon: '💢',
    emojis: [
      '💢','💥','💫','💦','💨','💬','💭','🗯','💤','🔴',
      '🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷',
      '🔸','🔹','🔺','🔻','💠','✅','❌','❓','❗','⚡',
      '♻️','✔️','🆕','🆓','🆗','🔞','🅰️','🅱️','🆎','🆑'
    ]
  }
]

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, placement = 'up', isSidebar = false, customTrigger }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const pickerWidth = 336
    const pickerHeight = 290

    let top: number
    let left: number = rect.left + rect.width / 2 - pickerWidth / 2

    if (placement === 'up') {
      top = rect.top - pickerHeight - 8
    } else {
      top = rect.bottom + 8
    }

    // Clamp to viewport
    if (left + pickerWidth > window.innerWidth - 8) {
      left = window.innerWidth - pickerWidth - 8
    }
    if (left < 8) left = 8
    if (top < 8) top = rect.bottom + 8

    setPickerStyle({
      position: 'fixed',
      top,
      left,
      width: pickerWidth,
      zIndex: 200000
    })
  }, [placement])

  const open = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isOpen) {
      calculatePosition()
    }
    setIsOpen(prev => !prev)
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      // Don't close if clicking inside portal
      const portal = document.getElementById('emoji-picker-portal')
      if (portal && portal.contains(target)) return
      if (buttonRef.current && buttonRef.current.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [isOpen])

  if (isSidebar) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: 'transparent',
          overflow: 'hidden'
        }}
      >
        {/* Category tabs */}
        <div 
          className="hide-scrollbar"
          style={{
            display: 'flex',
            overflowX: 'auto',
            padding: '6px 6px 0 6px',
            gap: 2,
            borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))',
            scrollbarWidth: 'none',
            flexShrink: 0
          }}
        >
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={idx}
              type="button"
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setActiveCategory(idx) }}
              title={cat.label}
              style={{
                flexShrink: 0,
                width: 27,
                height: 27,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: activeCategory === idx ? 'rgba(0,119,255,0.25)' : 'transparent',
                transition: 'background 0.15s',
                marginBottom: 6,
                outline: 'none',
                color: activeCategory === idx ? '#0077ff' : 'var(--vkui--color_icon_secondary)'
              }}
            >
              {cat.icon}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div 
          className="hide-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 6px',
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 1fr)',
            gap: 4,
            alignContent: 'start'
          }}
        >
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => {
                e.preventDefault()
                e.stopPropagation()
                onSelect(emoji)
              }}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 6,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.1s, transform 0.1s',
                lineHeight: 1,
                outline: 'none'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.transform = 'scale(1.35)'
                e.currentTarget.style.position = 'relative'
                e.currentTarget.style.zIndex = '10'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.position = 'static'
                e.currentTarget.style.zIndex = 'auto'
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const picker = isOpen ? (
    <div
      id="emoji-picker-portal"
      style={{
        ...pickerStyle,
        backgroundColor: 'rgba(30, 30, 32, 0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Category tabs */}
      <div 
        className="hide-scrollbar"
        style={{
          display: 'flex',
          overflowX: 'auto',
          padding: '8px 6px 0 6px',
          gap: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          scrollbarWidth: 'none'
        }}
      >
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={idx}
            type="button"
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setActiveCategory(idx) }}
            title={cat.label}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeCategory === idx ? 'rgba(0,119,255,0.25)' : 'transparent',
              transition: 'background 0.15s',
              marginBottom: 6,
              outline: 'none'
            }}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div 
        className="hide-scrollbar"
        style={{
          height: 220,
          overflowY: 'auto',
          padding: '6px 8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 2,
          alignContent: 'start'
        }}
      >
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
          <button
            key={i}
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              e.stopPropagation()
              onSelect(emoji)
            }}
            style={{
              width: '100%',
              aspectRatio: '1',
              borderRadius: 8,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.1s, transform 0.1s',
              lineHeight: 1,
              outline: 'none'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.transform = 'scale(1.35)'
              e.currentTarget.style.position = 'relative'
              e.currentTarget.style.zIndex = '10'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.position = 'static'
              e.currentTarget.style.zIndex = 'auto'
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  ) : null

  return (
    <>
      {customTrigger ? (
        React.cloneElement(customTrigger as React.ReactElement<any>, {
          ref: buttonRef,
          onMouseDown: (e: React.MouseEvent) => {
            const originalOnMouseDown = (customTrigger as React.ReactElement<any>).props.onMouseDown
            if (originalOnMouseDown) originalOnMouseDown(e)
            open(e)
          }
        })
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onMouseDown={open}
          aria-label="Смайлики"
          title="Смайлики"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            background: isOpen ? 'rgba(0,119,255,0.12)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            lineHeight: 1,
            flexShrink: 0,
            transition: 'background 0.15s',
            outline: 'none',
            color: isOpen ? '#0077ff' : 'inherit'
          }}
        >
          😊
        </button>
      )}

      {typeof document !== 'undefined' && createPortal(picker, document.body)}
    </>
  )
}
