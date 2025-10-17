import { useEffect, useRef, useState } from 'react'
import { AUDIO_QUALITY_OPTIONS, type AudioQuality } from './audioQuality'

type AudioQualityDropdownProps = {
  value: AudioQuality
  onChange: (value: AudioQuality) => void
  ariaLabel?: string
}

export default function AudioQualityDropdown({ value, onChange, ariaLabel }: AudioQualityDropdownProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (target && !btnRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const currentIndex = AUDIO_QUALITY_OPTIONS.findIndex((option) => option.value === value)
    const menu = menuRef.current
    const activeItem = currentIndex >= 0 ? menu?.children[currentIndex] : undefined

    if (activeItem instanceof HTMLElement) {
      const { offsetTop } = activeItem
      const menuElement = menuRef.current
      if (menuElement) {
        menuElement.scrollTop = offsetTop - menuElement.clientHeight / 2 + activeItem.clientHeight / 2
      }
    }
  }, [open, value])

  return (
    <div className="source-dd audio-quality-dd">
      <button
        ref={btnRef}
        type="button"
        className="source-dd__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        {AUDIO_QUALITY_OPTIONS.find((option) => option.value === value)?.label ?? '选择音质'}
        <span className="source-dd__caret" aria-hidden="true" />
      </button>
      {open && (
        <div ref={menuRef} className="source-dd__menu" role="listbox" aria-activedescendant={value}>
          {AUDIO_QUALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              id={option.value}
              type="button"
              onClick={() => {
                if (option.value !== value) {
                  onChange(option.value)
                }
                setOpen(false)
              }}
              className={`source-dd__item${option.value === value ? ' is-active' : ''}`}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
