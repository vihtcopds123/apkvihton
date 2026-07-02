import React from 'react'
import { useMusicStore } from '../store/useMusicStore'

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const ExpandedMusicPlayer: React.FC = () => {
  const {
    currentTrack, isPlaying, currentTime, duration, volume, shuffle, repeat,
    isPlayerExpanded, setIsPlaying, setVolume,
    toggleShuffle, toggleRepeat, nextTrack, prevTrack, setIsPlayerExpanded
  } = useMusicStore()

  if (!isPlayerExpanded || !currentTrack) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const t = ratio * duration
    useMusicStore.getState().setCurrentTime(t)
    const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
    if (audio) audio.currentTime = t
  }

  return (
    <div className="mpb-overlay" onClick={() => setIsPlayerExpanded(false)}>
      <div className="mpb-expanded" onClick={e => e.stopPropagation()}>
        {currentTrack.cover_url && (
          <div 
            className="mpb-expanded-blur-bg" 
            style={{ backgroundImage: `url(${currentTrack.cover_url})` }} 
          />
        )}
        
        {/* Close Button */}
        <button className="mpb-close" onClick={() => setIsPlayerExpanded(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Big Cover */}
        <div className="mpb-big-cover">
          {currentTrack.cover_url
            ? <img src={currentTrack.cover_url} alt={currentTrack.title} />
            : <div className="mpb-big-cover-ph">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
          }
        </div>

        {/* Track Meta */}
        <div className="mpb-meta">
          <div className="mpb-title-full">{currentTrack.title}</div>
          <div className="mpb-artist-full">{currentTrack.artist}</div>
          {currentTrack.album && <div className="mpb-album">{currentTrack.album}</div>}
        </div>

        {/* Time Progress */}
        <div className="mpb-time-row">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="mpb-progress-big" onClick={handleSeek}>
          <div className="mpb-progress-big-fill" style={{ width: `${progress}%` }}>
            <div className="mpb-progress-big-thumb" />
          </div>
        </div>

        {/* Controls */}
        <div className="mpb-main-controls">
          <button className={`mpb-ctrl ${shuffle ? 'active' : ''}`} onClick={toggleShuffle} title="Перемешать">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
              <line x1="4" y1="4" x2="9" y2="9"/>
            </svg>
          </button>
          <button className="mpb-ctrl" onClick={() => prevTrack()}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19 20 9 12 19 4 19 20"/>
              <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="mpb-ctrl mpb-play-big" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying
              ? <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </button>
          <button className="mpb-ctrl" onClick={() => nextTrack()}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"/>
              <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <button className={`mpb-ctrl ${repeat !== 'none' ? 'active' : ''}`} onClick={toggleRepeat} title="Повтор">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              {repeat === 'one' && <text x="12" y="14.5" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">1</text>}
            </svg>
          </button>
        </div>

        {/* Volume */}
        <div className="mpb-volume-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          </svg>
          <input type="range" min="0" max="1" step="0.01" value={volume}
            onChange={e => {
              const v = parseFloat(e.target.value)
              setVolume(v)
              const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
              if (audio) audio.volume = v
            }}
            className="mpb-volume-slider"
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        </div>
      </div>
    </div>
  )
}
