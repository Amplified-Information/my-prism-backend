import { useState, useCallback } from 'react'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { getMirrorNodeUrl } from '../constants'

export interface AuditMatch {
  sequenceNumber: number
  consensusTimestamp: string
  tradeIds: string[]
  isUserMatch: boolean
}

interface MirrorNodeMessage {
  sequence_number: number
  consensus_timestamp: string
  message: string // base64
}

interface MirrorNodeResponse {
  messages: MirrorNodeMessage[]
  links?: { next?: string }
}

export function useAuditTrail(userTxIds: string[], topicId: string) {
  const { networkSelected } = useNetworkContext()
  const [matches, setMatches] = useState<AuditMatch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextLink, setNextLink] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const net = networkSelected.toString().toLowerCase()
  const baseUrl = getMirrorNodeUrl(net)

  const decodeMessage = (base64: string): string[] => {
    try {
      const decoded = atob(base64)
      const parsed = JSON.parse(decoded)
      if (Array.isArray(parsed)) return parsed.map(String)
      return []
    } catch {
      return []
    }
  }

  const userTxIdSet = new Set(userTxIds)

  const processMessages = (messages: MirrorNodeMessage[]): AuditMatch[] => {
    return messages.map(msg => {
      const tradeIds = decodeMessage(msg.message)
      const isUserMatch = tradeIds.some(id => userTxIdSet.has(id))
      return {
        sequenceNumber: msg.sequence_number,
        consensusTimestamp: msg.consensus_timestamp,
        tradeIds,
        isUserMatch
      }
    }).filter(m => m.tradeIds.length > 0)
  }

  const fetchMessages = useCallback(async (append = false) => {
    if (!topicId || !baseUrl) {
      setError('Audit trail not available for this network')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const url = append && nextLink
        ? `${baseUrl}${nextLink}`
        : `${baseUrl}/api/v1/topics/${topicId}/messages?limit=25&order=desc`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`Mirror node returned ${res.status}`)

      const data: MirrorNodeResponse = await res.json()
      const newMatches = processMessages(data.messages ?? [])

      if (append) {
        setMatches(prev => [...prev, ...newMatches])
      } else {
        setMatches(newMatches)
      }

      if (data.links?.next) {
        setNextLink(data.links.next)
        setHasMore(true)
      } else {
        setHasMore(false)
        setNextLink(null)
      }
    } catch (err) {
      console.error('[useAuditTrail] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load audit trail')
    } finally {
      setIsLoading(false)
    }
  }, [topicId, baseUrl, nextLink])

  const refresh = useCallback(() => {
    setNextLink(null)
    setHasMore(true)
    return fetchMessages(false)
  }, [fetchMessages])

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      return fetchMessages(true)
    }
  }, [fetchMessages, hasMore, isLoading])

  const userMatches = matches.filter(m => m.isUserMatch)

  const hashScanTopicUrl = topicId
    ? `https://hashscan.io/${net}/topic/${topicId}/messages`
    : null

  const getHashScanMessageUrl = (timestamp: string) =>
    `https://hashscan.io/${net}/topic/${topicId}/${timestamp}`

  return {
    matches,
    userMatches,
    isLoading,
    error,
    hasMore,
    refresh,
    loadMore,
    hashScanTopicUrl,
    getHashScanMessageUrl,
    isAvailable: !!topicId
  }
}
