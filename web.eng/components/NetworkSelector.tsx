import { useAppContext } from '../AppProvider'
import { useState } from 'react'

const NetworkSelector = () => {
  const { signerZero, networkSelected, setNetworkSelected, availableNetworks  } = useAppContext()
  const [networkMenuOpen, setNetworkMenuOpen] = useState(false)

  return (
    <div className="absolute right-8 top-full z-20">
      <div className="relative inline-block">
        <span
          className="inline-block px-4 py-3 rounded-b-md bg-gray-800 text-white text-xs shadow border border-t-0 border-gray-500 cursor-pointer"
          style={{ borderColor: `${networkSelected.isTestnet() ? 'orange' : networkSelected.isPreviewnet() ? 'purple' : ''}` }}
          onClick={
            () => setNetworkMenuOpen((open) => !open)
          }
        >
          {signerZero?.getAccountId().toString()}
          { signerZero && (<> &nbsp;&nbsp;&nbsp; </>) }
          {networkSelected.toString()}
        </span>
        
        {networkMenuOpen && (
          <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-300 rounded shadow z-30">
            {availableNetworks.map((network) => (
              <div
                key={network._ledgerId.toString()}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-gray-900 text-xs"
                onClick={() => {
                  setNetworkSelected(network)
                  setNetworkMenuOpen(false)
                }}
              >
                {network.toString()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NetworkSelector
