import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LyricLine from './LyricLine'

interface LyricItem {
  text: string
  translation?: string
}

interface LyricsProps {
  lyrics: LyricItem[]
  currentIndex: number
  className?: string
}

const baseContainerClass =
  'relative flex h-full w-full flex-col items-center overflow-hidden text-center'

const Lyrics = ({ lyrics, currentIndex, className }: LyricsProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const [hasEnteredBottomZone, setHasEnteredBottomZone] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setHasEnteredBottomZone({})
  }, [lyrics])

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
    const container = containerRef.current
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
  }, [lyrics])

  const scrollToActiveLine = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const activeLine = lineRefs.current[currentIndex]
    if (!activeLine) return

    const containerHeight = container.clientHeight
    const activeRect = activeLine.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const activeOffset = activeRect.top - containerRect.top
    const target =
      activeOffset + container.scrollTop - containerHeight / 2 + activeLine.offsetHeight / 2

    container.scrollTo({ top: Math.max(target, 0), behavior: 'smooth' })
  }, [currentIndex])

  useEffect(() => {
    scrollToActiveLine()
  }, [scrollToActiveLine, currentIndex, lyrics])

  const containerClassName = useMemo(() => {
    return [baseContainerClass, className].filter(Boolean).join(' ')
  }, [className])

  return (
    <div className={containerClassName}>
      <div
        ref={containerRef}
        className="relative flex h-full w-full flex-1 flex-col overflow-y-auto px-6 py-12 scroll-smooth"
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

export default Lyrics
