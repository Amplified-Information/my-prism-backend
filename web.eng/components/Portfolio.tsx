import { useAppContext } from '../AppProvider'

const Portfolio = () => {
  const { userPortfolio, usdcNdecimals } = useAppContext()
  
  return (
    <div>
      <h1>Portfolio</h1>
      liquidated value: <a className='text-blue-500 cursor-pointer'>
        ${(Object.values(userPortfolio.positions).reduce((acc, pos) => {
          return (
            acc +
            Number(pos.yes) * pos.priceUsd +
            Number(pos.no) * (1 - pos.priceUsd)
          )
        }, 0) * ( 1 / 10 ** usdcNdecimals)).toFixed(2) }
        </a>

        {Object.values(userPortfolio.positions).map((pos, idx) => {
          return (
            <>
              <div key={idx} className="border p-4 my-2 rounded-lg bg-card">
                <h2>{Object.keys(userPortfolio.positions)[idx]}</h2>
                <div className="flex justify-between items-center">
                  <span>Yes Positions:</span>
                  <span className="font-mono font-semibold text-green-600">
                    ${(Number(pos.yes) / (10 ** usdcNdecimals)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>No Positions:</span>
                  <span className="font-mono font-semibold text-red-600">
                  ${(Number(pos.no) / (10 ** usdcNdecimals)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Current Price:</span>
                  <span className="font-mono">
                  ${(pos.priceUsd).toFixed(2)}
                  </span>
                </div>
              </div>  
            </>
          )
        })}
            
    </div>
  )
}

export default Portfolio