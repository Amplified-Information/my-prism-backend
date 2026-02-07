import { ClobClient } from './gen/clob.client.js'
import { OrderRequestClob } from './gen/clob.js'
import grpc from '@grpc/grpc-js'
import { v7 as uuidv7 } from 'uuid'
import { GrpcTransport } from '@protobuf-ts/grpc-transport'

const HOST = '0.0.0.0'
const PORT = 50051

// Configurable parameters
const INITIAL_PRICE = 0.5
const PRICE_RANGE = { min: -1.0, max: 1.0 }
const PERCENT_OFF_PRICE = 10
// const PRICE_RECENTER_COUNT = 10 
// const DRIFT_PRICE = 0.005
const QTY = { min: 0.01, max: 1.0 }
const PRECISION = 4
const ORDER_DELAY = { min: 50, max: 1000 }

// let priceUsd_global = INITIAL_PRICE // Current price
// let count_global = 0
let grpcClient : ClobClient

const pause = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const gaussianInRange = (min: number, max: number) => {
  return Math.random() * (max - min) + min
}

// this function selects a number between min and max weighted towards min using a probability distribution
const powerDistInRange = (min: number, max: number, skew: number = 2) => {
  const sample = Math.random()
  return min + (max - min) * Math.pow(sample, skew)
}

// returns a value cannot be less than min or greater than max
const constrain = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

// Helper function to round to precision number of decimal places
const roundToPrecision = (value: number, precision: number) => {
  return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision)
}

const initConnection = (): ClobClient => {
  try {
    const channel = grpc.credentials.createInsecure()
    const transport = new GrpcTransport({
        host: `${HOST}:${PORT}`,
        channelCredentials: channel
    })
    const client = new ClobClient(transport)
    console.log(client)
    return client
  } catch (err) {
    console.error('Failed to initialize gRPC connection:', err)
    process.exit(1)
  }
}

 // Simulate price drift with volatility
// const updatePrice = () => {
//   price = roundToPrecision(price + randomInRange(0 - DRIFT_PRICE, DRIFT_PRICE), PRECISION)

//   // Ensure price stays within bounds
//   if (price > PRICE_RANGE.max * 0.99) {
//     price = roundToPrecision((PRICE_RANGE.max + PRICE_RANGE.min) / 2, PRECISION) // Re-center around midpoint
//   }
//   if (price < PRICE_RANGE.min * 0.99) {
//     price = roundToPrecision((PRICE_RANGE.max + PRICE_RANGE.min) / 2, PRECISION) // Re-center around midpoint
//   }
// }

// Simulate volume fluctuations
// const generateVolume = () => {
//   const volumeMultiplier = randomInRange(VOLUME_MULTIPLIER.min, VOLUME_MULTIPLIER.max)
//   return roundToPrecision(QTY * volumeMultiplier, PRECISION)
// }

// const driftPrice = () => {
//   // Simple random walk for price drift
//   const drift = powerDistInRange(0 - PERCENT_OFF_PRICE, PERCENT_OFF_PRICE, 20)
//   priceUsd_global = (priceUsd_global < 0) ? roundToPrecision(priceUsd_global - drift, PRECISION) : roundToPrecision(priceUsd_global + drift, PRECISION)

//   // keep price within range
//   priceUsd_global = constrain(priceUsd_global, PRICE_RANGE.min, PRICE_RANGE.max)
// }

const placeOrder = async (client: ClobClient) => {
  const txId = uuidv7()
  const net = 'testnet'
  const marketId = uuidv7()
  const accountId = `0.0.${Math.floor(1000 + Math.random() * 9000)}`
  
  // const isBuyOrder = Math.random() < 0.5 // 50% prob

  // priceUsd_global = isBuyOrder
  //   ? roundToPrecision(priceUsd_global * (1 - powerDistInRange(0.0, PERCENT_OFF_PRICE)), PRECISION) // Buy slightly **below** market price
  //   : roundToPrecision(priceUsd_global * (1 + powerDistInRange(0.0, PERCENT_OFF_PRICE)), PRECISION) // Sell slightly **above** market price
  const isBuyOrder = Math.random() > 0.5 
  const perturbation = powerDistInRange(0, PERCENT_OFF_PRICE, 2) / 100
  let priceUsd = INITIAL_PRICE + perturbation
  priceUsd = constrain(priceUsd, 0, PRICE_RANGE.max)

  const order = OrderRequestClob.create({
    txId: txId,
    net: net,
    marketId: marketId,
    accountId: accountId,
    marketLimit: 'limit',
    priceUsd: isBuyOrder ? priceUsd : 0 - priceUsd,
    qty: roundToPrecision(gaussianInRange(QTY.min, QTY.max), PRECISION)
  })

  try {
    const response = await client.placeOrder(order).response
    console.log(`Placed ${isBuyOrder ? 'buy' : 'sell'} order:`, order, 'Response:', response)
  } catch (err) {
    console.error('Error placing order:', err)
  }

  // driftPrice()

  // ocassionally re-center price:
  // if (count_global > PRICE_RECENTER_COUNT) {
  //   console.log('Re-centering price...')
  //   priceUsd_global = await getCurrentPrice()
  //   count_global = 0
  // }
  // count_global++
}

// const getCurrentPrice = async (): Promise<number> => {
//   const result = await grpcClient.getBook({ depth: 1 })
//   const book = await result.response
//   // Simple mid-price calculation
//   const bid = book.bids.length > 0 ? book.bids[0].priceUsd : INITIAL_PRICE
//   const ask = book.asks.length > 0 ? book.asks[0].priceUsd : INITIAL_PRICE
//   console.log('Current price:', (bid + ask) / 2)
//   return roundToPrecision((bid + ask) / 2, PRECISION)
// }

console.log('Starting simulator...')
;(async () => {
  console.log('Initializing connection...')
  grpcClient = initConnection()
  console.log('Connection initialized, starting order loop')

  while (true) {
    console.log('Placing order...')
    await placeOrder(grpcClient)
    // Random delay between orders:
    await pause(powerDistInRange(ORDER_DELAY.min, ORDER_DELAY.max))
  }
})().catch((err) => {
  console.error('Fatal error in main loop:', err)
  process.exit(1)
})
