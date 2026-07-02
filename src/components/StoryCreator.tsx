import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadToTelegram } from '../utils/telegramStorage'
import { Spinner } from '@vkontakte/vkui'

interface StoryText {
  id: string
  text: string
  x: number // процент 0..100
  y: number // процент 0..100
  color: string
  bgStyle: 'none' | 'light' | 'dark'
  fontSize: number
  fontStyle: 'Montserrat' | 'Roboto' | 'Impact' | 'Courier New'
}

const LIFETIME_OPTIONS = [
  { value: '1h', label: '1 час', hours: 1 },
  { value: '2h', label: '2 часа', hours: 2 },
  { value: '3h', label: '3 часа', hours: 3 },
  { value: '6h', label: '6 часов', hours: 6 },
  { value: '12h', label: '12 часов', hours: 12 },
  { value: '24h', label: '24 часа', hours: 24 },
  { value: '2d', label: '2 дня', hours: 48 },
  { value: '3d', label: '3 дня', hours: 72 }
] as const

interface StoryCreatorProps {
  onSuccess?: () => void
  children?: React.ReactNode
}

export const StoryCreator: React.FC<StoryCreatorProps> = ({ onSuccess, children }) => {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [lifetimeIndex, setLifetimeIndex] = useState(5) // default 24h (index 5)
  
  const [showModal, setShowModal] = useState(false)
  const [modalAnimating, setModalAnimating] = useState(false)

  // Photo Editor state
  const [zoom, setZoom] = useState(1.0)
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 })
  const [storyTexts, setStoryTexts] = useState<StoryText[]>([])
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [activeTextId, setActiveTextId] = useState<string | null>(null)

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !uploadFile) return

      // Validate expiry (no custom check needed since slider has pre-validated steps)

      const fileExt = uploadFile.name.split('.').pop()
      const fileName = `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`

      let finalFile = uploadFile

      // Render edited image onto canvas
      if (uploadFile.type.startsWith('image/')) {
        const img = new Image()
        img.src = uploadPreview!
        await new Promise((resolve) => { img.onload = resolve })

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx) {
          // HD vertical story resolution 1080x1920
          canvas.width = 1080
          canvas.height = 1920

          // Black background
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          const editorWidth = 270 // based on container width in CSS
          const editorHeight = 480 // based on container height in CSS

          // Fit-cover calculation with zoom and offsets
          const imgRatio = img.width / img.height
          const containerRatio = editorWidth / editorHeight

          let renderWidth = editorWidth
          let renderHeight = editorHeight
          if (imgRatio > containerRatio) {
            renderWidth = editorHeight * imgRatio
          } else {
            renderHeight = editorWidth / imgRatio
          }

          renderWidth *= zoom
          renderHeight *= zoom

          const renderX = (editorWidth - renderWidth) / 2 + imgOffset.x
          const renderY = (editorHeight - renderHeight) / 2 + imgOffset.y

          const scaleX = canvas.width / editorWidth
          const scaleY = canvas.height / editorHeight

          ctx.drawImage(
            img,
            renderX * scaleX,
            renderY * scaleY,
            renderWidth * scaleX,
            renderHeight * scaleY
          )

          // Draw Texts
          storyTexts.forEach(t => {
            ctx.save()
            const canvasFontSize = Math.round(t.fontSize * scaleX)
            ctx.font = `bold ${canvasFontSize}px "${t.fontStyle}", sans-serif`
            ctx.textBaseline = 'top'

            const textMetrics = ctx.measureText(t.text)
            const textWidth = textMetrics.width
            const textHeight = canvasFontSize * 1.2

            const textX = (t.x / 100) * canvas.width
            const textY = (t.y / 100) * canvas.height

            // Background podlozhka
            if (t.bgStyle === 'dark') {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
              ctx.beginPath()
              ctx.roundRect(textX - canvasFontSize * 0.3, textY - canvasFontSize * 0.15, textWidth + canvasFontSize * 0.6, textHeight + canvasFontSize * 0.3, canvasFontSize * 0.25)
              ctx.fill()
            } else if (t.bgStyle === 'light') {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
              ctx.beginPath()
              ctx.roundRect(textX - canvasFontSize * 0.3, textY - canvasFontSize * 0.15, textWidth + canvasFontSize * 0.6, textHeight + canvasFontSize * 0.3, canvasFontSize * 0.25)
              ctx.fill()
            }

            // Fill Text
            ctx.fillStyle = t.bgStyle === 'light' ? '#000000' : t.color
            ctx.fillText(t.text, textX, textY)
            ctx.restore()
          })

          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
          if (blob) {
            finalFile = new File([blob], fileName, { type: 'image/jpeg' })
          }
        }
      }

      const publicUrl = await uploadToTelegram(finalFile, fileName)

      // Calculate expiration timestamp
      const now = new Date()
      const expiresAt = new Date()
      const selectedOption = LIFETIME_OPTIONS[lifetimeIndex]
      expiresAt.setHours(now.getHours() + selectedOption.hours)

      const { error: dbError } = await supabase
        .from('stories')
        .insert({
          user_id: profile.id,
          media_url: publicUrl,
          expires_at: expiresAt.toISOString()
        })
      if (dbError) throw dbError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          title: 'Истории',
          text: 'История успешно опубликована!'
        }
      }))
      setModalAnimating(true)
      setTimeout(() => {
        setShowModal(false)
        setModalAnimating(false)
        setUploadFile(null)
        if (uploadPreview) {
          try { URL.revokeObjectURL(uploadPreview); } catch(e){}
        }
        setUploadPreview(null)
      }, 250)
      if (onSuccess) onSuccess()
    },
    onError: (err: any) => {
      console.error('Error uploading story:', err)
      alert(err.message || 'Не удалось загрузить историю')
    }
  })

  const handleOpenModal = () => {
    setLifetimeIndex(5) // default to 24h
    setZoom(1.0)
    setImgOffset({ x: 0, y: 0 })
    setStoryTexts([])
    setEditingTextId(null)
    setModalAnimating(true)
    setShowModal(true)
    setTimeout(() => setModalAnimating(false), 50)
  }

  const handleCloseModal = () => {
    if (publishMutation.isPending) return
    setModalAnimating(true)
    setTimeout(() => {
      setShowModal(false)
      setModalAnimating(false)
      setUploadFile(null)
      if (uploadPreview) URL.revokeObjectURL(uploadPreview)
      setUploadPreview(null)
    }, 250)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        if (video.duration > 180) {
          alert('Длительность видео не должна превышать 3 минуты!')
          if (fileInputRef.current) fileInputRef.current.value = ''
        } else {
          setUploadFile(file)
          setUploadPreview(URL.createObjectURL(file))
          handleOpenModal()
        }
      }
      video.src = URL.createObjectURL(file)
    } else {
      setUploadFile(file)
      setUploadPreview(URL.createObjectURL(file))
      handleOpenModal()
    }
  }

  // Image Drag handling (X/Y movement inside preview box)
  const handleImageDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTextId) return // skip if dragging text
    e.preventDefault()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const startX = imgOffset.x
    const startY = imgOffset.y

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY
      setImgOffset({
        x: startX + (curX - clientX),
        y: startY + (curY - clientY)
      })
    }

    const onEnd = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onMove)
    document.addEventListener('touchend', onEnd)
  }

  // Text Drag handling (re-positioning inside preview box)
  const handleTextDragStart = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setActiveTextId(id)
    setEditingTextId(id)

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const targetText = storyTexts.find(t => t.id === id)
    if (!targetText) return

    const container = document.getElementById('story-canvas-container')
    if (!container) return
    const rect = container.getBoundingClientRect()

    const startXPercent = targetText.x
    const startYPercent = targetText.y

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY

      const diffXPercent = ((curX - clientX) / rect.width) * 100
      const diffYPercent = ((curY - clientY) / rect.height) * 100

      const newX = Math.max(0, Math.min(85, startXPercent + diffXPercent))
      const newY = Math.max(0, Math.min(95, startYPercent + diffYPercent))

      setStoryTexts(prev => prev.map(t => t.id === id ? { ...t, x: newX, y: newY } : t))
    }

    const onEnd = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      setActiveTextId(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onMove)
    document.addEventListener('touchend', onEnd)
  }

  const handleAddText = () => {
    const newText: StoryText = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'Текст',
      x: 30,
      y: 40,
      color: '#ffffff',
      bgStyle: 'dark',
      fontSize: 18,
      fontStyle: 'Montserrat'
    }
    setStoryTexts(prev => [...prev, newText])
    setEditingTextId(newText.id)
  }

  const currentEditingText = storyTexts.find(t => t.id === editingTextId)

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <input 
        type="file" 
        accept="image/*,video/*" 
        style={{ display: 'none' }} 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
      />

      {children ? (
        <div onClick={triggerFileSelect} style={{ width: '100%', height: '100%', cursor: 'pointer' }}>
          {children}
        </div>
      ) : (
        <div 
          onClick={triggerFileSelect}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <div 
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: '2px dashed var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.12))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'var(--vkui--color_background_secondary)',
              color: 'var(--vkui--color_text_secondary)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#007aff'
              e.currentTarget.style.color = '#007aff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.12))'
              e.currentTarget.style.color = 'var(--vkui--color_text_secondary)'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>
      )}

      {showModal && createPortal(
        <div 
          className="story-editor-overlay"
          style={{ opacity: modalAnimating ? 0 : 1 }}
          onClick={() => {
            if (!publishMutation.isPending) handleCloseModal()
          }}
        >
          <div 
            className="story-editor-modal"
            style={{ transform: modalAnimating ? 'scale(0.9) translateY(20px)' : 'scale(1) translateY(0)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Left section: interactive preview */}
            <div className="story-editor-left">
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--vkui--color_text_primary)' }}>Редактор истории</span>
                <button 
                  onClick={handleCloseModal}
                  disabled={publishMutation.isPending}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', fontSize: 20 }}
                >
                  ✕
                </button>
              </div>

              {uploadPreview && (
                <div 
                  id="story-canvas-container"
                  className="story-editor-canvas-container"
                  onMouseDown={handleImageDragStart}
                  onTouchStart={handleImageDragStart}
                >
                  {/* Photo or Video element */}
                  {uploadFile?.type.startsWith('video/') ? (
                    <video 
                      src={uploadPreview} 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        pointerEvents: 'none'
                      }} 
                      muted playsInline autoPlay loop 
                    />
                  ) : (
                    <img 
                      src={uploadPreview} 
                      alt="" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        transform: `scale(${zoom}) translate(${imgOffset.x / zoom}px, ${imgOffset.y / zoom}px)`,
                        transition: activeTextId ? 'none' : 'transform 0.05s ease-out',
                        pointerEvents: 'none'
                      }} 
                    />
                  )}

                  {/* Overlay text elements */}
                  {uploadFile?.type.startsWith('image/') && storyTexts.map(t => {
                    let textBg = 'transparent'
                    let textColor = t.color
                    if (t.bgStyle === 'dark') textBg = 'rgba(0, 0, 0, 0.65)'
                    else if (t.bgStyle === 'light') {
                      textBg = 'rgba(255, 255, 255, 0.85)'
                      textColor = '#000000'
                    }

                    return (
                      <div
                        key={t.id}
                        onMouseDown={e => handleTextDragStart(t.id, e)}
                        onTouchStart={e => handleTextDragStart(t.id, e)}
                        className={`story-draggable-text ${editingTextId === t.id ? 'editing' : ''}`}
                        style={{
                          left: `${t.x}%`,
                          top: `${t.y}%`,
                          fontSize: `${t.fontSize}px`,
                          fontFamily: t.fontStyle,
                          backgroundColor: textBg,
                          color: textColor
                        }}
                      >
                        {t.text}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right section: edit controls */}
            <div className="story-editor-right">
              {uploadFile?.type.startsWith('image/') ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Grid for Sliders */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Left Column: Zoom & Add Text Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--vkui--color_text_secondary)' }}>Масштаб фото</label>
                        <input 
                          type="range" 
                          min="1.0" 
                          max="3.0" 
                          step="0.05"
                          value={zoom} 
                          onChange={e => setZoom(parseFloat(e.target.value))}
                          style={{ width: '100%', accentColor: '#007aff' }}
                        />
                      </div>

                      <button 
                        onClick={handleAddText}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: 'none',
                          background: 'rgba(0,122,255,0.08)',
                          color: '#007aff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
                        Добавить текст
                      </button>
                    </div>

                    {/* Right Column: Lifetime slider & display */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--vkui--color_text_secondary)' }}>
                          Время жизни
                        </label>
                        <input 
                          type="range" 
                          min="0" 
                          max="7" 
                          step="1"
                          value={lifetimeIndex} 
                          onChange={e => setLifetimeIndex(parseInt(e.target.value))}
                          disabled={publishMutation.isPending}
                          style={{ width: '100%', accentColor: '#007aff', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--vkui--color_text_secondary)', padding: '0 2px' }}>
                          <span>1ч</span>
                          <span>24ч</span>
                          <span>3д</span>
                        </div>
                      </div>

                      <div style={{
                        background: 'var(--vkui--color_background_secondary, #f2f3f5)',
                        padding: '6px 8px',
                        borderRadius: 10,
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        minHeight: 28
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#007aff' }}>{LIFETIME_OPTIONS[lifetimeIndex].label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Text Editor panel */}
                  {currentEditingText && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--vkui--color_background_secondary)', padding: 12, borderRadius: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>Редактор текста</span>
                        <button 
                          onClick={() => setStoryTexts(prev => prev.filter(t => t.id !== editingTextId))}
                          style={{ background: 'none', border: 'none', color: '#ff3b30', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Удалить
                        </button>
                      </div>

                      <input 
                        type="text" 
                        value={currentEditingText.text}
                        onChange={e => setStoryTexts(prev => prev.map(t => t.id === editingTextId ? { ...t, text: e.target.value } : t))}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--vkui--color_separator_primary_alpha)',
                          background: 'var(--vkui--color_background_content)',
                          color: 'var(--vkui--color_text_primary)',
                          fontSize: 13,
                          outline: 'none'
                        }}
                        placeholder="Введите текст"
                      />

                      {/* Fonts */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>Шрифт</label>
                        <select
                          value={currentEditingText.fontStyle}
                          onChange={e => setStoryTexts(prev => prev.map(t => t.id === editingTextId ? { ...t, fontStyle: e.target.value as any } : t))}
                          style={{
                            padding: '6px',
                            borderRadius: 8,
                            background: 'var(--vkui--color_background_content)',
                            color: 'var(--vkui--color_text_primary)',
                            border: '1px solid var(--vkui--color_separator_primary_alpha)'
                          }}
                        >
                          <option value="Montserrat">Montserrat</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Impact">Impact (Мем)</option>
                          <option value="Courier New">Печатная машинка</option>
                        </select>
                      </div>

                      {/* Colors */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>Цвет</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['#ffffff', '#000000', '#ff3b30', '#34c759', '#007aff', '#ffcc00'].map(color => (
                            <div 
                              key={color}
                              onClick={() => setStoryTexts(prev => prev.map(t => t.id === editingTextId ? { ...t, color } : t))}
                              className={`story-editor-color-dot ${currentEditingText.color === color ? 'active' : ''}`}
                              style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #ddd' : 'none' }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Background Podlozhka style */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>Стиль подложки</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {([
                            { type: 'none', label: 'А', bg: 'transparent', color: 'var(--vkui--color_text_primary)' },
                            { type: 'dark', label: 'А', bg: 'rgba(0,0,0,0.6)', color: '#fff' },
                            { type: 'light', label: 'А', bg: 'rgba(255,255,255,0.8)', color: '#000' }
                          ] as const).map(style => (
                            <button
                              key={style.type}
                              onClick={() => setStoryTexts(prev => prev.map(t => t.id === editingTextId ? { ...t, bgStyle: style.type } : t))}
                              style={{
                                flex: 1,
                                padding: '6px',
                                borderRadius: 8,
                                border: '1px solid var(--vkui--color_separator_primary_alpha)',
                                background: style.bg || 'transparent',
                                color: style.color || 'var(--vkui--color_text_primary)',
                                fontSize: 13,
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: currentEditingText.bgStyle === style.type ? '2px solid #007aff' : 'none'
                              }}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Font size */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>Размер</label>
                        <input 
                          type="range" 
                          min="12" 
                          max="32" 
                          value={currentEditingText.fontSize}
                          onChange={e => setStoryTexts(prev => prev.map(t => t.id === editingTextId ? { ...t, fontSize: parseInt(e.target.value) } : t))}
                          style={{ width: '100%', accentColor: '#007aff' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Video specific controls - only lifetime slider */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_secondary)' }}>
                    Время жизни: <span style={{ color: '#007aff', fontWeight: 700 }}>{LIFETIME_OPTIONS[lifetimeIndex].label}</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="7" 
                    step="1"
                    value={lifetimeIndex} 
                    onChange={e => setLifetimeIndex(parseInt(e.target.value))}
                    disabled={publishMutation.isPending}
                    style={{ width: '100%', accentColor: '#007aff', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--vkui--color_text_secondary)', padding: '0 2px' }}>
                    <span>1 ч</span>
                    <span>12 ч</span>
                    <span>24 ч</span>
                    <span>3 дн</span>
                  </div>
                </div>
              )}

              {/* Publish button */}
              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#007aff',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: publishMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: publishMutation.isPending ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: '12px'
                }}
              >
                {publishMutation.isPending && <Spinner size="s" style={{ color: '#fff' }} />}
                {publishMutation.isPending ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
