import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { Spinner } from '@vkontakte/vkui'
import type { StickerPack, Sticker } from '../types/stickers'
import { useAuthStore } from '../store/useAuthStore'

interface StickerPickerProps {
  onSelectSticker: (url: string) => void
  placement?: 'up' | 'down'
  customTrigger?: React.ReactNode
  isSidebar?: boolean
}

export const StickerPicker: React.FC<StickerPickerProps> = ({ 
  onSelectSticker, 
  placement = 'up', 
  customTrigger,
  isSidebar = false
}) => {
  const { profile } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [packs, setPacks] = useState<StickerPack[]>([])
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [loadingPacks, setLoadingPacks] = useState(false)
  const [loadingStickers, setLoadingStickers] = useState(false)
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties>({})
  const [previewSticker, setPreviewSticker] = useState<string | null>(null)
  
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)

  const loadPacks = async () => {
    if (!profile) return
    setLoadingPacks(true)
    try {
      // 1. Get owned packs
      const { data: owned } = await supabase
        .from('sticker_packs')
        .select('*')
        .eq('owner_id', profile.id)

      // 2. Get installed pack IDs
      const { data: installed } = await supabase
        .from('user_sticker_packs')
        .select('pack_id')
        .eq('user_id', profile.id)

      const installedIds = installed?.map(i => i.pack_id) || []

      let allPacks = owned ? [...owned] : []
      
      if (installedIds.length > 0) {
        const { data: installedPacks } = await supabase
          .from('sticker_packs')
          .select('*')
          .in('id', installedIds)

        if (installedPacks) {
          const ownedIds = new Set(allPacks.map(p => p.id))
          installedPacks.forEach(p => {
            if (!ownedIds.has(p.id)) {
              allPacks.push(p)
            }
          })
        }
      }

      setPacks(allPacks)
      if (allPacks.length > 0) {
        // Оставляем текущий пак если он ещё существует, иначе выбираем первый
        setSelectedPackId(prev => {
          if (prev && allPacks.some(p => p.id === prev)) return prev
          return allPacks[0].id
        })
      } else {
        setSelectedPackId(null)
      }
    } catch (err) {
      console.error('Error loading packs in picker:', err)
    } finally {
      setLoadingPacks(false)
    }
  }

  const loadStickers = async (packId: string) => {
    setLoadingStickers(true)
    try {
      const { data, error } = await supabase
        .from('stickers')
        .select('*')
        .eq('pack_id', packId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setStickers(data || [])
    } catch (err) {
      console.error('Error loading stickers in picker:', err)
    } finally {
      setLoadingStickers(false)
    }
  }

  useEffect(() => {
    if (isSidebar) {
      // В режиме сайдбара компонент всегда виден — загружаем сразу
      loadPacks()
    } else if (isOpen) {
      loadPacks()
    }
  }, [isOpen, isSidebar, profile])

  useEffect(() => {
    if (selectedPackId) {
      loadStickers(selectedPackId)
    } else {
      setStickers([])
    }
  }, [selectedPackId])

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current || isSidebar) return
    const rect = buttonRef.current.getBoundingClientRect()
    const pickerWidth = 320
    const pickerHeight = 280

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
      height: pickerHeight,
      zIndex: 200000
    })
  }, [placement, isSidebar])

  const toggleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isOpen) {
      calculatePosition()
    }
    setIsOpen(prev => !prev)
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen || isSidebar) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      const portal = document.getElementById('sticker-picker-portal')
      if (portal && portal.contains(target)) return
      if (buttonRef.current && buttonRef.current.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [isOpen, isSidebar])

  const renderContent = () => {
    return (
      <div 
        ref={pickerRef}
        className="posts-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: 8,
          boxSizing: 'border-box',
          background: 'var(--vkui--color_background_content, #1c1c1e)',
          border: '1.5px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))',
          borderRadius: isSidebar ? 0 : 16,
          boxShadow: isSidebar ? 'none' : '0 12px 32px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
      >
        {/* Packs tabs (Horizontal scroll) */}
        <div 
          className="hide-scrollbar"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 6,
            borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.06))',
            flexShrink: 0
          }}
        >
          {loadingPacks ? (
            <Spinner size="s" style={{ margin: 'auto' }} />
          ) : packs.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', padding: '4px 8px' }}>
              Нет добавленных стикеров
            </span>
          ) : (
            packs.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPackId(p.id)}
                style={{
                  background: selectedPackId === p.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  padding: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                title={p.name}
              >
                <img 
                  src={p.cover_url} 
                  alt="" 
                  style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} 
                />
              </button>
            ))
          )}
        </div>

        {/* Stickers Grid */}
        <div 
          className="hide-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingTop: 8,
          }}
        >
          {loadingStickers ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <Spinner size="s" />
            </div>
          ) : stickers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>
              {selectedPackId ? 'В паке нет стикеров' : 'Выберите стикерпак'}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
            }}>
              {stickers.map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    if (didLongPressRef.current) return // не кликать если был long press
                    onSelectSticker(st.image_url)
                    if (!isSidebar) setIsOpen(false)
                  }}
                  onMouseDown={() => {
                    didLongPressRef.current = false
                    longPressTimer.current = setTimeout(() => {
                      setPreviewSticker(st.image_url)
                      didLongPressRef.current = true
                      longPressTimer.current = null
                    }, 300)
                  }}
                  onMouseUp={() => {
                    if (longPressTimer.current) {
                      clearTimeout(longPressTimer.current)
                      longPressTimer.current = null
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (longPressTimer.current) {
                      clearTimeout(longPressTimer.current)
                      longPressTimer.current = null
                    }
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.background = 'none'
                  }}
                  onTouchStart={() => {
                    didLongPressRef.current = false
                    longPressTimer.current = setTimeout(() => {
                      setPreviewSticker(st.image_url)
                      didLongPressRef.current = true
                      longPressTimer.current = null
                    }, 300)
                  }}
                  onTouchEnd={() => {
                    if (longPressTimer.current) {
                      clearTimeout(longPressTimer.current)
                      longPressTimer.current = null
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    transition: 'transform 0.15s ease, background 0.15s',
                    aspectRatio: '1',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none' as any,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.12)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                  }}
                >
                  <img 
                    src={st.image_url} 
                    alt={st.emoji || ''} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} 
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isSidebar) {
    return (
      <>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {renderContent()}
        </div>
        {previewSticker && createPortal(
          <StickerLargePreview url={previewSticker} onClose={() => setPreviewSticker(null)} />,
          document.body
        )}
      </>
    )
  }

  return (
    <>
      <button 
        ref={buttonRef} 
        type="button" 
        onClick={toggleOpen} 
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        {customTrigger || (
          <span style={{ fontSize: 20, filter: 'grayscale(0.3)' }} title="Стикеры">🖼️</span>
        )}
      </button>

      {isOpen && createPortal(
        <div id="sticker-picker-portal" style={pickerStyle}>
          {renderContent()}
        </div>,
        document.body
      )}
      {previewSticker && createPortal(
        <StickerLargePreview url={previewSticker} onClose={() => setPreviewSticker(null)} />,
        document.body
      )}
    </>
  )
}

// Крупный превью стикера при удержании
const StickerLargePreview: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
  <div
    onClick={onClose}
    onMouseUp={onClose}
    onTouchEnd={onClose}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 300000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      animation: 'stickerPrevFadeIn 0.15s ease',
    }}
  >
    <style>{`
      @keyframes stickerPrevFadeIn { from { opacity:0; } to { opacity:1; } }
      @keyframes stickerPrevPop { from { transform: scale(0.6); opacity:0; } to { transform: scale(1); opacity:1; } }
    `}</style>
    <img
      src={url}
      alt="Стикер"
      draggable={false}
      style={{
        width: 220,
        height: 220,
        objectFit: 'contain',
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.5))',
        animation: 'stickerPrevPop 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  </div>
)
