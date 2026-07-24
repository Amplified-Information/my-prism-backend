# smart contract

The Prism smart contract for on-chain settlement of user prediction intents (`PrismPredictionIntent`).

## Quickstart

`nvm use v24` (<https://github.com/nvm-sh/nvm>)

`npm install --g solc` # make `solc` globally available

`npm i` # install openzepplin and gnosis deps

`cd contracts`

`solc Prism.sol --bin`

May need (optimizations and intermediate representation enabled):

`solc Prism.sol --with-ir --optimize --bin`

or...

```bash
cd scs/scripts
./0_compile.sh Prism
```

**Deploy contract:**

Be sure to set the following private keys:

```bash
PREVIEWNET_HEDERA_OPERATOR_KEY
TESTNET_HEDERA_OPERATOR_KEY MAINNET_HEDERA_OPERATOR_KEY 
```

or, just do: 

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

```bash
export SMART_CONTRACT_ID=...
```

**Interact with smart contact:**

```bash
cd scripts

source ../loadEnv.sh local

# PREVIEWNET_USDC_ADDRESS=0.0.296
# TESTNET_USDC_ADDRESS=0.0.429274
# MAINNET_USDC_ADDRESS=0.0.456858

# associate a token (USD Coin - 0.0.429274) with the smart contract:
ts-node 1_associateToken.ts

# call getUserTokens (readonly):
ts-node 2_getUserTokens.ts $SMART_CONTRACT_ID 0.0.3728074

# send USDC to a smart contract:
ts-node 3_buy.ts $SMART_CONTRACT_ID 112233 33442

etc.
```



## test smart contract 

```bash
# install foundry globally:

curl -L https://foundry.paradigm.xyz | bash

source ~/.bashrc
foundryup
```

```bash
# use foundry in your application
cd scs
mkdir foundry
cd foundry

# now init with:
forge init

cd src
ln -s ../../Prism.sol .
forge install OpenZeppelin/openzeppelin-contracts
forge install dapphub/ds-test
forge install foundry-rs/forge-std
```

```bash
# You can also run the tests in:

`cd scs/scripts/tests`

`ts-node test.ts`

`ts-node prism.ts`

# etc.
```

## Add smart contract testing to github Actions

```bash
# tidy foundry up so can check in code:
cd foundry
rm -rf .git
rm -rf .github
mkdir old
mv .gitmodules ./old/.gitmodules.old

# may also need to remove any submodule reference here:
git rm --cached scs/foundry
rm -rf .git/modules/scs/foundry
git commit -am "Remove scs/foundry submodule reference"


# add a smart contract pipeline to:
.github/workflows/sc-test.yml

# place *.t.sol test files in scs/foundry/test/
# --> symlink the Solidity source .sol files to scs/foundry/src/
cd src
ln -s ../../X.sol .
forge install OpenZeppelin/openzeppelin-contracts
forge install dapphub/ds-test
forge install foundry-rs/forge-std

# Now do:
forge test

# Ensure you can also do (without having to change <name>.sol):
./0_compile.sh <name>.sol 

# Use AI to generate *.t.sol tests
```

Note: if you get stack too deep errors, do:

`forge test --via-ir`

Or, add "via_ir = true" to foundry.toml file

Still having issues? Add optimizer:

```toml
optimizer = true
optimizer_runs = 200
via_ir = true

# may also need the following remappings:

remappings = [
  '@openzeppelin/=lib/openzeppelin-contracts/',
  '@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/',
  'ds-test/=lib/ds-test/src/',
  'forge-std/=lib/forge-std/src/'
]
```

## e2e test of smart contract

```bash
cd api/e2e

# configure the e2e test
cp .env.example .env
# populate .env

ls 
# now run:
./0_allowances.sh # follow prompts

# get a token (JWT with ADMIN) to access the API
./0_bearerToken.sh 

# create a new market on Prism:
./0_createMarket.sh # follow prompts

# fill up the market just created with orders:
./1_fillUp.sh # follow prompts

# fill up with secondary orders
./1_fillUp.sh # follow prompts

# reconcile all orders submitted:
./2_reconcile.sh

# view all positions in the market:
./4_positions.sh

# resolve the market to YES or NO
./3_resolve.sh

# view all positions in the market:
./4_positions.sh

# claim winnings:
./5_claim.sh

# (optionally) delete market:
./7_softDeleteMarket.sh

```

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