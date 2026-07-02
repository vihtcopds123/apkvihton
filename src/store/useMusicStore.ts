import { create } from 'zustand'
import { supabase } from '../supabaseClient'
import { useAuthStore } from './useAuthStore'

export interface Track {
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
  created_at: string
  lyrics?: string | null
}

interface MusicState {
  currentTrack: Track | null
  playlist: Track[]
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: 'none' | 'one' | 'all'
  isPlayerExpanded: boolean
  isDimmed: boolean

  setCurrentTrack: (track: Track | null) => void
  setPlaylist: (tracks: Track[]) => void
  setIsPlaying: (v: boolean) => void
  setCurrentTime: (t: number) => void
  setDuration: (d: number) => void
  setVolume: (v: number) => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  nextTrack: () => void
  prevTrack: () => void
  setIsPlayerExpanded: (b: boolean) => void
  setIsDimmed: (b: boolean) => void
}

const updateListeningStatus = async (track: Track | null, isPlaying: boolean) => {
  const user = useAuthStore.getState().user
  if (!user) return
  try {
    const val = (isPlaying && track) ? {
      id: track.id,
      title: track.title,
      artist: track.artist,
      file_url: track.file_url,
      cover_url: track.cover_url || null,
      duration: track.duration
    } : null

    await supabase
      .from('profiles')
      .update({ listening_to: val })
      .eq('id', user.id)
  } catch (err) {
    console.error('Error updating listening status:', err)
  }
}

export const useMusicStore = create<MusicState>((set, get) => ({
  currentTrack: null,
  playlist: [],
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: parseFloat(localStorage.getItem('vh_music_vol') || '0.8'),
  shuffle: false,
  repeat: 'none',
  isPlayerExpanded: false,
  isDimmed: false,

  setCurrentTrack: (track) => {
    set({ currentTrack: track, currentTime: 0, isPlaying: !!track })
    updateListeningStatus(track, !!track)
    if (track) {
      const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
      if (audio) {
        audio.src = track.file_url
        audio.load()
        audio.play().catch((err) => {
          console.error("Audio play failed in store setCurrentTrack:", err)
        })
      }
    }
  },
  setPlaylist: (tracks) => set({ playlist: tracks }),
  setIsPlaying: (v) => {
    set({ isPlaying: v })
    updateListeningStatus(get().currentTrack, v)
    const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
    if (audio) {
      if (v) {
        audio.play().catch((err) => {
          console.error("Audio play failed in store setIsPlaying:", err)
        })
      } else {
        audio.pause()
      }
    }
  },
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setVolume: (v) => {
    localStorage.setItem('vh_music_vol', String(v))
    set({ volume: v })
  },
  toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
  toggleRepeat: () => set(s => ({
    repeat: s.repeat === 'none' ? 'all' : s.repeat === 'all' ? 'one' : 'none'
  })),
  setIsPlayerExpanded: (b) => set({ isPlayerExpanded: b }),
  setIsDimmed: (b) => set({ isDimmed: b }),

  nextTrack: () => {
    const { playlist, currentTrack, shuffle, repeat } = get()
    if (!playlist.length) return
    
    if (repeat === 'one') {
      set({ currentTime: 0, isPlaying: true })
      const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
      updateListeningStatus(currentTrack, true)
      return
    }
    
    const idx = playlist.findIndex(t => t.id === currentTrack?.id)
    let next: Track
    if (shuffle) {
      const others = playlist.filter(t => t.id !== currentTrack?.id)
      next = others.length ? others[Math.floor(Math.random() * others.length)] : playlist[0]
    } else {
      const nextIdx = (idx + 1) % playlist.length
      if (nextIdx === 0 && repeat === 'none') {
        set({ isPlaying: false })
        updateListeningStatus(null, false)
        const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
        if (audio) audio.pause()
        return
      }
      next = playlist[nextIdx]
    }
    set({ currentTrack: next, currentTime: 0, isPlaying: true })
    updateListeningStatus(next, true)

    const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
    if (audio) {
      audio.src = next.file_url
      audio.load()
      audio.play().catch((err) => {
        console.error("Audio play failed in store nextTrack:", err)
      })
    }
  },

  prevTrack: () => {
    const { playlist, currentTrack, currentTime, shuffle } = get()
    if (!playlist.length) return
    if (currentTime > 3) {
      set({ currentTime: 0 })
      const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
      if (audio) audio.currentTime = 0
      return
    }
    const idx = playlist.findIndex(t => t.id === currentTrack?.id)
    let prev: Track
    if (shuffle) {
      const others = playlist.filter(t => t.id !== currentTrack?.id)
      prev = others.length ? others[Math.floor(Math.random() * others.length)] : playlist[0]
    } else {
      const prevIdx = (idx - 1 + playlist.length) % playlist.length
      prev = playlist[prevIdx]
    }
    set({ currentTrack: prev, currentTime: 0, isPlaying: true })
    updateListeningStatus(prev, true)

    const audio = document.querySelector('audio[data-music-engine]') as HTMLAudioElement
    if (audio) {
      audio.src = prev.file_url
      audio.load()
      audio.play().catch((err) => {
        console.error("Audio play failed in store prevTrack:", err)
      })
    }
  }
}))
