import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export interface LyricLineProps {
  text: string
  delay?: number
  children?: ReactNode
  className?: string
}

const LyricLine = ({ text, delay = 0, className, children }: LyricLineProps) => {
  const combinedClassName = ['lyrics-line text-white/80', className]
    .filter(Boolean)
    .join(' ')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 1.5, delay }}
      className={combinedClassName}
    >
      <span className="lyrics-text whitespace-pre-line">{text}</span>
      {children}
    </motion.div>
  )
}

export default LyricLine
