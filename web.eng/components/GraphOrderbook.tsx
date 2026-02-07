

import { useEffect } from 'react'
import { ServerStreamingCall } from '@protobuf-ts/runtime-rpc' // Ensure this is the correct library for your project
import { useAppContext } from '../AppProvider'
import { clobClient } from '../grpcClient'
import { getMidPrice, getSpreadPercent, isValidUUIDv7 } from '../lib/utils'
import CancelOrder from './CancelOrder'
import { BookSnapshot } from '../gen/clob'

const DEPTH = 0 // TODO

const GraphOrderBook = ({ marketId }: { marketId: string }) => {
  const { book, setBook, signerZero } = useAppContext()
 
  /**
   * Effect to start streaming the order book data for the given marketId.
   * Cleanly end the stream (abort) when the component unmounts
   */
  useEffect(() => {
    const ac = new AbortController()

    async function startStream() {
      let call: ServerStreamingCall | undefined
      try {
        if (!isValidUUIDv7(marketId!)){
          return
        }
        call = clobClient.streamBook(
          { 
            marketId,
            depth: DEPTH
         },
          { signal: ac.signal, abort: ac.signal }  // RpcOptions
        )

        for await (const msg of call.responses) {
          if (ac.signal.aborted) {
            console.log('Stream aborted')
            return
          }
          setBook(msg as BookSnapshot)
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          console.error('streamBook error:', err)
        } else {
          console.log('Stream aborted due to controller signal')
        }
      } finally {
        console.log('finally')
        console.info(call)
      }
    }

    startStream()

    return () => {
      console.log('Aborting order book stream for marketId:', marketId)
      ac.abort() // cancels the stream on unmount
    }
  }, [marketId])

  return (
    <div>
      OrderBook
      <ul>
        
        {(book?.asks ?? []).slice().sort((a, b) => a.priceUsd - b.priceUsd).map((ask, idx) => (
          <li key={`ask-${idx}`}>
            <span style={{ color: 'red' }} title={ask.txId}>
              ${(0 - ask.priceUsd).toFixed(4)} &mdash; {ask.qty.toFixed(2)}</span>
              &nbsp;{ask.accountId === signerZero?.getAccountId().toString() ? <CancelOrder marketId={marketId} txId={ask.txId} /> : ''}
          </li>
        ))}
        --- mid-price: {typeof getMidPrice(book) === 'undefined' ? 'N/A' : getMidPrice(book)!.toFixed(4)}, spread: {typeof getSpreadPercent(book) === 'undefined' ? 'N/A' : getSpreadPercent(book)!.toFixed(2)}% ---
        {(book?.bids ?? []).slice().sort((a, b) => b.priceUsd - a.priceUsd).map((bid, idx) => (
          <li key={`bid-${idx}`}>
            <span style={{ color: 'green' }} title={bid.txId}>
            ${bid.priceUsd.toFixed(4)} &mdash; {bid.qty.toFixed(2)}</span>
            &nbsp;{bid.accountId === signerZero?.getAccountId().toString() ? <CancelOrder marketId={marketId} txId={bid.txId} /> : ''}
          </li>
        ))}

      </ul>
    </div>
  )
}

export default GraphOrderBook
