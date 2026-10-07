package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
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
	go pis.runOrderOutbox()
	// pis.hederaService = hederaService

	lib.Log(lib.LOG_INFO, "Service: PredictionIntents service initialized successfully, %p", pis)

	return nil
}

// minOrderLifetime rejects authorizations that would expire before they could settle.
const minOrderLifetime = 60 * time.Second

// CreatePredictionIntent accepts a signed PrismV2 Authorization. It checks everything
// the contract will check (domain, limits, signature) plus funding, then commits the
// order and its CLOB outbox message atomically.
func (pis *PredictionIntentsService) CreatePredictionIntent(req *pb_api.PrismPredictionIntentRequest) (string, error) {
	/////
	// validations
	/////
	netSelectedByUser := strings.ToLower(req.Net)
	if !lib.IsValidNetwork(netSelectedByUser) {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid network: %s", req.Net)
	}
	cfg, err := lib.GetPrismV2Network(netSelectedByUser)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "PrismV2 is not configured for %s: %v", netSelectedByUser, err)
	}

	accountId, err := hiero.AccountIDFromString(req.AccountId)
	if err != nil {
		return "Invalid accountId format", err
	}

	// The authorization must be bound to this network's chain and PrismV2 proxy.
	if req.ChainId != cfg.ChainID {
		return "", lib.LogAndError(lib.LOG_ERROR, "chainId %d does not match %s (%d)", req.ChainId, netSelectedByUser, cfg.ChainID)
	}
	if !strings.EqualFold(req.VerifyingContract, cfg.ProxyAddress) {
		return "", lib.LogAndError(lib.LOG_ERROR, "verifyingContract %s is not the PrismV2 proxy %s", req.VerifyingContract, cfg.ProxyAddress)
	}

	auth, err := lib.NewAuthorizationV2(req.ChainId, req.VerifyingContract, req.EvmAddress, req.MarketId, req.TxId, req.Side, req.Action, req.LimitYesPrice, req.QtyShares, req.CollateralCap, req.Deadline)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid authorization: %v", err)
	}
	now := time.Now().UTC()
	if req.Deadline < uint64(now.Add(minOrderLifetime).Unix()) {
		return "", lib.LogAndError(lib.LOG_ERROR, "deadline %d is in the past or less than %s away", req.Deadline, minOrderLifetime)
	}
	isBid := lib.IsBid(auth.Side, auth.Action)
	if (isBid && req.LimitYesPrice == 0) || (!isBid && req.LimitYesPrice == lib.PriceScale) {
		return "", lib.LogAndError(lib.LOG_ERROR, "limitYesPrice %d can never be filled for this side and action", req.LimitYesPrice)
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

	// The public key must belong to the account, and the signer address must be that
	// account: PrismV2 asks the Hedera Account Service to check the signature for the signer.
	publicKeyLookedUp, keyTypeLookedUp, err := lib.GetPublicKey(accountId, netSelectedByUser)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get public key: %v", err)
	}
	if !lib.IsValidKeyType(req.KeyType) || lib.HederaKeyType(req.KeyType) != keyTypeLookedUp {
		return "", lib.LogAndError(lib.LOG_ERROR, "keyType mismatch: expected %d, got %d", keyTypeLookedUp, req.KeyType)
	}
	publicKey, err := hiero.PublicKeyFromString(req.PublicKey)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to parse public key from string: %v", err)
	}
	if publicKeyLookedUp.String() != publicKey.String() || publicKey.String() == "" {
		return "", lib.LogAndError(lib.LOG_ERROR, "public key mismatch: expected %s, got %s", publicKeyLookedUp.String(), publicKey.String())
	}
	ledger, err := hiero.LedgerIDFromString(netSelectedByUser)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get network selected: %v", err)
	}
	signerAccount, err := lib.EvmAddressToHederaAccountId(*ledger, req.EvmAddress)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to resolve signer address %s: %v", req.EvmAddress, err)
	}
	if signerAccount.String() != accountId.String() {
		return "", lib.LogAndError(lib.LOG_ERROR, "signer address %s belongs to %s, not %s", req.EvmAddress, signerAccount, accountId)
	}

	isValidSig, err := auth.VerifySignature(&publicKey, req.Sig)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to verify signature: %v", err)
	}
	if !isValidSig {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid signature for account %s", req.AccountId)
	}
	lib.Log(lib.LOG_INFO, "**Signature is valid for account %s**", req.AccountId)

	// The market must be tradeable in the database and OPEN on the PrismV2 proxy.
	tradeable, err := pis.marketsRepository.IsMarketTradeable(req.MarketId)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to determine whether market %s is tradeable: %v", req.MarketId, err)
	}
	if !tradeable {
		return "", lib.LogAndError(lib.LOG_ERROR, "market %s is not tradeable (it may be resolved, closed, paused, suspended, or deleted)", req.MarketId)
	}
	market, err := pis.marketsRepository.GetMarketById(req.MarketId, true)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get tradeable market %s: %v", req.MarketId, err)
	}
	if market.SmartContractID != cfg.ContractID.String() {
		return "", lib.LogAndError(lib.LOG_ERROR, "market %s is on contract %s, not the PrismV2 proxy %s", req.MarketId, market.SmartContractID, cfg.ContractID)
	}
	onChain, err := lib.GetMarketV2(netSelectedByUser, cfg.ContractID, auth.MarketID)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to read market %s from PrismV2: %v", req.MarketId, err)
	}
	if onChain.State != lib.MarketOpen || onChain.CloseTime <= uint64(now.Unix()) {
		return "", lib.LogAndError(lib.LOG_ERROR, "market %s is not open for trading on PrismV2 (state %s, closes %d)", req.MarketId, onChain.State, onChain.CloseTime)
	}

	// A limit at the extreme of the range is a market order: refuse it unless the
	// book can fill it now, rather than leave the user with a partial fill to cancel.
	if (isBid && req.LimitYesPrice == lib.PriceScale) || (!isBid && req.LimitYesPrice == 0) {
		available, err := pis.getAvailableLiquiditySharesForMarket(isBid, req.MarketId)
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to get available liquidity for market %s: %v", req.MarketId, err)
		}
		if req.QtyShares > available {
			return "", lib.LogAndError(lib.LOG_ERROR, "order quantity %d exceeds available liquidity %d for market %s", req.QtyShares, available, req.MarketId)
		}
	}

	if auth.Action == lib.ActionBUY {
		// A BUY can spend up to collateralCap: the user must have allowed and hold that much.
		usdcAddress, err := hiero.ContractIDFromString(os.Getenv(fmt.Sprintf("%s_USDC_ADDRESS", strings.ToUpper(netSelectedByUser))))
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to validate %s_USDC_ADDRESS: %v", strings.ToUpper(netSelectedByUser), err)
		}
		allowance, err := lib.GetSpenderAllowance(*ledger, accountId, cfg.ContractID, usdcAddress)
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to get spender allowance: %v", err)
		}
		if allowance < req.CollateralCap {
			return "", lib.LogAndError(lib.LOG_ERROR, "allowance %d to %s is below the order's collateral cap %d", allowance, cfg.ContractID, req.CollateralCap)
		}
		balance, err := lib.GetUsdcBalanceUsd(*ledger, accountId) // smallest units
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to get user's USDC balance: %v", err)
		}
		if balance < req.CollateralCap {
			return "", lib.LogAndError(lib.LOG_ERROR, "USDC balance %d is below the order's collateral cap %d", balance, req.CollateralCap)
		}
	} else {
		// A SELL needs the shares on chain, net of the user's other open SELLs on that side.
		yesBalance, noBalance, err := pis.natsService.hederaService.GetUserPositionBalancesV2(netSelectedByUser, cfg.ContractID, req.MarketId, req.EvmAddress)
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to get position balances: %v", err)
		}
		held := yesBalance
		if auth.Side == lib.SideNO {
			held = noBalance
		}
		openOrders, err := pis.predictionIntentsRepository.GetAllOpenPredictionIntentsByMarketIdAndAccountId(auth.MarketID, req.AccountId)
		if err != nil {
			return "", lib.LogAndError(lib.LOG_ERROR, "failed to load existing open orders: %v", err)
		}
		reserved := uint64(0)
		for _, row := range openOrders {
			order, err := clobOrderFromIntent(&row)
			if err != nil || lib.Action(order.Action) != lib.ActionSELL || lib.Side(order.Side) != auth.Side {
				continue
			}
			reserved += order.QtyShares - order.SharesFilled
		}
		if reserved+req.QtyShares > held {
			return "", lib.LogAndError(lib.LOG_ERROR, "insufficient shares: holding %d, %d reserved by open sells, order needs %d", held, reserved, req.QtyShares)
		}
	}

	/////
	///// OK - All validations passed: commit the order and notify the CLOB via the outbox
	/////
	unitScale, err := lib.CollateralUnitScale()
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "%v", err)
	}
	clobRequestObj := &pb_clob.CreateOrderRequestClob{
		TxId:              req.TxId,
		Net:               netSelectedByUser,
		MarketId:          req.MarketId,
		AccountId:         req.AccountId,
		Sig:               req.Sig,
		PublicKey:         req.PublicKey, // passing extra key info - i) avoid lookups ii) handle situation where user has changed their key
		EvmAddress:        req.EvmAddress,
		KeyType:           int32(req.KeyType),
		ChainId:           req.ChainId,
		VerifyingContract: strings.ToLower(req.VerifyingContract),
		Side:              req.Side,
		Action:            req.Action,
		LimitYesPrice:     req.LimitYesPrice,
		QtyShares:         req.QtyShares,
		CollateralCap:     req.CollateralCap,
		Deadline:          req.Deadline,
	}
	clobRequestJSON, err := json.Marshal(clobRequestObj)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to marshal CLOB request: %v", err)
	}

	// Commit the order and outbox atomically before publication. The background
	// dispatcher retries until NATS acknowledges the message.
	_, err = pis.predictionIntentsRepository.CreateOrderIntentRequestWithOutbox(req, float64(unitScale), lib.SUBJECT_CLOB_ORDERS, clobRequestJSON)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "database error: failed to save order request: %v", err)
	}

	return fmt.Sprintf("txId accepted for durable CLOB delivery %s", req.TxId), nil
}

func (pis *PredictionIntentsService) runOrderOutbox() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for range ticker.C {
		records, err := pis.predictionIntentsRepository.PendingOrderOutbox(100)
		if err != nil { lib.Log(lib.LOG_ERROR, "order outbox poll failed: %v", err); continue }
		for _, record := range records {
			if err := pis.natsService.PublishWithID(record.Subject, record.Payload, record.TxID.String()); err != nil {
				_ = pis.predictionIntentsRepository.RecordOrderOutboxFailure(record.ID, err)
				continue
			}
			if err := pis.predictionIntentsRepository.MarkOrderOutboxDelivered(record.ID); err != nil {
				lib.Log(lib.LOG_ERROR, "failed to mark order outbox delivered (id=%d): %v", record.ID, err)
			}
		}
	}
}

func (pis *PredictionIntentsService) CancelPredictionIntent(net string, marketId string, txId string, accountIdStr string, sigBase64 string, publicKeyStr string, keyType uint32) (*pb_api.StdResponse, error) {
	// guards

	// net is validated by protobuf

	// marketId must be a valid UUIDv7
	_, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid marketId uuid: %v", err)
	}

	// txId must be a valid UUIDv7
	_, err = uuid.Parse(txId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid txId uuid: %v", err)
	}

	// accountId must be a valid Hedera account ID
	accountId, err := hiero.AccountIDFromString(accountIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid accountId format: %v", err)
	}

	// First look up the Hedera accountId against the mirror node
	publicKeyLookedUp, keyTypeLookedUp, err := lib.GetPublicKey(accountId, net)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get public key: %v", err)
	}
	lib.Log(lib.LOG_INFO, "Mirror node response for account %s on network %s: %s", accountId, net, publicKeyLookedUp.String())

	// keyType sent from the front-end (no 0x prefix) must match the keyType looked up on the mirror node
	if !lib.IsValidKeyType(keyType) {
		return nil, lib.LogAndError(lib.LOG_ERROR, "keyType mismatch: expected %d, got %d", keyTypeLookedUp, keyType)
	}

	// public key sent from the front-end (no 0x prefix) must match the public key looked up on the mirror node
	publicKey, err := hiero.PublicKeyFromString(publicKeyStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to parse public key from string: %v", err)
	}
	if publicKeyLookedUp.String() != publicKey.String() || publicKey.String() == "" {
		return nil, lib.LogAndError(lib.LOG_ERROR, "public key mismatch: expected %s, got %s", publicKeyLookedUp.String(), publicKey.String())
	}

	// verify that this accountId owns the predictionIntent with this txId and marketId
	predictionIntent, err := pis.predictionIntentsRepository.GetPredictionIntentByTxId(txId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get prediction intent by txId %s: %v", txId, err)
	}
	if predictionIntent == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "no prediction intent found for txId %s", txId)
	}
	if predictionIntent.AccountID != accountIdStr {
		return nil, lib.LogAndError(lib.LOG_ERROR, "accountId %s does not own prediction intent with txId %s (owned by accountId %s)", accountIdStr, txId, predictionIntent.AccountID)
	}
	if predictionIntent.MarketID.String() != marketId {
		return nil, lib.LogAndError(lib.LOG_ERROR, "marketId %s does not match prediction intent with txId %s (marketId is %s)", marketId, txId, predictionIntent.MarketID.String())
	}

	// check that the order is still open (not already cancelled or filled)
	if predictionIntent.CancelledAt.Valid {
		return nil, lib.LogAndError(lib.LOG_ERROR, "prediction intent with txId %s is already cancelled at %s", txId, predictionIntent.CancelledAt.Time.String())
	}

	// now validate the signature is correct:
	// sig = sign(txId, privateKey)
	// isValidSig = verify(publicKey, txId, sig)
	isValidSig, err := lib.VerifySig(&publicKey, lib.Utf82hex(txId), sigBase64)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to verify signature: %v", err)
	}
	if !isValidSig {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid signature for account %s", accountIdStr)
	}

	return pis.CancelPredictionIntentNoSigCheck(marketId, txId)
}

func (pis *PredictionIntentsService) CancelPredictionIntentNoSigCheck(marketId string, txId string) (*pb_api.StdResponse, error) {
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

func (pis *PredictionIntentsService) GetAllPredictionIntents(limit int32, offset int32) (*pb_api.PredictionIntentsResponse, error) {
	_limit := lib.ClampLimit(limit)

	predictionIntents, err := pis.predictionIntentsRepository.GetAllPredictionIntents(int(_limit), int(offset))
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get all prediction intents: %v", err)
	}

	total, err := pis.predictionIntentsRepository.CountAllPredictionIntents()
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to count all prediction intents: %v", err)
	}

	// Map []sqlc.PredictionIntent to []*pb_api.PrismPredictionIntentRequest
	var pbPredictionIntents []*pb_api.PrismPredictionIntentRequest
	for _, pi := range predictionIntents {

		order, err := clobOrderFromIntent(&pi)
		if err != nil {
			continue // legacy V1 rows have no authorization to show
		}
		pbPredictionIntents = append(pbPredictionIntents, &pb_api.PrismPredictionIntentRequest{
			TxId:              order.TxId,
			Net:               order.Net,
			MarketId:          order.MarketId,
			AccountId:         order.AccountId,
			Sig:               order.Sig,
			PublicKey:         order.PublicKey,
			EvmAddress:        order.EvmAddress,
			KeyType:           uint32(order.KeyType),
			ChainId:           order.ChainId,
			VerifyingContract: order.VerifyingContract,
			Side:              order.Side,
			Action:            order.Action,
			LimitYesPrice:     order.LimitYesPrice,
			QtyShares:         order.QtyShares,
			CollateralCap:     order.CollateralCap,
			Deadline:          order.Deadline,
		})
	}

	return &pb_api.PredictionIntentsResponse{
		PredictionIntents: pbPredictionIntents,
		Pagination:        lib.NewPagination(_limit, offset, total, len(pbPredictionIntents)),
	}, nil
}

// getAvailableLiquiditySharesForMarket returns the resting shares a market order can
// take: the asks for an incoming bid, the bids for an incoming ask.
func (pis *PredictionIntentsService) getAvailableLiquiditySharesForMarket(incomingIsBid bool, marketId string) (uint64, error) {
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
		return 0, lib.LogAndError(lib.LOG_ERROR, "failed to get market depth from CLOB (%s): %v", clobAddr, err)
	}

	if incomingIsBid {
		return result.SharesAsk, nil
	}
	return result.SharesBid, nil
}

func (pis *PredictionIntentsService) GetTxHashes(txId string) (*pb_api.TxIdHashesResponse, error) {
	txHashes, err := pis.predictionIntentsRepository.GetTxHashes(txId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get tx hashes by txId: %v", err)
	}

	_txHashes := make([]*pb_api.TxHash, len(txHashes))
	for i, txHash := range txHashes {
		_txHashes[i] = &pb_api.TxHash{
			TxHash: txHash.TxHash,
			Qty:    txHash.Qty.(float64),
		}
	}

	return &pb_api.TxIdHashesResponse{
		TxHashes: _txHashes,
	}, nil
}
