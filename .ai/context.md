# Prism

Prism is a prediction protocol. Humans and bots can submit a prediction intent to a marketId. Other humans and bots can also submit prediction intents to various marketIds.

A CLOB matches prediction intents across multiple separate marketIds.

The collateral token used by Prism is always USDC. The position token is either YES or NO for a given marketId.

When a match occurs, the two equal and opposing orders are sent to a Hedera smart contract for settlement (conversion of collateral token to/from position token).
