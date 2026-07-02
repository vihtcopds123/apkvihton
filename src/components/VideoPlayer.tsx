import React, { useRef, useState, useEffect } from 'react'
import {
  Icon28Play,
  Icon28Pause,
  Icon28VolumeOutline,
  Icon28FullscreenOutline
} from '@vkontakte/icons'

interface VideoPlayerProps {
  src: string
  className?: string
  style?: React.CSSProperties
  onEnded?: () => void
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, className = '', style, onEnded }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isWaiting, setIsWaiting] = useState(false)
  const controlsTimeoutRef = useRef<any>(null)

  // Extract video title from query parameters or filename
  let videoTitle = ''
  try {
    const titleParam = src.match(/[?&]title=([^&]+)/)?.[1]
    if (titleParam) {
      videoTitle = decodeURIComponent(titleParam)
    } else {
      const decodedUrl = decodeURIComponent(src)
      const lastSlash = decodedUrl.lastIndexOf('/')
      if (lastSlash >= 0) {
        let filename = decodedUrl.substring(lastSlash + 1)
        const qMark = filename.indexOf('?')
        if (qMark >= 0) filename = filename.substring(0, qMark)
        const dotIdx = filename.lastIndexOf('.')
        if (dotIdx >= 0) filename = filename.substring(0, dotIdx)
        videoTitle = filename
      }
    }
  } catch (e) {
    console.error(e)
  }

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '0:00'
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    const nextMute = !isMuted
    videoRef.current.muted = nextMute
    setIsMuted(nextMute)
    if (!nextMute && videoRef.current.volume === 0) {
      videoRef.current.volume = 0.5
      setVolume(0.5)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return
    const newVol = parseFloat(e.target.value)
    videoRef.current.volume = newVol
    setVolume(newVol)
    if (newVol > 0 && isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    } else if (newVol === 0 && !isMuted) {
      videoRef.current.muted = true
      setIsMuted(true)
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const cur = videoRef.current.currentTime
    const dur = videoRef.current.duration || 0
    setCurrentTime(formatTime(cur))
    setProgress(dur > 0 ? (cur / dur) * 100 : 0)
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    setDuration(formatTime(videoRef.current.duration))
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return
    const newProgress = parseFloat(e.target.value)
    const dur = videoRef.current.duration || 0
    videoRef.current.currentTime = (newProgress / 100) * dur
    setProgress(newProgress)
  }

  const toggleFullscreen = () => {
    if (!playerRef.current) return
    if (!isFullscreen) {
      if (playerRef.current.requestFullscreen) {
        playerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === playerRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Auto-hide controls
  const triggerControlsShow = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 2500)
    }
  }

  useEffect(() => {
    triggerControlsShow()
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [isPlaying])

  useEffect(() => {
    if (!videoRef.current) return
    setIsPlaying(false)
    const playPromise = videoRef.current.play()
    if (playPromise !== undefined) {
      playPromise.then(() => {
        setIsPlaying(true)
      }).catch(() => {
        // Autoplay prevented, will try muted
        if (videoRef.current) {
          videoRef.current.muted = true
          setIsMuted(true)
          videoRef.current.play().then(() => {
            setIsPlaying(true)
          }).catch(e => console.error("Autoplay failed:", e))
        }
      })
    }
  }, [src])

  return (
    <div
      ref={playerRef}
      className={`custom-video-player ${className} ${isFullscreen ? 'fullscreen' : ''}`}
      style={style}
      onMouseMove={triggerControlsShow}
      onClick={triggerControlsShow}
    >
      <video
        ref={videoRef}
        src={src}
        className="video-element"
        playsInline
        onClick={(e) => {
          e.stopPropagation()
          togglePlay()
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsWaiting(true)}
        onPlaying={() => setIsWaiting(false)}
        onSeeking={() => setIsWaiting(true)}
        onSeeked={() => setIsWaiting(false)}
        onEnded={onEnded}
      />

      {/* Top Title Overlay */}
      {videoTitle && (
        <div className={`video-top-title ${showControls ? 'visible' : ''}`}>
          {videoTitle}
        </div>
      )}

      {/* Buffering Spinner Overlay */}
      {isWaiting && (
        <div className="video-buffering-spinner">
          <div className="buffering-spinner-circle" />
        </div>
      )}

      {/* Center Play Button Overlay */}
      {!isPlaying && !isWaiting && (
        <div className="center-play-button" onClick={togglePlay}>
          <Icon28Play fill="#ffffff" width={44} height={44} />
        </div>
      )}

      {/* Custom Controls UI */}
      <div className={`controls-overlay ${showControls ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Progress Bar */}
        <div className="progress-bar-container">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleProgressChange}
            className="video-progress-slider"
          />
        </div>

        {/* Bottom Bar Controls */}
        <div className="bottom-controls-bar">
          <div className="left-controls">
            <button className="control-btn" onClick={togglePlay}>
              {isPlaying ? <Icon28Pause fill="#ffffff" /> : <Icon28Play fill="#ffffff" />}
            </button>
            <div className="volume-control-container" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="control-btn" onClick={toggleMute} style={{ padding: 4 }}>
                <Icon28VolumeOutline fill="#ffffff" style={isMuted ? { opacity: 0.4 } : {}} />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{
                  width: 60,
                  height: 4,
                  borderRadius: 2,
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  background: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'width 0.2s ease'
                }}
                className="volume-slider"
              />
            </div>
            <span className="time-display">
              {currentTime} / {duration}
            </span>
          </div>

          <div className="right-controls">
            <button className="control-btn" onClick={toggleFullscreen}>
              <Icon28FullscreenOutline fill="#ffffff" style={isFullscreen ? { transform: 'scale(0.85)', opacity: 0.8 } : {}} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
