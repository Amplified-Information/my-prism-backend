import { ContractId, LedgerId } from '@hiero-ledger/sdk'
import { Interface } from 'ethers'
import os from 'os'
import { log } from './logger'
import { NatsConnection } from 'nats/lib/nats-base-client/mod'
import { pub } from './nats'
import { Evt } from './type'
import Dedupe from './dedupe'
import { md5 } from './util'

const HOSTNAME = os.hostname()

const pubAllEventsForContract = async (stack: Dedupe, nats: NatsConnection, network: LedgerId, contractId: ContractId, fromTimestampUnixtimeSeconds: number, toTimestampUnixtimeSeconds: number/* = (Math.ceil(new Date().getTime() / 1000) + 1) default: current time + 1 second */) => {
  // console.log(fromTimestampUnixtimeSeconds)
  // console.log(toTimestampUnixtimeSeconds)
  const net = network.toString()
  const cid = contractId.toString()
  // log.debug('Fetching events for contract', { network: net, contractId: cid })

  // ABI interface
  const abiObjStr = process.env[`ABI_${net.toUpperCase()}_${cid.replace(/\./g, '_')}`]!
  let iface: Interface
  try {
    iface = new Interface(JSON.parse(abiObjStr))
  } catch {
    log.error('Failed to parse ABI JSON', { network: net, contractId: cid })
    return
  }

  // poll the mirrornode http API for events related to the contractId on the specified network
  // https://docs.hedera.com/hedera-mirror-node/docs/api#tag/Contracts/operation/getContractResultsByContractId
  // e.g. https://testnet.mirrornode.hedera.com/api/v1/contracts/0.0.8673287/results/logs?timestamp=gt:1776348607.000000000
  const baseUrl = `https://${net}.mirrornode.hedera.com`
  let url = `${baseUrl}/api/v1/contracts/${cid}/results/logs?timestamp=gt:${fromTimestampUnixtimeSeconds}&timestamp=lt:${toTimestampUnixtimeSeconds}.000000000`
  let page = 0
  try {
    while (url) {
      page += 1
      const response = await fetch(url)
      if (!response.ok) {
        log.error('Failed to fetch events', { network: net, contractId: cid, status: response.status, statusText: response.statusText, url })
        return
      }

      const data = await response.json()
      const events = data.logs || []
      log.debug('Fetched events for contract', { network: net, contractId: cid, page, eventCount: events.length, url })

      for (const event of events) {
        try {
          const parsed = iface.parseLog({ topics: event.topics, data: event.data })
          if (parsed) {

            const raw = parsed.args.toObject()
            const args: Record<string, string> = {}
            for (const [key, value] of Object.entries(raw)) {
              args[key] = String(value)
            }

            // type safe Evt:
            const evt: Evt = {
              type: 'contract',
              net: net,
              event: parsed.name,
              args,
              timestamp: event.timestamp,
              txHash: event.transaction_hash,
              host: HOSTNAME
            }
            // deduplicate by md5(evt)
            if (!stack.isDuplicate(md5(JSON.stringify(evt)))) {
              log.info('Contract event', { ...evt })
              // e.g. topic: `previewnet:0.0.12345678
              pub(nats, `${net.toLowerCase()}:${cid}`, JSON.stringify(evt))
              // tail NATS with:
              // nats sub '>' --server nats://localhost:4222
              stack.markPublished(md5(JSON.stringify(evt)))
            }
          } else {
            log.warn('Unknown event', { network: net, contractId: cid, topics: event.topics })
          }
        } catch {
          log.warn('Failed to decode event', { network: net, contractId: cid, topics: event.topics, data: event.data })
        }
      }

      const nextPath = data.links?.next
      if (typeof nextPath === 'string' && nextPath.length > 0) {
        url = `${baseUrl}${nextPath}`
      } else {
        url = ''
      }
    }
  } catch (error) {
    log.error('Error fetching events', { network: net, contractId: cid, error: (error as Error).message })
  }
}

export { pubAllEventsForContract }
