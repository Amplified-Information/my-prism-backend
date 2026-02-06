package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	pb_api "api/gen"
	pb_clob "api/gen/clob"
	"api/gen/sqlc"
	"api/server/lib"
	repositories "api/server/repositories"

	"github.com/google/uuid"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type PredictionIntentsService struct {
	log                         *LogService
	dbRepository                *repositories.DbRepository
	marketsRepository           *repositories.MarketsRepository
	predictionIntentsRepository *repositories.PredictionIntentsRepository

	natsService   *NatsService
	hederaService *HederaService
}

func (pis *PredictionIntentsService) Init(logService *LogService, dbRepository *repositories.DbRepository, marketsRepository *repositories.MarketsRepository, natsService *NatsService, hederaService *HederaService, predictionIntentRepository *repositories.PredictionIntentsRepository) error {
	pis.dbRepository = dbRepository
	pis.marketsRepository = marketsRepository
	pis.predictionIntentsRepository = predictionIntentRepository

	pis.natsService = natsService
	pis.hederaService = hederaService
	pis.log = logService

	pis.log.Log(INFO, "Service: PredictionIntents service initialized successfully, %p", pis)

	return nil
}

func (pis *PredictionIntentsService) CreatePredictionIntent(req *pb_api.PredictionIntentRequest) (string, error) {
	/////
	// validations
	/////
	// Validate account ID format and minimum account number
	accountId, err := hiero.AccountIDFromString(req.AccountId)
	if err != nil {
		return "Invalid accountId format", err
	}

	// Validate timestamp is within the last TIMESTAMP_ALLOWED_PAST_SECONDS seconds
	timestamp, err := time.Parse(time.RFC3339, req.GeneratedAt)
	if err != nil {
		return "", pis.log.Log(ERROR, "invalid timestamp format: %v", err)
	}

	now := time.Now().UTC()
	allowedPastSeconds, err := strconv.Atoi(os.Getenv("TIMESTAMP_ALLOWED_PAST_SECONDS"))
	if err != nil {
		return "", pis.log.Log(ERROR, "invalid TIMESTAMP_ALLOWED_PAST_SECONDS environment variable: %v", err)
	}
	allowedFutureSeconds, err := strconv.Atoi(os.Getenv("TIMESTAMP_ALLOWED_FUTURE_SECONDS"))
	if err != nil {
		return "", pis.log.Log(ERROR, "invalid TIMESTAMP_ALLOWED_FUTURE_SECONDS environment variable: %v", err)
	}
	pastDelta := now.Add(-1 * time.Duration(allowedPastSeconds) * time.Second)
	futureDelta := now.Add(time.Duration(allowedFutureSeconds) * time.Second)

	if timestamp.Before(pastDelta) {
		return "", pis.log.Log(ERROR, "timestamp is too old: %s", req.GeneratedAt)
	}

	if timestamp.After(futureDelta) {
		return "", pis.log.Log(ERROR, "timestamp is too far in the future: %s. Now: %s", req.GeneratedAt, now)
	}

	// check we haven't received this txid previously
	txUUID, err := uuid.Parse(req.TxId)
	if err != nil {
		return "", pis.log.Log(ERROR, "invalid txId uuid: %v", err)
	}
	exists, err := pis.dbRepository.IsDuplicateTxId(txUUID)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to check existing txId: %v", err)
	}
	if exists {
		pis.log.Log(WARN, "DUPLICATE txId: %s", req.TxId)
		return "", fmt.Errorf("duplicate txId: %s", req.TxId)
	}

	// validate that the network sent is valid
	netSelectedByUser := strings.ToLower(req.Net)
	if !lib.IsValidNetwork(netSelectedByUser) {
		return "", pis.log.Log(ERROR, "invalid network: %s", req.Net)
	}

	// First look up the Hedera accountId against the mirror node
	publicKeyLookedUp, keyTypeLookedUp, err := pis.hederaService.GetPublicKey(accountId, netSelectedByUser)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to get public key: %v", err)
	}
	pis.log.Log(INFO, "Mirror node response for account %s on network %s: %s", accountId, netSelectedByUser, publicKeyLookedUp.String())

	// keyType sent from the front-end (no 0x prefix) must match the keyType looked up on the mirror node
	if !lib.IsValidKeyType(req.KeyType) {
		return "", pis.log.Log(ERROR, "keyType mismatch: expected %d, got %d", keyTypeLookedUp, req.KeyType)
	}

	// public key sent from the front-end (no 0x prefix) must match the public key looked up on the mirror node
	publicKey, err := hiero.PublicKeyFromString(req.PublicKey)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to parse public key from string: %v", err)
	}
	if publicKeyLookedUp.String() != publicKey.String() || publicKey.String() == "" {
		return "", pis.log.Log(ERROR, "public key mismatch: expected %s, got %s", publicKeyLookedUp.String(), publicKey.String())
	}

	// Now it's safe to proceed with the publicKey passed from the frontend...
	usdcDecimals, err := strconv.ParseUint(os.Getenv("USDC_DECIMALS"), 10, 64)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to parse USDC_DECIMALS: %v", err)
	}

	payloadHex, err := lib.AssemblePayloadHexForSigning(req, usdcDecimals)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to extract payload for signing: %v", err)
	}
	// N.B. treat the hex string as a Utf8 string - don't want the hex conversion to remove leading zeros!!!
	payloadUtf8 := payloadHex // Yes, this is intentional
	pis.log.Log(INFO, "payloadUtf8: %s", payloadUtf8)

	isValidSig, err := lib.VerifySig(&publicKey, payloadUtf8, req.Sig)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to verify signature: %v", err)
	}
	if !isValidSig {
		return "", pis.log.Log(ERROR, "invalid signature for account %s", req.AccountId)
	}
	// if we get here, the sig is valid
	pis.log.Log(INFO, "**Signature is valid for account %s**", req.AccountId)

	// Ensure user has provided enough of an allowance
	_networkSelected, err := hiero.LedgerIDFromString(netSelectedByUser)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to get network selected: %v", err)
	}

	// NO, don't use the current X_SMART_CONTRACT_ID loaded from env vars
	// _smartContractId, err := hiero.ContractIDFromString(os.Getenv(fmt.Sprintf("%s_SMART_CONTRACT_ID", strings.ToUpper(netSelectedByUser))))
	// if err != nil {
	// 	return "", pis.log.Log(ERROR, "failed to validate %s_SMART_CONTRACT_ID: %v", strings.ToUpper(netSelectedByUser), err)
	// }
	// look up this market's smartContractID in the database
	market, err := pis.marketsRepository.GetMarketById(req.MarketId)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to get market by id %s: %v", req.MarketId, err)
	}
	_smartContractId, err := hiero.ContractIDFromString(market.SmartContractID)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to validate smart contract ID from market %s: %v", req.MarketId, err)
	}

	// read USDC address from env var
	usdcAddress, err := hiero.ContractIDFromString(os.Getenv(fmt.Sprintf("%s_USDC_ADDRESS", strings.ToUpper(netSelectedByUser))))
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to validate %s_USDC_ADDRESS: %v", strings.ToUpper(netSelectedByUser), err)
	}

	// ensure user has provided enough of an allowance to the smart contract:
	spenderAllowanceUsd, err := pis.hederaService.GetSpenderAllowanceUsd(*_networkSelected, accountId, _smartContractId, usdcAddress, usdcDecimals)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to get spender allowance: %v", err)
	}
	pis.log.Log(INFO, "Spender allowance for account %s on contract %s: $%.2f", accountId.String(), _smartContractId.String(), spenderAllowanceUsd)

	if spenderAllowanceUsd < math.Abs(req.GetPriceUsd()*req.GetQty()) {
		return "", pis.log.Log(ERROR, "Spender allowance ($USD%.2f USD token = %s) too low for this predictionIntent ($USD%.2f)", spenderAllowanceUsd, usdcAddress.String(), req.GetPriceUsd()*req.GetQty())
	}

	// ensure the spenderAllowanceUsd is <= usdc balance currently in the user's wallet
	currentUserBalanceUsdc, err := pis.hederaService.GetUsdcBalanceUsd(*_networkSelected, accountId)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to get user's USDC balance: %v", err)
	}
	pis.log.Log(INFO, "Current USDC balance for account %s: $%.2f", accountId.String(), currentUserBalanceUsdc)
	pis.log.Log(INFO, "Spender allowance for account %s: $%.2f", accountId.String(), spenderAllowanceUsd)
	if spenderAllowanceUsd <= currentUserBalanceUsdc {
		// OK
	} else {
		if math.Abs(req.PriceUsd)*req.Qty <= currentUserBalanceUsdc {
			// this is also OK - let's not warn the user that their allowance is higher than their balance
		} else {
			return "", pis.log.Log(ERROR, "Spender allowance ($USD%.2f) is greater than than the user's balance ($USD%.2f)", spenderAllowanceUsd, currentUserBalanceUsdc)
		}
	}

	/// OK - All validations passed
	/// Now you can (attempt to) put the order on the CLOB (subject to on-chain sig verification)

	/////
	// notify the CLOB via NATS:
	/////

	// Marshal the CLOB req: *pb_api.PredictionIntentRequest to JSON
	clobRequestObj := &pb_clob.CreateOrderRequestClob{
		TxId:        req.TxId,
		Net:         req.Net,
		MarketId:    req.MarketId,
		AccountId:   req.AccountId,
		MarketLimit: req.MarketLimit,
		PriceUsd:    req.PriceUsd,
		Qty:         req.Qty, // the clob will decrement this value over time as matches occur
		QtyOrig:     req.Qty, // need to keep track of the original qty for on/off-chain signature validation
		Sig:         req.Sig,
		PublicKey:   req.PublicKey, // passing extra key info - i) avoid lookups ii) handle situation where user has changed their key
		EvmAddress:  req.EvmAddress,
		KeyType:     int32(req.KeyType),
	}
	clobRequestJSON, err := json.Marshal(clobRequestObj)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to marshal CLOB request: %v", err)
	}

	// Publish the message to NATS:
	err = pis.natsService.Publish(lib.SUBJECT_CLOB_ORDERS, clobRequestJSON)
	if err != nil {
		return "", pis.log.Log(ERROR, "failed to publish to NATS: %v", err)
	}

	pis.log.Log(INFO, "Published order to NATS subject '%s': %s", lib.SUBJECT_CLOB_ORDERS, string(clobRequestJSON))

	// now store the OrderRequest in the database - the txid must be unique or this fails
	_, err = pis.predictionIntentsRepository.CreateOrderIntentRequest(req)
	if err != nil {
		return "", pis.log.Log(ERROR, "database error: failed to save order request: %v", err)
	}

	return fmt.Sprintf("Processed input for user %s", req.AccountId), nil
}

func (pis *PredictionIntentsService) CancelPredictionIntent(marketId string, txId string) (*pb_api.StdResponse, error) {
	// guards

	// OK

	// 1. Mark the position as cancelled in the database
	// - prediction_intents: set the cancelled_at timestamp
	// 2. Remove the order from the CLOB

	// 1 - Mark the order as cancelled in the database
	err := pis.predictionIntentsRepository.CancelPredictionIntent(txId)
	if err != nil {
		return nil, pis.log.Log(ERROR, "failed to cancel prediction intent: %v", err)
	}

	// TODO - in future, this will be done using NATS/Jetstream
	// 2 - Notify the CLOB via NATS:
	// cancelRequestObj := &pb_clob.CancelOrderRequest{
	// 	MarketId: req.MarketId,
	// 	TxId:     req.TxId,
	// }
	// cancelRequestJSON, err := json.Marshal(cancelRequestObj)
	// if err != nil {
	// 	return nil, pis.log.Log(ERROR, "failed to marshal CLOB cancel request: %v", err)
	// }

	// // Publish the cancellation message to NATS:
	// err = pis.natsService.Publish(lib.NATS_CLOB_CANCEL_ORDERS, cancelRequestJSON)
	// if err != nil {
	// 	return nil, pis.log.Log(ERROR, "failed to publish cancel to NATS: %v", err)
	// }

	// log.Printf("Published cancel order to NATS subject '%s': %s", lib.NATS_CLOB_CANCEL_ORDERS, string(cancelRequestJSON))

	// TODO - use NATS
	clobAddr := os.Getenv("CLOB_HOST") + ":" + os.Getenv("CLOB_PORT")

	conn, err := grpc.NewClient(clobAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, pis.log.Log(ERROR, "failed to cancel order (marketId=%s, txId=%s) - connect to CLOB gRPC server failed: %v", marketId, txId, err)
	}
	defer conn.Close()

	clobClient := pb_clob.NewClobInternalClient(conn)
	_, err = clobClient.CancelOrder(
		context.Background(),
		&pb_clob.CancelOrderRequest{
			MarketId: marketId,
			TxId:     txId,
		},
	)
	if err != nil {
		return nil, pis.log.Log(ERROR, "failed to cancel order (marketId=%s, txId=%s) on the CLOB (%s): %v", marketId, txId, clobAddr, err)
	}

	// OK if we got here:
	response := &pb_api.StdResponse{
		Message: fmt.Sprintf("Cancelled order intent with txId: %s", txId),
	}
	return response, nil
}

func (pis *PredictionIntentsService) GetAllOpenPredictionIntentsByMarketId(marketId string) (*[]sqlc.PredictionIntent, error) {
	predictionIntent, err := pis.predictionIntentsRepository.GetAllOpenPredictionIntentsByMarketId(marketId)
	if err != nil {
		return nil, pis.log.Log(ERROR, "failed to get prediction intent by MarketId %s: %v", marketId, err)
	}
	return predictionIntent, nil
}

func (pis *PredictionIntentsService) GetAllPredictionIntentsForMarketIdAndAccountId(marketId uuid.UUID) ([]string, error) {
	predictionIntent, err := pis.predictionIntentsRepository.GetAllAccountIdsForMarketId(marketId)
	if err != nil {
		return nil, pis.log.Log(ERROR, "failed to get all users with open orders for marketId: %s (%v)", marketId.String(), err)
	}
	return predictionIntent, nil
}
