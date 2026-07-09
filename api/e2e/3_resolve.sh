#!/bin/bash

# 0. prompt user to input the marketId to resolve
# 1. Resolve the marketId which was input to this program (Solidity, Prism.sol: function resolveMarket(uint128 marketId, bool noYes) external onlyOracle {... ) Use 0_ACCOUNT_ID=0.0.7090546 (owner)
# 2. Foreach accountId, call the on-chain (solidity) redeem function (Solidity, Prism.sol:  function redeem(uint128 marketId) external returns (uint256 amountUSDC))
# 3. Check the USDC (collateral) balance of each accountId after redeeming, and display the difference in the table (i.e. how much USDC was redeemed for each accountId) - note: there is a 2% rake taken by the market operator for each amount redeemed
# 4. Ensure all collateral is completely drained from the smart contract for that marketId (Solidity, Prism.sol: function getTotalCollateral(uint128 marketId) external view returns (uint256 amountUSDC))
# 5. Ensure all USDC (collateral) is accounted for


# 0. prompt user to input the marketId to resolve
read -p "Enter marketId to resolve: " marketId
if [[ -z "$marketId" ]]; then
  echo "marketId is required"
  exit 1
fi

# 1. resolve the market
