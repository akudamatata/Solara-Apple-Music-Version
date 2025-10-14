import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { mergeLyrics } from './utils/lyrics'
import type { LyricLine } from './utils/lyrics'

const API_BASE = 'https://music-api.gdstudio.xyz/api.php'
const DEFAULT_SOURCE = 'netease'
const DEFAULT_QUERY = 'Taylor Swift'

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

const VolumeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4.5 9.5v5h2.88L12 18.12V5.88L7.38 9.5H4.5zm12.6-3.1a6 6 0 010 11.2m-2.26-8.94a3 3 0 010 6.68"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const LoadingSpinner = () => (
  <span className="spinner" aria-hidden="true" />
)

function App() {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [currentTrack, setCurrentTrack] = useState<TrackDetails | null>(null)
  const [isLoadingTrack, setIsLoadingTrack] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const autoplayRef = useRef(false)
  const currentTrackRef = useRef<TrackDetails | null>(null)
  const searchResultsRef = useRef<SearchResult[]>([])

  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [activeLyricIndex, setActiveLyricIndex] = useState(0)

  useEffect(() => {
    searchResultsRef.current = searchResults
  }, [searchResults])

  useEffect(() => {
    currentTrackRef.current = currentTrack
  }, [currentTrack])

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

  useEffect(() => {
    if (searchResults.length === 0) {
      setSelectedIndex(-1)
      setCurrentTrack(null)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      return
    }

    if (selectedIndex === -1 || selectedIndex >= searchResults.length) {
      autoplayRef.current = false
      setSelectedIndex(0)
    }
  }, [searchResults, selectedIndex])

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
    (audio: HTMLAudioElement) => {
      const onTimeUpdate = () => handleTimeUpdate(audio)
      const onLoaded = () => {
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      }
      const onPlay = () => setIsPlaying(true)
      const onPause = () => setIsPlaying(false)
      const onWaiting = () => setIsBuffering(true)
      const onPlaying = () => setIsBuffering(false)
      const onEnded = () => {
        setIsPlaying(false)
        autoplayRef.current = true
        setSelectedIndex((prev) => {
          if (prev < 0) {
            return prev
          }
          const list = searchResultsRef.current
          const next = prev + 1
          if (next < list.length) {
            return next
          }
          return 0
        })
      }

      audio.addEventListener('timeupdate', onTimeUpdate)
      audio.addEventListener('loadedmetadata', onLoaded)
      audio.addEventListener('play', onPlay)
      audio.addEventListener('pause', onPause)
      audio.addEventListener('waiting', onWaiting)
      audio.addEventListener('playing', onPlaying)
      audio.addEventListener('ended', onEnded)

      cleanupRef.current = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate)
        audio.removeEventListener('loadedmetadata', onLoaded)
        audio.removeEventListener('play', onPlay)
        audio.removeEventListener('pause', onPause)
        audio.removeEventListener('waiting', onWaiting)
        audio.removeEventListener('playing', onPlaying)
        audio.removeEventListener('ended', onEnded)
      }
    },
    [handleTimeUpdate],
  )

  const loadTrack = useCallback(
    async (track: SearchResult, shouldAutoplay: boolean) => {
      setIsLoadingTrack(true)
      setError(null)
      setProgress(0)
      setDuration(0)
      setActiveLyricIndex(0)
      setIsBuffering(true)

      try {
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

        const details: TrackDetails = {
          id: String(track.id),
          title: track.name,
          artists,
          album: track.album,
          source: track.source,
          artworkUrl,
          audioUrl: urlInfo.url,
          lyrics,
        }

        currentTrackRef.current = details
        setCurrentTrack(details)

        teardownAudio()
        const audio = new Audio(details.audioUrl)
        audio.crossOrigin = 'anonymous'
        audio.volume = volume
        audioRef.current = audio
        attachAudio(audio)

        if (shouldAutoplay) {
          await audio.play().catch(() => undefined)
        }
      } catch (err) {
        console.error(err)
        setError('载入歌曲时出现问题，请稍后再试。')
      } finally {
        setIsLoadingTrack(false)
        setIsBuffering(false)
      }
    },
    [attachAudio, teardownAudio, volume],
  )

  useEffect(() => {
    if (selectedIndex < 0) {
      return
    }
    const track = searchResults[selectedIndex]
    if (!track) {
      return
    }

    if (currentTrackRef.current?.id === String(track.id)) {
      if (autoplayRef.current && audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => undefined)
      }
      autoplayRef.current = false
      return
    }

    const shouldAutoplay = autoplayRef.current || currentTrackRef.current !== null
    autoplayRef.current = false
    loadTrack(track, shouldAutoplay)
  }, [selectedIndex, searchResults, loadTrack])

  useEffect(() => {
    return () => {
      teardownAudio()
    }
  }, [teardownAudio])

  const backgroundStyle = useMemo(() => {
    if (!currentTrack?.artworkUrl) {
      return undefined
    }
    return {
      ['--artwork-url' as string]: `url(${currentTrack.artworkUrl})`,
    }
  }, [currentTrack?.artworkUrl])

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

  const handleSelect = (index: number) => {
    autoplayRef.current = true
    setSelectedIndex(index)
  }

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
        <div key={`${line.time}-${index}`} className={`lyric-line${isActive ? ' active' : ''}`}>
          <p className="lyric-text">{line.text}</p>
          {line.translation && <p className="lyric-translation">{line.translation}</p>}
        </div>
      )
    })
  }, [currentTrack, activeLyricIndex])

  const upcomingTrack = useMemo(() => {
    if (searchResults.length < 2 || selectedIndex < 0) {
      return null
    }
    const nextIndex = (selectedIndex + 1) % searchResults.length
    const nextTrack = searchResults[nextIndex]
    return `${nextTrack.name} · ${nextTrack.artist.join('、')}`
  }, [searchResults, selectedIndex])

  return (
    <div className="app" style={backgroundStyle}>
      <div className="app-backdrop" />
      <div className="app-overlay" />
      <div className="app-content">
        <aside className="sidebar">
          <header className="sidebar-header">
            <span className="badge">Solara Music</span>
            <h1>沉浸式播放室</h1>
            <p className="subtitle">高仿 Apple Music · Cloudflare Pages 就绪</p>
          </header>

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

          {error && <div className="error-banner">{error}</div>}

          <div className="results-header">
            <span>搜索结果</span>
            <span className="result-count">{searchResults.length} 首歌曲</span>
          </div>

          <div className="search-results" role="listbox">
            {searchResults.map((track, index) => {
              const isActive = index === selectedIndex
              return (
                <button
                  type="button"
                  key={`${track.id}-${track.source}`}
                  role="option"
                  aria-selected={isActive}
                  className={`search-item${isActive ? ' active' : ''}`}
                  onClick={() => handleSelect(index)}
                >
                  <div className="search-item-artwork" aria-hidden="true">
                    {isActive && (
                      <span className="equalizer" aria-hidden="true">
                        <span />
                      </span>
                    )}
                  </div>
                  <div className="search-item-meta">
                    <span className="title">{track.name}</span>
                    <span className="artist">{track.artist.join('、')}</span>
                  </div>
                  <span className="album" title={track.album}>
                    {track.album}
                  </span>
                </button>
              )
            })}
            {!searchResults.length && !isSearching && (
              <div className="empty-state">没有找到相关歌曲</div>
            )}
          </div>

          {currentTrack && (
            <div className="now-playing-card">
              <div
                className="now-playing-artwork"
                style={{ backgroundImage: currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl})` : undefined }}
                aria-label={currentTrack.title}
              />
              <div className="now-playing-meta">
                <span className="label">正在播放</span>
                <h2>{currentTrack.title}</h2>
                <p>{currentTrack.artists}</p>
                <span className="album-chip">{currentTrack.album}</span>
              </div>
            </div>
          )}

          <div className="player">
            <div className="timeline">
              <span>{formatTime(progress)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={Math.min(progress, duration || 0)}
                step={0.1}
                onChange={(event) => handleSeek(Number(event.target.value))}
                aria-label="播放进度"
              />
              <span>{formatTime(duration)}</span>
            </div>

            <div className="player-controls">
              <button
                type="button"
                className="control"
                onClick={() => {
                  if (!searchResults.length) {
                    return
                  }
                  autoplayRef.current = true
                  setSelectedIndex((prev) => {
                    if (prev <= 0) {
                      return Math.max(searchResults.length - 1, 0)
                    }
                    return prev - 1
                  })
                }}
                disabled={!searchResults.length}
                aria-label="上一首"
              >
                <PrevIcon />
              </button>

              <button
                type="button"
                className={`play-pause${isBuffering ? ' buffering' : ''}`}
                onClick={handlePlayPause}
                disabled={!currentTrack || isLoadingTrack}
                aria-label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>

              <button
                type="button"
                className="control"
                onClick={() => {
                  if (!searchResults.length) {
                    return
                  }
                  autoplayRef.current = true
                  setSelectedIndex((prev) => {
                    if (prev < 0) {
                      return 0
                    }
                    const next = prev + 1
                    if (next < searchResults.length) {
                      return next
                    }
                    return 0
                  })
                }}
                disabled={!searchResults.length}
                aria-label="下一首"
              >
                <NextIcon />
              </button>
            </div>

            <div className="player-extra">
              <div className="volume">
                <VolumeIcon />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => handleVolumeChange(Number(event.target.value))}
                  aria-label="音量"
                />
              </div>
              {currentTrack && <span className="source-chip">来自 {currentTrack.source}</span>}
            </div>
          </div>
        </aside>

        <section className="lyrics-panel">
          <header className="lyrics-header">
            <div>
              <span className="label">歌词</span>
              <h2>{currentTrack ? currentTrack.title : '准备播放'}</h2>
              {currentTrack && <p>{currentTrack.artists} · {currentTrack.album}</p>}
            </div>
            {upcomingTrack && (
              <div className="up-next">
                <span>接下来</span>
                <p>{upcomingTrack}</p>
              </div>
            )}
          </header>
          <div className="lyrics-scroll">{lyricsContent}</div>
        </section>
      </div>
    </div>
  )
}

export default App
