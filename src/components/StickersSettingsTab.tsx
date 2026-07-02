import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner, Input, Button } from '@vkontakte/vkui'
import { uploadToTelegram } from '../utils/telegramStorage'
import type { StickerPack, Sticker } from '../types/stickers'

// Функция ресайза и подгонки картинки под размер стикера (512x512 PNG с прозрачностью)
function resizeAndCropToSticker(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 512
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Не удалось инициализировать Canvas'))
          return
        }

        ctx.clearRect(0, 0, 512, 512)

        const scale = Math.min(512 / img.width, 512 / img.height)
        const w = img.width * scale
        const h = img.height * scale
        const x = (512 - w) / 2
        const y = (512 - h) / 2

        ctx.drawImage(img, x, y, w, h)

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Ошибка конвертации Canvas в Blob'))
          }
        }, 'image/png')
      }
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Ошибка чтения файла'))
    reader.readAsDataURL(file)
  })
}

interface StickersSettingsTabProps {
  profileId: string
  showToast: (message: string, isError?: boolean) => void
}

export const StickersSettingsTab: React.FC<StickersSettingsTabProps> = ({ profileId, showToast }) => {
  const [packs, setPacks] = useState<StickerPack[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState<StickerPack | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [loadingStickers, setLoadingStickers] = useState(false)

  // Pack Creation State
  const [isCreatingPack, setIsCreatingPack] = useState(false)
  const [newPackName, setNewPackName] = useState('')
  const [newPackCode, setNewPackCode] = useState('')
  const [newPackCoverUrl, setNewPackCoverUrl] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)

  // Sticker Creation State
  const [isAddingSticker, setIsAddingSticker] = useState(false)
  const [stickerEmoji, setStickerEmoji] = useState('😊')
  const [uploadingSticker, setUploadingSticker] = useState(false)

  const fetchPacks = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sticker_packs')
        .select('*')
        .eq('owner_id', profileId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPacks(data || [])
    } catch (err: any) {
      console.error('Error fetching sticker packs:', err)
      showToast('Ошибка при загрузке стикерпаков', true)
    } finally {
      setLoading(false)
    }
  }

  const fetchStickers = async (packId: string) => {
    setLoadingStickers(true)
    try {
      const { data, error } = await supabase
        .from('stickers')
        .select('*')
        .eq('pack_id', packId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setStickers(data || [])
    } catch (err: any) {
      console.error('Error fetching stickers:', err)
      showToast('Ошибка при загрузке стикеров', true)
    } finally {
      setLoadingStickers(false)
    }
  }

  useEffect(() => {
    fetchPacks()
  }, [profileId])

  const handleOpenPack = (pack: StickerPack) => {
    setSelectedPack(pack)
    fetchStickers(pack.id)
  }

  const handleBackToPacks = () => {
    setSelectedPack(null)
    setStickers([])
    fetchPacks()
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    try {
      const url = await uploadToTelegram(file, `cover_${Date.now()}.png`)
      setNewPackCoverUrl(url)
      showToast('Обложка успешно загружена!')
    } catch (err: any) {
      console.error('Error uploading cover:', err)
      showToast('Ошибка загрузки обложки: ' + err.message, true)
    } finally {
      setUploadingCover(false)
    }
  }

  const handleCreatePack = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPackName.trim() || !newPackCode.trim() || !newPackCoverUrl) {
      showToast('Заполните все поля и загрузите обложку!', true)
      return
    }

    const code = newPackCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (code.length < 3) {
      showToast('Код ссылки должен быть не менее 3 символов!', true)
      return
    }

    try {
      // Check if code is taken
      const { data: existing, error: checkErr } = await supabase
        .from('sticker_packs')
        .select('id')
        .eq('code', code)
        .maybeSingle()

      if (checkErr) throw checkErr
      if (existing) {
        showToast('Этот код ссылки уже занят другим паком!', true)
        return
      }

      const { data, error } = await supabase
        .from('sticker_packs')
        .insert({
          name: newPackName.trim(),
          code,
          cover_url: newPackCoverUrl,
          owner_id: profileId
        })
        .select()
        .single()

      if (error) throw error

      // Automatically subscribe owner to their own pack
      await supabase.from('user_sticker_packs').insert({
        user_id: profileId,
        pack_id: data.id
      })

      showToast('Стикерпак успешно создан!')
      setIsCreatingPack(false)
      setNewPackName('')
      setNewPackCode('')
      setNewPackCoverUrl('')
      fetchPacks()
    } catch (err: any) {
      console.error('Error creating pack:', err)
      showToast('Ошибка создания стикерпака: ' + err.message, true)
    }
  }

  const handleAddSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedPack) return
    setUploadingSticker(true)
    try {
      showToast('Подготовка изображения...')
      const stickerBlob = await resizeAndCropToSticker(file)
      
      showToast('Загрузка в облако...')
      const imageUrl = await uploadToTelegram(stickerBlob, `sticker_${Date.now()}.png`)

      const { error } = await supabase
        .from('stickers')
        .insert({
          pack_id: selectedPack.id,
          image_url: imageUrl,
          emoji: stickerEmoji.trim() || '😊'
        })

      if (error) throw error

      showToast('Стикер успешно добавлен!')
      fetchStickers(selectedPack.id)
      setIsAddingSticker(false)
    } catch (err: any) {
      console.error('Error adding sticker:', err)
      showToast('Ошибка добавления стикера: ' + err.message, true)
    } finally {
      setUploadingSticker(false)
    }
  }

  const handleDeleteSticker = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот стикер?')) return
    try {
      const { error } = await supabase
        .from('stickers')
        .delete()
        .eq('id', id)

      if (error) throw error
      showToast('Стикер удален!')
      if (selectedPack) fetchStickers(selectedPack.id)
    } catch (err: any) {
      console.error('Error deleting sticker:', err)
      showToast('Не удалось удалить стикер', true)
    }
  }

  const handleDeletePack = async (id: string) => {
    if (!confirm('Вы уверены, что хотите полностью удалить этот стикерпак? Все стикеры внутри будут безвозвратно удалены.')) return
    try {
      const { error } = await supabase
        .from('sticker_packs')
        .delete()
        .eq('id', id)

      if (error) throw error
      showToast('Стикерпак удален!')
      handleBackToPacks()
    } catch (err: any) {
      console.error('Error deleting pack:', err)
      showToast('Не удалось удалить стикерпак', true)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spinner size="m" />
      </div>
    )
  }

  if (selectedPack) {
    return (
      <div className="settings-tab-content-animated">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Button size="m" mode="secondary" onClick={handleBackToPacks}>
            ← К списку
          </Button>
          <div style={{ flex: 1 }} />
          <Button size="m" mode="secondary" onClick={() => handleDeletePack(selectedPack.id)} style={{ color: '#ff3b30', borderColor: '#ff3b30' }}>
            Удалить пак
          </Button>
        </div>

        <div className="posts-card" style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <img 
            src={selectedPack.cover_url} 
            alt="" 
            style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)' }} 
          />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vkui--color_text_primary)' }}>{selectedPack.name}</h3>
            <p style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', margin: 0 }}>
              Код ссылки: <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{selectedPack.code}</span>
            </p>
          </div>
          <Button 
            size="m" 
            mode="primary" 
            onClick={() => {
              const url = `${window.location.origin}/stickerpack/${selectedPack.code}`
              navigator.clipboard.writeText(url)
              showToast('Ссылка скопирована в буфер обмена!')
            }}
          >
            Скопировать ссылку
          </Button>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ fontSize: 16, fontWeight: 650, margin: 0, color: 'var(--vkui--color_text_primary)' }}>Стикеры ({stickers.length})</h4>
            {!isAddingSticker ? (
              <Button size="m" mode="primary" onClick={() => setIsAddingSticker(true)}>
                + Добавить стикер
              </Button>
            ) : (
              <Button size="m" mode="secondary" onClick={() => setIsAddingSticker(false)}>
                Отмена
              </Button>
            )}
          </div>

          {isAddingSticker && (
            <div className="posts-card" style={{ padding: 20, marginBottom: 20 }}>
              <h5 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px 0', color: 'var(--vkui--color_text_primary)' }}>Новый стикер</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', width: 90 }}>Ассоциация (Эмодзи):</span>
                  <Input 
                    type="text" 
                    value={stickerEmoji} 
                    onChange={e => setStickerEmoji(e.target.value)} 
                    placeholder="😊" 
                    maxLength={4}
                    style={{ width: 80 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)' }}>Выберите изображение (PNG/JPG):</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAddSticker} 
                    disabled={uploadingSticker}
                    style={{ fontSize: 13 }}
                  />
                </div>
                {uploadingSticker && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Spinner size="s" />
                    <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>Загрузка стикера...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {loadingStickers ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <Spinner size="s" />
            </div>
          ) : stickers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--vkui--color_text_secondary)', fontSize: 14 }}>
              В этом стикерпаке пока нет ни одного стикера.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 12 }}>
              {stickers.map(st => (
                <div 
                  key={st.id} 
                  className="posts-card" 
                  style={{ 
                    position: 'relative', 
                    padding: 8, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    aspectRatio: '1',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1.5px solid rgba(255,255,255,0.04)',
                    borderRadius: 14
                  }}
                >
                  <img 
                    src={st.image_url} 
                    alt="" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  />
                  {st.emoji && (
                    <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 14, background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: 4, color: '#fff' }}>
                      {st.emoji}
                    </span>
                  )}
                  <button 
                    onClick={() => handleDeleteSticker(st.id)}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: 'rgba(255,59,48,0.85)',
                      border: 'none',
                      color: '#fff',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 'bold'
                    }}
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="settings-tab-content-animated">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--vkui--color_text_primary)' }}>Мои стикерпаки</h3>
        {!isCreatingPack ? (
          <Button size="m" mode="primary" onClick={() => setIsCreatingPack(true)}>
            + Создать стикерпак
          </Button>
        ) : (
          <Button size="m" mode="secondary" onClick={() => setIsCreatingPack(false)}>
            Отмена
          </Button>
        )}
      </div>

      {isCreatingPack && (
        <form onSubmit={handleCreatePack} className="posts-card" style={{ padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h4 style={{ fontSize: 15, fontWeight: 650, margin: 0, color: 'var(--vkui--color_text_primary)' }}>Новый стикерпак</h4>
          
          <div className="field-wrapper">
            <span className="field-label">Название</span>
            <Input 
              type="text" 
              value={newPackName} 
              onChange={e => setNewPackName(e.target.value)} 
              placeholder="Название вашего стикерпака" 
              required
            />
          </div>

          <div className="field-wrapper">
            <span className="field-label">Код ссылки (уникальный)</span>
            <Input 
              type="text" 
              value={newPackCode} 
              onChange={e => setNewPackCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} 
              placeholder="my-stickers" 
              required
            />
            <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>
              Только мелкие латинские буквы, цифры и дефис. Ссылка будет иметь вид: vihtclub.ru/stickerpack/<b>код</b>
            </span>
          </div>

          <div className="field-wrapper">
            <span className="field-label">Обложка стикерпака</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {newPackCoverUrl && (
                <img 
                  src={newPackCoverUrl} 
                  alt="Обложка" 
                  style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} 
                />
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleCoverChange} 
                disabled={uploadingCover}
              />
            </div>
            {uploadingCover && <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>Загрузка обложки...</span>}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Button size="m" mode="primary" type="submit" disabled={uploadingCover || !newPackCoverUrl}>
              Создать стикерпак
            </Button>
            <Button size="m" mode="secondary" onClick={() => setIsCreatingPack(false)}>
              Отмена
            </Button>
          </div>
        </form>
      )}

      {packs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--vkui--color_text_secondary)', fontSize: 14 }}>
          У вас пока нет созданных стикерпаков. Создайте свой первый стикерпак прямо сейчас!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 16 }}>
          {packs.map(pack => (
            <div 
              key={pack.id} 
              className="posts-card" 
              onClick={() => handleOpenPack(pack)}
              style={{ 
                padding: 12, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                borderRadius: 18,
                textAlign: 'center'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <img 
                src={pack.cover_url} 
                alt="" 
                style={{ width: 90, height: 90, borderRadius: 16, objectFit: 'cover', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 10 }} 
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pack.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', marginTop: 2 }}>
                @{pack.code}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
