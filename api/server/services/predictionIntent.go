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
	dbRepository                *repositories.DbRepository
	marketsRepository           *repositories.MarketsRepository
	predictionIntentsRepository *repositories.PredictionIntentsRepository

	natsService *NatsService
	// hederaService *HederaService
}

func (pis *PredictionIntentsService) Init(dbRepository *repositories.DbRepository, marketsRepository *repositories.MarketsRepository, natsService *NatsService, predictionIntentRepository *repositories.PredictionIntentsRepository) error {
	pis.dbRepository = dbRepository
	pis.marketsRepository = marketsRepository
	pis.predictionIntentsRepository = predictionIntentRepository

	pis.natsService = natsService
	// pis.hederaService = hederaService

	lib.Log(lib.LOG_INFO, "Service: PredictionIntents service initialized successfully, %p", pis)

	return nil
}

func (pis *PredictionIntentsService) CreatePredictionIntent(req *pb_api.PrismPredictionIntentRequest) (string, error) {
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
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid timestamp format: %v", err)
	}

	now := time.Now().UTC()
	allowedPastSeconds, err := strconv.Atoi(os.Getenv("TIMESTAMP_ALLOWED_PAST_SECONDS"))
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid TIMESTAMP_ALLOWED_PAST_SECONDS environment variable: %v", err)
	}
	allowedFutureSeconds, err := strconv.Atoi(os.Getenv("TIMESTAMP_ALLOWED_FUTURE_SECONDS"))
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid TIMESTAMP_ALLOWED_FUTURE_SECONDS environment variable: %v", err)
	}
	pastDelta := now.Add(-1 * time.Duration(allowedPastSeconds) * time.Second)
	futureDelta := now.Add(time.Duration(allowedFutureSeconds) * time.Second)

	if timestamp.Before(pastDelta) {
		return "", lib.LogAndError(lib.LOG_ERROR, "timestamp is too old: %s", req.GeneratedAt)
	}

	if timestamp.After(futureDelta) {
		return "", lib.LogAndError(lib.LOG_ERROR, "timestamp is too far in the future: %s. Now: %s", req.GeneratedAt, now)
	}

	// check we haven't received this txid previously
	txUUID, err := uuid.Parse(req.TxId)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid txId uuid: %v", err)
	}
	exists, err := pis.dbRepository.IsDuplicateTxId(txUUID)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to check existing txId: %v", err)
	}
	if exists {
		lib.Log(lib.LOG_WARN, "DUPLICATE txId: %s", req.TxId)
		return "", lib.LogAndError(lib.LOG_ERROR, "duplicate txId: %s", req.TxId)
	}

	// validate that the network sent is valid
	netSelectedByUser := strings.ToLower(req.Net)
	if !lib.IsValidNetwork(netSelectedByUser) {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid network: %s", req.Net)
	}

	// First look up the Hedera accountId against the mirror node
	publicKeyLookedUp, keyTypeLookedUp, err := lib.GetPublicKey(accountId, netSelectedByUser)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get public key: %v", err)
	}
	lib.Log(lib.LOG_INFO, "Mirror node response for account %s on network %s: %s", accountId, netSelectedByUser, publicKeyLookedUp.String())

	// keyType sent from the front-end (no 0x prefix) must match the keyType looked up on the mirror node
	if !lib.IsValidKeyType(req.KeyType) {
		return "", lib.LogAndError(lib.LOG_ERROR, "keyType mismatch: expected %d, got %d", keyTypeLookedUp, req.KeyType)
	}

	// public key sent from the front-end (no 0x prefix) must match the public key looked up on the mirror node
	publicKey, err := hiero.PublicKeyFromString(req.PublicKey)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to parse public key from string: %v", err)
	}
	if publicKeyLookedUp.String() != publicKey.String() || publicKey.String() == "" {
		return "", lib.LogAndError(lib.LOG_ERROR, "public key mismatch: expected %s, got %s", publicKeyLookedUp.String(), publicKey.String())
	}

	// Now it's safe to proceed with the publicKey passed from the frontend...
	usdcDecimals, err := strconv.ParseUint(os.Getenv("USDC_DECIMALS"), 10, 64)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to parse USDC_DECIMALS: %v", err)
	}

	payloadHex, err := lib.AssemblePayloadHexForSigning(req, usdcDecimals)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to extract payload for signing: %v", err)
	}
	// N.B. treat the hex string as a Utf8 string - don't want the hex conversion to remove leading zeros!!!
	payloadUtf8 := payloadHex // Yes, this is intentional
	lib.Log(lib.LOG_INFO, "payloadUtf8: %s", payloadUtf8)

	isValidSig, err := lib.VerifySig(&publicKey, payloadUtf8, req.Sig)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to verify signature: %v", err)
	}
	if !isValidSig {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid signature for account %s", req.AccountId)
	}
	// if we get here, the sig is valid
	lib.Log(lib.LOG_INFO, "**Signature is valid for account %s**", req.AccountId)

	// Ensure user has provided enough of an allowance
	_networkSelected, err := hiero.LedgerIDFromString(netSelectedByUser)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get network selected: %v", err)
	}

	// db look up of this market's smartContractID in the markets table - don't use the current X_SMART_CONTRACT_ID as loaded from env vars
	market, err := pis.marketsRepository.GetMarketById(req.MarketId, false /* don't include suspended or paused markets*/)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get market by id %s: %v. Is the market suspended or paused?", req.MarketId, err)
	}
	_smartContractId, err := hiero.ContractIDFromString(market.SmartContractID)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to validate smart contract ID from market %s: %v", req.MarketId, err)
	}

	// if it's a market order, ensure there's enough liquidity in the orderbook to fill the order - if not, reject the order to avoid user frustration of having a partially filled market order and then having to cancel the remaining qty
	if math.Abs(req.PriceUsd) == 1.0 {
		// - get the orderbook depth
		// - if size is greater than the available liquidity, reject the order to avoid user frustration of having a partially filled market order and then having to cancel the remaining qty
		qty, err := pis.getAvailableLiquidityUsdForMarket(req.PriceUsd, req.MarketId)
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to get available liquidity for market %s: %v", req.MarketId, err)
		}
		if req.Qty > qty {
			return "", lib.LogAndError(lib.LOG_ERROR, "order quantity %f exceeds available liquidity %f for market %s", req.Qty, qty, req.MarketId)
		}
	}

	switch req.PrimarySecondary {
	case "p":
		// primary orders - only check collateral (USDC) allowance when it's a primary order
		// secondary orders don't require collateral to be posted to the contract - instead, the user transfers their position tokens to the contract
		// check that they have enough position tokens for secondary orders in a separate check below (if req.PrimarySecondary == "s")

		// read USDC address from env var
		usdcAddress, err := hiero.ContractIDFromString(os.Getenv(fmt.Sprintf("%s_USDC_ADDRESS", strings.ToUpper(netSelectedByUser))))
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to validate %s_USDC_ADDRESS: %v", strings.ToUpper(netSelectedByUser), err)
		}

		// ensure user has provided enough of an allowance to the smart contract:
		spenderAllowanceUsd, err := lib.GetSpenderAllowanceUsd(*_networkSelected, accountId, _smartContractId, usdcAddress, usdcDecimals)
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to get spender allowance: %v", err)
		}
		lib.Log(lib.LOG_INFO, "Spender allowance for account %s on contract %s: $%.2f", accountId.String(), _smartContractId.String(), spenderAllowanceUsd)

		// amountBeingSpentUsd := math.Abs(req.PriceUsd * req.Qty) // Don't do this. This is incorrect! (e.g. -0.99 price_usd with qty 10 is a big USDC number that needs large allowance)
		amountBeingSpentUsd := req.PriceUsd * req.Qty
		if req.PriceUsd < 0.0 {
			amountBeingSpentUsd = (1 - math.Abs(req.PriceUsd)) * req.Qty
		}
		if spenderAllowanceUsd < amountBeingSpentUsd {
			return "", lib.LogAndError(lib.LOG_ERROR, "Spender allowance is $USD%.2f (USDC token: %s) on smartContractId=%s, which is too low for this predictionIntent ($USD%.2f, price_usd=%.2f)", spenderAllowanceUsd, usdcAddress.String(), _smartContractId.String(), amountBeingSpentUsd, req.PriceUsd)
		}

		// ensure the spenderAllowanceUsd is <= usdc balance currently in the user's wallet
		currentUserBalanceUsdcInt64, err := lib.GetUsdcBalanceUsd(*_networkSelected, accountId)
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to get user's USDC balance: %v", err)
		}
		currentUserBalanceUsdc := float64(currentUserBalanceUsdcInt64) / math.Pow(10, float64(usdcDecimals))

		lib.Log(lib.LOG_INFO, "Current USDC balance for account %s: $%.2f", accountId.String(), currentUserBalanceUsdc)
		lib.Log(lib.LOG_INFO, "Spender allowance for account %s: $%.2f", accountId.String(), spenderAllowanceUsd)
		if spenderAllowanceUsd <= currentUserBalanceUsdc {
			// OK
		} else {
			if amountBeingSpentUsd <= currentUserBalanceUsdc {
				// this is also OK - let's not warn the user that their allowance is higher than their balance
			} else {
				return "", lib.LogAndError(lib.LOG_ERROR, "Spender allowance ($USD%.2f) is greater than than the user's balance ($USD%.2f)", spenderAllowanceUsd, currentUserBalanceUsdc)
			}
		}
		// OK if we got here
		lib.Log(lib.LOG_INFO, "[primary] User has enough allowance and balance to cover this order of $USD%.2f", amountBeingSpentUsd)
	case "s":
		// secondary orders - additional checks for secondary orders
		// ensure (on-chain read-only check) that the user has enough position tokens to cover their (secondary) predictionIntent
		// this transfer will be attempted on-chain and will fail if there aren't enough position tokens to transfer, even if this API-side check fails

		// get user position tokens balance for this market
		// call: getUserTokens(uint128 marketId, address user)
		nYesPositionTokens, nNoPositionTokens, err := pis.natsService.hederaService.GetUserPositionTokenBalance(*_networkSelected, req.MarketId, req.EvmAddress)
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to get user's position token balance: %v", err)
		}
		lib.Log(lib.LOG_INFO, "[secondary] User has %.8f 'yes' position tokens and %.8f 'no' position tokens on market %s", nYesPositionTokens, nNoPositionTokens, req.MarketId)

		if req.PriceUsd > 0 {
			// this is a secondary YES order - the user transfers YES tokens to the contract
			if nYesPositionTokens >= req.Qty {
				// OK - user has enough "yes" position tokens to cover this secondary YES order
				lib.Log(lib.LOG_INFO, "[secondary] User has %.8f 'yes' position tokens for market %s, which is enough to cover this secondary YES order of %.8f tokens", nYesPositionTokens, req.MarketId, req.Qty)
			} else {
				return "", lib.LogAndError(lib.LOG_ERROR, "user has %.8f 'yes' position tokens but needs %.8f to place this secondary YES order", nYesPositionTokens, req.Qty)
			}
		} else {
			// this is a secondary NO order - the user transfers NO tokens to the contract
			if nNoPositionTokens >= req.Qty {
				// OK - user has enough "no" position tokens to cover this secondary NO order
				lib.Log(lib.LOG_INFO, "[secondary] User has %.8f 'no' position tokens for market %s, which is enough to cover this secondary NO order of %.8f tokens", nNoPositionTokens, req.MarketId, req.Qty)
			} else {
				return "", lib.LogAndError(lib.LOG_ERROR, "user has %.8f 'no' position tokens but needs %.8f to place this secondary NO order", nNoPositionTokens, req.Qty)
			}
		}
	default:
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid PrimarySecondary value: %s. Must be 'p' for primary or 's' for secondary.", req.PrimarySecondary)
	}

	/////
	///// OK - All validations passed
	/////
	// Now you can (attempt to) put the order on the CLOB (subject to on-chain sig verification)

	/////
	// notify the CLOB via NATS:
	/////

	// Marshal the CLOB req: *pb_api.PredictionIntentRequest to JSON
	clobRequestObj := &pb_clob.CreateOrderRequestClob{
		TxId:             req.TxId,
		Net:              req.Net,
		MarketId:         req.MarketId,
		AccountId:        req.AccountId,
		PriceUsd:         req.PriceUsd,
		Qty:              req.Qty, // the clob will decrement this value over time as matches occur
		QtyOrig:          req.Qty, // need to keep track of the original qty for on/off-chain signature validation
		Sig:              req.Sig,
		PublicKey:        req.PublicKey, // passing extra key info - i) avoid lookups ii) handle situation where user has changed their key
		EvmAddress:       req.EvmAddress,
		KeyType:          int32(req.KeyType),
		PrimarySecondary: req.PrimarySecondary,
	}
	clobRequestJSON, err := json.Marshal(clobRequestObj)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to marshal CLOB request: %v", err)
	}

	// Publish the message to NATS:
	err = pis.natsService.Publish(lib.SUBJECT_CLOB_ORDERS, clobRequestJSON)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to publish to NATS: %v", err)
	}

	lib.Log(lib.LOG_INFO, "Published order to NATS subject '%s': %s", lib.SUBJECT_CLOB_ORDERS, string(clobRequestJSON))

	/////
	// finally, store the predictionIntent object in the database (after successfully publishing notification to the CLOB)
	/////
	// store the OrderRequest in the database - the txid must be unique or this fails
	_, err = pis.predictionIntentsRepository.CreateOrderIntentRequest(req)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "database error: failed to save order request: %v", err)
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
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to cancel prediction intent: %v", err)
	}

	// TODO - in future, this will be done using NATS/Jetstream
	// 2 - Notify the CLOB via NATS:
	// cancelRequestObj := &pb_clob.CancelOrderRequest{
	// 	MarketId: req.MarketId,
	// 	TxId:     req.TxId,
	// }
	// cancelRequestJSON, err := json.Marshal(cancelRequestObj)
	// if err != nil {
	// 	return nil, lib.LogAndError(lib.LOG_ERROR, "failed to marshal CLOB cancel request: %v", err)
	// }

	// // Publish the cancellation message to NATS:
	// err = pis.natsService.Publish(lib.NATS_CLOB_CANCEL_ORDERS, cancelRequestJSON)
	// if err != nil {
	// 	return nil, lib.LogAndError(lib.LOG_ERROR, "failed to publish cancel to NATS: %v", err)
	// }

	// debug: published cancel order payload to NATS subject

	// TODO - use NATS
	clobAddr := os.Getenv("CLOB_HOST") + ":" + os.Getenv("CLOB_PORT")

	conn, err := grpc.NewClient(clobAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to cancel order (marketId=%s, txId=%s) - connect to CLOB gRPC server failed: %v", marketId, txId, err)
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
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to cancel order (marketId=%s, txId=%s) on the CLOB (%s): %v", marketId, txId, clobAddr, err)
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
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get prediction intent by MarketId %s: %v", marketId, err)
	}
	return predictionIntent, nil
}

func (pis *PredictionIntentsService) GetAllPredictionIntentsForMarketIdAndAccountId(marketId uuid.UUID) ([]string, error) {
	predictionIntent, err := pis.predictionIntentsRepository.GetAllAccountIdsForMarketId(marketId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get all users with open orders for marketId: %s (%v)", marketId.String(), err)
	}
	return predictionIntent, nil
}

func (pis *PredictionIntentsService) GetAllPredictionIntents(limit int32, offset int32) ([]*pb_api.PrismPredictionIntentRequest, error) {
	predictionIntents, err := pis.predictionIntentsRepository.GetAllPredictionIntents(int(limit), int(offset))
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get all prediction intents: %v", err)
	}

	// Map []sqlc.PredictionIntent to []*pb_api.PrismPredictionIntentRequest
	var pbPredictionIntents []*pb_api.PrismPredictionIntentRequest
	for _, pi := range predictionIntents {

		pbPredictionIntents = append(pbPredictionIntents, &pb_api.PrismPredictionIntentRequest{
			TxId:             pi.TxID.String(),
			Net:              pi.Net,
			MarketId:         pi.MarketID.String(),
			AccountId:        pi.AccountID,
			PriceUsd:         pi.PriceUsd,
			Qty:              pi.Qty,
			Sig:              pi.Sig,
			PublicKey:        pi.PublicKeyHex,
			EvmAddress:       pi.Evmaddress,
			KeyType:          uint32(pi.Keytype),
			GeneratedAt:      pi.GeneratedAt.Format(time.RFC3339),
			PrimarySecondary: pi.PrimarySecondary,
		})
	}

	return pbPredictionIntents, nil
}

/*
*
this function returs the available Usd liquidity in the orderbook (for a market order)
*/
func (pis *PredictionIntentsService) getAvailableLiquidityUsdForMarket(priceUsd float64, marketId string) (float64, error) {
	if math.Abs(priceUsd) != 1.0 {
		return 0.0, lib.LogAndError(lib.LOG_ERROR, "priceUsd must be either 1.0 (for buy/long orders) or -1.0 (for sell/short orders)")
	}

	clobAddr := os.Getenv("CLOB_HOST") + ":" + os.Getenv("CLOB_PORT")

	conn, err := grpc.NewClient(clobAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "Failed to open grpc connection to CLOB %v", err)
	}
	defer conn.Close()

	clobClient := pb_clob.NewClobInternalClient(conn)
	result, err := clobClient.GetMarketDepthQty(
		context.Background(),
		&pb_clob.MarketIdRequest{
			MarketId: marketId,
		},
	)
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "failed to get market depth qty from CLOB (%s): %v", clobAddr, err)
	}

	qty := 0.0
	if priceUsd > 0 {
		qty = result.QtyBid
	} else {
		qty = result.QtyAsk
	}

	return qty, nil
}
