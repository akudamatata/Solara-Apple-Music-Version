import { motion, useAnimationControls } from 'framer-motion'
import { forwardRef, useEffect } from 'react'

export interface LyricLineProps {
  text: string
  translation?: string
  isActive: boolean
  hasEnteredBottomZone: boolean
  lineIndex: number
}

const baseClasses =
  'lyrics-line relative w-full max-w-2xl text-center transition-all duration-500 ease-out will-change-transform'

const LyricLine = forwardRef<HTMLDivElement, LyricLineProps>(
  ({ text, translation, isActive, hasEnteredBottomZone, lineIndex }, ref) => {
    const controls = useAnimationControls()

    const targetOpacity = isActive || hasEnteredBottomZone ? 1 : 0.4
    const targetScale = isActive ? 1.04 : 1

    useEffect(() => {
      controls.start({
        opacity: targetOpacity,
        scale: targetScale,
        transition: {
          duration: isActive ? 0.35 : hasEnteredBottomZone ? 0.8 : 0.3,
          ease: 'easeOut',
        },
      })
    }, [controls, hasEnteredBottomZone, isActive, targetOpacity, targetScale])

    return (
      <motion.div
        ref={ref}
        data-index={lineIndex}
        className={[
          baseClasses,
          isActive
            ? 'current text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.4)]'
            : 'text-white/80',
        ]
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
