import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import Stats from './Stats';
import CopyTiles from './CopyTiles';
import thriveLogo from '../src/assets/thrive-logo.png';

const Home = () => {
  const navigate = useNavigate();
  const {
    t
  } = useTranslation();
  const highlights = [1, 2, 3, 4, 5].map(i => t(`hero.titleHighlight${i}`));
  const [highlightIdx, setHighlightIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightIdx(idx => (idx + 1) % highlights.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [highlights.length]);
  return <div className="space-y-12">
      {/* Hero Section */}
      <div>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-12">
          {/* LHS */}
          <div className="flex-1 space-y-6 max-w-[43.56rem]">
            <h1 className="font-bold tracking-tight leading-tight font-sans">
              <span className="text-slate-50 block whitespace-nowrap" style={{ fontSize: 'clamp(2.4rem, 6vw, 4.8rem)' }}>
                {t('hero.title')}
              </span>
              <span key={highlightIdx} className="block text-primary animate-fadeinup whitespace-nowrap" style={{ fontSize: 'clamp(0.88rem, 4vw, 3.2rem)' }}>
                {highlights[highlightIdx]}
              </span>
            </h1>
            
            <p className="text-lg lg:text-xl text-muted-foreground max-w-lg leading-relaxed">
              {t('hero.description')}
            </p>
          </div>

          {/* RHS - Stats on large screens */}
          <div className="hidden lg:block flex-1">
            <Stats />
          </div>
        </div>

        {/* Stats on mobile/tablet - below hero */}
        <div className="block lg:hidden mt-8">
          <Stats />
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-10">
          <button className="btn-primary btn-lg" onClick={() => navigate('/explore')}>
            {t('hero.startTrading')}
          </button>
          <button className="btn-outline btn-lg" onClick={() => navigate('/explore')}>
            {t('hero.exploreMarkets')}
          </button>
        </div>
      </div>

      {/* Copy Tiles */}
      <CopyTiles />

      {/* Sponsor Section */}
      <section className="relative overflow-hidden rounded-2xl bg-transparent mb-12">
        <div className="flex flex-col items-center justify-center gap-5 text-center">
          <span className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Supported by</span>
          <img src={thriveLogo} alt="Thrive" className="h-16 md:h-20 object-contain" loading="lazy" />
        </div>
      </section>
    </div>;

};
export default Home;