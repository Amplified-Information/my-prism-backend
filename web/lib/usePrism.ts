import { useQuery } from '@tanstack/react-query'
import { apiClient, authHeaders } from '../grpcClient'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { mapPrismResponse } from './rewardsMath'
import type { PrismResponse } from '../gen/api'

/**
 * $PRSM balances sourced from the backend `GetPrism` RPC (api.proto).
 * Replaces the removed `UserPortfolioResponse.prism_token_balance` /
 * `prism_points` fields (backend commented them out — see docs/backend-sync.md).
 *
 * The response mapping lives in lib/rewardsMath.ts (unit tested offline).
 */
export const usePrism = () => {
  const { signerZero } = useWalletContext()
  const { networkSelected } = useNetworkContext()

  const accountId = signerZero?.getAccountId()?.toString()
  const net = networkSelected.toString().toLowerCase()

  const query = useQuery<PrismResponse | undefined>({
    queryKey: ['prism', accountId, net],
    enabled: !!accountId,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const { response } = await apiClient.getPrism({ accountId: accountId!, net }, authHeaders())
      return response
    },
  })

  return {
    ...mapPrismResponse(query.data),
    isLoading: query.isLoading,
    isConnected: !!accountId,
    refetch: query.refetch,
  }
}
