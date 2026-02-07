# smart contract

## contract parameters

collateral token - USDC, USDC[hts], HBAR, etc.

position tokens - ERC20-style or hts native

single oracle vs multiple oracles - simple shard tokens (ERC-20) or gnosis conditional token

etc.

## Comparison Table

| Collateral token  | Yes/No share token | Comments |
|-------------------|--------------------|--------------------|
| USDC      | ERC20-style  | Simplest |
| USDC[hts] | ERC20-style  | USDC[hts] has lower liquidity |
| USDC      | hts.FUNGIBLE | high performance. token association UX issues. Can take advantage of hts "royalty" feature... |
| USDC[hts] | hts.FUNGIBLE | high performance. token association UX issues. Can take advantage of hts "royalty" feature... |
| USDC      | hts.NFT      | high performance. token association UX issues. Can take advantage of hts "royalty" feature... |
| USDC[hts] | hts.NFT      | high performance. token association UX issues. Can take advantage of hts "royalty" feature... |

If we're happy for the user to perform an additional step (first time user), we could use an hts.NFT (infinite supply). Put the question on the NFT.

## Quickstart

`nvm use v24`

`cd contracts`

`npm i` # install openzepplin and gnosis deps

`npm install --g solc`

`solc PredictionMarket.sol --bin`

May need (optimizations and intermediate representation enabled):

`solc PredictionMarket.sol --with-ir --optimize --bin`

or...

`cd scs/scripts`
`./0_compile.sh Prism`

To compile the test contract (Test.sol), run:

`./0_compile.sh Test`

**Deploy contract:**

Be sure to set the PREVIEWNET_HEDERA_OPERATOR_KEY, TESTNET_HEDERA_OPERATOR_KEY and MAINNET_HEDERA_OPERATOR_KEY in `../shared/.secrets`

```bash
source ./loadEnv.sh local
```

Config is done in `scripts/constants.ts`

```bash
cd scripts

ts-node 0_deploy.ts Prism
```
Follow the output instructions...

`export <net>_SMART_CONTRACT_ID=0.0.7387199`

To deploy the test contract, run:

```bash
ts-node 0_deploy.ts Test
```

You can run the tests in:

`cd scs/scripts/tests`

`ts-node test.ts`

`ts-node prism.ts`

etc.

```bash
export SMART_CONTRACT_ID=...
```

**Interact with smart contact:**

```bash
cd scripts

# PREVIEWNET_USDC_ADDRESS=0.0.296
# TESTNET_USDC_ADDRESS=0.0.429274
# MAINNET_USDC_ADDRESS=0.0.456858

# associate a token (USD Coin - 0.0.429274) with the smart contract:
ts-node 1_associateToken.ts $SMART_CONTRACT_ID 0.0.429274

# call getUserTokens (readonly):
ts-node 2_getUserTokens.ts $SMART_CONTRACT_ID 0.0.3728074

# send USDC to a smart contract:
ts-node 3_buy.ts $SMART_CONTRACT_ID 112233 33442
```
