import { useState, useRef, useEffect } from 'react'
import { useAppContext } from '../AppProvider'
import i18n from '../i18n/i18n'

const supportedLangs = [
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'ja', label: '🇯🇵 日本語' },
  { code: 'pt', label: '🇧🇷 Português' }, // Changed to Brazilian flag
  { code: 'zh', label: '🇨🇳 中文' }
]

const SelectLang = () => {

  const { selectedLang, setSelectedLang } = useAppContext()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cookieLang = document.cookie.split('; ').find(row => row.startsWith('i18next='))
    if (cookieLang) {
      const langCode = cookieLang.split('=')[1]
      if (langCode && langCode !== selectedLang) {
        setSelectedLang(langCode)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedLang && i18n.language !== selectedLang) {
      i18n.changeLanguage(selectedLang)
    }
  }, [selectedLang])
  

  // Hide dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div
      ref={dropdownRef}
      style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}
    >
      <span
        style={{ fontSize: '1rem', minWidth: 24, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
        tabIndex={0}
        role="button"
        aria-label="Select language"
      >
        {selectedLang ? supportedLangs.find(l => l.code === selectedLang)?.label.split(' ')[0] : '🌐'}
      </span>
      {open && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            position: 'absolute',
            left: 32,
            top: 0,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: 6,
            boxShadow: '0 1px 8px rgba(0,0,0,0.12)',
            zIndex: 9999, // Increased z-index
            minWidth: 100
          }}
        >
          {supportedLangs.map(lang => (
            <li
              key={lang.code}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                background: selectedLang === lang.code ? '#f0f0f0' : 'white',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.95rem',
                color: '#222' // Ensure text is visible on white
              }}
              onClick={() => {
                setSelectedLang(lang.code)
                setOpen(false)

                // set a cookie to remember language preference for 30 days
                document.cookie = `i18next=${lang.code}; path=/; max-age=${30 * 24 * 60 * 60}`
              }}
            >
              <span style={{ fontSize: '1rem' }}>{lang.label.split(' ')[0]}</span>
              <span style={{ fontSize: '0.95rem' }}>{lang.label.split(' ').slice(1).join(' ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SelectLang
