import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import i18n from '../i18n/i18n'

const supportedLangs = [
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'ja', label: '🇯🇵 日本語' },
  { code: 'pt', label: '🇧🇷 Português' },
  { code: 'zh', label: '🇨🇳 中文' }
]

const SelectLang = () => {
  const { selectedLang, setSelectedLang } = useNetworkContext()
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

  const currentLang = supportedLangs.find(l => l.code === selectedLang)

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className="lang-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label="Select language"
      >
        <span className="flex items-center gap-2">
          <span>{currentLang?.label.split(' ')[0] || '🌐'}</span>
          <span>{currentLang?.label.split(' ').slice(1).join(' ') || 'Language'}</span>
        </span>
        <ChevronDown 
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} 
        />
      </button>
      
      {open && (
        <ul className="lang-dropdown absolute left-0 top-full mt-1">
          {supportedLangs.map(lang => (
            <li
              key={lang.code}
              className={selectedLang === lang.code ? 'active' : ''}
              onClick={() => {
                setSelectedLang(lang.code)
                setOpen(false)
                document.cookie = `i18next=${lang.code}; path=/; max-age=${30 * 24 * 60 * 60}`
              }}
            >
              <span>{lang.label.split(' ')[0]}</span>
              <span>{lang.label.split(' ').slice(1).join(' ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SelectLang
