import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from '@vkontakte/vkui'
import { useAuthStore } from '../store/useAuthStore'

interface StickerPreviewPopupProps {
  stickerUrl: string
  onClose: () => void
}

export const StickerPreviewPopup: React.FC<StickerPreviewPopupProps> = ({ stickerUrl, onClose }) => {
  const { profile } = useAuthStore()
  const [pack, setPack] = useState<any>(null)
  const [stickers, setStickers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Найти стикер по URL чтобы получить pack_id
        // URL формат: https://vihtclub.ru/tg-api/file/bot.../documents/...
        // Ищем стикер по image_url
        const cleanUrl = stickerUrl.split('?')[0]
        const { data: stickerData } = await supabase
          .from('stickers')
          .select('*, sticker_packs(*)')
          .or(`image_url.eq.${stickerUrl},image_url.ilike.${cleanUrl}%`)
          .limit(1)
          .single()

        if (!stickerData) {
          // Попробуем через ilike
          const { data: stickerData2 } = await supabase
            .from('stickers')
            .select('*, sticker_packs(*)')
            .ilike('image_url', `${cleanUrl}%`)
            .limit(1)
            .single()
          
          if (!stickerData2) {
            setLoading(false)
            return
          }
          
          const packData = stickerData2.sticker_packs
          setPack(packData)

          const { data: allStickers } = await supabase
            .from('stickers')
            .select('*')
            .eq('pack_id', packData.id)
            .order('created_at', { ascending: true })
          setStickers(allStickers || [])

          if (profile) {
            const { data: installed } = await supabase
              .from('user_sticker_packs')
              .select('pack_id')
              .eq('user_id', profile.id)
              .eq('pack_id', packData.id)
              .single()
            setIsInstalled(!!installed || packData.owner_id === profile.id)
          }
          setLoading(false)
          return
        }

        const packData = stickerData.sticker_packs
        setPack(packData)

        const { data: allStickers } = await supabase
          .from('stickers')
          .select('*')
          .eq('pack_id', packData.id)
          .order('created_at', { ascending: true })
        setStickers(allStickers || [])

        if (profile) {
          const isOwner = packData.owner_id === profile.id
          if (isOwner) {
            setIsInstalled(true)
          } else {
            const { data: installed } = await supabase
              .from('user_sticker_packs')
              .select('pack_id')
              .eq('user_id', profile.id)
              .eq('pack_id', packData.id)
              .single()
            setIsInstalled(!!installed)
          }
        }
      } catch (err) {
        console.error('StickerPreviewPopup load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [stickerUrl, profile])

  const handleInstall = async () => {
    if (!profile || !pack) return
    setInstalling(true)
    try {
      if (isInstalled) {
        await supabase
          .from('user_sticker_packs')
          .delete()
          .eq('user_id', profile.id)
          .eq('pack_id', pack.id)
        setIsInstalled(false)
      } else {
        await supabase
          .from('user_sticker_packs')
          .upsert({ user_id: profile.id, pack_id: pack.id })
        setIsInstalled(true)
      }
    } finally {
      setInstalling(false)
    }
  }

  const isOwner = profile && pack && pack.owner_id === profile.id

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 99998,
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div className="v-sticker-preview-modal">
        <style>{`
          @keyframes slideUp { 
            from { transform: translateY(100%); } 
            to { transform: translateY(0); } 
          }
          @keyframes desktopFadeIn {
            from { opacity: 0; transform: translate(-50%, -46%) scale(0.95); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
          
          .v-sticker-preview-modal {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 99999;
            background: var(--vkui--color_background_content, rgba(28, 28, 30, 0.98));
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px 20px 0 0;
            padding: 20px 16px 32px;
            max-height: 60vh;
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: 0 -8px 40px rgba(0,0,0,0.4);
            animation: slideUp 0.22s ease-out;
            box-sizing: border-box;
          }

          .v-sticker-preview-handle {
            width: 36px;
            height: 4px;
            border-radius: 2px;
            background: rgba(255,255,255,0.2);
            margin: -8px auto 0;
            flex-shrink: 0;
          }

          .v-sticker-preview-close {
            display: none;
          }

          @media (min-width: 768px) {
            .v-sticker-preview-modal {
              top: 50% !important;
              left: 50% !important;
              bottom: auto !important;
              right: auto !important;
              transform: translate(-50%, -50%) !important;
              width: 420px !important;
              max-height: 500px !important;
              border: 1px solid rgba(255, 255, 255, 0.08) !important;
              border-radius: 20px !important;
              box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5) !important;
              animation: desktopFadeIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
              padding: 24px 20px !important;
            }

            .v-sticker-preview-handle {
              display: none !important;
            }

            .v-sticker-preview-close {
              display: flex !important;
              position: absolute;
              top: 16px;
              right: 16px;
              background: none;
              border: none;
              cursor: pointer;
              color: var(--vkui--color_text_secondary, #8a8a8f);
              font-size: 24px;
              width: 32px;
              height: 32px;
              align-items: center;
              justifyContent: center;
              border-radius: 50%;
              transition: background 0.2s;
              outline: none;
            }
            .v-sticker-preview-close:hover {
              background: var(--vkui--color_background_hover, rgba(255,255,255,0.08));
              color: var(--vkui--color_text_primary, #fff);
            }
          }
        `}</style>

        {/* Handle */}
        <div className="v-sticker-preview-handle" />

        {/* Desktop Close Button */}
        <button onClick={onClose} className="v-sticker-preview-close" title="Закрыть">
          ×
        </button>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spinner size="m" />
          </div>
        ) : !pack ? (
          <div style={{ textAlign: 'center', color: 'var(--vkui--color_text_secondary)', padding: 24, fontSize: 14 }}>
            Стикерпак не найден
          </div>
        ) : (
          <>
            {/* Pack header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 28 }}>
              <img
                src={pack.cover_url}
                alt=""
                style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--vkui--color_text_primary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pack.name}</div>
                <div style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>
                  {stickers.length} стикер{stickers.length === 1 ? '' : stickers.length < 5 ? 'а' : 'ов'}
                </div>
              </div>
              {!isOwner && (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 12,
                    border: 'none',
                    background: isInstalled ? 'rgba(255,255,255,0.1)' : '#007aff',
                    color: isInstalled ? 'var(--vkui--color_text_secondary)' : '#fff',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: installing ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  {installing ? '...' : isInstalled ? 'Удалить' : 'Добавить'}
                </button>
              )}
            </div>

            {/* Stickers preview grid */}
            <div
              className="hide-scrollbar"
              style={{
                overflowY: 'auto',
                flex: 1,
              }}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 8,
              }}>
                {stickers.map(st => (
                  <div key={st.id} style={{
                    aspectRatio: '1',
                    borderRadius: 10,
                    background: stickerUrl.startsWith(st.image_url.split('?')[0]) || st.image_url.startsWith(stickerUrl.split('?')[0])
                      ? 'rgba(0,122,255,0.15)'
                      : 'rgba(255,255,255,0.04)',
                    padding: 6,
                    boxSizing: 'border-box',
                  }}>
                    <img
                      src={st.image_url}
                      alt={st.emoji || ''}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
