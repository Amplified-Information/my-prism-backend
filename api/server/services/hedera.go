package services

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"os"

	"api/server/lib"
	repositories "api/server/repositories"

	"github.com/google/uuid"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type HederaService struct {
	hedera_clients      map[string]*hiero.Client // look up based on 'previewnet', 'testnet', 'mainnet'
	dbRepository        *repositories.DbRepository
	priceRepository     *repositories.PriceRepository
	marketsRepository   *repositories.MarketsRepository
	matchesRepository   *repositories.MatchesRepository
	positionsRepository *repositories.PositionsRepository
}

func (hs *HederaService) InitHedera(dbRepository *repositories.DbRepository, priceRepository *repositories.PriceRepository, marketsRepository *repositories.MarketsRepository, matchesRepository *repositories.MatchesRepository, positionsRepository *repositories.PositionsRepository) error {
	hs.dbRepository = dbRepository
	hs.priceRepository = priceRepository
	hs.marketsRepository = marketsRepository
	hs.matchesRepository = matchesRepository
	hs.positionsRepository = positionsRepository

	// First initialize the map to avoid nil map assignment
	hs.hedera_clients = make(map[string]*hiero.Client)

	var err error

	hs.hedera_clients["previewnet"], err = hs.initHederaNet("previewnet")
	if err != nil {
		return err
	}

	hs.hedera_clients["mainnet"], err = hs.initHederaNet("mainnet")
	if err != nil {
		return err
	}

	hs.hedera_clients["testnet"], err = hs.initHederaNet("testnet")
	if err != nil {
		return err
	}

	return nil
}

func (hs *HederaService) initHederaNet(networkSelected string) (*hiero.Client, error) {
	operatorIdStr := os.Getenv(fmt.Sprintf("%s_HEDERA_OPERATOR_ID", strings.ToUpper(networkSelected)))
	operatorKeyType := strings.ToUpper(os.Getenv(fmt.Sprintf("%s_HEDERA_OPERATOR_KEY_TYPE", strings.ToUpper(networkSelected))))

	// validate the accountId
	operatorId, err := hiero.AccountIDFromString(operatorIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid %s_HEDERA_OPERATOR_ID: %v", strings.ToUpper(networkSelected), err)
	}

	operatorKey := hiero.PrivateKey{}
	switch operatorKeyType {
	case "ECDSA":
		operatorKey, err = hiero.PrivateKeyFromStringECDSA(os.Getenv(fmt.Sprintf("%s_HEDERA_OPERATOR_KEY", strings.ToUpper(networkSelected))))
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "invalid %s_HEDERA_OPERATOR_KEY: %v", strings.ToUpper(networkSelected), err)
		}
	case "ED25519":
		operatorKey, err = hiero.PrivateKeyFromStringEd25519(os.Getenv(fmt.Sprintf("%s_HEDERA_OPERATOR_KEY", strings.ToUpper(networkSelected))))
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "invalid %s_HEDERA_OPERATOR_KEY: %v", strings.ToUpper(networkSelected), err)
		}
	default:
		return nil, lib.LogAndError(lib.LOG_ERROR, "unsupported %s_HEDERA_OPERATOR_KEY_TYPE: %s", strings.ToUpper(networkSelected), operatorKeyType)
	}

	client, err := hiero.ClientForName(networkSelected)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to create Hedera client: %v", err)
	}

	client.SetOperator(operatorId, operatorKey)

	lib.Log(lib.LOG_INFO, "Service: Hedera service (%s) initialized successfully", strings.ToUpper(networkSelected))
	return client, nil
}

func (hs *HederaService) PublishHCSmessage(net string, message string) (string, error) {
	topicIdStr := os.Getenv(fmt.Sprintf("%s_HCS_TOPIC_ID", strings.ToUpper(net)))
	if topicIdStr == "" {
		return "", lib.LogAndError(lib.LOG_ERROR, "HCS_TOPIC_ID environment variable is not set for network %s", net)
	}

	topicId, err := hiero.TopicIDFromString(topicIdStr)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid HCS_TOPIC_ID for network %s: %v", net, err)
	}

	tx, err := hiero.NewTopicMessageSubmitTransaction().
		SetTopicID(topicId).
		SetMessage([]byte(message)).
		Execute(hs.hedera_clients[net])
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to submit HCS message: %v", err)
	}

	_, err = tx.GetReceipt(hs.hedera_clients[net])
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get receipt for HCS message: %v", err)
	}

	lib.Log(lib.LOG_INFO, "HCS message published successfully. Hedera txId = %s", tx.TransactionID.String())
	return tx.TransactionID.String(), nil
}

func (hs *HederaService) LogMarketResolvedEvent(net string, marketId string, outcome int32) error {
	message := fmt.Sprintf("Market resolved: %s, Outcome: %d", marketId, outcome)
	_, err := hs.PublishHCSmessage(net, message)
	return err
}

func (hs *HederaService) SendHTStokens(networkSelected hiero.LedgerID, tokenId hiero.TokenID, recipientAccountId hiero.AccountID, nTokens float64) (string, error) {
	txHash := ""

	nDecimalsStr := os.Getenv("TOKEN_DECIMALS")
	nDecimals, err := strconv.Atoi(nDecimalsStr)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid TOKEN_DECIMALS value: %v", err)
	}

	nHTStokensToSend := int64(nTokens * math.Pow10(nDecimals)) // assuming the token has nDecimals, adjust as needed

	tx, err := hiero.NewTransferTransaction().
		AddTokenTransfer(tokenId, hs.hedera_clients[networkSelected.String()].GetOperatorAccountID(), -nHTStokensToSend).
		AddTokenTransfer(tokenId, recipientAccountId, nHTStokensToSend).
		Execute(hs.hedera_clients[networkSelected.String()])
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to execute token transfer: %v", err)
	}

	receipt, err := tx.SetValidateStatus(true).GetReceipt(hs.hedera_clients[networkSelected.String()])
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get receipt for token transfer: %v", err)
	}

	txHash = tx.TransactionID.String()
	lib.Log(lib.LOG_INFO, "Token transfer successful: %s (status: %s)", txHash, receipt.Status.String())

	return txHash, nil
}

func (hs *HederaService) GetRakePercent(marketId string) (float32, error) {
	// TODO - look up most recent event_rake_updated entry
	// extract the float value
	rakePercent := float32(2.0)
	return rakePercent, nil
}

// CreateNewMarket creates marketId on the network's PrismV2 proxy, signed with the API's
// Hedera key (which must hold the contract's owner role). It returns the proxy contract ID.
// A retry after a later failure finds the market already OPEN and does not resubmit.
func (hs *HederaService) CreateNewMarket(marketId string, statement string, net string, closesAt time.Time) (hiero.ContractID, error) {
	cfg, err := lib.GetPrismV2Network(net)
	if err != nil {
		return hiero.ContractID{}, err
	}
	id, err := uuid.Parse(marketId)
	if err != nil {
		return hiero.ContractID{}, fmt.Errorf("invalid marketId: %w", err)
	}
	if existing, err := lib.GetMarketV2(net, cfg.ContractID, id); err == nil && existing.State != lib.MarketUninitialized {
		if existing.State == lib.MarketOpen {
			lib.Log(lib.LOG_WARN, "market %s already exists on PrismV2 %s; not creating it again", marketId, cfg.ContractID)
			return cfg.ContractID, nil
		}
		return hiero.ContractID{}, fmt.Errorf("market %s already exists on PrismV2 in state %s", marketId, existing.State)
	}

	marketIdBig, err := lib.Uuid7_to_bigint(marketId)
	if err != nil {
		return hiero.ContractID{}, fmt.Errorf("failed to convert marketId to bigint: %w", err)
	}
	params := hiero.NewContractFunctionParameters().
		AddUint128BigInt(marketIdBig).
		AddString(statement).
		AddUint64(uint64(closesAt.Unix()))

	lib.Log(lib.LOG_INFO, "Creating market %s on PrismV2 (%s), closing %s", marketId, cfg.ContractID, closesAt.UTC().Format(time.RFC3339))
	txID, err := hs.executeAdminCall(net, cfg.ContractID, "createMarket", params)
	if err != nil {
		return hiero.ContractID{}, err
	}
	lib.Log(lib.LOG_INFO, "CreateNewMarket - tx successful. Hedera txId = %s", txID)
	return cfg.ContractID, nil
}

// ResolveMarketOnChain records outcome (0 = NO, 1 = YES, 2 = VOID) on PrismV2, signed with
// the API's Hedera key (which must hold the contract's oracle role). A retry after a later
// failure finds the outcome already recorded and does not resubmit.
func (hs *HederaService) ResolveMarketOnChain(net string, marketId string, contractIdStr string, outcome int32) error {
	contractId, err := hiero.ContractIDFromString(contractIdStr)
	if err != nil {
		return fmt.Errorf("invalid contract ID in market record: %w", err)
	}
	id, err := uuid.Parse(marketId)
	if err != nil {
		return fmt.Errorf("invalid marketId: %w", err)
	}
	target := map[int32]lib.MarketStateV2{0: lib.MarketResolvedNo, 1: lib.MarketResolvedYes, 2: lib.MarketVoid}
	want, ok := target[outcome]
	if !ok {
		return fmt.Errorf("unsupported outcome %d", outcome)
	}
	if existing, err := lib.GetMarketV2(net, contractId, id); err == nil && existing.State == want {
		lib.Log(lib.LOG_WARN, "market %s is already %s on chain; not resolving it again", marketId, want)
		return nil
	}

	marketIdBig, err := lib.Uuid7_to_bigint(marketId)
	if err != nil {
		return fmt.Errorf("failed to convert marketId to bigint: %w", err)
	}
	params := hiero.NewContractFunctionParameters().AddUint128BigInt(marketIdBig)
	function := "voidMarket"
	if outcome != 2 {
		function = "resolveMarket"
		params.AddBool(outcome == 1) // no = false, yes = true
	}
	txID, err := hs.executeAdminCall(net, contractId, function, params)
	if err != nil {
		return err
	}
	lib.Log(lib.LOG_INFO, "ResolveMarket - %s(%s) tx successful. Hedera txId = %s", function, marketId, txID)
	return nil
}

// executeAdminCall submits a PrismV2 administration call with the API's key and waits for the receipt.
func (hs *HederaService) executeAdminCall(net string, contractId hiero.ContractID, function string, params *hiero.ContractFunctionParameters) (string, error) {
	client, ok := hs.hedera_clients[net]
	if !ok || client == nil {
		return "", fmt.Errorf("no Hedera client for %s", net)
	}
	response, err := hiero.NewContractExecuteTransaction().
		SetContractID(contractId).
		SetGas(1_000_000).
		SetFunction(function, params).
		Execute(client)
	if err != nil {
		return "", fmt.Errorf("%s: failed to execute contract: %w", function, err)
	}
	receipt, err := response.GetReceipt(client)
	if err != nil {
		return response.TransactionID.String(), fmt.Errorf("%s: transaction %s failed: %w", function, response.TransactionID.String(), err)
	}
	if receipt.Status != hiero.StatusSuccess {
		return response.TransactionID.String(), fmt.Errorf("%s: transaction %s status %s", function, response.TransactionID.String(), receipt.Status)
	}
	return response.TransactionID.String(), nil
}

// GetUserPositionBalancesV2 returns a signer's on-chain YES and NO balances in collateral units.
func (hs *HederaService) GetUserPositionBalancesV2(net string, contractId hiero.ContractID, marketId string, evmAddress string) (uint64, uint64, error) {
	id, err := uuid.Parse(marketId)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid marketId: %w", err)
	}
	yes, no, err := lib.GetPositionBalancesV2(net, contractId, id, evmAddress)
	if err != nil {
		return 0, 0, err
	}
	if !yes.IsUint64() || !no.IsUint64() {
		return 0, 0, fmt.Errorf("position balance exceeds uint64")
	}
	return yes.Uint64(), no.Uint64(), nil
}
