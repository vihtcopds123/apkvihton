import React, { useEffect, useRef } from 'react'
import { useMusicStore } from '../store/useMusicStore'

export const GlobalMusicPlayer: React.FC = () => {
  const {
    currentTrack, isPlaying, volume, isDimmed,
    setIsPlaying, setCurrentTime, setDuration,
    nextTrack
  } = useMusicStore()

  const audioRef = useRef<HTMLAudioElement>(null)

  // Sync volume with dim state reactively
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isDimmed ? volume * 0.2 : volume
  }, [volume, isDimmed])

  // Initial sync & fallback (runs only if source differs)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (audio.src !== currentTrack.file_url) {
      audio.src = currentTrack.file_url
      audio.load()
      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false))
      }
    } else {
      // If src is same but play/pause state differs, sync it gently
      if (isPlaying && audio.paused) {
        audio.play().catch(() => setIsPlaying(false))
      } else if (!isPlaying && !audio.paused) {
        audio.pause()
      }
    }
  }, [currentTrack?.id, isPlaying])

  return (
    <audio
      ref={audioRef}
      data-music-engine="true"
      onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime) }}
      onLoadedMetadata={() => { 
        const audio = audioRef.current
        if (audio) { 
          setDuration(audio.duration)
          audio.volume = isDimmed ? volume * 0.2 : volume
        } 
      }}
      onEnded={() => nextTrack()}
      style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none', zIndex: -1 }}
    />
  )
}
