import { useEffect, useRef } from 'react'
import { PriceHistoryRequest } from '../gen/api'
import { useAppContext } from '../AppProvider'
import { apiClient, clobClient } from '../grpcClient'
import { createChart, DeepPartial, LineSeries, TimeChartOptions, UTCTimestamp } from 'lightweight-charts'
import { ServerStreamingCall } from '@protobuf-ts/runtime-rpc'

type DataPoint = {
  time: UTCTimestamp,
  value: number
}

const GraphPrice = ({ marketId }: { marketId: string }) => {
  const { networkSelected } = useAppContext()

  // const [chart, setChart] = useState<IChartApi | undefined>(undefined)
  // const [dataPoints, setDataPoints] = useState<DataPoint[]>([])
  // const [dataSeries, setDataSeries] = useState<any>(undefined)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineSeriesRef = useRef<any>(undefined)
  // const [trigger, setTrigger] = useState<boolean>(false)

  const initChart = (dataPoints: DataPoint[]) => {
    console.log('initChart')
    const chartOptions: DeepPartial<TimeChartOptions> = {
      // https://tradingview.github.io/lightweight-charts/docs/api/interfaces/LineStyleOptions
      layout: {
        textColor: 'black', 
        background: { 
          color: 'white' 
        }
      },
      rightPriceScale: {
        scaleMargins: {
          top: 0.05,
          bottom: 0.05
        }
        // min: 0.0,
        // maxValue: 1.0
      }
    }
    
    document.getElementById('chartContainer')!.innerHTML = '' // clear previous chart, if any
    const _chart = createChart(document.getElementById('chartContainer'), chartOptions)
    // setChart(_chart)

    const _lineSeries = _chart.addSeries(LineSeries, {
      color: '#2962FF'
    }) 

    console.log(dataPoints)
    _lineSeries.setData(dataPoints)

    console.log('lineSeries: ', _lineSeries)
    lineSeriesRef.current = _lineSeries

    // setInterval(() => {
    //   const dataPoint: DataPoint = {
    //     time: new Date().toISOString(),
    //     value: Math.random()
    //   }
    //   console.log(dataPoint)
    //   // setDataPoints(prev => ([...prev, dataPoint]))

    //   lineSeries.update(dataPoint)
    // }, 500)
  }

  // get the (one-time) price:
  useEffect(() => {
    ;(async () => {
      if (!marketId){
        console.warn('No marketId provided')
        return
      }
      try {
        const priceHistoryRequest: PriceHistoryRequest = {
          marketId,
          net: networkSelected.toString(),
          resolution: 'hour',
          from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // last 24 hours in UTC ISO 8601 (Zulu) format
          to: new Date().toISOString()
          // limit: 1,
          // offset: 100
        }
        const priceResult = await apiClient.priceHistory(priceHistoryRequest)
        console.log('Initial price fetch:', priceResult.response)

        const _dataPoints: DataPoint[] = []
        for (let i = 0; i < priceResult.response.priceUsd.length; i++) {
          const dataPoint: DataPoint = {
            time: Number(priceResult.response.timestampMs[i] / BigInt(1000)) as UTCTimestamp,
            value: Math.abs(priceResult.response.priceUsd[i])
          }
          console.log(dataPoint)
          _dataPoints.push(dataPoint)
        }

        // if there is no price data for this market, set a default price
        if (priceResult.response.priceUsd.length === 0) {
          console.warn('No price data returned for marketId:', marketId)
          const dataPoint: DataPoint = {
            time: Number(new Date().getTime() / 1000) as UTCTimestamp,
            value: 0.5
          }
          _dataPoints.push(dataPoint)
        }
        
        // now init the chart...
        initChart(_dataPoints)
      } catch (e) {
        console.error('Error fetching initial price history:', e)
      } finally {
        console.log('Initial price fetch complete')
      }
    })()
  }, [])

  // Demo tick generator (replace with WebSocket)
  // useEffect(() => {
  //   // console.log(lineSeriesRef.current)
  //   // if (!lineSeriesRef.current) return
    
  //   const interval = setInterval(() => {
  //     const dataPoint: DataPoint = {
  //       time: Math.floor(new Date().getTime() / 1000) as UTCTimestamp,
  //       value: Math.random()
  //     }
  //     // console.log(dataPoint)
      
  //     lineSeriesRef.current.update(dataPoint)
  //     // console.log(lineSeriesRef.current.data())
  //   }, 500)

  //   return () => clearInterval(interval)
  // }, [])

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
          // Use type assertion to access timestampMs
          
          const { timestampMs, priceBidUsd, priceAskUsd  } = msg as { timestampMs: bigint, priceBidUsd: number, priceAskUsd: number }
          // console.log(priceBidUsd)
          // console.log(priceAskUsd)
          // console.log((BigInt(timestampMs) / BigInt(1000)).toString())
          // console.log('msg', msg)

          // add the datapoint:
          const dataPoint: DataPoint = {
            time: Number(BigInt(timestampMs) / BigInt(1000)) as UTCTimestamp,
            value: (Math.abs(priceAskUsd) + priceBidUsd) / 2
          }
          lineSeriesRef.current.update(dataPoint)
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

    startStream()

    return () => {
      console.log('Aborting price stream for marketId:', marketId)
      ac.abort() // cancels the stream on unmount
    }
  }, [])



  return (
    <div>
      {/* <h1>GraphPrice</h1>
      <span className='text-xs'>Market ID: {marketId}</span> */}
      {/* {JSON.stringify(data)} */}

      
      <div id="chartContainer" style={{ width: '640px', height: '400px' }}></div>
    </div>
  )
}

export default GraphPrice
