package lib

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

// PrismV2 MarketState values (enum order in PrismV2.sol).
type MarketStateV2 uint8

const (
	MarketUninitialized MarketStateV2 = iota
	MarketOpen
	MarketHalted
	MarketClosed
	MarketResolvedYes
	MarketResolvedNo
	MarketVoid
)

func (s MarketStateV2) String() string {
	names := []string{"UNINITIALIZED", "OPEN", "HALTED", "CLOSED", "RESOLVED_YES", "RESOLVED_NO", "VOID"}
	if int(s) < len(names) {
		return names[s]
	}
	return fmt.Sprintf("UNKNOWN(%d)", uint8(s))
}

// MarketV2 is PrismV2.markets(marketId).
type MarketV2 struct {
	State     MarketStateV2
	CloseTime uint64
	RakeBps   uint16
	Reserve   *big.Int
	TotalYes  *big.Int
	TotalNo   *big.Int
}

var mirrorClient = &http.Client{Timeout: 15 * time.Second}

func selector(signature string) []byte { return Keccak256([]byte(signature))[:4] }

// MirrorContractCall performs a free, read-only eth_call through the network's mirror node.
// Mirror state lags consensus by a few seconds.
func MirrorContractCall(net string, contractId hiero.ContractID, data []byte) ([]byte, error) {
	if !IsValidNetwork(net) {
		return nil, fmt.Errorf("invalid network %q", net)
	}
	body, err := json.Marshal(map[string]any{
		"block":    "latest",
		"data":     "0x" + hex.EncodeToString(data),
		"estimate": false,
		"to":       "0x" + contractId.ToSolidityAddress(),
	})
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("https://%s.mirrornode.hedera.com/api/v1/contracts/call", net)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := mirrorClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mirror contract call: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		Result string `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("mirror contract call: decode response (status %d): %w", resp.StatusCode, err)
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("mirror contract call failed with status %d", resp.StatusCode)
	}
	return hex.DecodeString(strings.TrimPrefix(result.Result, "0x"))
}

func word(data []byte, index int) ([]byte, error) {
	if len(data) < (index+1)*32 {
		return nil, errors.New("short ABI result")
	}
	return data[index*32 : (index+1)*32], nil
}

// GetMarketV2 reads PrismV2.markets(marketId).
func GetMarketV2(net string, contractId hiero.ContractID, marketId uuid.UUID) (*MarketV2, error) {
	data := append(selector("markets(uint128)"), leftPad(marketId[:], 32)...)
	out, err := MirrorContractCall(net, contractId, data)
	if err != nil {
		return nil, err
	}
	if len(out) < 6*32 {
		return nil, errors.New("short markets() result")
	}
	w := func(i int) *big.Int { b, _ := word(out, i); return new(big.Int).SetBytes(b) }
	return &MarketV2{
		State:     MarketStateV2(w(0).Uint64()),
		CloseTime: w(1).Uint64(),
		RakeBps:   uint16(w(2).Uint64()),
		Reserve:   w(3),
		TotalYes:  w(4),
		TotalNo:   w(5),
	}, nil
}

// GetPositionBalancesV2 reads PrismV2.yesBalance and noBalance for an account, in collateral units.
func GetPositionBalancesV2(net string, contractId hiero.ContractID, marketId uuid.UUID, account string) (yes *big.Int, no *big.Int, err error) {
	addr, err := addressBytes(account)
	if err != nil {
		return nil, nil, errors.New("invalid account address")
	}
	args := append(leftPad(marketId[:], 32), leftPad(addr, 32)...)
	read := func(sig string) (*big.Int, error) {
		out, err := MirrorContractCall(net, contractId, append(selector(sig), args...))
		if err != nil {
			return nil, err
		}
		b, err := word(out, 0)
		if err != nil {
			return nil, err
		}
		return new(big.Int).SetBytes(b), nil
	}
	if yes, err = read("yesBalance(uint128,address)"); err != nil {
		return nil, nil, err
	}
	if no, err = read("noBalance(uint128,address)"); err != nil {
		return nil, nil, err
	}
	return yes, no, nil
}

// IsMatchExecutedV2 reads PrismV2.executedMatches(matchId).
func IsMatchExecutedV2(net string, contractId hiero.ContractID, matchID [32]byte) (bool, error) {
	out, err := MirrorContractCall(net, contractId, append(selector("executedMatches(bytes32)"), matchID[:]...))
	if err != nil {
		return false, err
	}
	b, err := word(out, 0)
	if err != nil {
		return false, err
	}
	return new(big.Int).SetBytes(b).Sign() != 0, nil
}
