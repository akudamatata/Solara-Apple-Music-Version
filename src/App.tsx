import { useCallback, useEffect, useMemo, useRef, useState, useId, lazy, Suspense, memo } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import type { CSSProperties, ChangeEvent, ReactElement } from 'react'
import { Download, Radar, Trash2, X } from 'lucide-react'
import './App.css'
import SourceDropdown, { type SourceValue } from './SourceDropdown'
import { Notification } from './components/Notification'
// ✅ Performance optimized automatically by Codex
import { mergeLyrics } from './utils/lyrics'
import type { LyricLine } from './utils/lyrics'
import { DEFAULT_PALETTE, extractPaletteFromImage } from './utils/palette'
import type { BackgroundPalette } from './utils/palette'
import { generateAppleMusicStyleBackground } from './utils/background'
import AudioQualityDropdown from './AudioQualityDropdown'
import { QUALITY_TO_BR, type AudioQuality } from './audioQuality'

const Lyrics = lazy(() => import('./components/Lyrics'))

const API_BASE = '/proxy'
const KUWO_HOST_PATTERN = /(^|\.)kuwo\.cn$/i
const DEFAULT_SOURCE: SourceValue = 'netease'
const SEARCH_PAGE_SIZE = 24
const SUPPORTED_AUDIO_EXTENSIONS = /\.(mp3|flac|wav|m4a|ape|aac)$/i
const INVALID_AUDIO_SOURCE_ERROR = 'INVALID_AUDIO_SOURCE'
const TRACK_ITEM_HEIGHT = 48
const PLAYLIST_VERTICAL_GAP_REM = 0.6
const PLAYLIST_OVERSCAN = 6

const getPlaylistGapPx = () => {
  if (typeof window === 'undefined') {
    return 10
  }
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize || '16')
  if (!Number.isFinite(rootFontSize)) {
    return 10
  }
  return rootFontSize * PLAYLIST_VERTICAL_GAP_REM
}

const isSupportedAudioSource = (url: string | null | undefined) => {
  if (!url) {
    return false
  }
  const sanitized = url.split('?')[0]?.split('#')[0] ?? ''
  return SUPPORTED_AUDIO_EXTENSIONS.test(sanitized.toLowerCase())
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

interface PlaylistEntry {
  id: string
  title: string
  artists: string
  album: string
  source: string
  artworkUrl?: string
  audioUrl?: string
  lyrics?: LyricLine[]
  duration?: number
  lyricId?: string
  picId?: string
}

interface TrackDetails extends PlaylistEntry {
  audioUrl: string
  lyrics: LyricLine[]
}

const STORAGE_KEYS = {
  playlist: 'playlist',
  currentTrackId: 'currentTrackId',
  playProgress: 'playProgress',
  volume: 'volume',
  repeatMode: 'repeatMode',
  isShuffle: 'isShuffle',
  audioQuality: 'audioQuality',
  currentTrack: 'currentTrack',
} as const

const VALID_REPEAT_MODES = new Set<'none' | 'one' | 'all'>(['none', 'one', 'all'])

const VALID_AUDIO_QUALITIES = new Set<AudioQuality>(['standard', 'high', 'very_high', 'lossless'])

const AUDIO_QUALITY_TOAST_LABELS: Record<AudioQuality, string> = {
  standard: '标准音质',
  high: '高音质',
  very_high: '极高音质',
  lossless: '无损音质',
}

type NotificationType = 'info' | 'success' | 'error'

const showNotification = (message: string, type: NotificationType = 'info') => {
  toast.custom(
    (t) => (
      <Notification
        message={message}
        type={type}
        onClose={() => toast.dismiss(t.id)}
      />
    ),
    {
      duration: 2800,
      position: 'top-right',
    },
  )
}

const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

const proxifyAudioUrl = (rawUrl: string | undefined | null) => {
  if (!rawUrl) {
    return ''
  }

  try {
    const parsed = new URL(rawUrl)
    if (KUWO_HOST_PATTERN.test(parsed.hostname)) {
      return `${API_BASE}?target=${encodeURIComponent(parsed.toString())}`
    }
    return parsed.toString()
  } catch {
    return rawUrl
  }
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return '0:00'
  }
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const SearchIcon = memo(() => (
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
))

const PlayIcon = memo(() => (
  <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
    <path
      d="M10.345 23.287c.415 0 .763-.15 1.22-.407l12.742-7.404c.838-.481 1.178-.855 1.178-1.46 0-.599-.34-.972-1.178-1.462L11.565 5.158c-.457-.265-.805-.407-1.22-.407-.789 0-1.345.606-1.345 1.57V21.71c0 .971.556 1.577 1.345 1.577z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
))

const PauseIcon = memo(() => (
  <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
    <path
      d="M13.293 22.772c.955 0 1.436-.481 1.436-1.436V6.677c0-.98-.481-1.427-1.436-1.427h-2.457c-.954 0-1.436.473-1.436 1.427v14.66c-.008.954.473 1.435 1.436 1.435h2.457zm7.87 0c.954 0 1.427-.481 1.427-1.436V6.677c0-.98-.473-1.427-1.428-1.427h-2.465c-.955 0-1.428.473-1.428 1.427v14.66c0 .954.473 1.435 1.428 1.435h2.465z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
))

const ShuffleIcon = memo(() => (
  <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
    <path
      d="M5.536 6.5h3.797c1.27 0 2.205.327 3.156 1.116l6.153 5.05c.656.538 1.095.72 1.961.72h4.536l-1.637-1.636c-.407-.407-.407-1.04 0-1.448s1.04-.407 1.448 0l3.53 3.53c.407.407.407 1.04 0 1.448l-3.53 3.53c-.408.407-1.04.407-1.448 0-.407-.408-.407-1.041 0-1.448l1.637-1.637h-4.536c-1.27 0-2.205-.327-3.156-1.116l-6.153-5.05c-.656-.538-1.095-.72-1.961-.72H5.536v2.18c0 .58-.466 1.046-1.045 1.046-.58 0-1.046-.466-1.046-1.046V7.546C3.445 6.967 3.911 6.5 4.491 6.5zm0 8.54c.579 0 1.045.466 1.045 1.046v2.18h2.701c.866 0 1.305-.182 1.961-.72l2.057-1.688c.417-.343 1.04-.286 1.383.131.343.417.286 1.04-.131 1.383l-2.057 1.688c-.95.789-1.885 1.116-3.156 1.116H5.536v2.18c0 .58-.466 1.045-1.045 1.045-.58 0-1.046-.465-1.046-1.045v-3.673c0-.58.466-1.046 1.046-1.046z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
))

const RepeatIcon = memo(() => (
  <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
    <path
      d="M7.4 6.1h13.104l-1.49-1.488c-.408-.408-.408-1.04 0-1.448s1.04-.408 1.448 0l3.53 3.53c.408.408.408 1.04 0 1.448l-3.53 3.53c-.408.408-1.04.408-1.448 0s-.408-1.04 0-1.448L20.504 8.2H7.4c-2.415 0-4.375 1.96-4.375 4.375v1.8c0 .58-.466 1.045-1.046 1.045-.579 0-1.045-.465-1.045-1.045v-1.8C.934 8.698 3.633 6.1 7.4 6.1zm17.2 10.77H11.496l1.49 1.488c.408.408.408 1.04 0 1.448-.408.408-1.04.408-1.448 0l-3.53-3.53c-.408-.408-.408-1.04 0-1.448l3.53-3.53c.408-.408 1.04-.408 1.448 0 .408.408.408 1.04 0 1.448l-1.49 1.49H24.6c2.415 0 4.375-1.96 4.375-4.375v-1.8c0-.58.466-1.045 1.045-1.045.58 0 1.046.465 1.046 1.045v1.8c0 3.777-2.699 6.375-6.466 6.375z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
))

const RepeatOneIcon = memo(() => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M17 17H7V7h8V5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10v2l3-3-3-3v2zm-4-4h-2V9l-1.5.75V8L11 7h1v6z" />
  </svg>
))

interface PlaylistViewProps {
  playlist: PlaylistEntry[]
  currentTrackId: string | null
  downloadQuality: AudioQuality
  onSelect: (index: number) => void
  onDownload: (track: PlaylistEntry, quality: AudioQuality) => void
  onRemove: (trackKey: string) => void
  onClear: () => void
}

const PlaylistView = memo(
  ({
    playlist,
    currentTrackId,
    downloadQuality,
    onSelect,
    onDownload,
    onRemove,
    onClear,
  }: PlaylistViewProps) => {
    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)
    const [rowGap, setRowGap] = useState(() => getPlaylistGapPx())

    const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
      setContainerEl(node)
    }, [])

    useEffect(() => {
      if (typeof window === 'undefined') {
        return
      }
      const updateGap = () => {
        setRowGap(getPlaylistGapPx())
      }
      updateGap()
      window.addEventListener('resize', updateGap)
      return () => {
        window.removeEventListener('resize', updateGap)
      }
    }, [])

    useEffect(() => {
      if (!containerEl) {
        return
      }
      const handleScroll = () => {
        setScrollTop(containerEl.scrollTop)
      }
      handleScroll()
      containerEl.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        containerEl.removeEventListener('scroll', handleScroll)
      }
    }, [containerEl])

    useEffect(() => {
      if (!containerEl) {
        return
      }
      const updateViewport = () => {
        setViewportHeight(containerEl.clientHeight)
      }
      updateViewport()
      if (typeof ResizeObserver === 'undefined') {
        return
      }
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === containerEl) {
            setViewportHeight(entry.contentRect.height)
          }
        }
      })
      observer.observe(containerEl)
      return () => {
        observer.disconnect()
      }
    }, [containerEl])

    const rowStride = TRACK_ITEM_HEIGHT + rowGap
    const activeOptionId = currentTrackId ? `playlist-option-${currentTrackId}` : undefined

    const { startIndex, endIndex } = useMemo(() => {
      if (!playlist.length) {
        return { startIndex: 0, endIndex: -1 }
      }
      const stride = rowStride > 0 ? rowStride : TRACK_ITEM_HEIGHT
      const safeScrollTop = Math.max(0, scrollTop)
      const firstVisible = Math.floor(safeScrollTop / stride)
      const approxVisible = Math.max(1, Math.ceil((viewportHeight || TRACK_ITEM_HEIGHT) / stride))
      const start = Math.max(0, firstVisible - PLAYLIST_OVERSCAN)
      const end = Math.min(playlist.length - 1, firstVisible + approxVisible + PLAYLIST_OVERSCAN)
      return { startIndex: start, endIndex: end }
    }, [playlist.length, rowStride, scrollTop, viewportHeight])

    const totalHeight = useMemo(() => {
      if (!playlist.length) {
        return 0
      }
      const gapContribution = Math.max(0, playlist.length - 1) * Math.max(0, rowGap)
      return playlist.length * TRACK_ITEM_HEIGHT + gapContribution
    }, [playlist.length, rowGap])

    const visibleTracks = useMemo(() => {
      if (!playlist.length || endIndex < startIndex) {
        return []
      }
      const stride = rowStride > 0 ? rowStride : TRACK_ITEM_HEIGHT
      const nodes: ReactElement[] = []
      for (let index = startIndex; index <= endIndex; index += 1) {
        const track = playlist[index]
        if (!track) {
          continue
        }
        const trackKey = getTrackKey(track)
        const isActive = trackKey === currentTrackId
        const optionId = `playlist-option-${trackKey}`
        nodes.push(
          <div
            key={trackKey}
            className="virtualized-track-viewport__item"
            style={{ top: `${index * stride}px`, height: TRACK_ITEM_HEIGHT }}
          >
            <div
              id={optionId}
              role="option"
              aria-selected={isActive}
              className={`track-item${isActive ? ' active' : ''}`}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(index)
                }
              }}
              tabIndex={0}
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
              <div className="song-actions">
                <div
                  className="download-action"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  onKeyUp={(event) => event.stopPropagation()}
                >
                  <AudioQualityDropdown
                    value={downloadQuality}
                    onChange={(quality) => {
                      void onDownload(track, quality)
                    }}
                    ariaLabel={`选择 ${track.title} 的下载音质`}
                    triggerTitle="下载"
                    triggerContent={<Download aria-hidden="true" size={18} strokeWidth={1.9} />}
                    variant="minimal"
                    triggerClassName="action-btn"
                  />
                </div>
                <button
                  type="button"
                  className="action-btn delete-action"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(trackKey)
                  }}
                  aria-label={`从播放列表移除 ${track.title}`}
                  title="删除"
                >
                  <X aria-hidden="true" size={18} strokeWidth={1.9} />
                </button>
              </div>
            </div>
          </div>,
        )
      }
      return nodes
    }, [
      playlist,
      endIndex,
      startIndex,
      rowStride,
      currentTrackId,
      downloadQuality,
      onSelect,
      onDownload,
      onRemove,
    ])

    return (
      <div className="playlist-view" ref={handleContainerRef} role="presentation">
        <div className="list-header">
          <span className="list-header__title">播放列表（共 {playlist.length} 首）</span>
          <div className="list-header__actions">
            <button
              type="button"
              className="clear-playlist-btn"
              onClick={onClear}
              title="清空播放列表"
              disabled={!playlist.length}
            >
              <Trash2 aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>清空</span>
            </button>
          </div>
        </div>
        {playlist.length > 0 && (
          <div
            className="virtualized-track-viewport"
            role="listbox"
            aria-label="播放列表"
            aria-activedescendant={activeOptionId}
          >
            <div className="virtualized-track-viewport__inner" style={{ height: totalHeight }}>
              {visibleTracks}
            </div>
          </div>
        )}
        {!playlist.length && <div className="empty-state">播放列表为空，快去搜索一首喜欢的歌曲吧</div>}
      </div>
    )
  },
  (prev, next) =>
    prev.playlist === next.playlist &&
    prev.currentTrackId === next.currentTrackId &&
    prev.downloadQuality === next.downloadQuality &&
    prev.onSelect === next.onSelect &&
    prev.onDownload === next.onDownload &&
    prev.onRemove === next.onRemove &&
    prev.onClear === next.onClear,
)

const iconShadow = 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))'

const SpeakerLowIcon = memo(() => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ filter: iconShadow }}>
    <path
      d="M4.5 10h2.2L12 6v12l-5.3-4H4.5a1.5 1.5 0 01-1.5-1.5V11.5A1.5 1.5 0 014.5 10z"
      fill="currentColor"
    />
    <path d="M16 10.2a2.6 2.6 0 010 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
))

const SpeakerHighIcon = memo(() => (
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
))

const PrevIcon = memo(() => (
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
))

const NextIcon = memo(() => (
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
))

const LyricsIcon = memo(() => {
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
})

const PlaylistIcon = memo(() => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M3 5h14v2H3zm0 4h10v2H3zm0 4h7v2H3zm14 2v6l4-3-4-3z" />
  </svg>
))

const LoadingSpinner = memo(() => (
  <span className="spinner" aria-hidden="true" />
))

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
  const [downloadQuality, setDownloadQuality] = useState<AudioQuality>('very_high')
  const [isExploring, setIsExploring] = useState(false)
  const [isExplorePulsing, setIsExplorePulsing] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const currentTrackRef = useRef<TrackDetails | null>(null)
  const playlistRef = useRef<PlaylistEntry[]>([])
  const activeIndexRef = useRef(-1)
  const playTrackRef = useRef<
    ((details: PlaylistEntry, index: number, shouldAutoplay?: boolean) => Promise<void>) | null
  >(null)
  const audioSetupRef = useRef(false)
  const explorePulseTimeoutRef = useRef<number | null>(null)
  const qualityToastEnabledRef = useRef(false)
  const qualityToastTimerRef = useRef<number | null>(null)
  const autoLoadGuardRef = useRef(false)
  const timeUpdateFrameRef = useRef<number | null>(null)
  const queryInputFrameRef = useRef<number | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [activeLyricIndex, setActiveLyricIndex] = useState(0)
  const [activePanel, setActivePanel] = useState<'playlist' | 'lyrics'>('lyrics')
  const [playlist, setPlaylist] = useState<PlaylistEntry[]>([])
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [palette, setPalette] = useState<BackgroundPalette>(DEFAULT_PALETTE)
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
  const [isLowOverhead, setIsLowOverhead] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        if (timeUpdateFrameRef.current !== null) {
          window.cancelAnimationFrame(timeUpdateFrameRef.current)
        }
        if (queryInputFrameRef.current !== null) {
          window.cancelAnimationFrame(queryInputFrameRef.current)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const updateLowOverhead = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsLowOverhead(event.matches)
    }

    updateLowOverhead(mediaQuery)

    const handleChange = (event: MediaQueryListEvent) => updateLowOverhead(event)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => {
        mediaQuery.removeEventListener('change', handleChange)
      }
    }

    mediaQuery.addListener(handleChange)
    return () => {
      mediaQuery.removeListener(handleChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storage = window.localStorage

    const readJSON = <T,>(key: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]): T | null => {
      const raw = storage.getItem(key)
      if (!raw) {
        return null
      }
      try {
        return JSON.parse(raw) as T
      } catch (error) {
        console.warn(`Failed to parse persisted ${key}`, error)
        return null
      }
    }

    const savedPlaylist = readJSON<PlaylistEntry[]>(STORAGE_KEYS.playlist)
    if (Array.isArray(savedPlaylist) && savedPlaylist.length) {
      setPlaylist(savedPlaylist)
      playlistRef.current = savedPlaylist
    }

    const savedTrack = readJSON<TrackDetails>(STORAGE_KEYS.currentTrack)
    if (savedTrack && typeof savedTrack.id === 'string') {
      setCurrentTrack(savedTrack)
      currentTrackRef.current = savedTrack
      if (typeof savedTrack.duration === 'number' && Number.isFinite(savedTrack.duration)) {
        setDuration(savedTrack.duration)
      }
    }

    const savedTrackId = storage.getItem(STORAGE_KEYS.currentTrackId)
    if (savedTrackId) {
      setCurrentTrackId(savedTrackId)
    }

    const savedProgress = storage.getItem(STORAGE_KEYS.playProgress)
    if (savedProgress !== null) {
      const parsedProgress = Number(savedProgress)
      if (!Number.isNaN(parsedProgress) && parsedProgress >= 0) {
        setProgress(parsedProgress)
      }
    }

    const savedVolume = storage.getItem(STORAGE_KEYS.volume)
    if (savedVolume !== null) {
      const parsedVolume = Number(savedVolume)
      if (!Number.isNaN(parsedVolume)) {
        const clampedVolume = Math.min(Math.max(parsedVolume, 0), 1)
        setVolume(clampedVolume)
      }
    }

    const savedRepeat = storage.getItem(STORAGE_KEYS.repeatMode)
    if (savedRepeat && VALID_REPEAT_MODES.has(savedRepeat as 'none' | 'one' | 'all')) {
      setRepeatMode(savedRepeat as 'none' | 'one' | 'all')
    }

    const savedShuffle = storage.getItem(STORAGE_KEYS.isShuffle)
    if (savedShuffle === 'true' || savedShuffle === 'false') {
      setIsShuffle(savedShuffle === 'true')
    }

    const savedQuality = storage.getItem(STORAGE_KEYS.audioQuality)
    if (savedQuality && VALID_AUDIO_QUALITIES.has(savedQuality as AudioQuality)) {
      setAudioQuality(savedQuality as AudioQuality)
    }

    if (typeof window !== 'undefined') {
      qualityToastTimerRef.current = window.setTimeout(() => {
        qualityToastEnabledRef.current = true
      }, 0)
    }

    return () => {
      if (qualityToastTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(qualityToastTimerRef.current)
        qualityToastTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    currentTrackRef.current = currentTrack
  }, [currentTrack])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (currentTrack) {
      window.localStorage.setItem(STORAGE_KEYS.currentTrack, JSON.stringify(currentTrack))
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.currentTrack)
    }
  }, [currentTrack])

  useEffect(() => {
    const storedTrack = currentTrackRef.current
    if (!storedTrack) {
      return
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      return
    }

    if (storedTrack.duration === duration) {
      return
    }

    const updatedTrack: TrackDetails = { ...storedTrack, duration }
    currentTrackRef.current = updatedTrack
    setCurrentTrack(updatedTrack)
    const updatedKey = getTrackKey(updatedTrack)
    let playlistUpdated = false
    const nextPlaylist = playlistRef.current.map((track) => {
      if (getTrackKey(track) === updatedKey) {
        playlistUpdated = true
        return { ...track, duration }
      }
      return track
    })
    if (playlistUpdated) {
      playlistRef.current = nextPlaylist
      setPlaylist(nextPlaylist)
    }
  }, [duration])

  useEffect(() => {
    playlistRef.current = playlist
  }, [playlist])

  useEffect(() => {
    if (!playlist.length) {
      autoLoadGuardRef.current = false
      return
    }
    if (isLoadingTrack || currentTrackRef.current) {
      return
    }
    const play = playTrackRef.current
    if (!play) {
      return
    }
    const firstTrack = playlist[0]
    if (!firstTrack) {
      return
    }
    if (autoLoadGuardRef.current) {
      return
    }
    autoLoadGuardRef.current = true
    play(firstTrack, 0, false)
      .catch((error) => {
        console.warn('Failed to auto load first track', error)
      })
      .finally(() => {
        autoLoadGuardRef.current = false
      })
  }, [isLoadingTrack, playlist])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (playlist.length) {
      window.localStorage.setItem(STORAGE_KEYS.playlist, JSON.stringify(playlist))
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.playlist)
    }
  }, [playlist])

  useEffect(() => {
    activeIndexRef.current = playlist.findIndex((track) => getTrackKey(track) === currentTrackId)
  }, [playlist, currentTrackId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (currentTrackId) {
      window.localStorage.setItem(STORAGE_KEYS.currentTrackId, currentTrackId)
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.currentTrackId)
    }
  }, [currentTrackId])

  useEffect(() => {
    shuffleEnabledRef.current = isShuffle
    if (!isShuffle) {
      shuffleHistoryRef.current = []
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.isShuffle, String(isShuffle))
    }
  }, [isShuffle])

  useEffect(() => {
    repeatModeRef.current = repeatMode
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.repeatMode, repeatMode)
    }
  }, [repeatMode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.audioQuality, audioQuality)
  }, [audioQuality])

  useEffect(() => {
    if (!qualityToastEnabledRef.current) {
      return
    }
    const label = AUDIO_QUALITY_TOAST_LABELS[audioQuality] ?? '标准音质'
    showNotification(`音质已切换为 ${label}`, 'success')
  }, [audioQuality])

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
        const proxiedUrl = proxifyAudioUrl(urlInfo.url)
        const updatedTrack: TrackDetails = { ...latest, audioUrl: proxiedUrl }
        currentTrackRef.current = updatedTrack
        setCurrentTrack(updatedTrack)
        playlistRef.current = playlistRef.current.map((track) =>
          getTrackKey(track) === currentKey ? { ...track, audioUrl: proxiedUrl } : track,
        )
        setPlaylist((prev) =>
          prev.map((track) =>
            getTrackKey(track) === currentKey ? { ...track, audioUrl: proxiedUrl } : track,
          ),
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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.volume, String(volume))
    }
  }, [volume])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handler = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEYS.playProgress, String(Math.max(progress, 0)))
    }, 5000)

    return () => {
      window.clearTimeout(handler)
    }
  }, [progress])

  useEffect(() => {
    const controller = new AbortController()
    const handler = window.setTimeout(async () => {
      const trimmed = query.trim()
      if (!trimmed) {
        setSearchResults([])
        setIsSearching(false)
        setHasMoreResults(false)
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
    if (typeof window !== 'undefined' && timeUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(timeUpdateFrameRef.current)
      timeUpdateFrameRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current.load()
      audioRef.current = null
    }
  }, [])

  const handleTimeUpdate = useCallback((audio: HTMLAudioElement) => {
    if (typeof window === 'undefined') {
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
      return
    }

    if (timeUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(timeUpdateFrameRef.current)
    }

    timeUpdateFrameRef.current = window.requestAnimationFrame(() => {
      setProgress(audio.currentTime)
      const track = currentTrackRef.current
      if (!track || !track.lyrics.length) {
        timeUpdateFrameRef.current = null
        return
      }
      const current = audio.currentTime + 0.25
      let nextIndex = track.lyrics.findIndex((line) => current < line.time)
      if (nextIndex === -1) {
        nextIndex = track.lyrics.length
      }
      const computed = Math.max(0, nextIndex - 1)
      setActiveLyricIndex((prev) => (prev === computed ? prev : computed))
      timeUpdateFrameRef.current = null
    })
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
        if (typeof window !== 'undefined' && timeUpdateFrameRef.current !== null) {
          window.cancelAnimationFrame(timeUpdateFrameRef.current)
          timeUpdateFrameRef.current = null
        }
      }
    },
    [handleTimeUpdate],
  )

  const handleAutoAdvance = useCallback(() => {
    const list = playlistRef.current
    if (!list.length) {
      return
    }

    const play = playTrackRef.current
    if (!play) {
      return
    }

    const currentIndex = activeIndexRef.current
    const repeatState = repeatModeRef.current
    const shuffleOn = shuffleEnabledRef.current

    if (repeatState === 'one') {
      let repeatIndex = currentIndex
      if (repeatIndex < 0 && currentTrackRef.current) {
        const currentTrack = currentTrackRef.current
        repeatIndex = list.findIndex((item) => getTrackKey(item) === getTrackKey(currentTrack))
      }
      const repeatTrack =
        (repeatIndex >= 0 && repeatIndex < list.length ? list[repeatIndex] : null) ??
        currentTrackRef.current
      if (repeatTrack) {
        play(repeatTrack, repeatIndex >= 0 ? repeatIndex : 0).catch(() => undefined)
      }
      return
    }

    let targetIndex: number | null = null

    if (shuffleOn && list.length) {
      const availableIndexes = list.map((_, idx) => idx).filter((idx) => idx !== currentIndex)
      if (availableIndexes.length) {
        targetIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)]
      } else if (repeatState === 'all' && currentIndex >= 0) {
        targetIndex = currentIndex
      }
      if (
        targetIndex !== null &&
        currentIndex !== -1 &&
        targetIndex >= 0 &&
        targetIndex < list.length &&
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
        play(nextTrack, targetIndex).catch(() => undefined)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (audioSetupRef.current) {
      return
    }

    audioSetupRef.current = true

    let audio = audioRef.current
    if (!audio) {
      audio = new Audio()
      audioRef.current = audio
    }

    audio.crossOrigin = 'anonymous'
    audio.volume = volume

    cleanupRef.current?.()
    attachAudio(audio, handleAutoAdvance)

    const savedTrackRaw = window.localStorage.getItem(STORAGE_KEYS.currentTrack)
    if (savedTrackRaw) {
      try {
        const savedTrack = JSON.parse(savedTrackRaw) as TrackDetails
        if (savedTrack && savedTrack.audioUrl) {
          audio.src = savedTrack.audioUrl
          currentTrackRef.current = savedTrack
          setCurrentTrack(savedTrack)
          if (typeof savedTrack.duration === 'number' && Number.isFinite(savedTrack.duration)) {
            setDuration(savedTrack.duration)
          }
        }
      } catch (error) {
        console.warn('Failed to restore persisted track from storage', error)
      }
      return
    }

    if (currentTrackRef.current?.audioUrl) {
      audio.src = currentTrackRef.current.audioUrl
    }
  }, [attachAudio, handleAutoAdvance, volume])

  const buildTrackDetails = useCallback(
    async (track: SearchResult | PlaylistEntry): Promise<TrackDetails> => {
      const bitrate = QUALITY_TO_BR[audioQuality]
      const source = track.source || DEFAULT_SOURCE
      const lyricId = 'lyric_id' in track ? track.lyric_id : track.lyricId || track.id
      const picId = 'pic_id' in track ? track.pic_id : track.picId || track.id
      const baseTitle = 'name' in track ? track.name : track.title
      const baseArtists = 'artist' in track ? track.artist.join('、') : track.artists

      const [urlInfo, lyricInfo, picInfo] = await Promise.all([
        fetchJson<{ url?: string | null }>(
          `${API_BASE}?types=url&source=${source}&id=${track.id}&br=${bitrate}`,
        ),
        fetchJson<{ lyric?: string | null; tlyric?: string | null }>(
          `${API_BASE}?types=lyric&source=${source}&id=${lyricId}`,
        ),
        fetchJson<{ url?: string }>(`${API_BASE}?types=pic&source=${source}&id=${picId}&size=500`),
      ])

      const rawAudioUrl = urlInfo?.url ?? ''
      if (!isSupportedAudioSource(rawAudioUrl)) {
        throw new Error(INVALID_AUDIO_SOURCE_ERROR)
      }

      const lyrics = mergeLyrics(lyricInfo.lyric, lyricInfo.tlyric)
      const artworkUrl = picInfo.url ?? ('artworkUrl' in track ? track.artworkUrl ?? '' : '')

      const proxiedAudioUrl = proxifyAudioUrl(rawAudioUrl)

      return {
        id: String(track.id),
        title: baseTitle,
        artists: baseArtists,
        album: track.album,
        source,
        artworkUrl,
        audioUrl: proxiedAudioUrl,
        lyrics,
        duration: 'duration' in track ? track.duration : undefined,
        lyricId: lyricId ? String(lyricId) : undefined,
        picId: picId ? String(picId) : undefined,
      }
    },
    [audioQuality],
  )

  const activateTrack = useCallback(
    async (details: TrackDetails, shouldAutoplay: boolean) => {
      currentTrackRef.current = details
      setCurrentTrack(details)

      teardownAudio()
      const audio = new Audio(details.audioUrl)
      audio.crossOrigin = 'anonymous'
      audio.volume = volume
      audioRef.current = audio
      attachAudio(audio, handleAutoAdvance)

      if (shouldAutoplay) {
        await audio.play().catch(() => undefined)
      } else {
        setIsPlaying(false)
      }
    },
    [attachAudio, handleAutoAdvance, teardownAudio, volume],
  )

  const skipAfterInvalidTrack = useCallback(
    (failedIndex: number) => {
      const list = playlistRef.current
      if (!list.length) {
        setIsPlaying(false)
        setIsBuffering(false)
        return
      }

      const play = playTrackRef.current
      if (!play) {
        return
      }

      const shuffleOn = shuffleEnabledRef.current
      const repeatState = repeatModeRef.current
      let nextIndex: number | null = null

      if (shuffleOn && list.length > 1) {
        const options = list.map((_, index) => index).filter((index) => index !== failedIndex)
        if (options.length) {
          nextIndex = options[Math.floor(Math.random() * options.length)]
        }
      } else if (failedIndex + 1 < list.length) {
        nextIndex = failedIndex + 1
      } else if (repeatState === 'all' && list.length > 1) {
        nextIndex = 0
      }

      if (nextIndex === null || nextIndex === failedIndex || nextIndex < 0 || nextIndex >= list.length) {
        setIsPlaying(false)
        setIsBuffering(false)
        return
      }

      const target = list[nextIndex]
      if (!target) {
        setIsPlaying(false)
        setIsBuffering(false)
        return
      }

      const startPlayback = () => {
        play(target, nextIndex).catch(() => undefined)
      }

      if (typeof window !== 'undefined') {
        window.setTimeout(startPlayback, 0)
      } else {
        startPlayback()
      }
    },
    [setIsBuffering, setIsPlaying],
  )

  const playTrack = useCallback(
    async (entry: PlaylistEntry, index: number, shouldAutoplay = true) => {
      setIsLoadingTrack(true)
      setError(null)
      setProgress(0)
      setDuration(0)
      setActiveLyricIndex(0)
      setIsBuffering(true)
      const trackIdentifier = getTrackKey(entry)
      setCurrentTrackId(trackIdentifier)
      activeIndexRef.current = index

      try {
        let details: TrackDetails
        if (entry.audioUrl) {
          details = {
            ...entry,
            audioUrl: entry.audioUrl,
            lyrics: entry.lyrics ?? [],
          }
        } else {
          const hydrated = await buildTrackDetails(entry)
          details = {
            ...entry,
            ...hydrated,
          }
        }

        if (playlistRef.current.length) {
          playlistRef.current = playlistRef.current.map((track, trackIndex) =>
            trackIndex === index ? details : track,
          )
          setPlaylist(playlistRef.current)
        }

        await activateTrack(details, shouldAutoplay)
      } catch (err) {
        const error = err as Error
        if (error?.message === INVALID_AUDIO_SOURCE_ERROR) {
          console.warn('Audio source unavailable, skipping track automatically.', error)
          showNotification('当前歌曲暂无可用播放链接，已自动跳过', 'error')
          skipAfterInvalidTrack(index)
        } else {
          console.error(err)
          setError('载入歌曲时出现问题，请稍后再试。')
        }
      } finally {
        setIsLoadingTrack(false)
        setIsBuffering(false)
      }
    },
    [activateTrack, buildTrackDetails, skipAfterInvalidTrack],
  )

  useEffect(() => {
    playTrackRef.current = playTrack
  }, [playTrack])

  useEffect(() => {
    return () => {
      teardownAudio()
    }
  }, [teardownAudio])

  useEffect(() => {
    return () => {
      if (explorePulseTimeoutRef.current !== null) {
        window.clearTimeout(explorePulseTimeoutRef.current)
        explorePulseTimeoutRef.current = null
      }
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
    () => {
      if (isLowOverhead) {
        return {
          '--dynamic-backdrop': 'none',
          opacity: 1,
          transform: 'none',
        } as CSSProperties
      }

      return {
        '--dynamic-backdrop': displayedBg ? `url(${displayedBg})` : 'none',
        opacity: isBackgroundVisible ? 0.82 : 0,
        transform: isBackgroundVisible ? 'scale3d(1.02, 1.02, 1)' : 'scale3d(1.01, 1.01, 1)',
        backdropFilter: 'blur(18px)',
        willChange: 'transform, opacity',
      } as CSSProperties
    },
    [displayedBg, isBackgroundVisible, isLowOverhead],
  )

  const handleQueryInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value

      if (typeof window === 'undefined') {
        setQuery(nextValue)
        setSearchLimit(SEARCH_PAGE_SIZE)
        setHasMoreResults(false)
        setSearchResults([])
        return
      }

      if (queryInputFrameRef.current !== null) {
        window.cancelAnimationFrame(queryInputFrameRef.current)
      }

      queryInputFrameRef.current = window.requestAnimationFrame(() => {
        setQuery(nextValue)
        setSearchLimit(SEARCH_PAGE_SIZE)
        setHasMoreResults(false)
        setSearchResults([])
        queryInputFrameRef.current = null
      })
    },
    [setHasMoreResults, setQuery, setSearchLimit, setSearchResults],
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
    let audio = audioRef.current

    if (!audio) {
      const track = currentTrackRef.current
      if (!track || !track.audioUrl) {
        return
      }
      audio = new Audio(track.audioUrl)
      audio.crossOrigin = 'anonymous'
      audio.volume = volume
      audioRef.current = audio
      cleanupRef.current?.()
      attachAudio(audio, handleAutoAdvance)
    } else if (!audio.src && currentTrackRef.current?.audioUrl) {
      audio.src = currentTrackRef.current.audioUrl
    }

    if (!audio.src) {
      return
    }

    if (audio.paused) {
      audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [attachAudio, handleAutoAdvance, volume])

  const handleSeek = useCallback((value: number) => {
    const audio = audioRef.current
    if (!audio || !currentTrackRef.current) {
      return
    }
    audio.currentTime = value
    setProgress(value)
  }, [])

  const handleAudioQualityChange = useCallback(
    (selectedQuality: AudioQuality) => {
      setAudioQuality(selectedQuality)
    },
    [setAudioQuality]
  )

  const handleVolumeChange = useCallback((value: number) => {
    setVolume(value)
  }, [])

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
      await playTrack(track, index, true)
    },
    [playTrack],
  )

  const handleClearPlaylist = useCallback(() => {
    if (!playlistRef.current.length) {
      return
    }
    if (!window.confirm('确定要清空播放列表吗？')) {
      return
    }

    teardownAudio()
    playlistRef.current = []
    setPlaylist([])
    setCurrentTrack(null)
    currentTrackRef.current = null
    setCurrentTrackId(null)
    activeIndexRef.current = -1
    setProgress(0)
    setDuration(0)
    setActiveLyricIndex(0)
    setIsPlaying(false)
    setIsBuffering(false)
    window.localStorage.removeItem(STORAGE_KEYS.playlist)
    window.localStorage.removeItem(STORAGE_KEYS.currentTrack)
    window.localStorage.removeItem(STORAGE_KEYS.currentTrackId)
    window.localStorage.removeItem(STORAGE_KEYS.playProgress)
    showNotification('播放列表已清空', 'success')
  }, [teardownAudio])

  const handleDownloadTrack = useCallback(
    async (track: PlaylistEntry, quality: AudioQuality) => {
      setDownloadQuality(quality)
      try {
        const bitrate = QUALITY_TO_BR[quality]
        const source = track.source || DEFAULT_SOURCE
        const urlInfo = await fetchJson<{ url?: string | null }>(
          `${API_BASE}?types=url&id=${track.id}&source=${source}&br=${bitrate}`,
        )
        const rawUrl = urlInfo?.url ?? ''
        if (!isSupportedAudioSource(rawUrl)) {
          showNotification('未找到有效下载链接', 'error')
          return
        }
        const downloadUrl = proxifyAudioUrl(rawUrl)
        showNotification(`开始下载：${track.title}`, 'info')
        if (typeof window !== 'undefined') {
          window.open(downloadUrl, '_blank', 'noopener,noreferrer')
        }
      } catch (error) {
        console.error('Failed to initiate download', error)
        showNotification('未找到有效下载链接', 'error')
      }
    },
    [setDownloadQuality],
  )

  const handleRemoveTrack = useCallback(
    (trackKey: string) => {
      const target = playlistRef.current.find((item) => getTrackKey(item) === trackKey)
      if (!target) {
        return
      }
      if (!window.confirm(`确定要将「${target.title}」从播放列表中移除吗？`)) {
        return
      }

      const nextList = playlistRef.current.filter((item) => getTrackKey(item) !== trackKey)
      playlistRef.current = nextList
      setPlaylist(nextList)

      if (currentTrackRef.current && getTrackKey(currentTrackRef.current) === trackKey) {
        teardownAudio()
        setCurrentTrack(null)
        currentTrackRef.current = null
        setCurrentTrackId(null)
        activeIndexRef.current = -1
        setProgress(0)
        setDuration(0)
        setActiveLyricIndex(0)
        setIsPlaying(false)
        setIsBuffering(false)
        window.localStorage.removeItem(STORAGE_KEYS.currentTrack)
        window.localStorage.removeItem(STORAGE_KEYS.currentTrackId)
        window.localStorage.removeItem(STORAGE_KEYS.playProgress)
      }

      showNotification('已从播放列表移除', 'info')
    },
    [teardownAudio],
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

  const handleExploreClick = useCallback(async () => {
    if (isExploring) {
      return
    }

    setIsExploring(true)
    setError(null)

    if (explorePulseTimeoutRef.current !== null) {
      window.clearTimeout(explorePulseTimeoutRef.current)
      explorePulseTimeoutRef.current = null
    }
    setIsExplorePulsing(true)
    explorePulseTimeoutRef.current = window.setTimeout(() => {
      setIsExplorePulsing(false)
      explorePulseTimeoutRef.current = null
    }, 400)

    try {
      const response = await fetch('/proxy?types=playlist&id=3778678&limit=50&offset=0')
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data = await response.json()
      const rawTracks: Array<Record<string, unknown>> = Array.isArray(data?.tracks)
        ? data.tracks
        : Array.isArray(data?.playlist?.tracks)
          ? data.playlist.tracks
          : []

      if (!rawTracks.length) {
        throw new Error('No tracks received')
      }

      const normalizedResults = rawTracks
        .reduce<SearchResult[]>((acc, track) => {
          const rawId = track?.id ?? track?.trackId
          const resolvedId = rawId !== undefined && rawId !== null ? String(rawId) : ''
          if (!resolvedId.trim()) {
            return acc
          }

          const name = String(track?.name ?? '').trim()
          if (!name) {
            return acc
          }

          const albumInfo = (track?.al ?? track?.album) as Record<string, unknown> | undefined
          const artistArray = (track?.ar ?? track?.artists) as Array<Record<string, unknown>> | undefined

          const result: SearchResult = {
            id: resolvedId,
            name,
            artist:
              artistArray?.map((item) => String(item?.name ?? '')).filter(Boolean) ??
              (track?.artist ? [String(track.artist)] : []),
            album: String(albumInfo?.name ?? ''),
            pic_id: String(
              albumInfo?.pic_str ?? albumInfo?.pic ?? albumInfo?.picId ?? albumInfo?.picUrl ?? '',
            ),
            lyric_id: String(track?.lyric_id ?? track?.lyricId ?? resolvedId),
            source: 'netease',
          }

          acc.push(result)
          return acc
        }, [])
        .slice(0, 50)

      if (!normalizedResults.length) {
        throw new Error('No playable tracks received')
      }

      const baseTracks: PlaylistEntry[] = normalizedResults.map((result) => {
        const matchingRaw = rawTracks.find((item) => {
          const itemId = item?.id ?? item?.trackId
          return String(itemId ?? '') === String(result.id)
        })
        const durationMs = Number(matchingRaw?.dt ?? matchingRaw?.duration ?? 0)
        return {
          id: String(result.id),
          title: result.name,
          artists: result.artist.join('、'),
          album: result.album,
          source: result.source || DEFAULT_SOURCE,
          lyricId: result.lyric_id,
          picId: result.pic_id,
          duration: durationMs > 0 ? Math.round(durationMs / 1000) : undefined,
          lyrics: [],
        }
      })

      playlistRef.current = baseTracks
      setPlaylist(baseTracks)

      showNotification('已更新热门前 50 首歌曲', 'success')
    } catch (err) {
      showNotification('获取热门歌曲失败，请稍后再试', 'error')
      console.error(err)
    } finally {
      setIsExploring(false)
    }
  }, [isExploring])

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
      <Suspense fallback={<p className="lyrics-placeholder">正在载入歌词…</p>}>
        <Lyrics
          lyrics={lyricLines}
          currentIndex={clampedIndex}
          className="mx-auto max-w-2xl"
          scrollContainerRef={lyricsScrollRef}
        />
      </Suspense>
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
    <div
      className="app"
      style={backgroundStyle}
      data-low-overhead={isLowOverhead ? 'true' : undefined}
    >
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
                  <AudioQualityDropdown value={audioQuality} onChange={handleAudioQualityChange} ariaLabel="选择音质" />
                </div>
                <span className="time time-end">{formatTime(progressMax)}</span>
              </div>
            </div>

            <div className="player-controls control-row" role="group" aria-label="播放控制">
              <button
                type="button"
                className={`control-button icon-btn line-toggle shuffle${
                  isPlayerReady && isShuffle ? ' active' : ''
                }`}
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
                className={`control-button icon-btn line-toggle repeat${
                  isPlayerReady && repeatMode !== 'none' ? ' active' : ''
                }`}
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
                      onChange={handleQueryInput}
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
                        const fallbackLetter = track.name?.trim()?.[0]?.toUpperCase() || '?'
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
                              <div className="cover-fallback">{fallbackLetter}</div>
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
                <button
                  type="button"
                  className={`explore-btn${isExploring ? ' is-loading' : ''}${
                    isExplorePulsing ? ' is-pulsing' : ''
                  }`}
                  onClick={handleExploreClick}
                  disabled={isExploring}
                  aria-label="探索热门歌曲"
                  data-tooltip="探索热门歌曲"
                >
                  <Radar aria-hidden="true" size={18} strokeWidth={1.75} />
                </button>
                <SourceDropdown
                  value={searchSource}
                  onChange={(nextSource) => {
                    setSearchSource(nextSource)
                    setSearchLimit(SEARCH_PAGE_SIZE)
                    setHasMoreResults(false)
                    setSearchResults([])
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
                <PlaylistView
                  playlist={playlist}
                  currentTrackId={currentTrackId}
                  downloadQuality={downloadQuality}
                  onSelect={handlePlaylistSelect}
                  onDownload={handleDownloadTrack}
                  onRemove={handleRemoveTrack}
                  onClear={handleClearPlaylist}
                />
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
      <Toaster
        position="top-right"
        gutter={12}
        containerStyle={{
          top: 'calc(env(safe-area-inset-top, 0px) + 24px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 28px)',
        }}
        toastOptions={{
          duration: 2800,
          className: '',
          style: {
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
          },
        }}
      />
    </div>
  )
}

export default App
