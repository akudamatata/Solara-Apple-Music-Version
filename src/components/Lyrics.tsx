import { useEffect, useMemo, useRef, useState } from 'react'
import LyricLine from './LyricLine'

interface LyricsProps {
  lyrics: {
    text: string
    translation?: string
  }[]
  delayStep?: number
  className?: string
}

const Lyrics = ({ lyrics, delayStep = 0.15, className }: LyricsProps) => {
  const [animationCycle, setAnimationCycle] = useState(0)
  const previousLengthRef = useRef(lyrics.length)

  useEffect(() => {
    if (lyrics.length > previousLengthRef.current) {
      setAnimationCycle((cycle) => cycle + 1)
    }
    previousLengthRef.current = lyrics.length
  }, [lyrics.length])

  const firstAnimatedIndex = useMemo(() => {
    const count = Math.min(lyrics.length, 3)
    const startIndex = Math.max(lyrics.length - count, 0)
    return startIndex
  }, [lyrics.length])

  const containerClassName = ['flex w-full flex-col items-center gap-2', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={containerClassName}>
      {lyrics.map((line, index) => {
        const isAnimated = index >= firstAnimatedIndex
        const animationPosition = isAnimated ? index - firstAnimatedIndex : 0
        const isCurrent = index === lyrics.length - 1
        const keyBase = `${index}-${line.text}`
        const key = isAnimated ? `${keyBase}-cycle-${animationCycle}` : keyBase

        return (
          <LyricLine
            key={key}
            text={line.text}
            delay={isAnimated ? animationPosition * delayStep : 0}
            animate={isAnimated}
            className={isCurrent ? 'current' : undefined}
          >
            {line.translation ? (
              <span className="lyrics-translation whitespace-pre-line">{line.translation}</span>
            ) : null}
          </LyricLine>
        )
      })}
    </div>
  )
}

export default Lyrics
