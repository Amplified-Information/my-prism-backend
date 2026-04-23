package lib

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strings"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

func GetPublicKey(accountId hiero.AccountID, net string) (*hiero.PublicKey, HederaKeyType, error) {
	keyType := HederaKeyType(0)

	// TODO... may get rate limited here...
	mirrorNodeURL := fmt.Sprintf("https://%s.mirrornode.hedera.com/api/v1/accounts/%s", net, accountId)
	resp, err := Fetch(GET, mirrorNodeURL, nil)

	if err != nil {
		return nil, keyType, LogAndError(LOG_ERROR, "failed to query mirror node: %v", err)
	}

	if resp.StatusCode != 200 {
		return nil, keyType, LogAndError(LOG_ERROR, "mirror node returned status code %d", resp.StatusCode)
	}

	defer resp.Body.Close()

	var jsonParseResult struct {
		Key struct {
			Key   string `json:"key"`
			Type_ string `json:"_type"`
		} `json:"key"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&jsonParseResult); err != nil {
		return nil, keyType, LogAndError(LOG_ERROR, "failed to parse mirror node response: %v", err)
	}

	publicKey := &hiero.PublicKey{}
	if strings.HasPrefix(strings.ToUpper(jsonParseResult.Key.Type_), "ECDSA") {
		key, err := hiero.PublicKeyFromStringECDSA(jsonParseResult.Key.Key)
		if err != nil {
			return nil, keyType, LogAndError(LOG_ERROR, "failed to parse public key (ECDSA) from string: %v", err)
		}
		publicKey = &key
	} else if strings.HasPrefix(strings.ToUpper(jsonParseResult.Key.Type_), "ED25519") {
		key, err := hiero.PublicKeyFromStringEd25519(jsonParseResult.Key.Key)
		if err != nil {
			return nil, keyType, LogAndError(LOG_ERROR, "failed to parse public key (ED25519) from string: %v", err)
		}
		publicKey = &key
	} else {
		return nil, keyType, LogAndError(LOG_ERROR, "unsupported key type: %s", jsonParseResult.Key.Type_)
	}

	switch strings.ToUpper(jsonParseResult.Key.Type_) {
	case "ECDSA_SECP256K1":
		keyType = KEY_TYPE_ECDSA
	case "ED25519":
		keyType = KEY_TYPE_ED25519
	}

	return publicKey, keyType, nil
}

func EvmAddressToHederaAccountId(networkSelected hiero.LedgerID, evmAddressWith0x string) (*hiero.AccountID, error) {
	// if evmAddress does not start with "0x", prepend 0x
	if !strings.HasPrefix(evmAddressWith0x, "0x") {
		evmAddressWith0x = "0x" + evmAddressWith0x
	}
	// make sure evmAddress is prefixed with "0x" and is 42 characters long
	if !strings.HasPrefix(evmAddressWith0x, "0x") || len(evmAddressWith0x) != 42 {
		return nil, LogAndError(LOG_ERROR, "invalid EVM address format: %s", evmAddressWith0x)
	}
	// make sure evemAddressWith0x has length > 0
	if len(evmAddressWith0x) == 0 {
		return nil, LogAndError(LOG_ERROR, "EVM address is empty")
	}

	mirrorNodeURL := fmt.Sprintf("https://%s.mirrornode.hedera.com/api/v1/accounts/%s", networkSelected.String(), evmAddressWith0x)
	resp, err := Fetch(GET, mirrorNodeURL, nil)
	if err != nil {
		return nil, LogAndError(LOG_ERROR, "EvmAddressToHederaAccountId: error fetching allowance: %v", err)
	}
	defer resp.Body.Close()

	// parse out the accountId string:
	// {
	// "account": "0.0.7090546",
	// "alias": "IQFB26XZHOJJEC6OKC2MBUVI43OP5P6W",
	// "auto_renew_period": 7776000,
	// "balance": {
	//   "balance": 76990329210,
	//   "timestamp": "1774839904.421438000",
	//   "tokens": [
	//     {
	//       "token_id": "0.0.5449",
	//       "balance": 125508520
	//     },
	//     {
	//       "token_id": "0.
	// ...
	var result struct {
		Account string `json:"account"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, LogAndError(LOG_ERROR, "failed to parse response: %v", err)
	}

	accountId, err := hiero.AccountIDFromString(result.Account)
	if err != nil {
		return nil, LogAndError(LOG_ERROR, "failed to parse account id: %v", err)
	}

	return &accountId, nil
}

func GetSpenderAllowanceUsd(networkSelected hiero.LedgerID, accountId hiero.AccountID, smartContractId hiero.ContractID, usdcAddress hiero.ContractID, usdcDecimals uint64) (float64, error) {
	mirrorNodeURL := fmt.Sprintf("https://%s.mirrornode.hedera.com/api/v1/accounts/%s/allowances/tokens?spender.id=eq:%s&token.id=eq:%s", networkSelected.String(), accountId.String(), smartContractId.String(), usdcAddress.String())
	Log(LOG_INFO, mirrorNodeURL)
	// debug URL template retained for reference

	resp, err := Fetch(GET, mirrorNodeURL, nil)
	if err != nil {
		return 0, LogAndError(LOG_ERROR, "error fetching allowance: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return 0, LogAndError(LOG_ERROR, "network response was not ok: status %d", resp.StatusCode)
	}

	var result struct {
		Allowances []struct {
			Amount int64 `json:"amount"`
		} `json:"allowances"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, LogAndError(LOG_ERROR, "failed to parse response: %v", err)
	}

	if len(result.Allowances) == 0 {
		return 0, nil
	}

	// Convert to float64 and apply decimals
	Log(LOG_INFO, "Allowance amount: %d", result.Allowances[0].Amount)
	amount := float64(result.Allowances[0].Amount) / math.Pow(10, float64(usdcDecimals))
	return amount, nil
}

func GetTokenBalance(networkSelected hiero.LedgerID, tokenId hiero.TokenID, accountId hiero.AccountID) (int64, error) {
	// OK - proceed

	mirrorNodeURL := fmt.Sprintf("https://testnet.mirrornode.hedera.com/api/v1/tokens/%s/balances?account.id=%s", tokenId.String(), accountId.String())
	// mirrorNodeURL := fmt.Sprintf("https://%s.mirrornode.hedera.com/api/v1/accounts/%s/balances/tokens/%s", networkSelected.String(), accountId.String(), usdcAddress.String())
	// debug URL template retained for reference

	resp, err := Fetch(GET, mirrorNodeURL, nil)
	if err != nil {
		return 0, LogAndError(LOG_ERROR, "error fetching balance: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return 0, LogAndError(LOG_ERROR, "network response was not ok: status %d (%s)", resp.StatusCode, mirrorNodeURL)
	}

	// example response:
	// 	{
	//   "timestamp": "1769614394.545175617",
	//   "balances": [
	//     {
	//       "account": "0.0.7090546",
	//       "balance": 19300000,
	//       "decimals": 6
	//     }
	//   ],
	//   "links": {
	//     "next": null
	//   }
	// }

	var result struct {
		Timestamp string `json:"timestamp"`
		Balances  []struct {
			Account  string `json:"account"`
			Balance  int64  `json:"balance"`
			Decimals int    `json:"decimals"`
		} `json:"balances"`
		Links struct {
			Next *string `json:"next"`
		} `json:"links"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, LogAndError(LOG_ERROR, "failed to parse response: %v", err)
	}

	// Find the token balance for the specified usdcAddress
	var balance int64
	if len(result.Balances) == 0 {
		return 0, LogAndError(LOG_ERROR, "no balances found for account %s and token %s", accountId.String(), tokenId.String())
	}
	balance = result.Balances[0].Balance

	// Convert to float64 and apply decimals
	// balance := float64(usdcBalance) / math.Pow(10, float64(usdcDecimals))
	return balance, nil
}

func GetUsdcBalanceUsd(networkSelected hiero.LedgerID, accountId hiero.AccountID) (int64, error) {
	usdcAddressStr := os.Getenv(fmt.Sprintf("%s_USDC_ADDRESS", strings.ToUpper(networkSelected.String())))
	usdcDecimalsStr := os.Getenv("USDC_DECIMALS")

	if usdcAddressStr == "" || usdcDecimalsStr == "" {
		return 0, LogAndError(LOG_ERROR, "USDC_ADDRESS or USDC_DECIMALS environment variable is not set")
	}
	// usdcDecimals, err := strconv.ParseUint(usdcDecimalsStr, 10, 64)
	// if err != nil {
	// 	return 0, LogAndError(LOG_ERROR, "invalid USDC_DECIMALS: %v", err)
	// }
	usdcAddress, err := hiero.TokenIDFromString(usdcAddressStr)
	if err != nil {
		return 0, LogAndError(LOG_ERROR, "invalid USDC address: %v", err)
	}

	balance, err := GetTokenBalance(networkSelected, usdcAddress, accountId)
	if err != nil {
		return 0, LogAndError(LOG_ERROR, "failed to get USDC balance: %v", err)
	}
	return balance, nil
}
