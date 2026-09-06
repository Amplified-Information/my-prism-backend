// This program changes the implementation contract of the proxy contract.
// Usage: tsx 8_proxyChangeImplContract.ts <proxyId> <newImplementationId> [migrationDataHex]
import {
	ContractExecuteTransaction,
	ContractFunctionParameters,
	ContractId
} from '@hashgraph/sdk'
import { ethers } from 'ethers'
import { initHederaClient } from './lib/hedera.ts'

const [proxyId, newImplementationId, migrationDataHex = '0x'] = process.argv.slice(2)

if (!proxyId || !newImplementationId) {
	console.error('Usage: tsx 8_proxyChangeImplContract.ts <proxyId> <newImplementationId> [migrationDataHex]')
	console.error('Example: tsx 8_proxyChangeImplContract.ts 0.0.12345 0.0.12346')
	process.exit(1)
}

if (!ethers.isHexString(migrationDataHex) || migrationDataHex.length % 2 !== 0) {
	console.error('migrationDataHex must be an even-length hexadecimal string beginning with 0x')
	process.exit(1)
}

const [client] = initHederaClient()

const main = async () => {
	const proxyContractId = ContractId.fromString(proxyId)
	const implementationAddress = ContractId.fromString(newImplementationId).toEvmAddress()
	const migrationData = ethers.getBytes(migrationDataHex)

	console.log(`Upgrading proxy ${proxyId} (${proxyContractId.toEvmAddress()})`)
	console.log(`New implementation: ${newImplementationId} (${implementationAddress})`)
	console.log(`Migration data: ${migrationDataHex}`)

	const params = new ContractFunctionParameters()
		.addAddress(implementationAddress)
		.addBytes(migrationData)

	const response = await new ContractExecuteTransaction()
		.setContractId(proxyContractId)
		.setGas(500_000)
		.setFunction('upgradeToAndCall', params)
		.execute(client)

	const receipt = await response.getReceipt(client)
	console.log(`Upgrade transaction status: ${receipt.status.toString()}`)
}

main().catch((err) => {
	console.error('Proxy implementation upgrade failed:', err)
	process.exit(1)
})