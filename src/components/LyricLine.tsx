import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export interface LyricLineProps {
  text: string
  delay?: number
  children?: ReactNode
  className?: string
  animate?: boolean
}

const LyricLine = ({ text, delay = 0, className, children, animate = false }: LyricLineProps) => {
  const combinedClassName = ['lyrics-line text-white/80', className]
    .filter(Boolean)
    .join(' ')

  if (!animate) {
    return (
      <div className={combinedClassName}>
        <span className="lyrics-text whitespace-pre-line">{text}</span>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      className={combinedClassName}
    >
      <span className="lyrics-text whitespace-pre-line">{text}</span>
      {children}
    </motion.div>
  )
}

export default LyricLine
