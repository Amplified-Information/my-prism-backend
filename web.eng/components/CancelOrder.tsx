import { apiClient } from '../grpcClient'

const CancelOrder = ({marketId, txId}: {marketId: string, txId: string}) => {
  return (
    <button onClick={async () => {
      console.log(`cancel txid = ${txId}`)
      const result = await apiClient.cancelPredictionIntent({marketId, txId})
      console.log('CancelOrder result:', result.response)
    }}>X</button>
  )
}

export default CancelOrder
