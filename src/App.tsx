import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './App.css'
import { mergeLyrics } from './utils/lyrics'
import type { LyricLine } from './utils/lyrics'
import { DEFAULT_PALETTE, extractPaletteFromImage } from './utils/palette'
import type { BackgroundPalette } from './utils/palette'

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

const PlaylistIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 6.5h12M4 11.5h12M4 16.5h6m10-6.17v6.84a1.5 1.5 0 01-2.36 1.2l-2.14-1.53"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const LyricsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M5 6.5h9m-9 4h9m-9 4h5M16 6v9.5a2 2 0 01-2 2h-2.5l-3.2 2.4a.6.6 0 01-.96-.48V17.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
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
  const [activePanel, setActivePanel] = useState<'playlist' | 'lyrics'>('playlist')
  const [palette, setPalette] = useState<BackgroundPalette>(DEFAULT_PALETTE)

  useEffect(() => {
    searchResultsRef.current = searchResults
  }, [searchResults])

  useEffect(() => {
    currentTrackRef.current = currentTrack
  }, [currentTrack])

  useEffect(() => {
    let isActive = true

    const artworkUrl = currentTrack?.artworkUrl
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
  }, [currentTrack?.artworkUrl])

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
        '--artwork-url': currentTrack?.artworkUrl ? `url(${currentTrack.artworkUrl})` : 'none',
      }) as CSSProperties,
    [palette, currentTrack?.artworkUrl],
  )

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

  return (
    <div className="app" style={backgroundStyle}>
      <div className="app-backdrop" />
      <div className="app-ambient" aria-hidden="true">
        <div className="ambient-layer layer-1" />
        <div className="ambient-layer layer-2" />
      </div>
      <div className="app-overlay" />
      <main className="app-layout">
        <section className="panel playback-panel" aria-label="正在播放">
          <div className="playback-grid">
            <header className="playback-header">
              <div className="brand-bar">
                <h1 className="brand-title">Solara Music</h1>
                <p className="brand-subtitle">沉浸式高品质音乐体验</p>
              </div>

              <div className="playback-info">
                <span className="eyebrow">{currentTrack ? '现在播放' : '等待播放'}</span>
                <h2>{currentTrack ? currentTrack.title : '选择一首歌曲开始'}</h2>
                <p>{currentTrack ? `${currentTrack.artists} · ${currentTrack.album}` : '即时搜索 · 立刻播放'}</p>
              </div>
            </header>

            <div className="album-stage" aria-live="polite">
              <div
                className={`album-art${currentTrack?.artworkUrl ? ' loaded' : ''}`}
                style={{ backgroundImage: currentTrack?.artworkUrl ? `url(${currentTrack.artworkUrl})` : undefined }}
              >
                {!currentTrack && <span className="artwork-placeholder">搜索并选择一首歌曲</span>}
              </div>
            </div>

            <div className="playback-controls">
              <div className="timeline" role="group" aria-label="播放进度">
                <span aria-hidden="true">{formatTime(progress)}</span>
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
                  style={timelineStyle}
                />
                <span aria-hidden="true">{formatTime(duration)}</span>
              </div>

              <div className="control-row" role="group" aria-label="播放控制">
                <button
                  type="button"
                  className="control-button"
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
                  className={`control-button play-toggle${isBusy ? ' buffering' : ''}`}
                  onClick={handlePlayPause}
                  disabled={!currentTrack || isLoadingTrack}
                  aria-label={isPlaying ? '暂停' : '播放'}
                >
                  {isBusy ? <span className="sr-only">缓冲中</span> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button
                  type="button"
                  className="control-button"
                  onClick={() => {
                    if (!searchResults.length) {
                      return
                    }
                    autoplayRef.current = true
                    setSelectedIndex((prev) => {
                      if (prev === -1) {
                        return 0
                      }
                      return (prev + 1) % searchResults.length
                    })
                  }}
                  disabled={!searchResults.length}
                  aria-label="下一首"
                >
                  <NextIcon />
                </button>
              </div>

              <div className="volume-row">
                <VolumeIcon />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => handleVolumeChange(Number(event.target.value))}
                  aria-label="音量"
                  style={volumeStyle}
                />
              </div>
            </div>

            <footer className="playback-footer">
              {currentTrack ? (
                <>
                  <span className="source-chip">来自 {currentTrack.source}</span>
                  {upcomingTrack && (
                    <div className="up-next">
                      <span className="eyebrow">接下来</span>
                      <p>{upcomingTrack}</p>
                    </div>
                  )}
                </>
              ) : (
                <span className="footer-placeholder">选择歌曲后显示来源</span>
              )}
            </footer>
          </div>
        </section>

        <aside className="panel list-panel" aria-label="播放列表与歌词">
          <div className="list-stack">
            <header className="list-header">
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

              <div className="segmented-control" role="tablist" aria-label="内容切换">
                <button
                  type="button"
                  className={`segment${activePanel === 'playlist' ? ' active' : ''}`}
                  onClick={() => setActivePanel('playlist')}
                  role="tab"
                  aria-selected={activePanel === 'playlist'}
                  aria-controls="panel-playlist"
                  id="tab-playlist"
                >
                  <PlaylistIcon />
                  <span>播放列表</span>
                </button>
                <button
                  type="button"
                  className={`segment${activePanel === 'lyrics' ? ' active' : ''}`}
                  onClick={() => setActivePanel('lyrics')}
                  role="tab"
                  aria-selected={activePanel === 'lyrics'}
                  aria-controls="panel-lyrics"
                  id="tab-lyrics"
                >
                  <LyricsIcon />
                  <span>歌词</span>
                </button>
              </div>
            </header>

            {error && <div className="error-banner">{error}</div>}

            <div
              className="list-scroll"
              role={activePanel === 'playlist' ? 'listbox' : 'document'}
              id={activePanel === 'playlist' ? 'panel-playlist' : 'panel-lyrics'}
              aria-labelledby={activePanel === 'playlist' ? 'tab-playlist' : 'tab-lyrics'}
            >
              {activePanel === 'playlist' ? (
                <>
                  <div className="results-meta">
                    <span className="eyebrow">搜索结果</span>
                    <span className="result-count">{searchResults.length} 首歌曲</span>
                  </div>
                  {searchResults.map((track, index) => {
                    const isActive = index === selectedIndex
                    return (
                      <button
                        type="button"
                        key={`${track.id}-${track.source}`}
                        role="option"
                        aria-selected={isActive}
                        className={`track-item${isActive ? ' active' : ''}`}
                        onClick={() => handleSelect(index)}
                        title={`${track.name} · ${track.artist.join('、')} · ${track.album}`}
                      >
                        <div className="track-thumb" aria-hidden="true">
                          <span className="track-letter">{track.name.charAt(0)}</span>
                          {isActive && (
                            <span className="equalizer" aria-hidden="true">
                              <span />
                            </span>
                          )}
                        </div>
                        <div className="track-meta">
                          <span className="track-title">{track.name}</span>
                          <span className="track-artist">{track.artist.join('、')}</span>
                        </div>
                        <span className="track-duration" aria-hidden={!isActive}>
                          {isActive && duration ? formatTime(duration) : '--:--'}
                        </span>
                      </button>
                    )
                  })}
                  {!searchResults.length && !isSearching && (
                    <div className="empty-state">没有找到相关歌曲</div>
                  )}
                </>
              ) : (
                <div className="lyrics-view">
                  <header className="lyrics-header">
                    <span className="eyebrow">歌词</span>
                    <h2>{currentTrack ? currentTrack.title : '准备播放'}</h2>
                    {currentTrack && <p>{currentTrack.artists} · {currentTrack.album}</p>}
                  </header>
                  <div className="lyrics-scroll">{lyricsContent}</div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
