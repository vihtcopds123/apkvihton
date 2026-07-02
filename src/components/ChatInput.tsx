import React, { useState, useRef, useEffect, useCallback } from 'react'
import { EmojiPicker } from './EmojiPicker'
import { StickerPicker } from './StickerPicker'
import { createPortal } from 'react-dom'

// Объединённая кнопка Эмодзи + Стикеры
const CombinedPicker: React.FC<{
  onSelectEmoji: (e: string) => void
  onSelectSticker: (url: string) => void
}> = ({ onSelectEmoji, onSelectSticker }) => {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'emoji' | 'stickers'>('emoji')
  const [style, setStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const calcPos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const w = 320, h = 300
    let left = r.left + r.width / 2 - w / 2
    let top = r.top - h - 8
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8
    if (left < 8) left = 8
    if (top < 8) top = r.bottom + 8
    setStyle({ position: 'fixed', top, left, width: w, height: h, zIndex: 200000 })
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const p = document.getElementById('combined-picker-portal')
      if (p?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="v-chat-action-btn"
        onClick={() => { calcPos(); setOpen(p => !p) }}
        title="Эмодзи и стикеры"
        style={{ fontSize: 20, lineHeight: 1, padding: '0 2px' }}
      >
        😊
      </button>
      {open && createPortal(
        <div
          id="combined-picker-portal"
          ref={popRef}
          style={{
            ...style,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--vkui--color_background_content, #1c1c1e)',
            border: '1.5px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            {(['emoji', 'stickers'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid #007aff' : '2px solid transparent',
                  color: tab === t ? '#007aff' : 'var(--vkui--color_text_secondary)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {t === 'emoji' ? '😊 Эмодзи' : '🖼️ Стикеры'}
              </button>
            ))}
          </div>
          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {tab === 'emoji' ? (
              <EmojiPicker isSidebar={true} onSelect={(e) => { onSelectEmoji(e); setOpen(false) }} />
            ) : (
              <StickerPicker
                isSidebar={true}
                onSelectSticker={(url) => { onSelectSticker(url); setOpen(false) }}
              />
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

interface ChatInputProps {
  isChatRestricted: boolean
  isBlockedByUs: boolean
  isSystemChat?: boolean
  editingMessage: any
  setEditingMessage: (msg: any) => void
  replyTo: any
  setReplyTo: (reply: any) => void
  inputText: string
  setInputText: (text: string) => void
  handleInputChange: (text: string) => void
  attachedFile: File | null
  localPreviewUrl: string | null
  isUploading: boolean
  uploadProgress: number
  handleCancelUpload: () => void
  isRecording: boolean
  recordingSeconds: number
  formatAudioDuration: (s: number) => string
  cancelRecording: () => void
  stopRecording: () => void
  startRecording: (e: any) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSendMessage: () => void
  sending: boolean
  uploadedUrl: string | null
  isDesktop: boolean
  isGroupChat: boolean
  handleEmojiSelect: (emoji: string) => void
  videoTitle: string
  setVideoTitle: (title: string) => void
  startCircleVideo: () => void
  stopCircleVideo: (shouldSend: boolean) => void
  isRecordingCircle: boolean
  circleSeconds: number
  circleVideoRef: React.RefObject<HTMLVideoElement | null>
  inputActionMode: 'audio' | 'video'
  setInputActionMode: (mode: 'audio' | 'video') => void
  attachedTrack?: any
  onMusicAttachClick?: () => void
  onMusicDetachClick?: () => void
  onSendSticker?: (url: string) => void
}

export const ChatInput: React.FC<ChatInputProps> = ({
  isChatRestricted,
  isBlockedByUs,
  isSystemChat,
  editingMessage,
  setEditingMessage,
  replyTo,
  setReplyTo,
  inputText,
  setInputText,
  handleInputChange,
  attachedFile,
  localPreviewUrl,
  isUploading,
  uploadProgress,
  handleCancelUpload,
  isRecording,
  recordingSeconds,
  formatAudioDuration,
  cancelRecording,
  stopRecording,
  startRecording,
  textareaRef,
  fileInputRef,
  handleFileChange,
  handleSendMessage,
  sending,
  uploadedUrl,
  isDesktop,
  isGroupChat,
  handleEmojiSelect,
  videoTitle,
  setVideoTitle,
  startCircleVideo,
  stopCircleVideo,
  isRecordingCircle,
  circleSeconds,
  circleVideoRef,
  inputActionMode,
  setInputActionMode,
  attachedTrack,
  onMusicAttachClick,
  onMusicDetachClick,
  onSendSticker,
}) => {
  const pressStartTimeRef = React.useRef<number>(0);
  const isRecordingRef = React.useRef<boolean>(false);

  const handleActionBtnDown = (e: any) => {
    if (e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault();
    }
    pressStartTimeRef.current = Date.now();
    isRecordingRef.current = false;
    
    const timer = setTimeout(() => {
      if (pressStartTimeRef.current > 0) {
        isRecordingRef.current = true;
        if (inputActionMode === 'audio') {
          startRecording(e);
        } else {
          startCircleVideo();
        }
      }
    }, 250);
    
    (e.currentTarget as any)._pressTimer = timer;
  };

  const handleActionBtnUp = (e: any) => {
    if (e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault();
    }
    const pressDuration = Date.now() - pressStartTimeRef.current;
    pressStartTimeRef.current = 0;
    
    const timer = (e.currentTarget as any)._pressTimer;
    if (timer) clearTimeout(timer);

    if (!isRecordingRef.current || pressDuration < 250) {
      setInputActionMode(inputActionMode === 'audio' ? 'video' : 'audio');
    } else {
      if (inputActionMode === 'audio') {
        stopRecording();
      } else {
        stopCircleVideo(true);
      }
    }
    isRecordingRef.current = false;
  };

  return (
    <div className="v-chat-input-container">
      {isChatRestricted ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', minHeight: 40 }}>
          <span style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', textAlign: 'center', fontWeight: 500 }}>
            {isSystemChat 
              ? 'В этот чат нельзя отправлять сообщения.' 
              : isBlockedByUs 
                ? 'Вы заблокировали пользователя.' 
                : 'Вам заблокировали отправку сообщений.'}
          </span>
        </div>
      ) : (
        <>
          {editingMessage && (
            <div className="v-chat-edit-banner">
              <span>Редактирование...</span>
              <span onClick={() => { setEditingMessage(null); setInputText('') }} className="v-chat-edit-cancel">Отмена</span>
            </div>
          )}
          {replyTo && !editingMessage && (
            <div className="v-chat-edit-banner" style={{ borderLeft: '3px solid #007aff', background: 'rgba(0,122,255,0.06)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#007aff', marginBottom: 2 }}>Ответить {replyTo.senderName}</div>
                <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--vkui--color_text_secondary)' }}>{replyTo.content}</div>
              </div>
              <span onClick={() => setReplyTo(null)} className="v-chat-edit-cancel">Отмена</span>
            </div>
          )}
          {attachedFile && (
            <div className="v-chat-attach-preview" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="v-chat-attach-card" style={{ flexShrink: 0 }}>
                  {attachedFile.type.startsWith('video/') || attachedFile.name.toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/) ? (
                    <video src={localPreviewUrl || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                  ) : (
                    <img src={localPreviewUrl || ''} alt="" />
                  )}
                  {isUploading && <div className="v-chat-attach-progress"><span>{uploadProgress}%</span></div>}
                  <button onClick={handleCancelUpload} className="v-chat-attach-delete">x</button>
                </div>
                {(attachedFile.type.startsWith('video/') || attachedFile.name.toLowerCase().match(/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/)) && (
                  <div style={{ flex: 1 }}>
                    <input 
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Название видео"
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        border: '1.5px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.12))',
                        borderRadius: 8,
                        fontSize: 13,
                        background: 'var(--vkui--color_background_secondary)',
                        color: 'var(--vkui--color_text_primary)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          {attachedTrack && (
            <div className="v-chat-attach-preview" style={{ padding: '8px 12px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--vkui--color_background_secondary)', padding: '6px 12px', borderRadius: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: 8 }}>
                  🎵 {attachedTrack.artist} — {attachedTrack.title}
                </span>
                <button 
                  onClick={onMusicDetachClick} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', fontSize: 15, padding: '2px 6px', fontWeight: 'bold' }}
                >
                  ×
                </button>
              </div>
            </div>
          )}
          {isRecordingCircle && (
            <div className="v-circle-recording-preview">
              <video ref={circleVideoRef} autoPlay muted playsInline className="v-circle-recording-video" />
              <span className="v-circle-recording-timer">{formatAudioDuration(circleSeconds)}</span>
            </div>
          )}
          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'rgba(255,59,48,0.08)', borderRadius: 12, margin: '0 8px 4px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff3b30', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 13, color: '#ff3b30', fontWeight: 600 }}>Записываю {formatAudioDuration(recordingSeconds)}</span>
              <div style={{ flex: 1 }} />
              <button onClick={cancelRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>Отмена</button>
              <button onClick={stopRecording} style={{ background: '#007aff', border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Отправить</button>
            </div>
          )}
          {isRecordingCircle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'rgba(48,209,88,0.08)', borderRadius: 12, margin: '0 8px 4px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#30d158', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 13, color: '#30d158', fontWeight: 600 }}>Запись видео {formatAudioDuration(circleSeconds)}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => stopCircleVideo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>Отмена</button>
              <button onClick={() => stopCircleVideo(true)} style={{ background: '#30d158', border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Отправить</button>
            </div>
          )}
          {!isRecording && !isRecordingCircle && (
            <div className="v-chat-input-row">
              <div className="v-chat-input-pill">
                <textarea 
                  ref={textareaRef} 
                  rows={1} 
                  className="v-chat-textarea" 
                  value={inputText} 
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                  onBlur={() => {
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
                    if (isIOS) {
                      setTimeout(() => {
                        window.scrollTo(0, 0)
                        document.body.scrollTop = 0
                      }, 80)
                    }
                  }}
                  placeholder={editingMessage ? 'Изменить сообщение...' : replyTo ? 'Написать ответ...' : isGroupChat ? 'Написать в группу...' : 'Написать сообщение...'} 
                />
                {!isDesktop && (
                  <CombinedPicker
                    onSelectEmoji={handleEmojiSelect}
                    onSelectSticker={onSendSticker || (() => {})}
                  />
                )}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileChange} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="v-chat-action-btn" title="Прикрепить фото/видео">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>
                <button type="button" onClick={onMusicAttachClick} className="v-chat-action-btn" title="Прикрепить музыку">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                </button>
                {!inputText.trim() && !uploadedUrl && !attachedTrack && (
                  <button 
                    type="button" 
                    onMouseDown={handleActionBtnDown} 
                    onTouchStart={handleActionBtnDown}
                    onMouseUp={handleActionBtnUp}
                    onTouchEnd={handleActionBtnUp}
                    onMouseLeave={() => {
                      if (isRecordingRef.current) {
                        const timer = (pressStartTimeRef as any).current?._pressTimer;
                        if (timer) clearTimeout(timer);
                        pressStartTimeRef.current = 0;
                        if (inputActionMode === 'audio') {
                          cancelRecording();
                        } else {
                          stopCircleVideo(false);
                        }
                        isRecordingRef.current = false;
                      }
                    }}
                    className="v-chat-action-btn v-chat-record-btn-unified" 
                    style={{ color: inputActionMode === 'audio' ? '#007aff' : '#30d158' }} 
                    title={inputActionMode === 'audio' ? 'Голосовое (Зажать) / Сменить режим (Клик)' : 'Кружочек (Зажать) / Сменить режим (Клик)'}
                  >
                    {inputActionMode === 'audio' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <button 
                onClick={handleSendMessage} 
                disabled={sending || isUploading || (!inputText.trim() && !uploadedUrl && !attachedTrack)} 
                className="v-chat-action-btn send-btn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
