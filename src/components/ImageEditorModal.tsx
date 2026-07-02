import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Spinner } from '@vkontakte/vkui'

interface ImageEditorModalProps {
  file: File
  aspectRatio: 'circle' | 'banner'
  onClose: () => void
  onSave: (croppedFile: File) => void
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  file,
  aspectRatio,
  onClose,
  onSave
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1.0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  // Crop box (viewport) configuration
  const viewportWidth = aspectRatio === 'circle' ? 280 : 320
  const viewportHeight = aspectRatio === 'circle' ? 280 : 120

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImgSrc(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }, [file])

  const handleImageLoad = () => {
    setImgLoaded(true)
    setZoom(1.0)
    setOffset({ x: 0, y: 0 })
  }

  // Calculate default bounds and layout like cover
  const getRenderDimensions = () => {
    if (!imgRef.current) return { w: 0, h: 0, defaultX: 0, defaultY: 0 }
    const imgW = imgRef.current.naturalWidth
    const imgH = imgRef.current.naturalHeight

    const imgRatio = imgW / imgH
    const containerRatio = viewportWidth / viewportHeight

    let baseW = viewportWidth
    let baseH = viewportHeight

    if (imgRatio > containerRatio) {
      baseW = viewportHeight * imgRatio
    } else {
      baseH = viewportWidth / imgRatio
    }

    const renderW = baseW * zoom
    const renderH = baseH * zoom

    const defaultX = (viewportWidth - renderW) / 2
    const defaultY = (viewportHeight - renderH) / 2

    return { w: renderW, h: renderH, defaultX, defaultY }
  }

  const { w: rW, h: rH, defaultX, defaultY } = getRenderDimensions()

  // Helper to restrict translation within borders so no black areas are shown
  const restrictOffset = (dx: number, dy: number) => {
    if (!imgRef.current) return { x: 0, y: 0 }
    const minX = viewportWidth - rW - defaultX
    const maxX = -defaultX
    const minY = viewportHeight - rH - defaultY
    const maxY = -defaultY

    return {
      x: Math.min(Math.max(dx, minX), maxX),
      y: Math.min(Math.max(dy, minY), maxY)
    }
  }

  // Adjust translation when zoom changes to prevent image from slipping out of bounds
  useEffect(() => {
    if (imgLoaded) {
      setOffset((prev) => restrictOffset(prev.x, prev.y))
    }
  }, [zoom, imgLoaded])

  // Event Handlers for Dragging
  const handleDragStart = (clientX: number, clientY: number) => {
    isDragging.current = true
    dragStart.current = {
      x: clientX - offset.x,
      y: clientY - offset.y
    }
  }

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return
    const dx = clientX - dragStart.current.x
    const dy = clientY - dragStart.current.y
    setOffset(restrictOffset(dx, dy))
  }

  const handleDragEnd = () => {
    isDragging.current = false
  }

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleDragStart(e.clientX, e.clientY)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY)
  }

  const onMouseUp = () => {
    handleDragEnd()
  }

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleDragStart(touch.clientX, touch.clientY)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleDragMove(touch.clientX, touch.clientY)
  }

  const onTouchEnd = () => {
    handleDragEnd()
  }

  // Generate cropped output file via Canvas
  const handleSave = async () => {
    if (!imgRef.current || isProcessing) return
    setIsProcessing(true)

    try {
      const canvas = document.createElement('canvas')
      canvas.width = aspectRatio === 'circle' ? 1080 : 1920
      canvas.height = aspectRatio === 'circle' ? 1080 : 720

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')

      // Draw background white/black
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const scaleX = canvas.width / viewportWidth
      const scaleY = canvas.height / viewportHeight

      ctx.drawImage(
        imgRef.current,
        (defaultX + offset.x) * scaleX,
        (defaultY + offset.y) * scaleY,
        rW * scaleX,
        rH * scaleY
      )

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.95)
      })

      if (!blob) throw new Error('Canvas export failed')

      const croppedFile = new File([blob], file.name, { type: 'image/jpeg' })
      onSave(croppedFile)
    } catch (err) {
      console.error('Error cropping image:', err)
      alert('Ошибка при обработке изображения')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!imgSrc) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20000,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        padding: 16,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Editor Modal Window */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'rgba(25, 25, 25, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          padding: 24,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'storySlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>
          {aspectRatio === 'circle' ? 'Редактирование аватара' : 'Редактирование обложки'}
        </h3>
        <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>
          Перетаскивайте изображение для выбора области и используйте ползунок для зума
        </p>

        {/* Viewport Container */}
        <div
          ref={containerRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            position: 'relative',
            width: viewportWidth,
            height: viewportHeight,
            borderRadius: aspectRatio === 'circle' ? '50%' : 12,
            overflow: 'hidden',
            cursor: 'move',
            background: '#151515',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8), 0 0 0 4px rgba(255,255,255,0.15)',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          {/* Image */}
          <img
            ref={imgRef}
            src={imgSrc}
            alt="Source"
            onLoad={handleImageLoad}
            style={{
              position: 'absolute',
              width: rW || 'auto',
              height: rH || 'auto',
              left: defaultX + offset.x,
              top: defaultY + offset.y,
              pointerEvents: 'none',
              transform: 'none'
            }}
          />
        </div>

        {/* Zoom Slider */}
        <div style={{ width: '100%', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
            <span>Отдалить</span>
            <span>Приблизить</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.2)',
              outline: 'none',
              cursor: 'pointer',
              accentColor: '#007aff'
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 24 }}>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 14,
              border: 'none',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isProcessing || !imgLoaded}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 14,
              border: 'none',
              background: '#007aff',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              opacity: (isProcessing || !imgLoaded) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {isProcessing && <Spinner size="s" style={{ color: '#fff' }} />}
            {isProcessing ? 'Сохранение...' : 'Применить'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
