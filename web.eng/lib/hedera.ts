import { AccountId, ContractExecuteTransaction, ContractFunctionParameters, ContractId, LedgerId, Status } from '@hashgraph/sdk'
import { DAppSigner } from '@hashgraph/hedera-wallet-connect'
import { Position, UserAccountInfo } from '../types'

const getActiveMarkets = async (accountId: AccountId): Promise<string[]> => {
  // TODO
  void accountId
  return ['019a7e77-39e2-72a3-9bea-a63bdfa79d20']
}
const getAllPositions = async (accountId: AccountId): Promise<Position[]> => {
  const markets = await getActiveMarkets(accountId)
  for (let i = 0; i < markets.length; i++) {
    // TODO
  }
  return []
}

const getSpenderAllowanceUsd = async (networkSelected: LedgerId, usdcTokenIds: Record<string, string>, usdcNdecimals: number, smartContractId: string, accountId: string): Promise<number> => {
  try {
    const mirrornode = `https://${networkSelected}.mirrornode.hedera.com/api/v1/accounts/${accountId}/allowances/tokens?spender.id=eq:${smartContractId}&token.id=eq:${usdcTokenIds[networkSelected.toString().toLowerCase()]}`
    const response = await fetch(mirrornode)
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const data = await response.json()
    return data.allowances[0]?.amount / (10 ** usdcNdecimals) || 0
  } catch (error) {
    console.error('Error fetching allowance:', error)
    throw error
  }
}

const getUserAccountInfo = async (networkSelected: LedgerId, accountId: string) => {
  try {
    const mirrornode = `https://${networkSelected}.mirrornode.hedera.com/api/v1/accounts/${accountId}`
    const response = await fetch(mirrornode)
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const data = await response.json()
    return data as UserAccountInfo
  } catch (error) {
    console.error('Error fetching account info from mirrornode:', error)
    throw error
  }
}

const grantAllowanceUsd = async (signerZero: DAppSigner, usdcTokenIds: Record<string, string>, usdcNdecimals: number,contractId: string, amountUsd: number): Promise<boolean> => {
  // console.log(signerZero.getLedgerId().toString)
  console.log(usdcTokenIds[signerZero.getLedgerId().toString().toLowerCase()])
  console.log(contractId)
  console.log(amountUsd)
  console.log(ContractId.fromString(contractId).toEvmAddress())
  const approveTx = await new ContractExecuteTransaction()
    .setContractId(usdcTokenIds[signerZero.getLedgerId().toString().toLowerCase()])
    .setGas(10_000_000) // TODO: this is coming up as infinity HBAR?
    .setFunction('approve', new ContractFunctionParameters()
      .addAddress(ContractId.fromString(contractId).toEvmAddress()) // spender (the smart contract)
      .addUint256(amountUsd * (10 ** usdcNdecimals)))
    .executeWithSigner(signerZero)

    const approveReceipt = await approveTx.getReceiptWithSigner(signerZero)
    console.log('approve status:', approveReceipt.status.toString())

    if (approveReceipt.status === Status.Success) {
      return true
    } else {
      return false
    }
}

const getTokenBalance = async (networkSelected: LedgerId, tokenId: string, accountId: string): Promise<number> => {
  try {
    const url = `https://${networkSelected}.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`
    console.log('url', url)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const data = await response.json()

    if (data.tokens.length === 0) {
      console.warn(`No balance found for token ${tokenId} on account ${accountId}`)
      return 0
    }
    return data.tokens[0].balance || 0
  } catch (error) {
    console.error('Error fetching token balance:', error)
    throw error
  }
}

export { 
  getAllPositions, 
  getSpenderAllowanceUsd, 
  grantAllowanceUsd,
  getUserAccountInfo,
  getTokenBalance
}
