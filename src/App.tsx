import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ListMusic, Mic2, Repeat, Repeat1, Shuffle } from 'lucide-react'
import './App.css'
import { mergeLyrics } from './utils/lyrics'
import type { LyricLine } from './utils/lyrics'
import { DEFAULT_PALETTE, extractPaletteFromImage } from './utils/palette'
import type { BackgroundPalette } from './utils/palette'
import { generateAppleMusicStyleBackground } from './utils/background'

const API_BASE = 'https://music-api.gdstudio.xyz/api.php'
const DEFAULT_SOURCE = 'netease'

let userLyricsScrolling = false
let programmaticLyricsScroll = false
let resumeLyricsTimer: number | null = null
let releaseProgrammaticScrollTimer: number | null = null

function getVisibleLyricsContainer(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('.lyrics-view'))
  return candidates.find((el) => el.offsetParent !== null) || null
}

function getActiveLyric(container: HTMLElement): HTMLElement | null {
  return (
    container.querySelector<HTMLElement>('.lyrics-line.current') ||
    container.querySelector<HTMLElement>('.lyrics-line.active')
  )
}

function scrollActiveLyricToCenter(
  container: HTMLElement | null,
  active: HTMLElement | null,
  smooth = true,
) {
  if (!container || !active) {
    return
  }

  requestAnimationFrame(() => {
    if (!container || !active || !container.isConnected || !active.isConnected) {
      return
    }

    const containerRect = container.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    const offset =
      activeRect.top +
      activeRect.height / 2 -
      (containerRect.top + containerRect.height / 2)

    if (Math.abs(offset) < 0.5) {
      return
    }

    programmaticLyricsScroll = true
    if (releaseProgrammaticScrollTimer !== null) {
      window.clearTimeout(releaseProgrammaticScrollTimer)
      releaseProgrammaticScrollTimer = null
    }

    container.scrollBy({
      top: offset,
      behavior: smooth ? 'smooth' : 'auto',
    })

    const releaseDelay = smooth ? 650 : 150
    releaseProgrammaticScrollTimer = window.setTimeout(() => {
      programmaticLyricsScroll = false
      releaseProgrammaticScrollTimer = null
    }, releaseDelay)
  })
}

function onLyricLineChange() {
  if (userLyricsScrolling) {
    return
  }

  const container = getVisibleLyricsContainer()
  if (!container) {
    return
  }

  const active = getActiveLyric(container)
  if (active) {
    scrollActiveLyricToCenter(container, active, true)
  }
}

function attachLyricsScrollGuards(container: HTMLElement) {
  const onUserScroll = () => {
    if (programmaticLyricsScroll) {
      return
    }

    userLyricsScrolling = true
    if (resumeLyricsTimer !== null) {
      window.clearTimeout(resumeLyricsTimer)
    }
    resumeLyricsTimer = window.setTimeout(() => {
      userLyricsScrolling = false
      const currentContainer = getVisibleLyricsContainer()
      if (!currentContainer) {
        return
      }
      const active = getActiveLyric(currentContainer)
      if (active) {
        scrollActiveLyricToCenter(currentContainer, active, true)
      }
    }, 3500)
  }

  container.addEventListener('wheel', onUserScroll, { passive: true })
  container.addEventListener('touchmove', onUserScroll, { passive: true })
  container.addEventListener('scroll', onUserScroll, { passive: true })

  return () => {
    container.removeEventListener('wheel', onUserScroll)
    container.removeEventListener('touchmove', onUserScroll)
    container.removeEventListener('scroll', onUserScroll)
    if (resumeLyricsTimer !== null) {
      window.clearTimeout(resumeLyricsTimer)
      resumeLyricsTimer = null
    }
  }
}

function resetLyricsScrollState() {
  userLyricsScrolling = false
  programmaticLyricsScroll = false
  if (resumeLyricsTimer !== null) {
    window.clearTimeout(resumeLyricsTimer)
    resumeLyricsTimer = null
  }
  if (releaseProgrammaticScrollTimer !== null) {
    window.clearTimeout(releaseProgrammaticScrollTimer)
    releaseProgrammaticScrollTimer = null
  }
}

const getTrackKey = (track: { id: string | number; source?: string }) => {
  const source = track.source || DEFAULT_SOURCE
  return `${track.id}-${source}`
}

interface SearchResult {
  id: number | string
  name: string
  artist: string[]
  album: string
  pic_id: string
  lyric_id: string
  source: string
}

interface TrackDetails {
  id: string
  title: string
  artists: string
  album: string
  source: string
  artworkUrl: string
  audioUrl: string
  lyrics: LyricLine[]
}

const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return '0:00'
  }
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M21 21l-4.35-4.35m1.52-3.79a6.54 6.54 0 11-13.07 0 6.54 6.54 0 0113.07 0z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5v14l11-7z" fill="currentColor" />
  </svg>
)

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 5h3v14H7zm7 0h3v14h-3z" fill="currentColor" />
  </svg>
)

const PrevIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 6v12M18 6l-8.5 6L18 18V6z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const NextIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M18 6v12M6 6l8.5 6L6 18V6z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const LoadingSpinner = () => (
  <span className="spinner" aria-hidden="true" />
)

function App() {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<TrackDetails | null>(null)
  const [isLoadingTrack, setIsLoadingTrack] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const currentTrackRef = useRef<TrackDetails | null>(null)
  const playlistRef = useRef<TrackDetails[]>([])
  const activeIndexRef = useRef(-1)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [activeLyricIndex, setActiveLyricIndex] = useState(0)
  const [activePanel, setActivePanel] = useState<'playlist' | 'lyrics'>('lyrics')
  const [playlist, setPlaylist] = useState<TrackDetails[]>([])
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [palette, setPalette] = useState<BackgroundPalette>(DEFAULT_PALETTE)
  const [failedCoverMap, setFailedCoverMap] = useState<Record<string, boolean>>({})
  const [generatedBg, setGeneratedBg] = useState<string | null>(null)
  const [displayedBg, setDisplayedBg] = useState<string | null>(null)
  const [isBackgroundVisible, setIsBackgroundVisible] = useState(true)
  const backgroundCacheRef = useRef<Record<string, string>>({})
  const [isShuffle, setIsShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none')
  const shuffleHistoryRef = useRef<string[]>([])
  const shuffleEnabledRef = useRef(isShuffle)
  const repeatModeRef = useRef(repeatMode)
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null)
  const lyricsScrollCleanupRef = useRef<(() => void) | null>(null)

  const handleLyricLineChange = useCallback(() => {
    onLyricLineChange()
  }, [])

  useEffect(() => {
    currentTrackRef.current = currentTrack
  }, [currentTrack])

  useEffect(() => {
    playlistRef.current = playlist
  }, [playlist])

  useEffect(() => {
    activeIndexRef.current = playlist.findIndex((track) => getTrackKey(track) === currentTrackId)
  }, [playlist, currentTrackId])

  useEffect(() => {
    shuffleEnabledRef.current = isShuffle
    if (!isShuffle) {
      shuffleHistoryRef.current = []
    }
  }, [isShuffle])

  useEffect(() => {
    repeatModeRef.current = repeatMode
  }, [repeatMode])

  const trackCacheKey = currentTrack ? getTrackKey(currentTrack) : null
  const artworkUrl = currentTrack?.artworkUrl

  useEffect(() => {
    let isActive = true

    if (!artworkUrl) {
      setPalette(DEFAULT_PALETTE)
      return () => {
        isActive = false
      }
    }

    extractPaletteFromImage(artworkUrl)
      .then((nextPalette) => {
        if (isActive) {
          setPalette(nextPalette)
        }
      })
      .catch(() => {
        if (isActive) {
          setPalette(DEFAULT_PALETTE)
        }
      })

    return () => {
      isActive = false
    }
  }, [artworkUrl])

  useEffect(() => {
    if (!artworkUrl || !trackCacheKey) {
      setGeneratedBg(null)
      return
    }

    const cached = backgroundCacheRef.current[trackCacheKey]
    if (cached) {
      setGeneratedBg(cached)
      return
    }

    let isCancelled = false

    generateAppleMusicStyleBackground(artworkUrl)
      .then((backgroundUrl) => {
        if (isCancelled) {
          return
        }
        backgroundCacheRef.current[trackCacheKey] = backgroundUrl
        setGeneratedBg(backgroundUrl)
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error('Failed to generate background', error)
          setGeneratedBg(null)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [artworkUrl, trackCacheKey])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  useEffect(() => {
    const controller = new AbortController()
    const handler = window.setTimeout(async () => {
      if (!query.trim()) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      try {
        setIsSearching(true)
        setError(null)
        const url = `${API_BASE}?types=search&source=${DEFAULT_SOURCE}&name=${encodeURIComponent(
          query.trim(),
        )}&count=24`
        const results = await fetchJson<SearchResult[]>(url, controller.signal)
        setSearchResults(Array.isArray(results) ? results : [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error(err)
          setError('搜索歌曲时出现问题，请稍后重试。')
        }
      } finally {
        setIsSearching(false)
      }
    }, 380)

    return () => {
      controller.abort()
      window.clearTimeout(handler)
    }
  }, [query])

  const teardownAudio = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current.load()
      audioRef.current = null
    }
  }, [])

  const handleTimeUpdate = useCallback((audio: HTMLAudioElement) => {
    setProgress(audio.currentTime)
    const track = currentTrackRef.current
    if (!track || !track.lyrics.length) {
      return
    }
    const current = audio.currentTime + 0.25
    let nextIndex = track.lyrics.findIndex((line) => current < line.time)
    if (nextIndex === -1) {
      nextIndex = track.lyrics.length
    }
    const computed = Math.max(0, nextIndex - 1)
    setActiveLyricIndex((prev) => (prev === computed ? prev : computed))
  }, [])

  const attachAudio = useCallback(
    (audio: HTMLAudioElement, onEnded: () => void): void => {
      const onTimeUpdate = () => handleTimeUpdate(audio)
      const onLoaded = () => {
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      }
      const onPlay = () => setIsPlaying(true)
      const onPause = () => setIsPlaying(false)
      const onWaiting = () => setIsBuffering(true)
      const onPlaying = () => setIsBuffering(false)
      const handleEnded = () => {
        setIsPlaying(false)
        onEnded()
      }

      audio.addEventListener('timeupdate', onTimeUpdate)
      audio.addEventListener('loadedmetadata', onLoaded)
      audio.addEventListener('play', onPlay)
      audio.addEventListener('pause', onPause)
      audio.addEventListener('waiting', onWaiting)
      audio.addEventListener('playing', onPlaying)
      audio.addEventListener('ended', handleEnded)

      cleanupRef.current = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate)
        audio.removeEventListener('loadedmetadata', onLoaded)
        audio.removeEventListener('play', onPlay)
        audio.removeEventListener('pause', onPause)
        audio.removeEventListener('waiting', onWaiting)
        audio.removeEventListener('playing', onPlaying)
        audio.removeEventListener('ended', handleEnded)
      }
    },
    [handleTimeUpdate],
  )

  const buildTrackDetails = useCallback(async (track: SearchResult): Promise<TrackDetails> => {
    const [urlInfo, lyricInfo, picInfo] = await Promise.all([
      fetchJson<{ url: string }>(
        `${API_BASE}?types=url&source=${track.source || DEFAULT_SOURCE}&id=${track.id}&br=320`,
      ),
      fetchJson<{ lyric?: string | null; tlyric?: string | null }>(
        `${API_BASE}?types=lyric&source=${track.source || DEFAULT_SOURCE}&id=${track.lyric_id || track.id}`,
      ),
      fetchJson<{ url?: string }>(
        `${API_BASE}?types=pic&source=${track.source || DEFAULT_SOURCE}&id=${track.pic_id}&size=500`,
      ),
    ])

    const lyrics = mergeLyrics(lyricInfo.lyric, lyricInfo.tlyric)
    const artworkUrl = picInfo.url ?? ''
    const artists = track.artist.join('、')

    return {
      id: String(track.id),
      title: track.name,
      artists,
      album: track.album,
      source: track.source,
      artworkUrl,
      audioUrl: urlInfo.url,
      lyrics,
    }
  }, [])

  const activateTrack = useCallback(
    async (details: TrackDetails, shouldAutoplay: boolean, onEnded: () => void) => {
      currentTrackRef.current = details
      setCurrentTrack(details)

      teardownAudio()
      const audio = new Audio(details.audioUrl)
      audio.crossOrigin = 'anonymous'
      audio.volume = volume
      audioRef.current = audio
      attachAudio(audio, onEnded)

      if (shouldAutoplay) {
        await audio.play().catch(() => undefined)
      }
    },
    [attachAudio, teardownAudio, volume],
  )

  const playTrack = useCallback(
    async (details: TrackDetails, index: number, shouldAutoplay = true) => {
      setIsLoadingTrack(true)
      setError(null)
      setProgress(0)
      setDuration(0)
      setActiveLyricIndex(0)
      setActivePanel('lyrics')
      setIsBuffering(true)
      const trackIdentifier = getTrackKey(details)
      setCurrentTrackId(trackIdentifier)
      activeIndexRef.current = index

      try {
        await activateTrack(details, shouldAutoplay, () => {
          const list = playlistRef.current
          const currentIndex = activeIndexRef.current
          const repeatState = repeatModeRef.current
          const shuffleOn = shuffleEnabledRef.current

          if (repeatState === 'one') {
            const repeatIndex = currentIndex >= 0 ? currentIndex : index
            const repeatTrack = list[repeatIndex] ?? details
            if (repeatTrack) {
              playTrack(repeatTrack, repeatIndex >= 0 ? repeatIndex : index).catch(() => undefined)
            }
            return
          }

          let targetIndex: number | null = null

          if (shuffleOn && list.length) {
            const availableIndexes = list
              .map((_, idx) => idx)
              .filter((idx) => idx !== currentIndex)
            if (availableIndexes.length) {
              targetIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)]
            } else if (repeatState === 'all' && currentIndex >= 0) {
              targetIndex = currentIndex
            }
            if (
              targetIndex !== null &&
              currentIndex !== -1 &&
              targetIndex >= 0 &&
              targetIndex !== currentIndex
            ) {
              const currentTrack = list[currentIndex]
              if (currentTrack) {
                shuffleHistoryRef.current.push(getTrackKey(currentTrack))
              }
            }
          } else if (list.length) {
            const nextIndex = currentIndex + 1
            if (nextIndex < list.length) {
              targetIndex = nextIndex
            } else if (repeatState === 'all') {
              targetIndex = 0
            }
          }

          if (targetIndex === null || targetIndex === undefined) {
            return
          }

          if (targetIndex >= 0 && targetIndex < list.length) {
            const nextTrack = list[targetIndex]
            if (nextTrack) {
              playTrack(nextTrack, targetIndex).catch(() => undefined)
            }
          }
        })
      } catch (err) {
        console.error(err)
        setError('载入歌曲时出现问题，请稍后再试。')
      } finally {
        setIsLoadingTrack(false)
        setIsBuffering(false)
      }
    },
    [activateTrack],
  )

  useEffect(() => {
    return () => {
      teardownAudio()
    }
  }, [teardownAudio])

  useEffect(() => {
    handleLyricLineChange()
  }, [activeLyricIndex, handleLyricLineChange])

  useEffect(() => {
    const container = getVisibleLyricsContainer()
    const htmlContainer = (container as HTMLDivElement | null) ?? null
    lyricsContainerRef.current = htmlContainer

    if (!container) {
      resetLyricsScrollState()
      lyricsScrollCleanupRef.current = null
      return () => {
        if (lyricsScrollCleanupRef.current) {
          lyricsScrollCleanupRef.current()
          lyricsScrollCleanupRef.current = null
        }
      }
    }

    resetLyricsScrollState()
    const active = getActiveLyric(container)
    let initialScrollFrame: number | null = null
    if (active) {
      initialScrollFrame = window.requestAnimationFrame(() => {
        scrollActiveLyricToCenter(container, active, false)
      })
    }

    const cleanup = attachLyricsScrollGuards(container)
    lyricsScrollCleanupRef.current = cleanup

    return () => {
      if (initialScrollFrame !== null) {
        window.cancelAnimationFrame(initialScrollFrame)
      }
      cleanup()
      if (lyricsScrollCleanupRef.current === cleanup) {
        lyricsScrollCleanupRef.current = null
      }
      if (lyricsContainerRef.current === htmlContainer) {
        lyricsContainerRef.current = null
      }
    }
  }, [activePanel, currentTrack, currentTrackId])

  useEffect(() => {
    return () => {
      if (lyricsScrollCleanupRef.current) {
        lyricsScrollCleanupRef.current()
        lyricsScrollCleanupRef.current = null
      }
      resetLyricsScrollState()
      lyricsContainerRef.current = null
    }
  }, [])

  const backgroundStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--bg-color-1': palette.primary,
        '--bg-color-2': palette.secondary,
        '--bg-color-3': palette.tertiary,
        '--accent-color': palette.accent,
        '--accent-soft': palette.accentSoft,
        '--accent-strong': palette.accentStrong,
        '--panel-bg': palette.panel,
        '--panel-border': palette.panelBorder,
        '--text-muted': palette.muted,
      }) as CSSProperties,
    [palette],
  )

  useEffect(() => {
    if (!generatedBg) {
      setDisplayedBg(null)
      setIsBackgroundVisible(true)
      return
    }

    setIsBackgroundVisible(false)
    setDisplayedBg(generatedBg)

    const frame = window.requestAnimationFrame(() => {
      setIsBackgroundVisible(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [generatedBg])

  const generatedBackgroundStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--dynamic-backdrop': displayedBg ? `url(${displayedBg})` : 'none',
        opacity: isBackgroundVisible ? 0.82 : 0,
      }) as CSSProperties,
    [displayedBg, isBackgroundVisible],
  )

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev
      shuffleHistoryRef.current = []
      return next
    })
  }, [])

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none'))
  }, [])

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    if (audio.paused) {
      audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [])

  const handleSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    audio.currentTime = value
    setProgress(value)
  }

  const handleVolumeChange = (value: number) => {
    setVolume(value)
  }

  const handlePlaylistSelect = useCallback(
    async (index: number) => {
      const track = playlistRef.current[index]
      if (!track) {
        return
      }
      if (shuffleEnabledRef.current && activeIndexRef.current !== -1 && activeIndexRef.current !== index) {
        const current = playlistRef.current[activeIndexRef.current]
        if (current) {
          shuffleHistoryRef.current.push(getTrackKey(current))
        }
      }
      await playTrack(track, index)
    },
    [playTrack],
  )

  const handleSearchSelect = useCallback(
    async (track: SearchResult) => {
      setIsLoadingTrack(true)
      setIsBuffering(true)
      setError(null)

      try {
        const details = await buildTrackDetails(track)
        let targetIndex = -1
        setPlaylist((prev) => {
          const targetKey = getTrackKey(details)
          const existingIndex = prev.findIndex((item) => getTrackKey(item) === targetKey)
          const defaultInsertIndex = activeIndexRef.current >= 0 ? activeIndexRef.current + 1 : prev.length
          let insertIndex = Math.min(defaultInsertIndex, prev.length)

          if (existingIndex !== -1) {
            const nextList = [...prev]
            nextList[existingIndex] = details
            const [updatedTrack] = nextList.splice(existingIndex, 1)
            if (existingIndex < insertIndex) {
              insertIndex = Math.max(insertIndex - 1, 0)
            }
            insertIndex = Math.min(insertIndex, nextList.length)
            nextList.splice(insertIndex, 0, updatedTrack)
            targetIndex = insertIndex
            return nextList
          }

          const nextList = [...prev]
          nextList.splice(insertIndex, 0, details)
          targetIndex = insertIndex
          return nextList
        })

        if (targetIndex === -1) {
          targetIndex = 0
        }

        await playTrack(details, targetIndex)
      } catch (err) {
        console.error(err)
        setError('载入歌曲时出现问题，请稍后再试。')
        setIsLoadingTrack(false)
        setIsBuffering(false)
      } finally {
        setQuery('')
        setSearchResults([])
        setIsSearching(false)
      }
    },
    [buildTrackDetails, playTrack],
  )

  const handlePrevious = useCallback(() => {
    const list = playlistRef.current
    if (!list.length) {
      return
    }
    if (shuffleEnabledRef.current) {
      const history = shuffleHistoryRef.current
      while (history.length) {
        const previousKey = history.pop()
        if (!previousKey) {
          break
        }
        const previousIndex = list.findIndex((item) => getTrackKey(item) === previousKey)
        if (previousIndex !== -1) {
          const target = list[previousIndex]
          if (target) {
            playTrack(target, previousIndex).catch(() => undefined)
            return
          }
        }
      }
    }
    const nextIndex = activeIndexRef.current > 0 ? activeIndexRef.current - 1 : list.length - 1
    const target = list[nextIndex]
    if (target) {
      playTrack(target, nextIndex).catch(() => undefined)
    }
  }, [playTrack])

  const handleNext = useCallback(() => {
    const list = playlistRef.current
    if (!list.length) {
      return
    }
    const currentIndex = activeIndexRef.current
    if (shuffleEnabledRef.current) {
      if (currentIndex !== -1) {
        const currentTrack = list[currentIndex]
        if (currentTrack) {
          shuffleHistoryRef.current.push(getTrackKey(currentTrack))
        }
      }
      if (list.length === 1) {
        const target = list[0]
        playTrack(target, 0).catch(() => undefined)
        return
      }
      const availableIndexes = list.map((_, index) => index).filter((index) => index !== currentIndex)
      const nextIndex = availableIndexes.length
        ? availableIndexes[Math.floor(Math.random() * availableIndexes.length)]
        : currentIndex >= 0
          ? currentIndex
          : 0
      const target = list[nextIndex]
      if (target) {
        playTrack(target, nextIndex).catch(() => undefined)
      }
      return
    }
    const nextIndex = currentIndex + 1
    if (nextIndex < list.length) {
      const target = list[nextIndex]
      if (target) {
        playTrack(target, nextIndex).catch(() => undefined)
      }
      return
    }
    if (list.length > 1) {
      const target = list[0]
      playTrack(target, 0).catch(() => undefined)
    }
  }, [playTrack])

  const lyricsContent = useMemo(() => {
    if (!currentTrack) {
      return <p className="lyrics-placeholder">选择一首歌曲开始播放</p>
    }

    if (!currentTrack.lyrics.length) {
      return <p className="lyrics-placeholder">暂无歌词信息</p>
    }

    return currentTrack.lyrics.map((line, index) => {
      const isActive = index === activeLyricIndex
      return (
        <div key={`${line.time}-${index}`} className={`lyrics-line${isActive ? ' current' : ''}`}>
          <span className="lyrics-text">{line.text}</span>
          {line.translation && <span className="lyrics-translation">{line.translation}</span>}
        </div>
      )
    })
  }, [currentTrack, activeLyricIndex])

  const isBusy = isBuffering || isLoadingTrack

  const progressPercent = useMemo(() => {
    if (!duration || duration <= 0) {
      return 0
    }
    const safeProgress = Math.min(Math.max(progress, 0), duration)
    return (safeProgress / duration) * 100
  }, [duration, progress])

  const timelineStyle = useMemo<CSSProperties>(() => {
    const percentage = Math.min(Math.max(progressPercent, 0), 100)
    return {
      background: `linear-gradient(90deg, var(--accent-color) 0%, var(--accent-strong) ${percentage}%, rgba(255, 255, 255, 0.24) ${percentage}%, rgba(255, 255, 255, 0.24) 100%)`,
    }
  }, [progressPercent])

  const volumeStyle = useMemo<CSSProperties>(() => {
    const percentage = Math.min(Math.max(volume * 100, 0), 100)
    return {
      background: `linear-gradient(90deg, rgba(255, 255, 255, 0.42) 0%, var(--accent-strong) ${percentage}%, rgba(255, 255, 255, 0.2) ${percentage}%, rgba(255, 255, 255, 0.2) 100%)`,
    }
  }, [volume])

  const trimmedQuery = query.trim()
  const showSearchDropdown = trimmedQuery.length > 0
  const RepeatIconComponent = repeatMode === 'one' ? Repeat1 : Repeat
  const shuffleLabel = isShuffle ? '关闭随机播放' : '开启随机播放'
  const repeatAriaLabel =
    repeatMode === 'none' ? '开启循环播放' : repeatMode === 'all' ? '切换为单曲循环' : '关闭循环播放'

  return (
    <div className="app" style={backgroundStyle}>
      <div className="app-backdrop" style={generatedBackgroundStyle} />
      <div className="app-overlay" />
      <main className="app-layout">
        <section className="panel playback-panel" aria-label="正在播放">
          <header className="player-header">
            <p className="eyebrow">SOLARA MUSIC</p>
            <h1 className="player-heading">沉浸式音乐体验</h1>
          </header>

          <div className="player-stage left-pane" aria-live="polite">
            <div className="player-cover cover">
              <div
                className={`album-art${currentTrack?.artworkUrl ? ' loaded' : ''}`}
                style={{ backgroundImage: currentTrack?.artworkUrl ? `url(${currentTrack.artworkUrl})` : undefined }}
              >
                {!currentTrack && <span className="artwork-placeholder">搜索并选择一首歌曲</span>}
              </div>
            </div>

            <div className="player-track-meta">
              <h2 className="player-title track-title">{currentTrack ? currentTrack.title : '选择一首歌曲开始'}</h2>
              <p className="player-artist track-artist">
                {currentTrack ? `${currentTrack.artists} · ${currentTrack.album}` : '即时搜索 · 立刻播放'}
              </p>
            </div>

            <div className="player-progress">
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={Math.min(progress, duration || 0)}
                step={0.1}
                onChange={(event) => handleSeek(Number(event.target.value))}
                aria-valuemin={0}
                aria-valuemax={duration || 0}
                aria-valuenow={Math.min(progress, duration || 0)}
                aria-label="播放进度"
                className="progress"
                style={timelineStyle}
              />
              <div className="time-row" aria-hidden="true">
                <span className="time time-start">{formatTime(progress)}</span>
                <span className="time time-end">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="player-controls control-row" role="group" aria-label="播放控制">
              <button
                type="button"
                className={`control-button shuffle${isShuffle ? ' active' : ''}`}
                onClick={toggleShuffle}
                aria-pressed={isShuffle}
                aria-label={shuffleLabel}
              >
                <Shuffle strokeWidth={1.6} />
              </button>
              <div className="main-controls">
                <button
                  type="button"
                  className="control-button prev"
                  onClick={handlePrevious}
                  disabled={playlist.length === 0}
                  aria-label="上一首"
                >
                  <PrevIcon />
                </button>
                <button
                  type="button"
                  className={`control-button play-toggle${isBusy ? ' buffering' : ''}`}
                  onClick={handlePlayPause}
                  disabled={!currentTrack || isLoadingTrack}
                  aria-label={isPlaying ? '暂停' : '播放'}
                >
                  {isBusy ? <span className="sr-only">缓冲中</span> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button
                  type="button"
                  className="control-button next"
                  onClick={handleNext}
                  disabled={playlist.length === 0}
                  aria-label="下一首"
                >
                  <NextIcon />
                </button>
              </div>
              <button
                type="button"
                className={`control-button repeat${repeatMode !== 'none' ? ' active' : ''}`}
                onClick={cycleRepeat}
                aria-label={repeatAriaLabel}
                aria-pressed={repeatMode !== 'none'}
              >
                <RepeatIconComponent strokeWidth={1.6} />
              </button>
            </div>

            <div className="player-volume volume-row">
              <span className="vol-min" aria-hidden="true">
                🔈
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => handleVolumeChange(Number(event.target.value))}
                aria-label="音量"
                className="volume-slider"
                style={volumeStyle}
              />
              <span className="vol-max" aria-hidden="true">
                🔊
              </span>
            </div>
          </div>
        </section>

        <aside className="panel list-panel" aria-label="播放列表与歌词">
          <div className="list-stack">
            <header className="list-header">
              <div className="search-area">
                <div className={`search-bar${isSearching ? ' searching' : ''}`}>
                  <SearchIcon />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                    }}
                    placeholder="搜索艺术家、歌曲或专辑"
                    spellCheck={false}
                  />
                  {isSearching && <LoadingSpinner />}
                </div>

                {showSearchDropdown && (
                  <div className="search-dropdown" role="listbox" aria-label="搜索建议">
                    {isSearching && <div className="search-status">正在搜索…</div>}
                    {!isSearching && !searchResults.length && (
                      <div className="search-status empty">没有找到相关歌曲</div>
                    )}
                    {searchResults.map((track) => {
                      const trackKey = getTrackKey(track)
                      const coverUrl = track.pic_id
                        ? `${API_BASE}?types=pic&source=${track.source || DEFAULT_SOURCE}&id=${track.pic_id}&size=120`
                        : ''
                      const fallbackLetter = track.name?.trim()?.[0]?.toUpperCase() || '?'
                      const shouldShowFallback = !coverUrl || failedCoverMap[trackKey]
                      return (
                        <button
                          type="button"
                          key={trackKey}
                          className="search-result"
                          role="option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSearchSelect(track)}
                        >
                          <span className="search-result-thumb" aria-hidden="true">
                            {shouldShowFallback ? (
                              <div className="cover-fallback">{fallbackLetter}</div>
                            ) : (
                              <img
                                src={coverUrl}
                                alt={track.name}
                                className="cover-image"
                                loading="lazy"
                                onError={() => {
                                  setFailedCoverMap((prev) => ({ ...prev, [trackKey]: true }))
                                }}
                              />
                            )}
                          </span>
                          <span className="search-result-meta">
                            <span className="search-result-title">{track.name}</span>
                            <span className="search-result-artist">{track.artist.join('、')}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

            </header>

            {error && <div className="error-banner">{error}</div>}

            <div
              className={`list-scroll${
                activePanel === 'lyrics' ? ' is-lyrics' : ' playlist-scroll'
              }`}
              role={activePanel === 'playlist' ? 'listbox' : 'document'}
              id={activePanel === 'playlist' ? 'panel-playlist' : 'panel-lyrics'}
              aria-labelledby={activePanel === 'playlist' ? 'tab-playlist' : 'tab-lyrics'}
            >
              {activePanel === 'playlist' ? (
                <>
                  <div className="results-meta">
                    <span className="eyebrow">播放列表</span>
                    <span className="result-count">{playlist.length} 首歌曲</span>
                  </div>
                  {playlist.map((track, index) => {
                    const trackKey = getTrackKey(track)
                    const isActive = trackKey === currentTrackId
                    return (
                      <button
                        type="button"
                        key={trackKey}
                        role="option"
                        aria-selected={isActive}
                        className={`track-item${isActive ? ' active' : ''}`}
                        onClick={() => handlePlaylistSelect(index)}
                        title={`${track.title} · ${track.artists} · ${track.album}`}
                      >
                        <div className="track-thumb" aria-hidden="true">
                          {track.artworkUrl ? (
                            <img src={track.artworkUrl} alt="" loading="lazy" />
                          ) : (
                            <span className="track-letter">{track.title.charAt(0)}</span>
                          )}
                          {isActive && (
                            <span className="equalizer" aria-hidden="true">
                              <span />
                            </span>
                          )}
                        </div>
                        <div className="track-meta">
                          <span className="track-title track__title">{track.title}</span>
                          <span className="track-artist">{track.artists}</span>
                        </div>
                        <span className="track-duration" aria-hidden={!isActive}>
                          {isActive && duration ? formatTime(duration) : '--:--'}
                        </span>
                      </button>
                    )
                  })}
                  {!playlist.length && (
                    <div className="empty-state">播放列表为空，快去搜索一首喜欢的歌曲吧</div>
                  )}
                </>
              ) : (
                <div className="lyrics-panel">
                  <header className="lyrics-header">
                    <span className="eyebrow">歌词</span>
                    <h2>{currentTrack ? currentTrack.title : '准备播放'}</h2>
                    {currentTrack && <p>{currentTrack.artists} · {currentTrack.album}</p>}
                  </header>
                  <div className="lyrics-view" ref={lyricsContainerRef}>
                    <div className="lyrics-content">{lyricsContent}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>
      <div className="bottom-right" role="tablist" aria-label="内容切换">
        <button
          type="button"
          id="tab-lyrics"
          role="tab"
          className={activePanel === 'lyrics' ? 'active' : ''}
          onClick={() => setActivePanel('lyrics')}
          aria-selected={activePanel === 'lyrics'}
          aria-controls="panel-lyrics"
          title="歌词"
        >
          <Mic2 size={22} aria-hidden="true" />
          <span className="sr-only">显示歌词</span>
        </button>
        <button
          type="button"
          id="tab-playlist"
          role="tab"
          className={activePanel === 'playlist' ? 'active' : ''}
          onClick={() => setActivePanel('playlist')}
          aria-selected={activePanel === 'playlist'}
          aria-controls="panel-playlist"
          title="播放列表"
        >
          <ListMusic size={22} aria-hidden="true" />
          <span className="sr-only">显示播放列表</span>
        </button>
      </div>
    </div>
  )
}

export default App
