import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Panel } from '@vkontakte/vkui'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { uploadToTelegram } from '../utils/telegramStorage'
import { useMusicStore } from '../store/useMusicStore'

interface Track {
  id: string
  user_id: string
  title: string
  artist: string
  album: string
  duration: number
  file_url: string
  cover_url: string | null
  plays_count: number
  genre: string
  year?: number | null
  created_at: string
  profiles?: {
    full_name: string | null
    avatar_url: string | null
    username: string | null
  }
}

interface MusicPanelProps {
  id: string
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Native ID3v2 tag reader — no external deps */
function readTags(file: File): Promise<{ title: string; artist: string; album: string; genre: string; year: number | null; cover: string | null }> {
  const defaults = {
    title: file.name.replace(/\.[^/.]+$/, ''),
    artist: 'Неизвестный исполнитель',
    album: '', genre: '', year: null as number | null, cover: null as string | null
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer
        const view = new DataView(buf)
        const bytes = new Uint8Array(buf)
        if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return resolve(defaults)
        const majorVersion = bytes[3]
        const tagSize = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f)
        const result = { ...defaults }
        const decoderLatin = new TextDecoder('latin1')
        let offset = 10
        while (offset < 10 + tagSize - 10) {
          if (bytes[offset] === 0) break
          const frameIdLen = majorVersion >= 3 ? 4 : 3
          const frameSizeLen = majorVersion >= 3 ? 4 : 3
          const frameId = String.fromCharCode(...bytes.slice(offset, offset + frameIdLen))
          let frameSize: number
          if (majorVersion >= 4) {
            frameSize = ((bytes[offset + 4] & 0x7f) << 21) | ((bytes[offset + 5] & 0x7f) << 14) | ((bytes[offset + 6] & 0x7f) << 7) | (bytes[offset + 7] & 0x7f)
          } else if (majorVersion === 3) {
            frameSize = view.getUint32(offset + 4)
          } else {
            frameSize = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5]
          }
          const headerLen = frameIdLen + frameSizeLen + (majorVersion >= 3 ? 2 : 0)
          const dataStart = offset + headerLen
          if (frameSize <= 0 || dataStart + frameSize > buf.byteLength) break
          const enc = bytes[dataStart]
          const strData = bytes.slice(dataStart + 1, dataStart + frameSize)
          const str = (enc === 1 || enc === 2)
            ? new TextDecoder('utf-16').decode(strData).replace(/\0/g, '')
            : decoderLatin.decode(strData).replace(/\0/g, '')
          if (frameId === 'TIT2' || frameId === 'TT2') result.title = str.trim() || result.title
          else if (frameId === 'TPE1' || frameId === 'TP1') result.artist = str.trim() || result.artist
          else if (frameId === 'TALB' || frameId === 'TAL') result.album = str.trim()
          else if (frameId === 'TCON' || frameId === 'TCO') result.genre = str.replace(/^\(\d+\)/, '').trim()
          else if (frameId === 'TYER' || frameId === 'TYE' || frameId === 'TDRC') { const y = parseInt(str); if (!isNaN(y)) result.year = y }
          else if (frameId === 'APIC' || frameId === 'PIC') {
            try {
              let picOffset = dataStart + 1
              if (frameId === 'APIC') { while (picOffset < dataStart + frameSize && bytes[picOffset] !== 0) picOffset++; picOffset++ }
              else { picOffset += 3 }
              picOffset++ // picture type
              while (picOffset < dataStart + frameSize && bytes[picOffset] !== 0) picOffset++
              picOffset++
              if (enc === 1 || enc === 2) { while (picOffset < dataStart + frameSize && (bytes[picOffset] !== 0 || bytes[picOffset + 1] !== 0)) picOffset += 2; picOffset += 2 }
              const imgBytes = bytes.slice(picOffset, dataStart + frameSize)
              result.cover = URL.createObjectURL(new Blob([imgBytes], { type: 'image/jpeg' }))
            } catch {}
          }
          offset += headerLen + frameSize
        }
        resolve(result)
      } catch { resolve(defaults) }
    }
    reader.onerror = () => resolve(defaults)
    reader.readAsArrayBuffer(file.slice(0, 512 * 1024))
  })
}


export const MusicPanel: React.FC<MusicPanelProps> = ({ id }) => {
  const { user, profile } = useAuthStore()
  const { currentTrack, isPlaying, setCurrentTrack, setPlaylist, currentTime, duration } = useMusicStore()

  const [activeTab, setActiveTab] = useState<'my' | 'search' | 'recs'>('my')
  const [myTracks, setMyTracks] = useState<Track[]>([])
  const [recTracks, setRecTracks] = useState<Track[]>([])
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState<'idle' | 'reading' | 'uploading' | 'saving'>('idle')
  const [showUpload, setShowUpload] = useState(false)

  // Drag and drop state
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // Preloading modal edit state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [editGenre, setEditGenre] = useState('')
  const [editCoverBlobUrl, setEditCoverBlobUrl] = useState<string | null>(null)
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null)
  const [editLyrics, setEditLyrics] = useState('')
  const [editDuration, setEditDuration] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverFileInputRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<any>(null)

  // Load my tracks
  const loadMyTracks = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('music_tracks')
      .select('*, profiles(full_name, avatar_url, username)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setMyTracks(data || [])
    setLoading(false)
  }, [user])

  // Load recommendations: most played tracks not in my library
  const loadRecs = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('music_tracks')
      .select('*, profiles(full_name, avatar_url, username)')
      .neq('user_id', user.id)
      .order('plays_count', { ascending: false })
      .limit(30)
    setRecTracks(data || [])
  }, [user])

  useEffect(() => {
    loadMyTracks()
    loadRecs()
  }, [loadMyTracks, loadRecs])

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase()
      const { data } = await supabase
        .from('music_tracks')
        .select('*, profiles(full_name, avatar_url, username)')
        .or(`title.ilike.%${q}%,artist.ilike.%${q}%,album.ilike.%${q}%`)
        .order('plays_count', { ascending: false })
        .limit(50)
      setSearchResults(data || [])
    }, 300)
  }, [searchQuery])

  const processFile = async (file: File) => {
    if (!user) return
    setUploading(true)
    setShowUpload(true)
    setUploadProgress(0)
    setUploadStage('reading')

    try {
      // 1. Read ID3 tags
      const tags = await readTags(file)

      // 2. Get duration
      let durationVal = 0
      try {
        const audioEl = document.createElement('audio')
        audioEl.preload = 'metadata'
        const objUrl = URL.createObjectURL(file)
        durationVal = await new Promise<number>((res) => {
          audioEl.onloadedmetadata = () => { res(Math.round(audioEl.duration)); URL.revokeObjectURL(objUrl) }
          audioEl.onerror = () => { res(0); URL.revokeObjectURL(objUrl) }
          audioEl.src = objUrl
        })
      } catch {}

      // Open Modal with filled values
      setSelectedFile(file)
      setEditTitle(tags.title || file.name.replace(/\.[^/.]+$/, ""))
      setEditArtist(tags.artist || 'Неизвестный исполнитель')
      setEditGenre(tags.genre || '')
      setEditCoverBlobUrl(tags.cover || null)
      setEditCoverFile(null)
      setEditLyrics('')
      setEditDuration(durationVal)
      
      setIsEditModalOpen(true)
    } catch (err) {
      console.error('Error reading file metadata:', err)
      alert('Не удалось прочитать теги файла.')
    } finally {
      setUploading(false)
      setShowUpload(false)
      setUploadStage('idle')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|flac|ogg|wav|m4a|aac)$/i)) {
      alert('Выберите аудиофайл (MP3, FLAC, OGG, WAV, M4A, AAC)')
      return
    }
    await processFile(file)
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(false)

    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|flac|ogg|wav|m4a|aac)$/i)) {
      alert('Выберите аудиофайл (MP3, FLAC, OGG, WAV, M4A, AAC)')
      return
    }
    await processFile(file)
  }

  const handleSaveTrack = async () => {
    if (!selectedFile || !user) return
    setIsEditModalOpen(false)
    setUploading(true)
    setShowUpload(true)
    setUploadProgress(0)
    setUploadStage('uploading')

    try {
      // 1. Upload audio to Telegram
      const audioUrl = await uploadToTelegram(selectedFile, selectedFile.name, (p) => setUploadProgress(Math.round(p * 0.85)))

      // 2. Upload cover if exists
      let coverUrl: string | null = null
      if (editCoverFile) {
        setUploadProgress(88)
        coverUrl = await uploadToTelegram(editCoverFile, `cover_${Date.now()}.jpg`)
      } else if (editCoverBlobUrl) {
        setUploadProgress(88)
        try {
          const resp = await fetch(editCoverBlobUrl)
          const blob = await resp.blob()
          const coverFile = new File([blob], 'cover.jpg', { type: blob.type || 'image/jpeg' })
          coverUrl = await uploadToTelegram(coverFile, `cover_${Date.now()}.jpg`)
        } catch (err) {
          console.error('Error uploading original cover:', err)
        }
      }

      // Cleanup cover blob url
      if (editCoverBlobUrl) {
        URL.revokeObjectURL(editCoverBlobUrl)
      }

      setUploadProgress(95)
      setUploadStage('saving')

      // 3. Save to Supabase (including lyrics)
      const { data: newTrack, error } = await supabase
        .from('music_tracks')
        .insert({
          user_id: user.id,
          title: editTitle.trim(),
          artist: editArtist.trim(),
          genre: editGenre.trim(),
          duration: editDuration,
          file_url: audioUrl,
          cover_url: coverUrl,
          lyrics: editLyrics.trim() || null,
          plays_count: 0
        })
        .select('*, profiles(full_name, avatar_url, username)')
        .single()

      if (!error && newTrack) {
        setMyTracks(prev => [newTrack, ...prev])
        setUploadProgress(100)
      } else {
        throw error
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('Ошибка при загрузке трека. Попробуйте ещё раз.')
    } finally {
      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
        setUploadStage('idle')
        setShowUpload(false)
        setSelectedFile(null)
      }, 1200)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCoverClick = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentTrack?.id === track.id) {
      useMusicStore.getState().setIsPlaying(!isPlaying)
    } else {
      setPlaylist(displayList)
      setCurrentTrack(track)
      useMusicStore.getState().setIsPlaying(true)
    }
  }

  const handleTitleClick = (title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveTab('search')
    setSearchQuery(title)
  }

  const handleArtistClick = (artist: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveTab('search')
    setSearchQuery(artist)
  }

  const handleTrackItemClick = (track: Track) => {
    if (currentTrack?.id !== track.id) {
      setPlaylist(displayList)
      setCurrentTrack(track)
      useMusicStore.getState().setIsPlaying(true)
      // Increment plays_count
      supabase
        .from('music_tracks')
        .update({ plays_count: track.plays_count + 1 })
        .eq('id', track.id)
        .then(({ error }) => {
          if (error) console.error("Error updating plays count:", error);
        });
    }
    useMusicStore.getState().setIsPlayerExpanded(true)
  }


  const addTrackToLibrary = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    try {
      let { data: newTrack, error } = await supabase
        .from('music_tracks')
        .insert({
          user_id: user.id,
          title: track.title,
          artist: track.artist,
          album: track.album || '',
          genre: track.genre || '',
          year: track.year || null,
          duration: track.duration,
          file_url: track.file_url,
          cover_url: track.cover_url,
          plays_count: 0
        })
        .select('*, profiles(full_name, avatar_url, username)')
        .single()

      if (error && (error.code === 'PGRST200' || error.message?.includes('profiles') || error.message?.includes('relationship'))) {
        const { data: fallbackTrack, error: fallbackError } = await supabase
          .from('music_tracks')
          .insert({
            user_id: user.id,
            title: track.title,
            artist: track.artist,
            album: track.album || '',
            genre: track.genre || '',
            year: track.year || null,
            duration: track.duration,
            file_url: track.file_url,
            cover_url: track.cover_url,
            plays_count: 0
          })
          .select()
          .single()

        if (fallbackError) throw fallbackError
        
        if (fallbackTrack) {
          newTrack = {
            ...fallbackTrack,
            profiles: {
              full_name: profile?.full_name || null,
              avatar_url: profile?.avatar_url || null,
              username: profile?.username || null
            }
          }
        }
      } else if (error) {
        throw error
      }

      if (newTrack) {
        setMyTracks(prev => [newTrack, ...prev])
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              title: 'Музыка',
              text: 'Трек добавлен в вашу музыку!',
              duration: 2000
            }
          })
        )
      }
    } catch (err) {
      console.error('Error adding track:', err)
      alert('Не удалось добавить трек')
    }
  }

  const downloadTrack = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(track.file_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${track.artist} - ${track.title}.mp3`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      window.open(track.file_url, '_blank')
    }
  }

  const deleteTrack = async (trackId: string) => {
    if (!confirm('Удалить трек?')) return
    await supabase.from('music_tracks').delete().eq('id', trackId)
    setMyTracks(prev => prev.filter(t => t.id !== trackId))
    if (currentTrack?.id === trackId) {
      setCurrentTrack(null)
    }
  }

  const handleInlineSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value)
    useMusicStore.getState().setCurrentTime(t)
    const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
    if (audio) {
      audio.currentTime = t
    }
  }

  const handleBottomSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const t = ratio * (duration || 0)
    useMusicStore.getState().setCurrentTime(t)
    const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
    if (audio) {
      audio.currentTime = t
    }
  }

  const displayList = activeTab === 'my' ? myTracks : activeTab === 'recs' ? recTracks : searchResults

  return (
    <Panel id={id}>
      <div 
        className="music-panel"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="music-header">
          <div className="music-header-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <span>Музыка</span>
          </div>
          <button
            className="music-add-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Добавить
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.flac,.ogg,.wav,.m4a,.aac"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        {/* Upload progress overlay */}
        {showUpload && (
          <div className="music-upload-overlay">
            <div className="music-upload-card">
              <div className="music-upload-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div className="music-upload-label">
                {uploadStage === 'reading' && 'Читаю теги и обложку...'}
                {uploadStage === 'uploading' && `Загружаю в облако... ${uploadProgress}%`}
                {uploadStage === 'saving' && 'Сохраняю в базу...'}
              </div>
              <div className="music-upload-bar">
                <div className="music-upload-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="music-tabs">
          <button
            className={`music-tab ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={activeTab === 'my' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            Моя
            {myTracks.length > 0 && <span className="music-tab-count">{myTracks.length}</span>}
          </button>
          <button
            className={`music-tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Поиск
          </button>
          <button
            className={`music-tab ${activeTab === 'recs' ? 'active' : ''}`}
            onClick={() => setActiveTab('recs')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={activeTab === 'recs' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Рекомендации
          </button>
        </div>

        {/* Search bar (only in search tab) */}
        {activeTab === 'search' && (
          <div className="music-search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Исполнитель, трек, альбом..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="music-search-input"
              autoFocus
            />
            {searchQuery && (
              <button className="music-search-clear" onClick={() => setSearchQuery('')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Track list */}
        <div className="music-track-list">
          {activeTab === 'search' && !searchQuery && (
            <div className="music-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <p>Введите название трека или исполнителя</p>
            </div>
          )}

          {loading && activeTab === 'my' && (
            <div className="music-loading">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="music-track-skeleton">
                  <div className="skeleton-cover" />
                  <div className="skeleton-info">
                    <div className="skeleton-title" />
                    <div className="skeleton-artist" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && activeTab === 'my' && myTracks.length === 0 && (
            <div className="music-empty">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              <p>Здесь будет ваша музыка</p>
              <button className="music-empty-btn" onClick={() => fileInputRef.current?.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Добавить первый трек
              </button>
            </div>
          )}

          {activeTab === 'recs' && recTracks.length === 0 && (
            <div className="music-empty">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <p>Пока нет рекомендаций — добавьте больше треков</p>
            </div>
          )}

          {activeTab === 'recs' && recTracks.length > 0 && (
            <div className="music-section-label">Популярное у других</div>
          )}

          {displayList.map((track) => {
            const isActive = currentTrack?.id === track.id
            return (
              <div
                key={track.id}
                className={`music-track-item ${isActive ? 'active' : ''} ${isActive && isPlaying ? 'playing' : ''}`}
                onClick={() => handleTrackItemClick(track)}
              >
                {/* Cover / equalizer */}
                <div className="music-track-cover" onClick={e => handleCoverClick(track, e)}>
                  {track.cover_url ? (
                    <img src={track.cover_url} alt={track.title} />
                  ) : (
                    <div className="music-track-cover-placeholder">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                  )}
                  {isActive && isPlaying && (
                    <div className="music-equalizer">
                      <span /><span /><span />
                    </div>
                  )}
                  {isActive && !isPlaying && (
                    <div className="music-play-icon-overlay">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="music-track-info">
                  <div className="music-track-title" onClick={e => handleTitleClick(track.title, e)}>{track.title}</div>
                  <div className="music-track-artist" onClick={e => handleArtistClick(track.artist, e)}>{track.artist}{track.album ? ` — ${track.album}` : ''}</div>
                  
                  {isActive && (
                    <div className="music-track-inline-player" onClick={e => e.stopPropagation()}>
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleInlineSeek}
                        className="music-track-inline-slider"
                      />
                      <div className="music-track-inline-time">
                        <span>{formatDuration(currentTime)}</span>
                        <span>{formatDuration(duration)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Duration & actions */}
                <div className="music-track-right">
                  <span className="music-track-duration">{formatDuration(track.duration)}</span>
                  
                  {/* Download button */}
                  <button
                    className="music-track-delete download-btn"
                    onClick={e => downloadTrack(track, e)}
                    title="Скачать"
                    style={{ opacity: 1 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>

                  {track.user_id === user?.id ? (
                    <button
                      className="music-track-delete"
                      onClick={e => { e.stopPropagation(); deleteTrack(track.id) }}
                      title="Удалить"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  ) : (
                    /* Show add button if not already in library */
                    !myTracks.some(t => t.file_url === track.file_url) && (
                      <button
                        className="music-track-delete add-btn"
                        onClick={e => addTrackToLibrary(track, e)}
                        title="Добавить в мою музыку"
                        style={{ opacity: 1 }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Bottom Player on Music Page */}
        {currentTrack && (
          <div className="music-bottom-player-bar" onClick={() => useMusicStore.getState().setIsPlayerExpanded(true)}>
            <div className="mbp-progress" onClick={e => { e.stopPropagation(); handleBottomSeek(e) }}>
              <div className="mbp-progress-fill" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
            </div>
            
            <div className="mbp-content">
              <div className="mbp-left">
                <div className="mbp-cover">
                  {currentTrack.cover_url ? (
                    <img src={currentTrack.cover_url} alt="" />
                  ) : (
                    <div className="mbp-cover-ph">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="mbp-info">
                  <span className="mbp-title">{currentTrack.title}</span>
                  <span className="mbp-artist">{currentTrack.artist}</span>
                </div>
              </div>

              <div className="mbp-center" onClick={e => e.stopPropagation()}>
                <button className="mbp-btn" onClick={() => useMusicStore.getState().prevTrack()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="19 20 9 12 19 4 19 20"/>
                    <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </button>
                <button className="mbp-btn mbp-play" onClick={() => useMusicStore.getState().setIsPlaying(!isPlaying)}>
                  {isPlaying ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                </button>
                <button className="mbp-btn" onClick={() => useMusicStore.getState().nextTrack()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 4 15 12 5 20 5 4"/>
                    <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* Volume on PC */}
              <div className="mbp-right" onClick={e => e.stopPropagation()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={useMusicStore.getState().volume}
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    useMusicStore.getState().setVolume(v)
                    const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
                    if (audio) audio.volume = v
                  }}
                  className="mbp-volume-slider"
                />
              </div>
            </div>
          </div>
        )}

        {/* Drag and Drop hover overlay */}
        {isDraggingFile && (
          <div className="music-drag-drop-overlay">
            <div className="music-drag-drop-card">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 12 }}>Перетащите аудиофайл сюда для загрузки...</div>
            </div>
          </div>
        )}

        {/* Edit Track Modal */}
        {isEditModalOpen && (
          <div className="music-edit-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
            <div className="music-edit-modal" onClick={e => e.stopPropagation()}>
              <h3>Загрузка нового трека</h3>
              
              <div className="music-edit-body">
                {/* Cover section */}
                <div className="music-edit-cover-section">
                  <div 
                    className="music-edit-cover-preview"
                    onClick={() => coverFileInputRef.current?.click()}
                    title="Нажмите для выбора обложки"
                  >
                    {editCoverFile || editCoverBlobUrl ? (
                      <img src={editCoverFile ? URL.createObjectURL(editCoverFile) : editCoverBlobUrl!} alt="Обложка" />
                    ) : (
                      <div className="music-edit-cover-ph">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                        </svg>
                        <span>Выбрать фото</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setEditCoverFile(file)
                    }}
                  />
                </div>

                {/* Fields section */}
                <div className="music-edit-fields-section">
                  <div className="music-edit-field">
                    <label>Название</label>
                    <input 
                      type="text" 
                      value={editTitle} 
                      onChange={e => setEditTitle(e.target.value)} 
                      placeholder="Например: Не отступаю" 
                    />
                  </div>
                  
                  <div className="music-edit-field">
                    <label>Исполнитель</label>
                    <input 
                      type="text" 
                      value={editArtist} 
                      onChange={e => setEditArtist(e.target.value)} 
                      placeholder="Например: AI LGX" 
                    />
                  </div>

                  <div className="music-edit-field">
                    <label>Жанр / Теги</label>
                    <input 
                      type="text" 
                      value={editGenre} 
                      onChange={e => setEditGenre(e.target.value)} 
                      placeholder="Например: Rock, Slowed" 
                    />
                  </div>

                  <div className="music-edit-field">
                    <label>Текст песни</label>
                    <textarea 
                      value={editLyrics} 
                      onChange={e => setEditLyrics(e.target.value)} 
                      placeholder="Вставьте текст песни..." 
                      rows={5}
                    />
                  </div>
                </div>
              </div>

              <div className="music-edit-footer">
                <button className="music-edit-btn cancel" onClick={() => setIsEditModalOpen(false)}>Отмена</button>
                <button className="music-edit-btn save" onClick={handleSaveTrack} disabled={!editTitle.trim()}>Загрузить</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
