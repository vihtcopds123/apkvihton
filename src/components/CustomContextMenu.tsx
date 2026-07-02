import React, { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'

interface MessageData {
  id: string
  content: string
  isMe: boolean
  isPinned?: boolean
}

interface CommentData {
  id: string
  postId?: string | null
  photoUrl?: string | null
  content: string
  authorId: string
  isPhoto: boolean
}

interface MenuState {
  isOpen: boolean
  x: number
  y: number
  targetElement: HTMLInputElement | HTMLTextAreaElement | null
  hasSelection: boolean
  messageData?: MessageData | null
  commentData?: CommentData | null
  channelPostId?: string | null
  channelPostContent?: string | null
}

export const CustomContextMenu: React.FC = () => {
  const { profile } = useAuthStore()
  const { activeStory } = useAppStore()
  const [menuState, setMenuState] = useState<MenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetElement: null,
    hasSelection: false,
    messageData: null,
    commentData: null,
    channelPostId: null,
    channelPostContent: null
  })

  const isAdminUser = !!(profile && (
    profile.id === 'fee894db-c5b0-4022-bb9f-56c60decac86' || 
    profile.username === 'viht' || 
    profile.username === 'adm' || 
    profile.role === 'admin' || 
    profile.role === 'moderator' || 
    (profile.roles && (profile.roles.includes('admin') || profile.roles.includes('moderator') || profile.roles.includes('creator')))
  ))
  
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      let posX = e.clientX
      let posY = e.clientY
      const menuWidth = 220
      const menuHeight = 280 // Max height estimate

      // Viewport bounds adjustment
      if (posX + menuWidth > window.innerWidth) {
        posX = window.innerWidth - menuWidth - 10
      }
      if (posY + menuHeight > window.innerHeight) {
        posY = window.innerHeight - menuHeight - 10
      }

      // 1. Check if clicking on a message bubble
      const messageEl = target.closest('[data-message-id]')
      if (messageEl) {
        const messageId = messageEl.getAttribute('data-message-id')
        const isMe = messageEl.getAttribute('data-is-me') === 'true'
        const isDeleted = messageEl.getAttribute('data-is-deleted') === 'true'
        const isPinned = messageEl.getAttribute('data-is-pinned') === 'true'
        const content = messageEl.getAttribute('data-message-content') || ''
        
        if (!isDeleted) {
          e.preventDefault()
          setMenuState({
            isOpen: true,
            x: posX,
            y: posY,
            targetElement: null,
            hasSelection: false,
            messageData: { id: messageId!, content, isMe, isPinned },
            commentData: null,
            channelPostId: null,
            channelPostContent: null
          })
          return
        }
      }

      // 2. Check if clicking on a comment
      const commentEl = target.closest('[data-comment-id]')
      if (commentEl) {
        e.preventDefault()
        const commentId = commentEl.getAttribute('data-comment-id')!
        const postId = commentEl.getAttribute('data-comment-post-id')
        const photoUrl = commentEl.getAttribute('data-comment-photo-url')
        const content = commentEl.getAttribute('data-comment-content') || ''
        const authorId = commentEl.getAttribute('data-comment-author-id') || ''
        const isPhoto = commentEl.getAttribute('data-comment-is-photo') === 'true'

        setMenuState({
          isOpen: true,
          x: posX,
          y: posY,
          targetElement: null,
          hasSelection: false,
          messageData: null,
          commentData: { id: commentId, postId, photoUrl, content, authorId, isPhoto },
          channelPostId: null,
          channelPostContent: null
        })
        return
      }

      // 3. Check if clicking on a channel post bubble
      const channelPostEl = target.closest('[data-channel-post-id]')
      if (channelPostEl) {
        e.preventDefault()
        const postId = channelPostEl.getAttribute('data-channel-post-id')!
        const content = channelPostEl.getAttribute('data-channel-post-content') || ''
        setMenuState({
          isOpen: true,
          x: posX,
          y: posY,
          targetElement: null,
          hasSelection: false,
          messageData: null,
          commentData: null,
          channelPostId: postId,
          channelPostContent: content
        })
        return
      }

      const isTextInput = target instanceof HTMLTextAreaElement || 
        (target instanceof HTMLInputElement && ['text', 'email', 'search', 'url', 'password'].includes(target.type))
      const selectedText = window.getSelection()?.toString()

      // Show custom menu if right-clicking in a text input/textarea OR if there is selected text on the page
      if (isTextInput || selectedText) {
        e.preventDefault()
        setMenuState({
          isOpen: true,
          x: posX,
          y: posY,
          targetElement: isTextInput ? (target as HTMLInputElement | HTMLTextAreaElement) : null,
          hasSelection: !!selectedText,
          messageData: null,
          commentData: null,
          channelPostId: null,
          channelPostContent: null
        })
        return
      }

      // Если кликнули ПКМ в любом другом месте, закрываем меню
      setMenuState(prev => prev.isOpen ? { ...prev, isOpen: false } : prev)

      // Если это страница сообществ, полностью глушим стандартный ПКМ браузера
      if (activeStory === 'groups') {
        e.preventDefault()
      }
    }

    const handleClickOutside = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return
      }
      setMenuState(prev => prev.isOpen ? { ...prev, isOpen: false } : prev)
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('click', handleClickOutside, { capture: true })
    window.addEventListener('resize', handleClickOutside)
    document.addEventListener('scroll', handleClickOutside, { capture: true })

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('click', handleClickOutside, { capture: true })
      window.removeEventListener('resize', handleClickOutside)
      document.removeEventListener('scroll', handleClickOutside, { capture: true })
    }
  }, [profile])

  // Programmatically change React inputs
  const triggerReactChange = (element: HTMLInputElement | HTMLTextAreaElement, newValue: string) => {
    const prototype = Object.getPrototypeOf(element)
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, newValue)
    } else {
      element.value = newValue
    }
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // Actions
  const handleCopy = () => {
    const selectedText = window.getSelection()?.toString()
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
    }
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handlePaste = async () => {
    if (!menuState.targetElement) return
    try {
      const text = await navigator.clipboard.readText()
      const el = menuState.targetElement
      const start = el.selectionStart || 0
      const end = el.selectionEnd || 0
      const val = el.value
      
      const newVal = val.slice(0, start) + text + val.slice(end)
      triggerReactChange(el, newVal)

      setTimeout(() => {
        el.focus()
        el.setSelectionRange(start + text.length, start + text.length)
      }, 10)
    } catch (err) {
      console.error('Failed to paste from clipboard:', err)
    }
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleBold = () => {
    if (!menuState.targetElement) return
    const el = menuState.targetElement
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const val = el.value
    const selection = val.slice(start, end)
    
    const newVal = val.slice(0, start) + `**${selection}**` + val.slice(end)
    triggerReactChange(el, newVal)

    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + 2, start + 2 + selection.length)
    }, 10)
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleItalic = () => {
    if (!menuState.targetElement) return
    const el = menuState.targetElement
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const val = el.value
    const selection = val.slice(start, end)
    
    const newVal = val.slice(0, start) + `*${selection}*` + val.slice(end)
    triggerReactChange(el, newVal)

    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + 1, start + 1 + selection.length)
    }, 10)
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleLink = () => {
    if (!menuState.targetElement) return
    const el = menuState.targetElement
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const val = el.value
    const selection = val.slice(start, end)

    const url = prompt('Введите URL ссылку для текста:', 'https://')
    if (url === null) return // Cancelled

    const newVal = val.slice(0, start) + `[${selection || 'ссылка'}](${url})` + val.slice(end)
    triggerReactChange(el, newVal)

    setTimeout(() => {
      el.focus()
    }, 10)
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleQuote = () => {
    if (!menuState.targetElement) return
    const el = menuState.targetElement
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const val = el.value
    const selection = val.slice(start, end)
    
    const quoted = selection.split('\n').map(line => `> ${line}`).join('\n')
    const newVal = val.slice(0, start) + quoted + val.slice(end)
    triggerReactChange(el, newVal)

    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start, start + quoted.length)
    }, 10)
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  // Message events
  const handlePinMessage = () => {
    if (!menuState.messageData) return
    window.dispatchEvent(new CustomEvent('pin-message', { detail: { id: menuState.messageData.id, isPinned: menuState.messageData.isPinned } }))
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleReplyMessage = () => {
    if (!menuState.messageData) return
    window.dispatchEvent(new CustomEvent('reply-message', { detail: menuState.messageData }))
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleForwardMessage = () => {
    if (!menuState.messageData) return
    window.dispatchEvent(new CustomEvent('forward-message', { detail: menuState.messageData }))
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleEditMessage = () => {
    if (!menuState.messageData) return
    window.dispatchEvent(new CustomEvent('edit-message', { detail: menuState.messageData }))
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleCopyMessage = () => {
    if (!menuState.messageData) return
    navigator.clipboard.writeText(menuState.messageData.content)
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleDeleteMessage = () => {
    if (!menuState.messageData) return
    window.dispatchEvent(new CustomEvent('delete-message', { detail: { id: menuState.messageData.id } }))
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  // Comment events
  const handleReplyComment = () => {
    if (!menuState.commentData) return
    window.dispatchEvent(new CustomEvent('reply-comment', { detail: menuState.commentData }))
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleEditComment = () => {
    if (!menuState.commentData) return
    window.dispatchEvent(new CustomEvent('edit-comment', { detail: menuState.commentData }))
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleCopyComment = () => {
    if (!menuState.commentData) return
    navigator.clipboard.writeText(menuState.commentData.content)
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const handleDeleteComment = () => {
    if (!menuState.commentData) return
    window.dispatchEvent(new CustomEvent('delete-comment', { detail: menuState.commentData }))
    setMenuState(prev => ({ ...prev, isOpen: false }))
  }

  const isInputActive = !!menuState.targetElement

  // Conditional Menu Items based on click target
  const menuItems = menuState.messageData
    ? (menuState.messageData.isMe
        ? [
            { label: '↩ Ответить', action: handleReplyMessage, disabled: false, shortcut: 'Reply' },
            { label: '↪ Переслать', action: handleForwardMessage, disabled: false, shortcut: 'Fwd' },
            { label: menuState.messageData.isPinned ? '📌 Открепить' : '📌 Закрепить', action: handlePinMessage, disabled: false, shortcut: 'Pin' },
            { isDivider: true },
            { label: 'Изменить', action: handleEditMessage, disabled: false, shortcut: 'Edit' },
            { label: 'Скопировать', action: handleCopyMessage, disabled: false, shortcut: 'Copy' },
            { isDivider: true },
            { label: 'Удалить у всех', action: handleDeleteMessage, disabled: false, shortcut: 'Del' }
          ]
        : [
            { label: '↩ Ответить', action: handleReplyMessage, disabled: false, shortcut: 'Reply' },
            { label: '↪ Переслать', action: handleForwardMessage, disabled: false, shortcut: 'Fwd' },
            { label: menuState.messageData.isPinned ? '📌 Открепить' : '📌 Закрепить', action: handlePinMessage, disabled: false, shortcut: 'Pin' },
            { isDivider: true },
            { label: 'Скопировать', action: handleCopyMessage, disabled: false, shortcut: 'Copy' }
          ])
    : menuState.commentData
      ? (() => {
          const isOwner = profile && menuState.commentData.authorId === profile.id
          const canDelete = isOwner || isAdminUser

          const items: any[] = [
            { label: '↩ Ответить', action: handleReplyComment, disabled: false, shortcut: 'Reply' },
            { label: 'Скопировать текст', action: handleCopyComment, disabled: false, shortcut: 'Copy' }
          ]

          if (isOwner) {
            items.push({ isDivider: true })
            items.push({ label: 'Редактировать', action: handleEditComment, disabled: false, shortcut: 'Edit' })
          }

          if (canDelete) {
            if (!isOwner) items.push({ isDivider: true })
            items.push({ label: 'Удалить', action: handleDeleteComment, disabled: false, shortcut: 'Del' })
          }

          return items
        })()
      : menuState.channelPostId
        ? (() => {
            const items: any[] = [
              { label: 'Скопировать текст', action: () => {
                if (menuState.channelPostContent) {
                  navigator.clipboard.writeText(menuState.channelPostContent)
                }
                setMenuState(prev => ({ ...prev, isOpen: false }))
              }, disabled: false, shortcut: 'Copy' }
            ]
            
            if (isAdminUser) {
              items.push({ isDivider: true })
              items.push({ label: 'Редактировать', action: () => {
                window.dispatchEvent(new CustomEvent('edit-channel-post', { detail: { id: menuState.channelPostId } }))
                setMenuState(prev => ({ ...prev, isOpen: false }))
              }, disabled: false, shortcut: 'Edit' })
              items.push({ label: 'Удалить', action: () => {
                window.dispatchEvent(new CustomEvent('delete-channel-post', { detail: { id: menuState.channelPostId } }))
                setMenuState(prev => ({ ...prev, isOpen: false }))
              }, disabled: false, shortcut: 'Del' })
            }
            return items
          })()
        : [
            { label: 'Копировать', action: handleCopy, disabled: !menuState.hasSelection, shortcut: 'Ctrl+C' },
            { label: 'Вставить', action: handlePaste, disabled: !isInputActive, shortcut: 'Ctrl+V' },
            { isDivider: true },
            { label: 'Жирный (**текст**)', action: handleBold, disabled: !isInputActive, shortcut: 'Ctrl+B' },
            { label: 'Курсив (*текст*)', action: handleItalic, disabled: !isInputActive, shortcut: 'Ctrl+I' },
            { label: 'Вставить ссылку', action: handleLink, disabled: !isInputActive, shortcut: 'Ctrl+K' },
            { label: 'Цитата (> текст)', action: handleQuote, disabled: !isInputActive, shortcut: 'Ctrl+Q' }
          ]

  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👎']
  const showReactions = !!(menuState.messageData || menuState.commentData || menuState.channelPostId)

  if (!menuState.isOpen) return null

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: menuState.x,
        top: menuState.y,
        width: 220,
        backgroundColor: 'rgba(28, 28, 30, 0.88)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45), 0 0 1px rgba(255, 255, 255, 0.2)',
        padding: '6px 4px',
        zIndex: 99999,
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
        fontSize: 13,
        userSelect: 'none',
        pointerEvents: 'auto'
      }}
    >
      {showReactions && (
        <>
          <div 
            style={{ 
              display: 'flex', 
              gap: 2, 
              padding: '6px 8px', 
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '8px 8px 0 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: 4
            }}
          >
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation()
                  if (menuState.messageData) {
                    window.dispatchEvent(new CustomEvent('react-message', { detail: { id: menuState.messageData.id, emoji } }))
                  } else if (menuState.commentData) {
                    window.dispatchEvent(new CustomEvent('react-comment', { detail: { id: menuState.commentData.id, emoji, isPhoto: menuState.commentData.isPhoto, postId: menuState.commentData.postId, photoUrl: menuState.commentData.photoUrl } }))
                  } else if (menuState.channelPostId) {
                    window.dispatchEvent(new CustomEvent('react-post', { detail: { id: menuState.channelPostId, emoji } }))
                  }
                  setMenuState(prev => ({ ...prev, isOpen: false }))
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: '2px 2px',
                  borderRadius: 6,
                  transition: 'transform 0.15s, background-color 0.15s',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
                className="reaction-btn-hover"
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.25)'
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      {menuItems.map((item, idx) => {
        if (item.isDivider) {
          return (
            <div
              key={idx}
              style={{
                height: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                margin: '4px 6px'
              }}
            />
          )
        }

        const isHovered = hoveredIdx === idx
        const isDisabled = item.disabled

        return (
          <div
            key={idx}
            onMouseEnter={() => !isDisabled && setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => !isDisabled && item.action && item.action()}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: isDisabled ? 'default' : 'pointer',
              backgroundColor: isHovered ? '#007af5' : 'transparent',
              color: isDisabled ? 'rgba(255, 255, 255, 0.35)' : '#ffffff',
              fontWeight: 500,
              transition: 'background-color 0.1s ease, color 0.1s ease',
              margin: '1px 0'
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span
                style={{
                  fontSize: 10,
                  color: isDisabled ? 'rgba(255, 255, 255, 0.15)' : isHovered ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 'normal',
                  marginLeft: 10
                }}
              >
                {item.shortcut}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
