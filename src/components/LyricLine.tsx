import { motion, useAnimationControls } from 'framer-motion'
import { forwardRef, useEffect } from 'react'

export interface LyricLineProps {
  text: string
  translation?: string
  isActive: boolean
  lineIndex: number
  distanceFromActive: number
}

const baseClasses =
  'lyrics-line relative w-full max-w-2xl text-center transition-all duration-500 ease-out will-change-transform'

const LyricLine = forwardRef<HTMLDivElement, LyricLineProps>(
  ({ text, translation, isActive, distanceFromActive, lineIndex }, ref) => {
    const controls = useAnimationControls()

    const getOpacityForDistance = (distance: number) => {
      if (distance <= 0) return 1
      if (distance === 1) return 0.96
      if (distance === 2) return 0.84
      if (distance === 3) return 0.72
      if (distance === 4) return 0.6
      return 0.48
    }

    const targetOpacity = getOpacityForDistance(distanceFromActive)
    const targetScale = isActive ? 1.05 : distanceFromActive === 1 ? 1.01 : 1

    const toneClass = isActive
      ? 'current text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.4)]'
      : distanceFromActive <= 1
      ? 'text-white/90'
      : distanceFromActive === 2
      ? 'text-white/70'
      : distanceFromActive <= 4
      ? 'text-white/60'
      : 'text-white/45'

    useEffect(() => {
      controls.start({
        opacity: targetOpacity,
        scale: targetScale,
        transition: {
          duration: isActive ? 0.3 : 0.45,
          ease: 'easeOut',
        },
      })
    }, [controls, isActive, targetOpacity, targetScale])

    return (
      <motion.div
        ref={ref}
        data-index={lineIndex}
        className={[baseClasses, toneClass]
          .filter(Boolean)
          .join(' ')}
        initial={{ opacity: targetOpacity, scale: targetScale }}
        animate={controls}
      >
        <span className="lyrics-text block whitespace-pre-line text-lg font-medium leading-tight md:text-xl">
          {text}
        </span>
        {translation ? (
          <span className="lyrics-translation mt-2 block whitespace-pre-line text-base text-white/60">
            {translation}
          </span>
        ) : null}
      </motion.div>
    )
  }
)

LyricLine.displayName = 'LyricLine'

export default LyricLine
