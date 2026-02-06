import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import de from './locales/de/common.json'
import en from './locales/en/common.json'
import es from './locales/es/common.json'
import fr from './locales/fr/common.json'
import ja from './locales/ja/common.json'
import pt from './locales/pt/common.json'
import zh from './locales/zh/common.json'

const resources = {
  de: { translation: de },
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  ja: { translation: ja },
  pt: { translation: pt },
  zh: { translation: zh }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    }
  })

export default i18n
