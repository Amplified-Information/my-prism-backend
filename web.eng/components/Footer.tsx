import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

const Footer = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <footer className="py-8 border-t border-gray-200 dark:border-gray-700 text-muted-foreground opacity-60">
      <div className="container mx-auto px-4 text-center text-sm sm:text-sm text-xs">
      <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4">
        <span className="whitespace-nowrap">© {`${new Date().getFullYear()}`} Prism Market. {t('footer.copyright')}</span>
        <span className="text-border hidden sm:inline">•</span>
        <button
        onClick={() => navigate('/terms')}
        className="hover:underline bg-transparent border-none p-0 m-0 text-inherit cursor-pointer whitespace-nowrap"
        >
        {t('footer.termsOfService')}
        </button>
        <span className="text-border hidden sm:inline">•</span>
        <button
        onClick={() => navigate('/privacy')}
        className="hover:underline bg-transparent border-none p-0 m-0 text-inherit cursor-pointer whitespace-nowrap"
        >
        {t('footer.privacyPolicy')}
        </button>
        <span className="text-border hidden sm:inline">•</span>
        <button
        onClick={() => navigate('/contact')}
        className="hover:underline bg-transparent border-none p-0 m-0 text-inherit cursor-pointer whitespace-nowrap"
        >
        {t('footer.contactUs')}
        </button>
      </div>
      <div className="mt-4 text-xs sm:text-sm">
        <span>
        Built with ❤️ by{' '}
        <a
          href="https://prism.market"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Prism Market Labs
        </a>
        </span>
      </div>
      </div>
    </footer>
  )
}

export default Footer
