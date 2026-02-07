import { DAppConnector, HederaChainId, HederaJsonRpcMethod, HederaSessionEvent } from '@hashgraph/hedera-wallet-connect'
import { walletConnectProjectId, walletMetaData } from '../constants'
import { useEffect, useState } from 'react'
import { useAppContext } from '../AppProvider'
import { getUserAccountInfo } from '../lib/hedera'

const Wallet = () => {
  const { dAppConnector, setDappConnector, networkSelected, signerZero, setSignerZero, setUserAccountInfo } = useAppContext()
  const [ thinger, setThinger ] = useState(false)

  useEffect(() => {
    ;(async () => {
      const _dAppConnector = await initDAppConnector()
      await searchExistingSignerAndConnect(_dAppConnector)
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      await searchExistingSignerAndConnect(dAppConnector)
    })()
  }, [networkSelected])

  useEffect(() => {
    ;(async () => {
      await searchExistingSignerAndConnect(dAppConnector)
    })()
  }, [])

  useEffect(() => {
    if (signerZero === undefined) return
    ;(async () => {
      console.log('Fetching user account info for signerZero...')
      const uai = await getUserAccountInfo(networkSelected, signerZero.getAccountId().toString())
      console.log('user account info:', uai)
      setUserAccountInfo(uai)
    })()
  }, [networkSelected, signerZero])

  const initDAppConnector = async () => {
    // https://www.npmjs.com/package/@hashgraph/hedera-wallet-connect
    const _dAppConnector = new DAppConnector(
      walletMetaData,
      networkSelected,
      walletConnectProjectId,
      Object.values(HederaJsonRpcMethod),
      [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
      [HederaChainId.Mainnet, HederaChainId.Testnet, HederaChainId.Previewnet]
    )

    setDappConnector(_dAppConnector)
    try {
      await _dAppConnector.init()
    } catch (error) {
      console.warn('Warn when initializing dAppConnector:', error)
    }
    return _dAppConnector
  }

  const disconnect = async () => {
    setThinger(true)
    try {
      await dAppConnector!.disconnectAll()
    } catch (error) {
      console.error('Error disconnecting wallet:', error)
    } finally {
      setSignerZero(undefined)
      setDappConnector(undefined)
      setThinger(false)
    }
  }

  const connect = async () => {
    setThinger(true)
    const _dAppConnector = await initDAppConnector()
    try {
      const _signerZero = _dAppConnector!.signers.find(signer => signer.getLedgerId() === networkSelected) // find first signer on the selected network
      if (!_signerZero) {
        // this can take the user several seconds to complete the flow...
        const walletObj = await _dAppConnector!.openModal(undefined /* yes, undefined - a bit messy */, true) // true: reject if user does not fully complete the flow...
        console.log('walletObj:')
        console.log(walletObj)
      } else {
        console.log(`Already have a connected signer for ${networkSelected.toString()}: ${_signerZero.getAccountId().toString()}`)
      }
    } catch (error) {
      console.error('Error initializing dAppConnector:', error)
    } finally {
      await searchExistingSignerAndConnect(_dAppConnector)
      setThinger(false)
    }
  }

  const searchExistingSignerAndConnect = async (_dAppConnector: DAppConnector | undefined) => {
    try {
      if (typeof _dAppConnector === 'undefined') {
        console.log('_dAppConnector still undefined') // TODO - is this why the tab keeps popping up?
        return
      }

      console.log('Available sessions:')
      console.log(_dAppConnector!.signers)
      const _signerZero = _dAppConnector!.signers.find(signer => { console.log(signer.getLedgerId().toString()); return signer.getLedgerId().toString() === networkSelected.toString() } ) // find first signer on the selected network
      if (!_signerZero) {
        console.log(`No connected signer found for network ${networkSelected.toString()}`)
        setSignerZero(undefined)
      } else {
        setSignerZero(_signerZero)
        console.log(`signerZero set to ${_signerZero.getAccountId().toString()} for network ${networkSelected.toString()}`)
      }
    } catch (e) {
      console.error('searchExistingSignerAndConnect: ', JSON.stringify(e))
    }
  }

  return (
    <div className="flex items-center gap-2 ml-auto">
      {/* <NetworkSelector /> */}
      { signerZero === undefined ? (
        <>
          <button className='btn-primary' title='Connect wallet' disabled={thinger} 
            onClick={async () => { 
              /* dAppConnector.connect(() => {
                console.log('Connected callback from dAppConnector')
              })*/
              await connect() 
            }}>
            {thinger ? 'Connecting...' : 'Connect'}
          </button>
        </>
      ) : (
        <>
          {/* <span>{signerZero.getLedgerId().toString()}</span> */}
          <button className='btn-primary' title='Disconnect wallet' onClick={async () => { await disconnect() }}>
            {thinger ? 'Disconnecting...' : 
              <>
                Disconnect
              </>
            }
          </button>
        </>
      )}
    </div>
  )
}

export default Wallet
