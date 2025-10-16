import { AnimatePresence } from 'framer-motion'
import LyricLine from './LyricLine'

interface LyricsProps {
  lyrics: {
    text: string
    translation?: string
  }[]
  delayStep?: number
  className?: string
}

const Lyrics = ({ lyrics, delayStep = 0.3, className }: LyricsProps) => {
  const visibleLyrics = lyrics.slice(-3)
  const offset = lyrics.length - visibleLyrics.length
  const containerClassName = ['flex w-full flex-col items-center gap-2', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={containerClassName}>
      <AnimatePresence initial={false}>
        {visibleLyrics.map((line, index) => {
          const isCurrent = index === visibleLyrics.length - 1
          const keyIndex = offset + index
          return (
            <LyricLine
              key={`${keyIndex}-${line.text}`}
              text={line.text}
              delay={index * delayStep}
              className={isCurrent ? 'current' : undefined}
            >
              {line.translation ? (
                <span className="lyrics-translation whitespace-pre-line">{line.translation}</span>
              ) : null}
            </LyricLine>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default Lyrics
