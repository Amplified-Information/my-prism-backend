package lib

import (
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"math/bits"
	"strings"

	"github.com/google/uuid"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

// SettleSignature is the canonical signature of PrismV2.settle.
const SettleSignature = "settle((uint8,uint256,address,address,uint128,uint128,uint8,uint8,uint256,uint256,uint256,uint64),bytes,(uint8,uint256,address,address,uint128,uint128,uint8,uint8,uint256,uint256,uint256,uint64),bytes,uint256,uint256,bytes32)"

// matchIDTag domain-separates match identifiers from any other keccak preimage.
var matchIDTag = Keccak256([]byte("PrismMatchV2"))

// HederaChainIDs maps each network to its EVM chain ID (HIP-26).
var HederaChainIDs = map[string]uint64{
	"mainnet":    295,
	"testnet":    296,
	"previewnet": 297,
}

// NewAuthorizationV2 assembles an Authorization from transport/persisted fields.
// Addresses may be given with or without a 0x prefix.
func NewAuthorizationV2(chainID uint64, verifyingContract string, signer string, marketID string, txID string, side uint32, action uint32, limitYesPrice uint64, qtyShares uint64, collateralCap uint64, deadline uint64) (AuthorizationV2, error) {
	market, err := uuid.Parse(marketID)
	if err != nil {
		return AuthorizationV2{}, fmt.Errorf("invalid marketId: %w", err)
	}
	tx, err := uuid.Parse(txID)
	if err != nil {
		return AuthorizationV2{}, fmt.Errorf("invalid txId: %w", err)
	}
	if side > uint32(SideNO) || action > uint32(ActionSELL) {
		return AuthorizationV2{}, errors.New("invalid side or action")
	}
	a := AuthorizationV2{
		Version:           AuthorizationVersion,
		ChainID:           new(big.Int).SetUint64(chainID),
		VerifyingContract: normalizeAddress(verifyingContract),
		Signer:            normalizeAddress(signer),
		MarketID:          market,
		TxID:              tx,
		Side:              Side(side),
		Action:            Action(action),
		LimitYesPrice:     new(big.Int).SetUint64(limitYesPrice),
		QtyShares:         new(big.Int).SetUint64(qtyShares),
		CollateralCap:     new(big.Int).SetUint64(collateralCap),
		Deadline:          deadline,
	}
	if err := a.Validate(0); err != nil {
		return AuthorizationV2{}, err
	}
	if a.Action == ActionBUY && collateralCap == 0 {
		return AuthorizationV2{}, errors.New("collateralCap must be positive for a BUY")
	}
	return a, nil
}

// VerifySignature checks a base64 signature over the exact message PrismV2 passes
// to the Hedera Account Service: "\x19Hedera Signed Message:\n44" + base64(structHash).
// Hedera wallets add that prefix themselves when asked to sign base64(structHash).
func (a AuthorizationV2) VerifySignature(publicKey *hiero.PublicKey, sigBase64 string) (bool, error) {
	sig, err := base64.StdEncoding.DecodeString(sigBase64)
	if err != nil {
		return false, fmt.Errorf("invalid base64 signature: %w", err)
	}
	message, err := a.SigningMessage()
	if err != nil {
		return false, err
	}
	return publicKey.VerifySignedMessage(message, sig), nil
}

// IsBid reports whether an order buys YES exposure at its limit (BUY YES or SELL NO).
// Asks are SELL YES and BUY NO. Every bid/ask pair is one of PrismV2's four pairings.
func IsBid(side Side, action Action) bool {
	return (side == SideYES && action == ActionBUY) || (side == SideNO && action == ActionSELL)
}

// SplitCollateral mirrors PrismV2.settle: the YES leg pays floor(shares*price/1e6)
// and the NO leg pays the rest, so a complete set is exactly one collateral unit per share.
func SplitCollateral(fillShares uint64, executionYesPrice uint64) (yesCollateral uint64, noCollateral uint64, err error) {
	if fillShares == 0 || executionYesPrice == 0 || executionYesPrice >= PriceScale {
		return 0, 0, errors.New("fill shares must be positive and price strictly between 0 and 1_000_000")
	}
	hi, lo := bits.Mul64(fillShares, executionYesPrice)
	yesCollateral, _ = bits.Div64(hi, lo, PriceScale) // hi < PriceScale because executionYesPrice < PriceScale
	noCollateral = fillShares - yesCollateral
	if yesCollateral == 0 || noCollateral == 0 {
		return 0, 0, errors.New("fill too small: both legs must pay a positive collateral amount")
	}
	return yesCollateral, noCollateral, nil
}

// LegCollateral is the collateral PrismV2 attributes to an authorization for one fill.
func LegCollateral(side Side, yesCollateral uint64, noCollateral uint64) uint64 {
	if side == SideYES {
		return yesCollateral
	}
	return noCollateral
}

// CheckLimit mirrors PrismV2._validateAuthorization's normalized limit inequalities.
func CheckLimit(side Side, action Action, limitYesPrice uint64, executionYesPrice uint64) error {
	if IsBid(side, action) {
		if executionYesPrice > limitYesPrice {
			return fmt.Errorf("execution price %d is above the bid limit %d", executionYesPrice, limitYesPrice)
		}
		return nil
	}
	if executionYesPrice < limitYesPrice {
		return fmt.Errorf("execution price %d is below the ask limit %d", executionYesPrice, limitYesPrice)
	}
	return nil
}

// MatchID derives the on-chain idempotency key for one fill. It is stable across
// redelivery (it depends only on the fill and the fill state before it) and unique
// per fill, because each fill advances at least one order's cumulative shares.
func MatchID(verifyingContract string, marketID uuid.UUID, bidTxID uuid.UUID, askTxID uuid.UUID, bidSharesBefore uint64, askSharesBefore uint64, fillShares uint64, executionYesPrice uint64) ([32]byte, error) {
	var id [32]byte
	vc, err := addressBytes(verifyingContract)
	if err != nil {
		return id, errors.New("invalid verifyingContract")
	}
	words := make([]byte, 0, 9*32)
	words = append(words, matchIDTag...)
	words = append(words, leftPad(vc, 32)...)
	words = append(words, leftPad(marketID[:], 32)...)
	words = append(words, leftPad(bidTxID[:], 32)...)
	words = append(words, leftPad(askTxID[:], 32)...)
	for _, v := range []uint64{bidSharesBefore, askSharesBefore, fillShares, executionYesPrice} {
		words = append(words, uintWord(new(big.Int).SetUint64(v))...)
	}
	copy(id[:], Keccak256(words))
	return id, nil
}

// EncodeSettleCalldata returns the complete calldata (selector + ABI arguments) for
// PrismV2.settle. signatureA/B are the HAS SignatureMap blobs, not raw signatures.
func EncodeSettleCalldata(a AuthorizationV2, signatureA []byte, b AuthorizationV2, signatureB []byte, fillShares uint64, executionYesPrice uint64, matchID [32]byte) ([]byte, error) {
	tupleA, err := a.ABIEncode()
	if err != nil {
		return nil, fmt.Errorf("authorization a: %w", err)
	}
	tupleB, err := b.ABIEncode()
	if err != nil {
		return nil, fmt.Errorf("authorization b: %w", err)
	}

	const headWords = 12 + 1 + 12 + 1 + 3
	offsetA := uint64(headWords * 32)
	offsetB := offsetA + uint64(len(encodeBytes(signatureA)))

	out := make([]byte, 0, 4+headWords*32+len(signatureA)+len(signatureB)+128)
	out = append(out, Keccak256([]byte(SettleSignature))[:4]...)
	out = append(out, tupleA...)
	out = append(out, uintWord(new(big.Int).SetUint64(offsetA))...)
	out = append(out, tupleB...)
	out = append(out, uintWord(new(big.Int).SetUint64(offsetB))...)
	out = append(out, uintWord(new(big.Int).SetUint64(fillShares))...)
	out = append(out, uintWord(new(big.Int).SetUint64(executionYesPrice))...)
	out = append(out, matchID[:]...)
	out = append(out, encodeBytes(signatureA)...)
	out = append(out, encodeBytes(signatureB)...)
	return out, nil
}

// encodeBytes is the ABI tail encoding of a dynamic bytes value.
func encodeBytes(value []byte) []byte {
	padded := (len(value) + 31) / 32 * 32
	out := make([]byte, 32+padded)
	copy(out[:32], uintWord(big.NewInt(int64(len(value)))))
	copy(out[32:], value)
	return out
}

func normalizeAddress(value string) string {
	return "0x" + strings.ToLower(strings.TrimPrefix(strings.TrimPrefix(value, "0x"), "0X"))
}
