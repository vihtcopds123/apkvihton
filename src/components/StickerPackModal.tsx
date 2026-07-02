import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner, Button } from '@vkontakte/vkui'
import type { StickerPack, Sticker } from '../types/stickers'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'

export const StickerPackModal: React.FC = () => {
  const { openStickerPackCode, setOpenStickerPackCode } = useAppStore()
  const { profile } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [pack, setPack] = useState<StickerPack | null>(null)
  const [authorName, setAuthorName] = useState('')
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [isInstalled, setIsInstalled] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const loadPackData = async () => {
    if (!openStickerPackCode) return
    setLoading(true)
    try {
      // 1. Get Pack
      const { data: packData, error: packErr } = await supabase
        .from('sticker_packs')
        .select('*')
        .eq('code', openStickerPackCode.toLowerCase())
        .maybeSingle()

      if (packErr) throw packErr
      if (!packData) {
        setPack(null)
        setLoading(false)
        return
      }

      setPack(packData)

      // 2. Get Author Name
      const { data: authorData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', packData.owner_id)
        .maybeSingle()

      if (authorData) {
        setAuthorName(authorData.full_name || 'Неизвестный автор')
      }

      // 3. Get Stickers
      const { data: stickersData, error: stickersErr } = await supabase
        .from('stickers')
        .select('*')
        .eq('pack_id', packData.id)
        .order('created_at', { ascending: true })

      if (stickersErr) throw stickersErr
      setStickers(stickersData || [])

      // 4. Check if Installed
      if (profile) {
        const { data: installData } = await supabase
          .from('user_sticker_packs')
          .select('*')
          .eq('user_id', profile.id)
          .eq('pack_id', packData.id)
          .maybeSingle()

        setIsInstalled(!!installData)
      }

    } catch (err) {
      console.error('Error loading sticker pack details:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (openStickerPackCode) {
      loadPackData()
    }
  }, [openStickerPackCode, profile])

  const handleToggleInstall = async () => {
    if (!profile || !pack || actionLoading) return
    setActionLoading(true)
    try {
      if (isInstalled) {
        // Uninstall
        const { error } = await supabase
          .from('user_sticker_packs')
          .delete()
          .eq('user_id', profile.id)
          .eq('pack_id', pack.id)

        if (error) throw error
        setIsInstalled(false)
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { title: 'Стикеры', text: 'Стикерпак удален из вашей коллекции' }
        }))
      } else {
        // Install
        const { error } = await supabase
          .from('user_sticker_packs')
          .insert({
            user_id: profile.id,
            pack_id: pack.id
          })

        if (error) throw error
        setIsInstalled(true)
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { title: 'Стикеры', text: 'Стикерпак добавлен в вашу коллекцию!' }
        }))
      }
    } catch (err: any) {
      console.error('Error toggling sticker pack installation:', err)
      alert('Ошибка: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (!openStickerPackCode) return null

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={() => setOpenStickerPackCode(null)}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--vkui--color_background_content, #1c1c1e)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          padding: 24,
          boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          boxSizing: 'border-box',
          animation: 'v-modal-appear 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={() => setOpenStickerPackCode(null)}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            color: 'var(--vkui--color_text_primary, #fff)',
            width: 32,
            height: 32,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 'bold',
            zIndex: 10
          }}
        >
          ×
        </button>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60, flex: 1 }}>
            <Spinner size="m" />
          </div>
        ) : !pack ? (
          <div style={{ textAlign: 'center', padding: 40, flex: 1 }}>
            <span style={{ fontSize: 48 }}>🔍</span>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 16, color: 'var(--vkui--color_text_primary)' }}>Стикерпак не найден</h3>
            <p style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', marginTop: 8 }}>Возможно, ссылка устарела или пак был удален автором.</p>
          </div>
        ) : (
          <>
            {/* Header info */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
              <img 
                src={pack.cover_url} 
                alt="" 
                style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', background: '#000', border: '1px solid rgba(255,255,255,0.06)' }} 
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px 0', color: 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pack.name}</h3>
                <p style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Создатель: <b>{authorName}</b>
                </p>
              </div>
            </div>

            {/* Stickers Grid */}
            <div 
              className="hide-scrollbar"
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                marginBottom: 20, 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: 8,
                padding: '4px 2px'
              }}
            >
              {stickers.length === 0 ? (
                <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: 40, color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>
                  В этом паке пока нет стикеров
                </div>
              ) : (
                stickers.map(st => (
                  <div 
                    key={st.id} 
                    style={{ 
                      aspectRatio: '1', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: 12,
                      padding: 6,
                      border: '1px solid rgba(255,255,255,0.04)'
                    }}
                  >
                    <img 
                      src={st.image_url} 
                      alt="" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                  </div>
                ))
              )}
            </div>

            {/* Action Button */}
            {profile && (
              <div style={{ flexShrink: 0 }}>
                <Button 
                  stretched 
                  size="l" 
                  mode={isInstalled ? 'secondary' : 'primary'}
                  disabled={actionLoading}
                  loading={actionLoading}
                  onClick={handleToggleInstall}
                  style={{
                    background: isInstalled ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #0077ff, #aa3bff)',
                    color: isInstalled ? 'var(--vkui--color_text_primary)' : '#fff',
                    borderRadius: 14,
                    height: 44,
                    fontWeight: 600
                  }}
                >
                  {isInstalled ? 'Удалить из моих стикеров' : 'Добавить стикерпак'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
