// Stub for unused @reown/appkit subpaths pulled in by
// @hashgraph/hedera-wallet-connect's reown adapter (re-exported from
// its index). The reown adapter is never invoked in this app — we only
// use DAppConnector — so resolving these to inert values is safe.
const stub: any = new Proxy(function () {}, {
  get: () => stub,
  apply: () => stub,
  construct: () => stub,
})

export default stub
// Named exports referenced statically by the reown adapter sources:
export const defineChain = stub
export const WcHelpersUtil = stub
export const AdapterBlueprint = stub
export const CaipNetwork = stub
export const ChainNamespace = stub
export const ConstantsUtil = stub
export const CoreHelperUtil = stub
export const PresetsUtil = stub
export const isReownName = stub
