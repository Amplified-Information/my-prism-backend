import { useEffect, useState } from 'react'
import { ServerStreamingCall } from '@protobuf-ts/runtime-rpc' // Ensure this is the correct library for your project
import { useAppContext } from '../AppProvider'
// import { MarketResponse } from '../gen/api'
import { apiClient, clobClient } from '../grpcClient'
import { PriceUpdate } from '../gen/clob'
import { PredictionIntentRequest } from '../gen/api'
import { defaultPredictionIntentRequest } from '../constants'
import { assemblePayloadHexForSigning, keyTypeToInt } from '../lib/utils'
import { v7 as uuidv7 } from 'uuid'
import { keccak256 } from 'ethers'
import toast from 'react-hot-toast'
import { getSpenderAllowanceUsd } from '../lib/hedera'

const TIMESTAMP_ALLOWED_PAST_SECONDS = 300

const PopupTradePanel = () => {
  const { showPopupTradePanel, setShowPopupTradePanel, marketId, signerZero, userAccountInfo, networkSelected, usdcNdecimals, spenderAllowanceUsd, setSpenderAllowanceUsd, minOrderSizeUsd, usdcTokenIds, smartContractIds } = useAppContext()

  const [thingerSign, setThingerSign] = useState(false)
  const [thingerSubmit, setThingerSubmit] = useState(false)
  // const [isSigned, setIsSigned] = useState(false)

  const [buySell, setBuySell] = useState<'buy' | 'sell'>('buy')
  const [amountUsd, setAmountUsd] = useState(defaultPredictionIntentRequest().qty * defaultPredictionIntentRequest().priceUsd)
  const [marketLimit, setMarketLimit] = useState<'market' | 'limit'>(defaultPredictionIntentRequest().marketLimit as 'market' | 'limit')
  const [priceUsd, setPriceUsd] = useState(defaultPredictionIntentRequest().priceUsd)
  
  const [predictionIntentRequest, setPredictionIntentRequest] = useState<PredictionIntentRequest>({...defaultPredictionIntentRequest(), marketId: marketId})

  const [bidUsd, setBidUsd] = useState<number>(0.50)
  const [askUsd, setAskUsd] = useState<number>(0.50)

  const [isPredictionIntentRequestValid, setIsPredictionIntentRequestValid] = useState<boolean>(false)

  useEffect(() => {
    // one-time price fetch to initialize 'priceUsd'
    (async () => {
      const result = await clobClient.getPrice({ marketId: marketId })
      const priceUpdate = result.response
      setPriceUsd((Math.abs(priceUpdate.priceAskUsd) + priceUpdate.priceBidUsd) / 2)
    })()
  }, [])

  // validate predictionIntentRequest whenever it changes
  useEffect(() => {
    validatePredictionIntentRequest()
  }, [predictionIntentRequest, predictionIntentRequest.sig, buySell, amountUsd, priceUsd, marketLimit, spenderAllowanceUsd])

  // invalidate the signature if any of the inputs change
  useEffect(() => {
    setPredictionIntentRequest({...predictionIntentRequest, sig: '' })
  }, [priceUsd, buySell, amountUsd, marketLimit]) 

  // show/hide the PopupTradePanel
  useEffect(() => {
    console.log('PopupTradePanel mounted for marketId:', marketId)

    if (showPopupTradePanel === false) {
      console.log('DISAPPEAR: PopupTradePanel closing...')
      setThingerSign(false)
      setThingerSubmit(false)
      setIsPredictionIntentRequestValid(false)
    } else {
      console.log('APPEAR: PopupTradePanel opening...')
      // set the current price to the instantaneous price when opening the panel
      // with a fixed decimal precision of 3
      setPriceUsd(Number(((bidUsd + Math.abs(askUsd)) / 2).toFixed(3)))
    }
  }, [marketId, showPopupTradePanel])

  // stream the price:
  useEffect(() => {
    const ac = new AbortController()

    async function startStream() {
      console.log('startStream (streamPrice) called for marketId:', marketId)
      let call: ServerStreamingCall | undefined
      try {
        call = clobClient.streamPrice(
          { 
            marketId: marketId
         },
          { signal: ac.signal, abort: ac.signal }  // RpcOptions
        )

        for await (const msg of call.responses) {
          if (ac.signal.aborted) {
            console.log('Stream aborted')
            return
          }
          console.log('msg', msg)
          setBidUsd((msg as PriceUpdate).priceBidUsd)
          setAskUsd((msg as PriceUpdate).priceAskUsd)
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          console.error('streamPrice error:', err)
        } else {
          console.log('Stream aborted due to controller signal')
        }
      } finally {
        console.log('finally')
        console.info(call)
      }
    }

    if (showPopupTradePanel) { // only start stream if panel is shown!
      startStream()
    }

    return () => {
      console.log('Aborting price stream for marketId:', marketId)
      ac.abort() // cancels the stream on unmount
    }
  }, [showPopupTradePanel])

  const generatePredictionIntentObject = (_predictionIntentRequest: PredictionIntentRequest): PredictionIntentRequest => {
    // TODO - more guards
    // apply guards
    // signerZero
    // userAccountInfo 

    if (typeof signerZero === 'undefined' || !signerZero) {
      console.warn('generatePredictionIntentObject: signerZero is undefined')
      return _predictionIntentRequest
    }

    return {
      ..._predictionIntentRequest,
      accountId: signerZero!.getAccountId().toString() || '0.0.1',
      evmAddress: userAccountInfo.evm_address.slice(2), // remove '0x' prefix
      generatedAt: new Date().toISOString(),
      keyType: keyTypeToInt(userAccountInfo.key._type),
      marketId: marketId,
      net: networkSelected.toString().toLowerCase(),
      priceUsd: buySell === 'buy' ? priceUsd : 0 - priceUsd,
      publicKey: userAccountInfo.key.key,
      qty: buySell === 'buy' ? amountUsd / priceUsd : amountUsd /  (1 - priceUsd), // N.B.
      sig: '',
      txId: uuidv7()
    }
  }

  const validatePredictionIntentRequest = (): boolean => {
    if (
      predictionIntentRequest.sig.length === 0 ||
      !predictionIntentRequest.generatedAt ||
      ((Date.now() - new Date(predictionIntentRequest.generatedAt).getTime()) / 1000 > TIMESTAMP_ALLOWED_PAST_SECONDS) ||
      (predictionIntentRequest.priceUsd * predictionIntentRequest.qty) > spenderAllowanceUsd
      // TODO - more validations
    ) {
      console.log('INVALID predictionIntentRequest')
      console.log(predictionIntentRequest)
      setIsPredictionIntentRequestValid(false)
      return false
    }
    console.log('VALID predictionIntentRequest')
    console.log(predictionIntentRequest)
    setIsPredictionIntentRequestValid(true)
    return true
  }

  if (!showPopupTradePanel) {
    return null 
  }

  return (
    <div
      className="fixed inset-0 z-1002 flex items-start justify-end"
      tabIndex={-1}
      onKeyDown={e => {
      if (e.key === 'Escape') setShowPopupTradePanel(false)
      }}
    >
      {/* Backdrop */}
      <div
      className="fixed inset-0 bg-opacity-40"
      onClick={() => setShowPopupTradePanel(false)}
      aria-label="Close trade panel"
      />

      {/* Panel */}
      <div
      className="relative h-full bg-gray-900 border-l border-gray-800 p-6 shadow-lg w-full sm:w-96 transition-all duration-300"
      style={{ outline: 'none' }}
      onClick={e => e.stopPropagation()}
      >
      <button
        className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl cursor-pointer"
        onClick={() => setShowPopupTradePanel(false)}
        aria-label="Close"
      >
        X
      </button>

      <div className="flex items-center mb-2">
        <label className="flex items-center mr-4 cursor-pointer">
          <input
            type="radio"
            name="tradeType"
            value='buy'
            className="hidden peer"
            defaultChecked
            onClick={() => {
              // buy order is indicated by positive priceUsd
              setBuySell('buy')
            }}
          />
          <span className="px-3 py-1 rounded-l border border-gray-600 bg-gray-800 text-white peer-checked:bg-green-700 peer-checked:border-green-400 transition-colors">
            YES
          </span>
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            name="tradeType"
            value='sell'
            className="hidden peer"
             onClick={() => {
              setBuySell('sell')
            }}
          />
          <span className="px-3 py-1 rounded-r border border-gray-600 bg-gray-800 text-white peer-checked:bg-red-700 peer-checked:border-red-400 transition-colors">
            NO
          </span>
        </label>
        &nbsp;&nbsp; ${bidUsd.toFixed(2)} | ${Math.abs(askUsd).toFixed(2)}
      </div>

      <label>USD size of position:</label>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span>$</span><input type="number" value={amountUsd.toFixed(2)} placeholder="Amount" className="input input-bordered w-full"
          onChange={(e) => {
            // guards
            const _amountUsd = Number(e.currentTarget.value)
            // attempt to place order above allowance:
            if (_amountUsd > spenderAllowanceUsd) {
              toast.error(`Order size exceeds your current allowance of $${spenderAllowanceUsd.toFixed(2)}`)
            }
            if (_amountUsd < minOrderSizeUsd) {
              toast.error(`Minimum order amount is $${minOrderSizeUsd.toFixed(2)}`)
              return
            }
            // OK
            setAmountUsd(_amountUsd)
          }}
        />
      </div>

      {/* limit order by default - disabling market order for now */}
      <div className="flex items-center mb-2">
        <label className="flex items-center mr-4 cursor-pointer">
        <input
          type="radio"
          name="orderType"
          className="hidden peer"
          checked={marketLimit === 'market'}
          value='market'
          onClick={(e) => {
            console.log(e.currentTarget.value)
            // setMarketLimit('market')
            toast.success('Market orders are not currently available. Please use Limit orders.')
          }}
          onChange={() => {}}
        />
        <span className="px-3 py-1 rounded-l border border-gray-600 bg-gray-800 text-white peer-checked:bg-blue-700 peer-checked:border-blue-400 transition-colors">
          Market Order
        </span>
        </label>
        <label className="flex items-center cursor-pointer">
        <input
          type="radio"
          name="orderType"
          className="hidden peer"
          value='limit'
          checked={marketLimit === 'limit'}
          onClick={(e) => {
            console.log(e.currentTarget.value)
            setMarketLimit('limit')
          }}
          onChange={() => {}}
        />
        <span className="px-3 py-1 rounded-r border border-gray-600 bg-gray-800 text-white peer-checked:bg-purple-700 peer-checked:border-purple-400 transition-colors">
          Limit Order
        </span>
        </label>
      </div>
      
      {marketLimit === 'limit' && (
        <>
        <label>Price</label>
        <input
          type="number"
          value={priceUsd}
          min={0.00}
          max={1.00}
          step={0.01}
          placeholder="Price"
          className="input input-bordered w-full mb-2"
          onChange={(e) => {
            // guards
            const _priceUsd = Number(e.currentTarget.value)

            // priceUsd must be between 0.00 and 1.00
            if (_priceUsd < 0 || _priceUsd > 1) {
              toast.error('Price must be between $0.00 and $1.00')
              return
            }
            
            // OK
            setPriceUsd(_priceUsd)
          }}
        />
        </>
      )}

      {!isPredictionIntentRequestValid && (
        <button 
          className="btn-orange" 
          disabled={thingerSign || thingerSubmit}
          onClick={async () => {
            console.log('Signing OrderIntent...')
            try {
              setThingerSign(true)
              
              const _predictionIntentRequest = generatePredictionIntentObject(predictionIntentRequest)
              // setPredictionIntentRequest(_predictionIntentRequest)

              const packedHex = assemblePayloadHexForSigning(_predictionIntentRequest, usdcNdecimals)
              console.log(`packedHex: ${packedHex}`)
              const packedKeccakHex = keccak256(Buffer.from(packedHex, 'hex')).slice(2)
              console.log(`packedKeccakHex (len=${Buffer.from(packedKeccakHex, 'hex').length}): ${packedKeccakHex}`)
              console.log('verify at: https://emn178.github.io/online-tools/keccak_256.html')
              
              const msgToSign64 = Buffer.from(packedKeccakHex, 'hex').toString('base64')
              console.log(`msgToSign (base64) (len=${msgToSign64.length}): ${msgToSign64}`)
              // console.log(`packedKeccakHex (len=${Buffer.from(packedKeccakHex, 'hex').length}): ${packedKeccakHex}`)
              const sigHex = (await signerZero!.sign([Buffer.from(packedKeccakHex, 'hex')], { encoding: 'base64' }))[0].signature
              console.log(`sig (hex) (len=${sigHex.length}): ${Buffer.from(sigHex).toString('hex')}`)
              console.log(`sig (base64): ${Buffer.from(sigHex).toString('base64')}`)
              
              const signedObj = { ..._predictionIntentRequest, sig: Buffer.from(sigHex).toString('base64') }
              setPredictionIntentRequest(signedObj)
              console.log('predictionIntentRequest (signed):', signedObj)
              
            } catch (e) {
            console.error(e)
            } finally {
              setThingerSign(false)
            }
          }
        }>Sign{thingerSign ? 'ing ...' : ''}</button>
      )}
      
      {isPredictionIntentRequestValid && (
        <div className="ml-0 text-sm" title={`Signed by ${predictionIntentRequest.accountId}. Signature: ${predictionIntentRequest.sig}`}>
         Transaction is signed ✅
         <br/><br/>
        </div>
      )}

      {isPredictionIntentRequestValid && (
        <button
          className="btn-primary"
          disabled={
            thingerSign ||
            thingerSubmit
          }
          onClick={async () => {
            setThingerSubmit(true)
            try {
              console.log('Submitting predictionOrderIntentRequest...')
              console.log(predictionIntentRequest)
              console.log('qty*priceUsd' ,predictionIntentRequest.qty * predictionIntentRequest.priceUsd)

              const result = await apiClient.createPredictionIntent(predictionIntentRequest)
              console.log('PredictIntent response:', result)
            } catch (e) {
              console.error(e)
            } finally {
              setThingerSubmit(false)
              setIsPredictionIntentRequestValid(false) // duplicate tx prevention

              // update spender allowance after spending:
              // Note: delay!!!
              const _spenderAllowance = await getSpenderAllowanceUsd(networkSelected, usdcTokenIds, usdcNdecimals, smartContractIds[networkSelected.toString().toLowerCase()], signerZero!.getAccountId().toString())
              setSpenderAllowanceUsd(_spenderAllowance)
            }
          }}
        >
          Submit{thingerSubmit ? 'ing ...' : ''}
        </button>
      )}
      </div>
    </div>
  )
}

export default PopupTradePanel
