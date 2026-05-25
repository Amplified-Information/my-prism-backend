import { log } from './logger'

class Dedupe {
  private publishedTxs: Map<string, number> = new Map() // txHash -> timestamp of when it was published
  private maxSize: number

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  public isDuplicate(txHash: string): boolean {
    if (this.publishedTxs.has(txHash)) {
      log.info('Duplicate event detected. txHash: ', { txHash })
      return true
    }
    return false
  }

  public markPublished(txHash: string): void {
    this.publishedTxs.set(txHash, Date.now())
    
    // If over max size, remove the oldest entry
    if (this.publishedTxs.size > this.maxSize) {
      const oldestKey = this.publishedTxs.keys().next().value
      try {
        this.publishedTxs.delete(oldestKey!)
        log.info('[Dedupe] Evicted oldest txHash from dedupe map', { txHash: oldestKey })
      } catch (error) {
        log.error('Failed to delete old txHash from dedupe map', { txHash: oldestKey, error })
      }
    }
  }
}

export default Dedupe
