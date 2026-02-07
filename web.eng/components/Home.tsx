import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import Stats from './Stats'
import CopyTiles from './CopyTiles'
import { apiClient } from '../grpcClient'

const Home = () => {

  const navigate = useNavigate()
  const { t } = useTranslation()
  const highlights = [1, 2, 3, 4, 5].map(i => t(`hero.titleHighlight${i}`))
  const [highlightIdx, setHighlightIdx] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightIdx(idx => (idx + 1) % highlights.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [highlights.length])

  useEffect(() => {
    (async () => {
      try {
        const result = await apiClient.health({})
        console.log('API Health:', result)
      } catch (error) {
        console.error('API Health check failed:', error)
      }
    })()
  }, [])

  return (
    <div>
        <br/>
        <br/>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          
          {/* LHS */}
          <div className="flex-1">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
          
                <span style={{ color: 'var(--prism-yellow)' }}>
                  {t('hero.title')}
                </span>
                <span
                  key={highlightIdx}
                  className="block text-primary opacity-0 translate-y-2 animate-fadeinup"
                  style={{ animation: 'fadeinup 0.4s cubic-bezier(0.4,0,0.2,1) 0.1s forwards' }}
                >
                  {highlights[highlightIdx]}
                </span>
              <style>
              {`
              @keyframes fadeinup {
                from { opacity: 0; transform: translateY(0.5rem); }
                to { opacity: 1; transform: translateY(0); }
              }
              `}
              </style>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-lg">
                {t('hero.description')}
              </p>
            </div>
          </div>


          {/* RHS */}
          <div className="hidden lg:block flex-1">
            <Stats />
          </div>
        </div>

        <br/>
        <br/>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            className="btn-primary btn-xl"
            onClick={async () => {
              navigate('/explore')
            }}
          >
            {t('hero.startTrading')}
          </button>
          <button className="btn-outline btn-xl">
            {t('hero.exploreMarkets')}
          </button>
        </div>


      <br/>
      <br/>
      <br/>

      
      <CopyTiles />

      <br/>
      <br/>
      <br/>
      
      
    </div>
  )
}


export default Home
