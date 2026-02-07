import { useAppContext } from '../AppProvider'

const Stats = () => {
  const { nMarkets, tvlUsd, totalVolumeUsd } = useAppContext()
  return (
    <>
      <div style={{
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center',
        marginTop: '1rem'
      }}>
        {[
          { label: '# markets', value: nMarkets },
          { label: 'TVL', value: `$${tvlUsd.toFixed(2)}` },
          { label: '24h Volume', value: `$${totalVolumeUsd['24h']?.toFixed(2) ?? '0.00'}` }
        ].map((stat, i) => (
              <div
              key={i}
              style={{
                background: 'transparent',
                color: 'white',
                borderRadius: '0rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                borderColor: 'var(--prism-yellow)',
                borderWidth: '1px',
                borderStyle: 'solid',
                padding: '1rem 2rem',
                minWidth: '120px',
                textAlign: 'center',
                transition: 'transform 0.2s',
                cursor: 'pointer',
                flex: '1 1 180px', // allow wrapping and min width
                margin: 0
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
              <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1rem' }}>
                {stat.value}
              </div>
              </div>
        ))}
      </div>
    </>
  )
}

export default Stats
