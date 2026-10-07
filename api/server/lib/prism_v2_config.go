package lib

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

// PrismV2Network is the PrismV2 deployment the API trades against on one network.
type PrismV2Network struct {
	Net          string
	ContractID   hiero.ContractID // the proxy contract ID (<NET>_SMART_CONTRACT_ID)
	ProxyAddress string           // the proxy EVM address users sign as verifyingContract: 40 lowercase hex chars, no 0x
	ChainID      uint64
}

// GetPrismV2Network reads <NET>_SMART_CONTRACT_ID, <NET>_PRISM_V2_PROXY_ADDRESS and the
// optional <NET>_CHAIN_ID override (defaults: mainnet 295, testnet 296, previewnet 297).
func GetPrismV2Network(net string) (*PrismV2Network, error) {
	net = strings.ToLower(net)
	if !IsValidNetwork(net) {
		return nil, fmt.Errorf("invalid network %q", net)
	}
	prefix := strings.ToUpper(net)

	contractID, err := hiero.ContractIDFromString(os.Getenv(prefix + "_SMART_CONTRACT_ID"))
	if err != nil {
		return nil, fmt.Errorf("invalid %s_SMART_CONTRACT_ID: %w", prefix, err)
	}

	proxy := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(os.Getenv(prefix+"_PRISM_V2_PROXY_ADDRESS")), "0x"))
	if _, err := addressBytes(proxy); err != nil {
		return nil, fmt.Errorf("%s_PRISM_V2_PROXY_ADDRESS must be the proxy's 20-byte EVM address", prefix)
	}

	chainID, ok := HederaChainIDs[net]
	if override := strings.TrimSpace(os.Getenv(prefix + "_CHAIN_ID")); override != "" {
		chainID, err = strconv.ParseUint(override, 10, 64)
		if err != nil || chainID == 0 {
			return nil, fmt.Errorf("invalid %s_CHAIN_ID", prefix)
		}
		ok = true
	}
	if !ok {
		return nil, fmt.Errorf("no chain ID for network %s", net)
	}

	return &PrismV2Network{Net: net, ContractID: contractID, ProxyAddress: proxy, ChainID: chainID}, nil
}

// CollateralUnitScale returns 10^USDC_DECIMALS: the number of collateral units in one share.
func CollateralUnitScale() (uint64, error) {
	decimals, err := strconv.ParseUint(os.Getenv("USDC_DECIMALS"), 10, 8)
	if err != nil || decimals > 18 {
		return 0, fmt.Errorf("invalid USDC_DECIMALS")
	}
	scale := uint64(1)
	for i := uint64(0); i < decimals; i++ {
		scale *= 10
	}
	return scale, nil
}
