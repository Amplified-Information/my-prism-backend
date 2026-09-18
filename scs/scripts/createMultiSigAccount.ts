// source ../loadEnv.sh local
// npx tsx createMultiSigAccount.ts
import { AccountCreateTransaction, Hbar, KeyList, PublicKey } from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'
// type Net = 'previewnet' | 'testnet' | 'mainnet'

const [client, network] = initHederaClient()


const n = 3
const m = 2

const accountIds = ['0.0.7090546', '0.0.7511359', '0.0.7513087']







interface MirrorNodeAccount {
    key: {
        key: string
    }
}

async function getAccountPublicKey(accountId: string): Promise<PublicKey> {
    const response = await fetch(
        `https://${network}.mirrornode.hedera.com/api/v1/accounts/${accountId}`,
    )
    if (!response.ok) {
        throw new Error(`Mirror Node lookup failed for ${accountId}: HTTP ${response.status}`)
    }

    const account: MirrorNodeAccount = await response.json()
    if (!account.key?.key) {
        throw new Error(`Mirror Node returned no public key for ${accountId}`)
    }

    return PublicKey.fromString(account.key.key)
}

const publicKeys = await Promise.all(accountIds.map(getAccountPublicKey))


// guards:

// n must be >= m
if (n < m) {
	throw new Error('n must be greater than or equal to m')
}

// publicKeys.length must be equal to n
if (publicKeys.length !== n) {
    throw new Error('The number of public keys must be equal to n')
}

// must be valid public keys:
for (const pubKey of publicKeys) {
    if (!(pubKey instanceof PublicKey)) {
        throw new Error(`Invalid public key: ${pubKey}`)
    }
}

// check to make sure that the public keys correspond to the account IDs:






const keys = new KeyList(publicKeys, m)


const result = await new AccountCreateTransaction()
    .setKeyWithoutAlias(keys)
    .setInitialBalance(new Hbar(10))
    .setTransactionMemo(`${m}-of-${n} treasury`)
//     .freeze()
//     .toBytes()
// console.log(result.toString())
    .freezeWith(client)
    .execute(client)
console.log('Multi-sig account created:', result.toString())

const receipt = await result.getReceipt(client)
const accountId = receipt.accountId
console.log('Multi-sig account ID:', accountId?.toString())
console.log('--> Verify this account ID on hashscan! <--')




// verify the account creation transaction

// verify the public keys in the multi-sig
// verify the thresholding (<m, ==m, >m) All combinations of the accounts
// that is a script that runs privately on a local machine







// instructions required:
// perform an m/n transaction:
/*
tx, err := hiero.NewTransferTransaction().
    AddHbarTransfer(multisigAccountID, hiero.NewHbar(-1)).
    AddHbarTransfer(recipientAccountID, hiero.NewHbar(1)).
    FreezeWith(client)
if err != nil {
    return err
}

tx.Sign(alicePrivateKey)
tx.Sign(bobPrivateKey)
tx.Sign(carolPrivateKey)
// Add Dave's signature too for 4-of-4.

resp, err := tx.Execute(client)
*/