import React from 'react'
import { useMusicStore } from '../store/useMusicStore'

/**
 * MiniPlayerBar — встраивается в Header вместо строки поиска когда играет музыка.
 */
export const MiniPlayerBar: React.FC = () => {
  const {
    currentTrack, isPlaying, duration, currentTime,
    setIsPlaying, nextTrack, prevTrack, setIsPlayerExpanded
  } = useMusicStore()

  if (!currentTrack) return null

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
    <div className="mini-player-bar" onClick={() => setIsPlayerExpanded(true)} style={{ position: 'relative' }}>
      {isPlaying && (
        <div style={{
          position: 'absolute',
          inset: -3,
          background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.45) 0%, rgba(122, 0, 255, 0.45) 50%, rgba(255, 45, 85, 0.45) 100%)',
          borderRadius: 12,
          filter: 'blur(10px)',
          zIndex: -1,
          animation: 'beatGlow 0.8s infinite alternate cubic-bezier(0.25, 0.8, 0.25, 1)',
          pointerEvents: 'none'
        }} />
      )}
      <div className="mpb-cover">
        {currentTrack.cover_url
          ? <img src={currentTrack.cover_url} alt="" />
          : <div className="mpb-cover-placeholder">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
        }
      </div>
      <div className="mpb-info">
        <span className="mpb-title">{currentTrack.title}</span>
        <span className="mpb-artist">{currentTrack.artist}</span>
      </div>
      <div className="mpb-controls" onClick={e => e.stopPropagation()}>
        <button className="mpb-btn" onClick={() => prevTrack()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="19 20 9 12 19 4 19 20"/>
            <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="mpb-btn mpb-play" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>
        <button className="mpb-btn" onClick={() => nextTrack()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div className="mpb-progress" onClick={e => { e.stopPropagation(); handleSeek(e) }}>
        <div className="mpb-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
