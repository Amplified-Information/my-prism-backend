package lib

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"math/big"
	"strings"

	"github.com/google/uuid"
)

const AuthorizationV2Type = "PrismAuthorization(uint8 version,uint256 chainId,address verifyingContract,address signer,uint128 marketId,uint128 txId,uint8 side,uint8 action,uint256 limitYesPrice,uint256 qtyShares,uint256 collateralCap,uint64 deadline)"

const (
	AuthorizationVersion uint8 = 2
	PriceScale                 = uint64(1_000_000)
)

type Side uint8
type Action uint8

const (
	SideYES Side = iota
	SideNO
)

const (
	ActionBUY Action = iota
	ActionSELL
)

// AuthorizationV2 mirrors PrismV2.Authorization. All monetary and quantity
// fields are integers; callers must never derive these values with float64.
type AuthorizationV2 struct {
	Version           uint8
	ChainID           *big.Int
	VerifyingContract string
	Signer            string
	MarketID          uuid.UUID
	TxID              uuid.UUID
	Side              Side
	Action            Action
	LimitYesPrice     *big.Int
	QtyShares         *big.Int
	CollateralCap     *big.Int
	Deadline          uint64
}

func (a AuthorizationV2) Validate(now uint64) error {
	if a.Version != AuthorizationVersion {
		return errors.New("authorization version must be 2")
	}
	if a.ChainID == nil || a.ChainID.Sign() <= 0 || a.ChainID.BitLen() > 256 {
		return errors.New("chainId must be a positive uint256")
	}
	if _, err := addressBytes(a.VerifyingContract); err != nil {
		return errors.New("invalid verifyingContract")
	}
	if _, err := addressBytes(a.Signer); err != nil {
		return errors.New("invalid signer")
	}
	if a.Side > SideNO || a.Action > ActionSELL {
		return errors.New("invalid side or action")
	}
	if !validUint256(a.LimitYesPrice) || a.LimitYesPrice.Cmp(new(big.Int).SetUint64(PriceScale)) > 0 {
		return errors.New("limitYesPrice must be between 0 and 1_000_000")
	}
	if !validPositiveUint256(a.QtyShares) {
		return errors.New("qtyShares must be a positive uint256")
	}
	if !validUint256(a.CollateralCap) {
		return errors.New("collateralCap must be a uint256")
	}
	if a.Deadline <= now {
		return errors.New("authorization has expired")
	}
	return nil
}

// ABIEncode returns the Solidity abi.encode representation of the static
// Authorization tuple. This is the exact preimage used by PrismV2's
// authorization struct hash (preceded there by the EIP-712 type hash).
func (a AuthorizationV2) ABIEncode() ([]byte, error) {
	if err := a.Validate(0); err != nil {
		return nil, err
	}
	words := make([]byte, 0, 12*32)
	words = append(words, uintWord(new(big.Int).SetUint64(uint64(a.Version)))...)
	words = append(words, uintWord(a.ChainID)...)
	vc, _ := addressBytes(a.VerifyingContract)
	words = append(words, leftPad(vc, 32)...)
	signer, _ := addressBytes(a.Signer)
	words = append(words, leftPad(signer, 32)...)
	words = append(words, leftPad(a.MarketID[:], 32)...)
	words = append(words, leftPad(a.TxID[:], 32)...)
	words = append(words, uintWord(new(big.Int).SetUint64(uint64(a.Side)))...)
	words = append(words, uintWord(new(big.Int).SetUint64(uint64(a.Action)))...)
	words = append(words, uintWord(a.LimitYesPrice)...)
	words = append(words, uintWord(a.QtyShares)...)
	words = append(words, uintWord(a.CollateralCap)...)
	words = append(words, uintWord(new(big.Int).SetUint64(a.Deadline))...)
	return words, nil
}

// StructHash returns the exact hash consumed by PrismV2.authorizationHash.
// It is deliberately not an EIP-712 domain hash: Prism V2 binds the chain and
// verifying contract directly in the signed struct and uses HAS-compatible
// Hedera message framing.
func (a AuthorizationV2) StructHash() ([]byte, error) {
	encoded, err := a.ABIEncode()
	if err != nil {
		return nil, err
	}
	typeHash := Keccak256([]byte(AuthorizationV2Type))
	return Keccak256(append(typeHash, encoded...)), nil
}

// SigningMessage returns the bytes wallets sign through the Hedera Account
// Service. A base64-encoded bytes32 is always 44 bytes including padding.
func (a AuthorizationV2) SigningMessage() ([]byte, error) {
	hash, err := a.StructHash()
	if err != nil {
		return nil, err
	}
	encoded := base64.StdEncoding.EncodeToString(hash)
	return []byte("\x19Hedera Signed Message:\n44" + encoded), nil
}

func addressBytes(value string) ([]byte, error) {
	value = strings.TrimPrefix(value, "0x")
	if len(value) != 40 {
		return nil, errors.New("address must contain 20 bytes")
	}
	return hex.DecodeString(value)
}

func validUint256(v *big.Int) bool { return v != nil && v.Sign() >= 0 && v.BitLen() <= 256 }
func validPositiveUint256(v *big.Int) bool { return validUint256(v) && v.Sign() > 0 }

func uintWord(v *big.Int) []byte { return leftPad(v.Bytes(), 32) }

func leftPad(src []byte, width int) []byte {
	out := make([]byte, width)
	copy(out[width-len(src):], src)
	return out
}
