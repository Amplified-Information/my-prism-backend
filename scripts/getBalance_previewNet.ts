// ts-node getBalance_previewNet.ts

const accountId = '0.0.31019'

const MIRROR_NODE = 'https://previewnet.mirrornode.hedera.com/api/v1'

async function getBalance(accountId: string) {
  const res = await fetch(`${MIRROR_NODE}/accounts/${accountId}`)

  if (!res.ok) {
    throw new Error(`Mirror node error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as { balance: { balance: string } }

  const tinybars = BigInt(data.balance.balance)
  const hbars = Number(tinybars) / 100_000_000

  console.log(`Account: ${accountId}`)
  console.log(`HBAR: ${hbars}`)
  console.log(`Tinybars: ${tinybars.toString()}`)

}


getBalance(accountId).catch(console.error)
