import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react'
// ✅ Performance optimized automatically by Codex
import LyricLine from './LyricLine'

interface LyricItem {
  text: string
  translation?: string
}

interface LyricsProps {
  lyrics: LyricItem[]
  currentIndex: number
  className?: string
  scrollContainerRef?: RefObject<HTMLDivElement | null> | MutableRefObject<HTMLDivElement | null>
}

const baseContainerClass =
  'relative flex h-full w-full flex-col items-center overflow-hidden text-center'

const LyricsComponent = ({ lyrics, currentIndex, className, scrollContainerRef }: LyricsProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const [hasEnteredBottomZone, setHasEnteredBottomZone] = useState<Record<number, boolean>>({})
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const scrollAnimationRef = useRef<number | null>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const scrollSettledTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        if (scrollAnimationRef.current !== null) {
          window.cancelAnimationFrame(scrollAnimationRef.current)
        }
        if (scrollFrameRef.current !== null) {
          window.cancelAnimationFrame(scrollFrameRef.current)
        }
        if (scrollSettledTimeoutRef.current !== null) {
          window.clearTimeout(scrollSettledTimeoutRef.current)
        }
      }
    }
  }, [])

  useEffect(() => {
    setHasEnteredBottomZone({})
    setIsUserScrolling(false)
  }, [lyrics])

  const smoothScrollTo = useCallback((container: HTMLDivElement, target: number) => {
    if (typeof window === 'undefined') {
      container.scrollTop = target
      return
    }

    if (scrollAnimationRef.current !== null) {
      window.cancelAnimationFrame(scrollAnimationRef.current)
    }

    const start = container.scrollTop
    const distance = target - start

    if (Math.abs(distance) < 0.5) {
      container.scrollTop = target
      scrollAnimationRef.current = null
      return
    }

    const duration = 320
    const startTime = window.performance?.now?.() ?? Date.now()

    const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)

    const step = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      container.scrollTop = start + distance * eased
      if (progress < 1) {
        scrollAnimationRef.current = window.requestAnimationFrame(step)
      } else {
        scrollAnimationRef.current = null
      }
    }

    scrollAnimationRef.current = window.requestAnimationFrame(step)
  }, [])

  const handleScroll = useCallback(() => {
    if (typeof window === 'undefined') {
      setIsUserScrolling(false)
      return
    }

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current)
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      setIsUserScrolling(true)
      if (scrollSettledTimeoutRef.current !== null) {
        window.clearTimeout(scrollSettledTimeoutRef.current)
      }
      scrollSettledTimeoutRef.current = window.setTimeout(() => {
        setIsUserScrolling(false)
        scrollSettledTimeoutRef.current = null
      }, 180)
    })
  }, [])

  useEffect(() => {
    setHasEnteredBottomZone((prev) => {
      if (currentIndex < 0) return prev
      let didChange = false
      const next = { ...prev }
      for (let i = 0; i <= currentIndex; i += 1) {
        if (!next[i]) {
          next[i] = true
          didChange = true
        }
      }
      return didChange ? next : prev
    })
  }, [currentIndex])

  useEffect(() => {
    const container = scrollContainerRef?.current ?? containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        setHasEnteredBottomZone((prev) => {
          const next = { ...prev }
          let hasChanges = false

          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const indexValue = (entry.target as HTMLElement).dataset.index
            const index = indexValue ? Number.parseInt(indexValue, 10) : NaN
            if (Number.isNaN(index)) return
            if (!next[index]) {
              next[index] = true
              hasChanges = true
            }
          })

          return hasChanges ? next : prev
        })
      },
      {
        root: container,
        threshold: 0,
        rootMargin: '-80% 0px 0px 0px',
      }
    )

    lineRefs.current.forEach((node) => {
      if (node) observer.observe(node)
    })

    return () => {
      observer.disconnect()
    }
  }, [lyrics, scrollContainerRef])

  useEffect(() => {
    const container = scrollContainerRef?.current ?? containerRef.current
    if (!container) {
      return
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll, scrollContainerRef])

  const scrollToActiveLine = useCallback(() => {
    if (isUserScrolling) {
      return
    }
    const container = scrollContainerRef?.current ?? containerRef.current
    if (!container) return

    const activeLine = lineRefs.current[currentIndex]
    if (!activeLine) return

    const containerHeight = container.clientHeight
    const activeRect = activeLine.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const activeOffset = activeRect.top - containerRect.top
    const target =
      activeOffset + container.scrollTop - containerHeight / 2 + activeLine.offsetHeight / 2

    smoothScrollTo(container, Math.max(target, 0))
  }, [currentIndex, isUserScrolling, scrollContainerRef, smoothScrollTo])

  useEffect(() => {
    scrollToActiveLine()
  }, [scrollToActiveLine, currentIndex, lyrics])

  const containerClassName = useMemo(() => {
    return [baseContainerClass, className].filter(Boolean).join(' ')
  }, [className])

  const useExternalScroll = Boolean(scrollContainerRef)

  return (
    <div className={containerClassName}>
      <div
        ref={containerRef}
        className="relative flex h-full w-full flex-1 flex-col px-6 py-12"
        style={{
          overflowY: useExternalScroll ? 'visible' : 'auto',
          scrollBehavior: useExternalScroll ? undefined : 'smooth',
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/40 to-transparent" />
        <div className="relative z-0 flex flex-col items-center gap-6 pb-32">
          {lyrics.map((line, index) => {
            const key = `${index}-${line.text}`
            const entered = hasEnteredBottomZone[index] ?? index <= currentIndex
            const isActive = index === currentIndex

            return (
              <LyricLine
                key={key}
                ref={(node) => {
                  lineRefs.current[index] = node
                }}
                lineIndex={index}
                text={line.text}
                translation={line.translation}
                isActive={isActive}
                hasEnteredBottomZone={entered}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default memo(LyricsComponent)
