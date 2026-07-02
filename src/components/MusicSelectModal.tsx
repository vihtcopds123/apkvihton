import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useMusicStore } from '../store/useMusicStore'
import type { Track } from '../store/useMusicStore'
import { Spinner } from '@vkontakte/vkui'
import { Icon28Play, Icon28Pause } from '@vkontakte/icons'

interface MusicSelectModalProps {
  onClose: () => void
  onSelect: (track: Track) => void
}

export const MusicSelectModal: React.FC<MusicSelectModalProps> = ({ onClose, onSelect }) => {
  const { user } = useAuthStore()
  const { currentTrack, isPlaying } = useMusicStore()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchTracks = async () => {
      if (!user) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('music_tracks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setTracks(data || [])
      } catch (err) {
        console.error('Error fetching select tracks:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTracks()
  }, [user])

  const filteredTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handlePlayPause = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation()
    const store = useMusicStore.getState()
    if (currentTrack?.id === track.id) {
      store.setIsPlaying(!isPlaying)
    } else {
      store.setPlaylist(tracks)
      store.setCurrentTrack(track)
      store.setIsPlaying(true)
    }
  }

  return (
    <div 
      className="mpb-overlay" 
      onClick={onClose}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
    >
      <div 
        className="mpb-expanded" 
        onClick={e => e.stopPropagation()}
        style={{
          width: '420px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--vkui--color_background_content)',
          border: '1px solid var(--vkui--color_separator_primary_alpha)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--vkui--color_text_primary)' }}>Прикрепить музыку</span>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--vkui--color_text_secondary)'
            }}
          >
            ×
          </button>
        </div>

        <input 
          type="text"
          placeholder="Поиск по моим аудиозаписям"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid var(--vkui--color_separator_primary_alpha)',
            background: 'var(--vkui--color_background_secondary)',
            color: 'var(--vkui--color_text_primary)',
            outline: 'none',
            fontSize: '14px',
            marginBottom: '16px',
            boxSizing: 'border-box'
          }}
        />

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '200px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Spinner size="m" />
            </div>
          ) : filteredTracks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vkui--color_text_secondary)', fontSize: '13px' }}>
              Ничего не найдено
            </div>
          ) : (
            filteredTracks.map(track => {
              const isCurrent = currentTrack?.id === track.id
              const isPlay = isCurrent && isPlaying
              return (
                <div 
                  key={track.id}
                  onClick={() => onSelect(track)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: 'var(--vkui--color_background_secondary_alpha, rgba(255,255,255,0.02))',
                    border: '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--vkui--color_background_secondary)'
                    e.currentTarget.style.borderColor = 'var(--vkui--color_separator_primary_alpha)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--vkui--color_background_secondary_alpha, rgba(255,255,255,0.02))'
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  {/* Cover / Play btn */}
                  <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#1c1c1e' }}>
                    {track.cover_url ? (
                      <img src={track.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #2c3e50, #3498db)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
                        🎵
                      </div>
                    )}
                    <div 
                      onClick={e => handlePlayPause(e, track)}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isCurrent ? 1 : 0,
                        transition: 'opacity 0.2s'
                      }}
                      className="track-hover-play"
                    >
                      {isPlay ? (
                        <Icon28Pause fill="#fff" width={20} height={20} />
                      ) : (
                        <Icon28Play fill="#fff" width={20} height={20} />
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--vkui--color_text_primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {track.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--vkui--color_text_secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                      {track.artist}
                    </div>
                  </div>

                  {/* Duration */}
                  <div style={{ fontSize: '12px', color: 'var(--vkui--color_text_secondary)' }}>
                    {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      <style>{`
        div:hover .track-hover-play {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}
