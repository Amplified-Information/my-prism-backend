import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppContext } from '../AppProvider'
import { grantAllowanceUsd } from '../lib/hedera'
import toast from 'react-hot-toast'

const PopupAllowance = () => {
  const [ amountUsd, setAmountUsd ] = useState<number>(0.00)
  const { signerZero, spenderAllowanceUsd, usdcTokenIds, setSpenderAllowanceUsd, smartContractIds, networkSelected, showPopupAllowance, setShowPopupAllowance, usdcNdecimals } = useAppContext()
  const [ thinger, setThinger ] = useState(false)
  const [ smartContractId, setSmartContractId ] = useState<string>('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowPopupAllowance(false)
      }
    }
    if (showPopupAllowance) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showPopupAllowance])

  useEffect(() => {
    setSmartContractId(smartContractIds[networkSelected.toString().toLowerCase()] || '')
  }, [smartContractIds, networkSelected])

  if (!showPopupAllowance) return null
  return createPortal(
    <div className='fixed inset-0 z-1003 flex items-center justify-center'>
      <div className='absolute inset-0 bg-black/90' onClick={() => setShowPopupAllowance(false)}></div>
      <div className='relative rounded-lg shadow-lg p-6 max-w-lg w-full z-10'>
        <button
          className="absolute top-2 right-2 text-white text-xxl font-bold cursor-pointer hover:text-gray-300"
          onClick={() => setShowPopupAllowance(false)}
          aria-label="Close"
        >X</button>
        
        Provide an allowance
        <br />
        <br />

        <div className="mt-3 text-sm text-gray-600">
          <div className="space-2">
            <div className="flex justify-between">
              <span>Current allowance granted to {smartContractId}</span>
              <span>${spenderAllowanceUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Add this amount</span>
              <span>${amountUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>New allowance</span>
              <span>${(amountUsd + spenderAllowanceUsd).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <br />

        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Amount (USD)</label>
          <input
            className="ml-4 w-28 text-right border rounded px-2 py-1"
            value={amountUsd.toFixed(2)}
            onChange={(e) => setAmountUsd(Number(e.target.value))}
            max={spenderAllowanceUsd}
            type="number"
            min={0}
            step="0.01"
          />
        </div>

        <div className="flex justify-end">
          <button className='btn-outline' disabled={thinger} onClick={async () => {
          setThinger(true)
          const wasSuccessful = await grantAllowanceUsd(signerZero!, usdcTokenIds, usdcNdecimals, smartContractId, 0)
          if (wasSuccessful) {
            setSpenderAllowanceUsd(0)
            toast.success(`Allowance successfully removed from ${smartContractId}`)
          }
          setThinger(false)
          }}>Remove Allowance</button>
          &nbsp;
          <button className='btn-primary' disabled={thinger} onClick={async () => {
            setThinger(true)
            const wasSuccessful = await grantAllowanceUsd(signerZero!, usdcTokenIds, usdcNdecimals, smartContractId, spenderAllowanceUsd + amountUsd)
            if (wasSuccessful) {
              setSpenderAllowanceUsd(spenderAllowanceUsd + amountUsd)
              setShowPopupAllowance(false)
              toast.success(`Allowance of $${(spenderAllowanceUsd + amountUsd).toFixed(2)} granted successfully to ${smartContractId}`)
            }
            setThinger(false)
            }}
          >Grant Allowance</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PopupAllowance
