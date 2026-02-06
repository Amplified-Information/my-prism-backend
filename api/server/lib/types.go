package lib

type ValidNetworksType string

const (
	TESTNET    ValidNetworksType = "testnet"
	MAINNET    ValidNetworksType = "mainnet"
	PREVIEWNET ValidNetworksType = "previewnet"
	// Future network types
)

type HederaKeyType uint32

const (
	KEY_TYPE_INVALID HederaKeyType = 0
	KEY_TYPE_ED25519 HederaKeyType = 1
	KEY_TYPE_ECDSA   HederaKeyType = 2
	// Future key types
)
