import { useEffect, useRef, useState } from 'react'

export type SourceValue = 'netease' | 'kuwo' | 'joox'

type SourceDropdownProps = {
  value: SourceValue
  onChange: (value: SourceValue) => void
}

const OPTIONS: Array<{ label: string; value: SourceValue }> = [
  { label: '网易云', value: 'netease' },
  { label: '酷我', value: 'kuwo' },
  { label: 'JOOX', value: 'joox' },
]

export default function SourceDropdown({ value, onChange }: SourceDropdownProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (target && !btnRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="source-dd">
      <button
        ref={btnRef}
        type="button"
        className="source-dd__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {OPTIONS.find((option) => option.value === value)?.label ?? '选择音源'}
        <span className="source-dd__caret" aria-hidden="true" />
      </button>
      {open && (
        <div ref={menuRef} className="source-dd__menu" role="listbox" aria-activedescendant={value}>
          {OPTIONS.map((option) => (
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
