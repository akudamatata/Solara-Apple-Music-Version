import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import './App.css'
import SourceDropdown, { type SourceValue } from './SourceDropdown'
import Lyrics from './components/Lyrics'
import { mergeLyrics } from './utils/lyrics'
import type { LyricLine } from './utils/lyrics'
import { DEFAULT_PALETTE, extractPaletteFromImage } from './utils/palette'
import type { BackgroundPalette } from './utils/palette'
import { generateAppleMusicStyleBackground } from './utils/background'

const API_BASE = 'https://music-api.gdstudio.xyz/api.php'
const DEFAULT_SOURCE: SourceValue = 'netease'
const SEARCH_PAGE_SIZE = 24
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

type AudioQuality = 'standard' | 'high' | 'very_high' | 'lossless'

const AUDIO_QUALITY_OPTIONS: Array<{ value: AudioQuality; label: string }> = [
  { value: 'standard', label: '标准音质' },
  { value: 'high', label: '高频音质' },
  { value: 'very_high', label: '极高音质' },
  { value: 'lossless', label: '无损音质' },
]

const QUALITY_TO_BR: Record<AudioQuality, number> = {
  standard: 128,
  high: 192,
  very_high: 320,
  lossless: 999,
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
  <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
    <path
      d="M10.345 23.287c.415 0 .763-.15 1.22-.407l12.742-7.404c.838-.481 1.178-.855 1.178-1.46 0-.599-.34-.972-1.178-1.462L11.565 5.158c-.457-.265-.805-.407-1.22-.407-.789 0-1.345.606-1.345 1.57V21.71c0 .971.556 1.577 1.345 1.577z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
)

const PauseIcon = () => (
  <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
    <path
      d="M13.293 22.772c.955 0 1.436-.481 1.436-1.436V6.677c0-.98-.481-1.427-1.436-1.427h-2.457c-.954 0-1.436.473-1.436 1.427v14.66c-.008.954.473 1.435 1.436 1.435h2.457zm7.87 0c.954 0 1.427-.481 1.427-1.436V6.677c0-.98-.473-1.427-1.428-1.427h-2.465c-.955 0-1.428.473-1.428 1.427v14.66c0 .954.473 1.435 1.428 1.435h2.465z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
)

const ShuffleIcon = () => (
  <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
    <path
      d="M5.536 6.5h3.797c1.27 0 2.205.327 3.156 1.116l6.153 5.05c.656.538 1.095.72 1.961.72h4.536l-1.637-1.636c-.407-.407-.407-1.04 0-1.448s1.04-.407 1.448 0l3.53 3.53c.407.407.407 1.04 0 1.448l-3.53 3.53c-.408.407-1.04.407-1.448 0-.407-.408-.407-1.041 0-1.448l1.637-1.637h-4.536c-1.27 0-2.205-.327-3.156-1.116l-6.153-5.05c-.656-.538-1.095-.72-1.961-.72H5.536v2.18c0 .58-.466 1.046-1.045 1.046-.58 0-1.046-.466-1.046-1.046V7.546C3.445 6.967 3.911 6.5 4.491 6.5zm0 8.54c.579 0 1.045.466 1.045 1.046v2.18h2.701c.866 0 1.305-.182 1.961-.72l2.057-1.688c.417-.343 1.04-.286 1.383.131.343.417.286 1.04-.131 1.383l-2.057 1.688c-.95.789-1.885 1.116-3.156 1.116H5.536v2.18c0 .58-.466 1.045-1.045 1.045-.58 0-1.046-.465-1.046-1.045v-3.673c0-.58.466-1.046 1.046-1.046z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
)

const RepeatIcon = () => (
  <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
    <path
      d="M7.4 6.1h13.104l-1.49-1.488c-.408-.408-.408-1.04 0-1.448s1.04-.408 1.448 0l3.53 3.53c.408.408.408 1.04 0 1.448l-3.53 3.53c-.408.408-1.04.408-1.448 0s-.408-1.04 0-1.448L20.504 8.2H7.4c-2.415 0-4.375 1.96-4.375 4.375v1.8c0 .58-.466 1.045-1.046 1.045-.579 0-1.045-.465-1.045-1.045v-1.8C.934 8.698 3.633 6.1 7.4 6.1zm17.2 10.77H11.496l1.49 1.488c.408.408.408 1.04 0 1.448-.408.408-1.04.408-1.448 0l-3.53-3.53c-.408-.408-.408-1.04 0-1.448l3.53-3.53c.408-.408 1.04-.408 1.448 0 .408.408.408 1.04 0 1.448l-1.49 1.49H24.6c2.415 0 4.375-1.96 4.375-4.375v-1.8c0-.58.466-1.045 1.045-1.045.58 0 1.046.465 1.046 1.045v1.8c0 3.777-2.699 6.375-6.466 6.375z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
)

const RepeatOneIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M17 17H7V7h8V5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10v2l3-3-3-3v2zm-4-4h-2V9l-1.5.75V8L11 7h1v6z" />
  </svg>
)

const iconShadow = 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))'

const SpeakerLowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ filter: iconShadow }}>
    <path
      d="M4.5 10h2.2L12 6v12l-5.3-4H4.5a1.5 1.5 0 01-1.5-1.5V11.5A1.5 1.5 0 014.5 10z"
      fill="currentColor"
    />
    <path d="M16 10.2a2.6 2.6 0 010 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const SpeakerHighIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ filter: iconShadow }}>
    <path
      d="M4.5 10h2.2L12 6v12l-5.3-4H4.5a1.5 1.5 0 01-1.5-1.5V11.5A1.5 1.5 0 014.5 10z"
      fill="currentColor"
    />
    <path
      d="M16 8a5 5 0 010 8M16 10.2a2.6 2.6 0 010 3.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
)

const PrevIcon = () => (
  <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
    <g transform="matrix(-1 0 0 1 32 0)">
      <path
        d="M10.345 23.287c.415 0 .763-.15 1.22-.407l12.742-7.404c.838-.481 1.178-.855 1.178-1.46 0-.599-.34-.972-1.178-1.462L11.565 5.158c-.457-.265-.805-.407-1.22-.407-.789 0-1.345.606-1.345 1.57V21.71c0 .971.556 1.577 1.345 1.577z"
        fill="currentColor"
        fillRule="nonzero"
      />
      <path
        d="M6.31 4.75c-.789 0-1.345.606-1.345 1.57v15.356c0 .971.556 1.577 1.345 1.577h1.345c.789 0 1.345-.606 1.345-1.577V6.32c0-.965-.556-1.57-1.345-1.57H6.31z"
        fill="currentColor"
      />
    </g>
  </svg>
)

const NextIcon = () => (
  <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
    <path
      d="M10.345 23.287c.415 0 .763-.15 1.22-.407l12.742-7.404c.838-.481 1.178-.855 1.178-1.46 0-.599-.34-.972-1.178-1.462L11.565 5.158c-.457-.265-.805-.407-1.22-.407-.789 0-1.345.606-1.345 1.57V21.71c0 .971.556 1.577 1.345 1.577z"
      fill="currentColor"
      fillRule="nonzero"
    />
    <path
      d="M24.345 4.75c-.789 0-1.345.606-1.345 1.57v15.356c0 .971.556 1.577 1.345 1.577h1.345c.789 0 1.345-.606 1.345-1.577V6.32c0-.965-.556-1.57-1.345-1.57h-1.345z"
      fill="currentColor"
    />
  </svg>
)

const LyricsIcon = () => {
  const maskId = useId()
  return (
    <svg
      data-testid="invertible-mask-svg"
      className="invertible-mask invertible-mask--not-inverted"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <mask data-testid="invertible-mask" id={maskId}>
        <rect width="100%" height="100%" fill="black" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 64 64"
          width="22"
          height="22"
          x="3"
          y="3"
          fill="white"
        >
          <path d="M18.53 62.724c1.764 0 3.115-.81 5.257-2.707l9.816-8.638h16.62c8.72 0 13.777-5.152 13.777-13.777V15.053c0-8.625-5.056-13.777-13.777-13.777H13.777C5.057 1.276 0 6.42 0 15.053v22.549c0 8.633 5.27 13.777 13.456 13.777h1.016v6.793c0 2.812 1.511 4.552 4.057 4.552zm1.57-7.16v-8.11c0-1.81-.805-2.485-2.486-2.485h-3.55c-5.165 0-7.654-2.603-7.654-7.654V15.34c0-5.033 2.489-7.632 7.654-7.632h35.872c5.149 0 7.654 2.599 7.654 7.632v21.975c0 5.051-2.505 7.654-7.654 7.654H33.188c-1.835 0-2.702.33-4.012 1.65zm-2.212-32.177c0 3.398 2.156 5.936 5.388 5.936 1.361 0 2.592-.302 3.372-1.263h.385c-.868 2.231-3 3.845-5.303 4.4-.95.243-1.327.737-1.327 1.425 0 .8.658 1.36 1.51 1.36 3.174 0 8.8-3.775 8.8-10.6 0-4.138-2.602-7.336-6.588-7.336-3.576 0-6.237 2.518-6.237 6.078zm15.663 0c0 3.398 2.134 5.936 5.387 5.936 1.34 0 2.593-.302 3.373-1.263h.39c-.865 2.231-3.023 3.845-5.308 4.4-.947.243-1.327.737-1.327 1.425 0 .8.636 1.36 1.51 1.36 3.178 0 8.779-3.775 8.779-10.6 0-4.138-2.577-7.336-6.567-7.336-3.577 0-6.237 2.518-6.237 6.078z" />
        </svg>
      </mask>
      <rect data-testid="invertible-mask-rect" width="100%" height="100%" mask={`url(#${maskId})`} />
    </svg>
  )
}

const PlaylistIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M3 5h14v2H3zm0 4h10v2H3zm0 4h7v2H3zm14 2v6l4-3-4-3z" />
  </svg>
)

const LoadingSpinner = () => (
  <span className="spinner" aria-hidden="true" />
)

function App() {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchSource, setSearchSource] = useState<SourceValue>(DEFAULT_SOURCE)
  const [searchLimit, setSearchLimit] = useState(SEARCH_PAGE_SIZE)
  const [hasMoreResults, setHasMoreResults] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<TrackDetails | null>(null)
  const [isLoadingTrack, setIsLoadingTrack] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('very_high')
  const qualitySelectId = useId()

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
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null)
  const searchBarRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    const current = currentTrackRef.current
    if (!current) {
      return
    }

    const controller = new AbortController()
    const currentKey = getTrackKey(current)
    let detachLoaded: (() => void) | null = null

    const updateQuality = async () => {
      setIsBuffering(true)

      try {
        const bitrate = QUALITY_TO_BR[audioQuality]
        const urlInfo = await fetchJson<{ url: string }>(
          `${API_BASE}?types=url&source=${current.source || DEFAULT_SOURCE}&id=${current.id}&br=${bitrate}`,
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        const latest = currentTrackRef.current
        if (!latest || getTrackKey(latest) !== currentKey) {
          return
        }

        setError(null)
        const updatedTrack: TrackDetails = { ...latest, audioUrl: urlInfo.url }
        currentTrackRef.current = updatedTrack
        setCurrentTrack(updatedTrack)
        playlistRef.current = playlistRef.current.map((track) =>
          getTrackKey(track) === currentKey ? { ...track, audioUrl: urlInfo.url } : track,
        )
        setPlaylist((prev) =>
          prev.map((track) => (getTrackKey(track) === currentKey ? { ...track, audioUrl: urlInfo.url } : track)),
        )

        const audio = audioRef.current
        if (!audio) {
          setIsBuffering(false)
          return
        }

        const wasPlaying = !audio.paused
        const previousTime = audio.currentTime

        const activeAudio = audio

        function cleanupQualityListeners() {
          activeAudio.removeEventListener('loadeddata', handleLoadedData)
          activeAudio.removeEventListener('error', handleError)
        }

        function handleLoadedData() {
          cleanupQualityListeners()
          if (controller.signal.aborted) {
            return
          }

          const targetTime = Number.isFinite(previousTime)
            ? Math.min(previousTime, activeAudio.duration || previousTime)
            : 0

          if (targetTime > 0) {
            try {
              activeAudio.currentTime = targetTime
            } catch (seekError) {
              console.warn('Failed to seek after quality switch:', seekError)
              activeAudio.currentTime = 0
            }
          } else {
            activeAudio.currentTime = 0
          }

          setProgress(activeAudio.currentTime || 0)
          setIsBuffering(false)

          if (wasPlaying) {
            activeAudio.play().catch(() => undefined)
          }
        }

        function handleError() {
          cleanupQualityListeners()
          if (controller.signal.aborted) {
            return
          }
          setIsBuffering(false)
          setError('切换音质时出现问题，请稍后重试。')
        }

        detachLoaded = cleanupQualityListeners

        activeAudio.pause()
        activeAudio.addEventListener('loadeddata', handleLoadedData)
        activeAudio.addEventListener('error', handleError)
        activeAudio.src = urlInfo.url
        activeAudio.load()
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        console.error('Failed to switch audio quality', error)
        setError('切换音质时出现问题，请稍后重试。')
        setIsBuffering(false)
      }
    }

    updateQuality()

    return () => {
      controller.abort()
      if (detachLoaded) {
        detachLoaded()
      }
    }
  }, [audioQuality])

  useEffect(() => {
    const updateSearchBarHeight = () => {
      const searchBar = searchBarRef.current
      if (searchBar) {
        const nextHeight = Math.max(searchBar.offsetHeight, 320)
        document.documentElement.style.setProperty(
          '--search-bar-height',
          `${nextHeight}px`,
        )
      }
    }

    updateSearchBarHeight()

    const observer = new ResizeObserver(() => {
      updateSearchBarHeight()
    })

    const currentSearchBar = searchBarRef.current
    if (currentSearchBar) {
      observer.observe(currentSearchBar)
    }

    window.addEventListener('resize', updateSearchBarHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSearchBarHeight)
    }
  }, [isSearching, searchResults.length])

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
      const trimmed = query.trim()
      if (!trimmed) {
        setSearchResults([])
        setIsSearching(false)
        setHasMoreResults(false)
        setFailedCoverMap({})
        return
      }

      try {
        setIsSearching(true)
        setError(null)
        const url = `${API_BASE}?types=search&source=${searchSource}&name=${encodeURIComponent(
          trimmed,
        )}&count=${searchLimit}`
        const results = await fetchJson<SearchResult[]>(url, controller.signal)
        const parsedResults = Array.isArray(results) ? results : []
        setSearchResults(parsedResults)
        setHasMoreResults(parsedResults.length >= searchLimit)
        setFailedCoverMap({})
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
  }, [query, searchSource, searchLimit])

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
    const bitrate = QUALITY_TO_BR[audioQuality]
    const [urlInfo, lyricInfo, picInfo] = await Promise.all([
      fetchJson<{ url: string }>(
        `${API_BASE}?types=url&source=${track.source || DEFAULT_SOURCE}&id=${track.id}&br=${bitrate}`,
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
  }, [audioQuality])

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
    if (!audio || !currentTrackRef.current) {
      return
    }
    audio.currentTime = value
    setProgress(value)
  }

  const handleAudioQualityChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const selectedQuality = event.target.value as AudioQuality
      console.log('Audio quality switched to:', selectedQuality)
      setAudioQuality(selectedQuality)
    },
    [setAudioQuality]
  )

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

  const handleLoadMoreResults = useCallback(() => {
    setSearchLimit((prev) => prev + SEARCH_PAGE_SIZE)
  }, [])

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
        setSearchLimit(SEARCH_PAGE_SIZE)
        setHasMoreResults(false)
      }
    },
    [buildTrackDetails, playTrack],
  )

  const handlePrevious = useCallback(() => {
    const list = playlistRef.current
    if (!list.length) {
      return
    }
    if (!currentTrackRef.current) {
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
    if (!currentTrackRef.current) {
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

    const lyricLines = currentTrack.lyrics
    const clampedIndex = Math.min(Math.max(activeLyricIndex, -1), lyricLines.length - 1)

    return (
      <Lyrics
        lyrics={lyricLines}
        currentIndex={clampedIndex}
        className="mx-auto max-w-2xl"
        scrollContainerRef={lyricsScrollRef}
      />
    )
  }, [currentTrack, activeLyricIndex, lyricsScrollRef])

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

  const albumArtStyle = useMemo<CSSProperties>(() => {
    if (!currentTrack?.artworkUrl) {
      return {}
    }
    return {
      '--album-art-image': `url(${currentTrack.artworkUrl})`,
    } as CSSProperties
  }, [currentTrack?.artworkUrl])

  const albumArtAriaLabel = useMemo(() => {
    if (currentTrack) {
      return currentTrack.artworkUrl
        ? `${currentTrack.title} 的专辑封面`
        : `${currentTrack.title} 的专辑封面占位图`
    }
    return '专辑封面占位图'
  }, [currentTrack])

  const isPlayerReady = Boolean(currentTrack)
  const progressValue = isPlayerReady ? Math.min(progress, duration || 0) : 0
  const progressMax = isPlayerReady ? duration || 0 : 0
  const playerTitle = currentTrack?.title ?? '准备播放'
  const playerSubtitle = currentTrack
    ? `${currentTrack.artists} · ${currentTrack.album}`
    : '搜索并选择一首歌曲开始播放'
  const navigationDisabled = !isPlayerReady || playlist.length <= 1
  const shuffleDisabled = !isPlayerReady || playlist.length <= 1
  const repeatDisabled = !isPlayerReady

  const trimmedQuery = query.trim()
  const showSearchDropdown = trimmedQuery.length > 0
  const RepeatIconComponent = repeatMode === 'one' ? RepeatOneIcon : RepeatIcon
  const shuffleLabel = isShuffle ? '关闭随机播放' : '开启随机播放'
  const repeatAriaLabel =
    repeatMode === 'none' ? '开启循环播放' : repeatMode === 'all' ? '切换为单曲循环' : '关闭循环播放'

  return (
    <div className="app" style={backgroundStyle}>
      <div className="app-backdrop" style={generatedBackgroundStyle} />
      <div className="app-overlay" />
      <h1 className="header-title">SOLARA MUSIC</h1>
      <main className="app-layout">
        <section className="panel playback-panel" aria-label="正在播放">
          <div className="player-stage left-pane album-section" aria-live="polite">
            <div className="player-cover">
              {currentTrack?.artworkUrl ? (
                <div className="album-art" style={albumArtStyle} role="img" aria-label={albumArtAriaLabel} />
              ) : (
                <div className="album-placeholder" role="img" aria-label={albumArtAriaLabel} />
              )}
            </div>

            <div className="player-track-meta">
              <h2 className="player-title track-title">{playerTitle}</h2>
              <p className="player-artist track-artist">{playerSubtitle}</p>
            </div>

            <div className="player-progress">
              <input
                type="range"
                min={0}
                max={progressMax}
                value={progressValue}
                step={0.1}
                onChange={(event) => handleSeek(Number(event.target.value))}
                aria-valuemin={0}
                aria-valuemax={progressMax}
                aria-valuenow={progressValue}
                aria-label="播放进度"
                className="progress"
                style={isPlayerReady ? timelineStyle : undefined}
                disabled={!isPlayerReady}
              />
              <div className="time-row">
                <span className="time time-start">{formatTime(progressValue)}</span>
                <div className="audio-quality-select-wrapper">
                  <select
                    id={qualitySelectId}
                    className="audio-quality-select"
                    value={audioQuality}
                    onChange={handleAudioQualityChange}
                    aria-label="选择音质"
                  >
                    {AUDIO_QUALITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="time time-end">{formatTime(progressMax)}</span>
              </div>
            </div>

            <div className="audio-quality-control" role="group" aria-label="音质选择">
              <label className="audio-quality-label" htmlFor={qualitySelectId}>
                音质
              </label>
              <select
                id={qualitySelectId}
                className="audio-quality-select"
                value={audioQuality}
                onChange={(event) => setAudioQuality(event.target.value as AudioQuality)}
                aria-label="选择音质"
              >
                {AUDIO_QUALITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="player-controls control-row" role="group" aria-label="播放控制">
              <button
                type="button"
                className={`control-button icon-btn shuffle${isPlayerReady && isShuffle ? ' active' : ''}`}
                onClick={toggleShuffle}
                aria-pressed={isPlayerReady && isShuffle}
                aria-label={shuffleLabel}
                disabled={shuffleDisabled}
              >
                <ShuffleIcon />
              </button>
              <div className="main-controls">
                <button
                  type="button"
                  className="control-button icon-btn prev"
                  onClick={handlePrevious}
                  disabled={navigationDisabled}
                  aria-label="上一首"
                >
                  <PrevIcon />
                </button>
                <button
                  type="button"
                  className={`control-button icon-btn play-toggle${isBusy ? ' buffering' : ''}`}
                  onClick={handlePlayPause}
                  disabled={!isPlayerReady || isLoadingTrack}
                  aria-label={isPlaying ? '暂停' : '播放'}
                >
                  {isBusy ? <span className="sr-only">缓冲中</span> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button
                  type="button"
                  className="control-button icon-btn next"
                  onClick={handleNext}
                  disabled={navigationDisabled}
                  aria-label="下一首"
                >
                  <NextIcon />
                </button>
              </div>
              <button
                type="button"
                className={`control-button icon-btn repeat${isPlayerReady && repeatMode !== 'none' ? ' active' : ''}`}
                onClick={cycleRepeat}
                aria-label={repeatAriaLabel}
                aria-pressed={isPlayerReady && repeatMode !== 'none'}
                disabled={repeatDisabled}
              >
                <RepeatIconComponent />
              </button>
            </div>

            <div className="player-volume volume-row">
              <span className="vol-min" aria-hidden="true">
                <SpeakerLowIcon />
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
                <SpeakerHighIcon />
              </span>
            </div>
          </div>
        </section>

        <aside className="panel list-panel" aria-label="播放列表与歌词">
          <div className="list-stack">
            <header className="list-header">
              <div className="search-area">
                <div className="search-bar-wrapper">
                  <div
                    className={`search-bar${isSearching ? ' searching' : ''}`}
                    ref={searchBarRef}
                  >
                    <SearchIcon />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value)
                        setSearchLimit(SEARCH_PAGE_SIZE)
                        setHasMoreResults(false)
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
                      {!isSearching && hasMoreResults && searchResults.length > 0 && (
                        <button
                          type="button"
                          className="search-load-more"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={handleLoadMoreResults}
                        >
                          加载更多
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <SourceDropdown
                  value={searchSource}
                  onChange={(nextSource) => {
                    setSearchSource(nextSource)
                    setSearchLimit(SEARCH_PAGE_SIZE)
                    setHasMoreResults(false)
                    setSearchResults([])
                    setFailedCoverMap({})
                    if (query.trim()) {
                      setIsSearching(true)
                    }
                  }}
                />
              </div>

            </header>

            {error && <div className="error-banner">{error}</div>}

            <div
              className={`list-scroll${activePanel === 'lyrics' ? ' is-lyrics' : ''}`}
              role={activePanel === 'playlist' ? 'listbox' : 'document'}
              id={activePanel === 'playlist' ? 'panel-playlist' : 'panel-lyrics'}
              aria-labelledby={activePanel === 'playlist' ? 'tab-playlist' : 'tab-lyrics'}
            >
              {activePanel === 'playlist' ? (
                <div className="playlist-view">
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
                </div>
              ) : (
                <div className="lyrics-panel">
                  <header className="lyrics-header">
                    <h2>{currentTrack ? currentTrack.title : '准备播放'}</h2>
                    {currentTrack && <p>{currentTrack.artists} · {currentTrack.album}</p>}
                  </header>
                  <div ref={lyricsScrollRef} className="lyrics-view">
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
          className={`icon-btn${activePanel === 'lyrics' ? ' active' : ''}`}
          onClick={() => setActivePanel('lyrics')}
          aria-selected={activePanel === 'lyrics'}
          aria-controls="panel-lyrics"
          title="歌词"
        >
          <LyricsIcon />
          <span className="sr-only">显示歌词</span>
        </button>
        <button
          type="button"
          id="tab-playlist"
          role="tab"
          className={`icon-btn${activePanel === 'playlist' ? ' active' : ''}`}
          onClick={() => setActivePanel('playlist')}
          aria-selected={activePanel === 'playlist'}
          aria-controls="panel-playlist"
          title="播放列表"
        >
          <PlaylistIcon />
          <span className="sr-only">显示播放列表</span>
        </button>
      </div>
    </div>
  )
}

export default App
