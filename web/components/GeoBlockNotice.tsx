import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

interface Props {
  country: string | null
}

const GeoBlockNotice = ({ country }: Props) => {
  const { t } = useTranslation()

  return (
    <div className="relative z-10 px-4 md:px-8 lg:px-24">
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-xl w-full rounded-2xl border border-border bg-card/80 backdrop-blur p-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/40">
            <Globe className="h-6 w-6 text-muted-foreground" />
          </div>

          <h1 className="text-2xl font-semibold text-card-foreground">
            {t('geoBlock.title')}
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            {country
              ? t('geoBlock.detected', { country })
              : t('geoBlock.description')}
          </p>

          <p className="mt-2 text-sm text-muted-foreground">
            {t('geoBlock.description')}
          </p>

          <Link
            to="/contact"
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm text-card-foreground transition-colors hover:bg-muted/40"
          >
            {t('geoBlock.contact')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default GeoBlockNotice
