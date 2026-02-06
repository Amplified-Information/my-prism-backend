import { useState, useEffect } from 'react'
import { v7 as uuidv7 } from 'uuid'
import { apiClient } from '../grpcClient'
import { useAppContext } from '../AppProvider'
import { bigIntScaledDecimalsToFloat, delay } from '../lib/utils'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router'

const CreateMarket = () => {
  const navigate = useNavigate()
  // const location = useLocation()

  const { signerZero, spenderAllowanceUsd, marketCreationFeeScaledUsdc, usdcNdecimals, setShowPopupAllowance, setSpenderAllowanceUsd } = useAppContext()
  const [statement, setStatement] = useState('')
  const [imageUrl, setImageUrl] = useState(window.location.origin + '/640_480.png')
  const [ isSubmitDisabled, setIsSubmitDisabled ] = useState(true)

  useEffect(() => {
    validateForm()
  }, [signerZero])

  const validateForm = () => {
    if (signerZero && statement.length >= 5 && statement.length <= 500 && imageUrl.length > 0 && imageUrl.length <= 2048 && /^https?:\/\/.+/.test(imageUrl)) {
      setIsSubmitDisabled(false)
    } else {
      setIsSubmitDisabled(true)
    }
  }

  return (
    <>
      {
        /*
        A form to create a new market
        calls api.CreateMarket 
        message NewMarketRequest {market_id, net, statement, image_url }

        I want a nicely styled form with labels and placeholders to do this
        use tailwindccss for styling
        use already defined components where possible
        use css styling (tailwindscss) from index.css as much as possible
        */
      }
      {/* <GrantAllowance open={openPopup} onClose={() => { setOpenPopup(false) }} /> */}

      {typeof signerZero === 'undefined' && (
        <h2>To create a new market, first connect your wallet.</h2>
      )}

      { (spenderAllowanceUsd < marketCreationFeeScaledUsdc / (10 ** usdcNdecimals)) && (
        <>
          <h2>To create a new market, you must deposit at least {(marketCreationFeeScaledUsdc / (10 ** usdcNdecimals)).toFixed(2)} USDC into your account. </h2>

          {/* TODO */}
          <span className="text-blue-600 underline cursor-pointer" title="Click here to deposit" onClick={() => { setShowPopupAllowance(true) }}>Deposit</span>
        </>
      )}

      <div className={`max-w-2xl mx-auto p-6 bg-card rounded-lg shadow-md ${(spenderAllowanceUsd < marketCreationFeeScaledUsdc / (10 ** usdcNdecimals)) || typeof signerZero === 'undefined' ? 'opacity-50 pointer-events-none select-none' : ''}`}>
        To create a new market, simply enter a <span className="text-blue-600 underline cursor-pointer" title="Your statement should be clear, concise and specific. Please make a statement and don't ask a question. Importantly, the statement MUST be publicly verifiable. Ambiguous or unverifiable statements can cause resolution problems and could result in the market resolving in an unexpected way.">publicly verifiable market statement</span> below. 
        
        <br/>
        <br/>

        Additionally, you can optionally include an <span className="text-blue-600 underline cursor-pointer" title="Provide a URL to an image that visually represents the market. Including an image URL is optional, but an image can help users better understand the market. prism.market does not accept image uploads to its servers at this time. We suggest uploading images to IPFS.">image URL</span> to visually represent the market. 
        
        <br/>
        <br/>
        As soon as you submit this form, your market will be created and made available for trading without any censorship.
        
        <br/>
        <br/>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="statement">Market Statement</label>
          <textarea
            className="w-full px-3 py-2 border rounded-lg bg-input text-input-foreground resize-none"
            id="statement"
            name="statement"
            placeholder="The price of HBAR will exceed USD $1 by the end of 2026"
            required
            minLength={5}
            maxLength={500}
            rows={4}
            value={statement}
            onChange={(e) => {
              if (e.target.value.length > 500) return
              setStatement(e.target.value)

              validateForm()
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="image_url">Image URL (optional)</label>
          <input className="w-full px-3 py-2 border rounded-lg bg-input text-input-foreground" type="text" id="image_url" name="image_url"
            placeholder={ window.location.origin + '/640_480.png' }
            value={imageUrl} 
            onChange={(e) => {
              setImageUrl(e.target.value)
              validateForm()
            }} />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1" htmlFor="image_url">Image preview</label>
          <img src={imageUrl} alt="Image preview" />
        </div>

        <br/>
        <br/>
        <br/>

        <button 
          className="btn-primary"
          type="submit"
          disabled={isSubmitDisabled}
          onClick={async () => {
            try {
              setIsSubmitDisabled(true)
              const result = await apiClient.createMarket({
                marketId: uuidv7(),
                net: 'testnet',
                statement,
                imageUrl: imageUrl,
                description: statement // todo - its own description
              })
              const response = result.response
              console.log('CreateMarketResponse', response)

              // CreateMarketResponse includes the remaining allowance in the smart contract response
              // relying on the mirrornode network has too much latency to reflect the new allowance immediately after market creation
              setSpenderAllowanceUsd(bigIntScaledDecimalsToFloat(response.remainingAllowance, usdcNdecimals))

              toast.success(`Market created successfully with marketId: ${response.marketResponse.marketId}`)
              
              await delay(1000)
              navigate(`/market/${response.marketResponse.marketId}`)
              
            } catch (error) {
              console.error('Error creating market:', error)
            } finally {
              setIsSubmitDisabled(false)
            }
          }}
        >
            { isSubmitDisabled ? 'Creating Market...' : 'Create Market' }
            { isSubmitDisabled && <span className="ml-2 spinner-border spinner-border-sm inline-block w-4 h-4 border-2 rounded-full border-white border-t-transparent animate-spin"></span> }
        </button>
      </div>


    </>
  )
}

export default CreateMarket
