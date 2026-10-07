package services

import (
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	pb_api "api/gen"
	pb_clob "api/gen/clob"
	"api/gen/sqlc"
	"api/server/lib"
	repositories "api/server/repositories"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

// settleGas covers two HAS signature checks and up to two HTS transfers.
const settleGas = 5_000_000

type settlementOutcome int

const (
	settlementDone     settlementOutcome = iota // settled (now or previously): acknowledge
	settlementRetry                             // transient or ambiguous: redeliver later
	settlementRejected                          // can never settle: terminate the message
)

// settleMatchV2 settles one CLOB fill on PrismV2. The persisted, signature-verified
// orders are authoritative; the CLOB message only says which orders matched, how
// much and at what price. The on-chain match ID makes resubmission safe.
func (ns *NatsService) settleMatchV2(m *pb_clob.ClobMatch) (settlementOutcome, error) {
	if m == nil || m.Bid == nil || m.Ask == nil {
		return settlementRejected, errors.New("incomplete match message")
	}
	if m.Bid.MarketId != m.MarketId || m.Ask.MarketId != m.MarketId {
		return settlementRejected, fmt.Errorf("market mismatch: match=%s bid=%s ask=%s", m.MarketId, m.Bid.MarketId, m.Ask.MarketId)
	}

	bidRow, err := ns.predictionIntentsRepository.GetPredictionIntentByTxId(m.Bid.TxId)
	if err != nil {
		return settlementRetry, fmt.Errorf("load bid %s: %w", m.Bid.TxId, err)
	}
	askRow, err := ns.predictionIntentsRepository.GetPredictionIntentByTxId(m.Ask.TxId)
	if err != nil {
		return settlementRetry, fmt.Errorf("load ask %s: %w", m.Ask.TxId, err)
	}
	for _, row := range []*sqlc.PredictionIntent{bidRow, askRow} {
		if row.ProtocolVersion != 2 {
			return settlementRejected, fmt.Errorf("order %s is not a PrismV2 authorization", row.TxID)
		}
		if row.MarketID.String() != strings.ToLower(m.MarketId) {
			return settlementRejected, fmt.Errorf("order %s belongs to market %s", row.TxID, row.MarketID)
		}
	}
	if bidRow.Net != askRow.Net {
		return settlementRejected, fmt.Errorf("network mismatch: %s vs %s", bidRow.Net, askRow.Net)
	}
	if strings.EqualFold(bidRow.Evmaddress, askRow.Evmaddress) {
		return settlementRejected, errors.New("self-match: bid and ask have the same signer")
	}

	net := bidRow.Net
	cfg, err := lib.GetPrismV2Network(net)
	if err != nil {
		return settlementRetry, fmt.Errorf("PrismV2 configuration: %w", err)
	}
	market, err := ns.hederaService.marketsRepository.GetMarketById(m.MarketId, true)
	if err != nil {
		return settlementRetry, fmt.Errorf("load market %s: %w", m.MarketId, err)
	}
	if market.SmartContractID != cfg.ContractID.String() {
		return settlementRejected, fmt.Errorf("market %s is on contract %s, not the configured PrismV2 proxy %s", m.MarketId, market.SmartContractID, cfg.ContractID)
	}

	bidAuth, err := authorizationFromIntent(bidRow)
	if err != nil {
		return settlementRejected, fmt.Errorf("bid %s: %w", bidRow.TxID, err)
	}
	askAuth, err := authorizationFromIntent(askRow)
	if err != nil {
		return settlementRejected, fmt.Errorf("ask %s: %w", askRow.TxID, err)
	}
	for _, a := range []lib.AuthorizationV2{bidAuth, askAuth} {
		if a.ChainID.Uint64() != cfg.ChainID || strings.TrimPrefix(a.VerifyingContract, "0x") != cfg.ProxyAddress {
			return settlementRejected, fmt.Errorf("order %s is bound to a different chain or contract", a.TxID)
		}
	}
	if !lib.IsBid(bidAuth.Side, bidAuth.Action) || lib.IsBid(askAuth.Side, askAuth.Action) {
		return settlementRejected, errors.New("the bid leg must buy YES exposure and the ask leg must sell it")
	}

	fill, price := m.FillShares, m.ExecutionYesPrice
	yesCollateral, noCollateral, err := lib.SplitCollateral(fill, price)
	if err != nil {
		return settlementRejected, err
	}
	if m.YesCollateral != yesCollateral || m.NoCollateral != noCollateral {
		return settlementRejected, fmt.Errorf("CLOB collateral split (%d/%d) disagrees with the contract rule (%d/%d)", m.YesCollateral, m.NoCollateral, yesCollateral, noCollateral)
	}
	matchID, err := lib.MatchID(cfg.ProxyAddress, bidAuth.MarketID, bidAuth.TxID, askAuth.TxID, m.Bid.SharesFilled, m.Ask.SharesFilled, fill, price)
	if err != nil {
		return settlementRejected, err
	}
	unitScale, err := lib.CollateralUnitScale()
	if err != nil {
		return settlementRetry, err
	}
	record := repositories.MatchV2{
		MarketID:          bidAuth.MarketID,
		BidTxID:           bidAuth.TxID,
		AskTxID:           askAuth.TxID,
		MatchID:           "0x" + hex.EncodeToString(matchID[:]),
		FillShares:        fill,
		ExecutionYesPrice: price,
		YesCollateral:     yesCollateral,
		NoCollateral:      noCollateral,
		BidCollateral:     lib.LegCollateral(bidAuth.Side, yesCollateral, noCollateral),
		AskCollateral:     lib.LegCollateral(askAuth.Side, yesCollateral, noCollateral),
		UnitScale:         float64(unitScale),
	}
	row, err := ns.matchesRepository.CreateMatchV2(record)
	if err != nil {
		return settlementRetry, err
	}
	if row.Status == "finalized" {
		lib.Log(lib.LOG_WARN, "acknowledging redelivery of finalized match %s", record.MatchID)
		return settlementDone, nil
	}

	// A previous attempt may have executed even though we never saw its receipt.
	executed, err := lib.IsMatchExecutedV2(net, cfg.ContractID, matchID)
	if err != nil {
		return settlementRetry, fmt.Errorf("check executedMatches: %w", err)
	}
	if executed {
		return ns.finalizeMatchV2(net, record, row.TxHash, bidRow, askRow)
	}

	// Everything below gates a *new* submission. It must come after the checks above:
	// a fill that already executed has to be finalized even if an order has since been
	// cancelled, expired or (in the database) filled further.
	reject := func(err error) (settlementOutcome, error) {
		if markErr := ns.matchesRepository.MarkMatchFailed(record.MatchID, err); markErr != nil {
			lib.Log(lib.LOG_ERROR, "failed to mark match %s failed: %v", record.MatchID, markErr)
		}
		if row.Attempts > 0 {
			// An earlier submission may have executed but not reached the mirror node yet:
			// retry so the executedMatches check above runs again before giving up.
			return settlementRetry, err
		}
		return settlementRejected, err
	}
	for _, row := range []*sqlc.PredictionIntent{bidRow, askRow} {
		// Honour a cancellation that raced with the match.
		if row.CancelledAt.Valid || row.EvictedAt.Valid {
			return reject(fmt.Errorf("order %s was cancelled or evicted before settlement", row.TxID))
		}
	}
	now := uint64(time.Now().Unix())
	legs := []struct {
		auth lib.AuthorizationV2
		row  *sqlc.PredictionIntent
	}{{bidAuth, bidRow}, {askAuth, askRow}}
	for _, leg := range legs {
		a := leg.auth
		if err := lib.CheckLimit(a.Side, a.Action, a.LimitYesPrice.Uint64(), price); err != nil {
			return reject(fmt.Errorf("order %s: %w", a.TxID, err))
		}
		if a.Deadline < now {
			return reject(fmt.Errorf("order %s expired at %d", a.TxID, a.Deadline))
		}
		// The persisted fill state counts only finalized fills, exactly like the contract.
		sharesFilled, err := strconv.ParseUint(leg.row.SharesFilled, 10, 64)
		if err != nil {
			return settlementRetry, fmt.Errorf("order %s: invalid shares_filled: %w", a.TxID, err)
		}
		if sharesFilled+fill > a.QtyShares.Uint64() || sharesFilled+fill < sharesFilled {
			return reject(fmt.Errorf("order %s: fill of %d exceeds remaining quantity", a.TxID, fill))
		}
		if a.Action == lib.ActionBUY {
			collateralFilled, err := strconv.ParseUint(leg.row.CollateralFilled, 10, 64)
			if err != nil {
				return settlementRetry, fmt.Errorf("order %s: invalid collateral_filled: %w", a.TxID, err)
			}
			if collateralFilled+lib.LegCollateral(a.Side, yesCollateral, noCollateral) > a.CollateralCap.Uint64() {
				return reject(fmt.Errorf("order %s: fill exceeds the collateral cap", a.TxID))
			}
		}
	}

	sigMapBid, err := signatureMap(bidRow)
	if err != nil {
		return settlementRejected, fmt.Errorf("bid %s: %w", bidRow.TxID, err)
	}
	sigMapAsk, err := signatureMap(askRow)
	if err != nil {
		return settlementRejected, fmt.Errorf("ask %s: %w", askRow.TxID, err)
	}
	calldata, err := lib.EncodeSettleCalldata(bidAuth, sigMapBid, askAuth, sigMapAsk, fill, price, matchID)
	if err != nil {
		return settlementRejected, err
	}

	txHash, err := ns.hederaService.SubmitSettlement(net, cfg.ContractID, calldata, func(hederaTxID string) {
		if err := ns.matchesRepository.MarkMatchSubmitted(record.MatchID, hederaTxID); err != nil {
			lib.Log(lib.LOG_ERROR, "failed to mark match %s submitted: %v", record.MatchID, err)
		}
	})
	if err != nil {
		// A revert or a lost receipt may still mean the match executed (for example
		// MatchAlreadyExecuted). Mirror state lags, so a negative answer is retried.
		if executed, checkErr := lib.IsMatchExecutedV2(net, cfg.ContractID, matchID); checkErr == nil && executed {
			return ns.finalizeMatchV2(net, record, txHash, bidRow, askRow)
		}
		if markErr := ns.matchesRepository.MarkMatchFailed(record.MatchID, err); markErr != nil {
			lib.Log(lib.LOG_ERROR, "failed to mark match %s failed: %v", record.MatchID, markErr)
		}
		return settlementRetry, fmt.Errorf("settle %s: %w", record.MatchID, err)
	}
	return ns.finalizeMatchV2(net, record, txHash, bidRow, askRow)
}

// finalizeMatchV2 records an on-chain settlement. A database failure is retried:
// the redelivery finds the match executed on chain and finalizes without resubmitting.
func (ns *NatsService) finalizeMatchV2(net string, record repositories.MatchV2, txHash string, bidRow *sqlc.PredictionIntent, askRow *sqlc.PredictionIntent) (settlementOutcome, error) {
	if txHash == "" || txHash == "notYetAvailable" {
		txHash = "executed:" + record.MatchID
	}
	applied, err := ns.matchesRepository.FinalizeMatchV2(record, txHash)
	if err != nil {
		lib.Log(lib.LOG_CRITICAL, "match %s settled on chain but finalization failed (will retry): %v", record.MatchID, err)
		return settlementRetry, err
	}
	if applied {
		ns.hederaService.recordFillBookkeeping(net, record, bidRow, askRow)
	}
	return settlementDone, nil
}

// SubmitSettlement executes PrismV2.settle with prebuilt calldata and waits for the receipt.
// onSubmitted is called with the Hedera transaction ID once the network accepts the transaction.
func (hs *HederaService) SubmitSettlement(net string, contractID hiero.ContractID, calldata []byte, onSubmitted func(hederaTxID string)) (string, error) {
	client, ok := hs.hedera_clients[net]
	if !ok || client == nil {
		return "", fmt.Errorf("no Hedera client for %s", net)
	}
	response, err := hiero.NewContractExecuteTransaction().
		SetContractID(contractID).
		SetGas(settleGas).
		SetFunctionParameters(calldata).
		Execute(client)
	if err != nil {
		return "", fmt.Errorf("submit settle: %w", err)
	}
	txHash := response.TransactionID.String()
	if onSubmitted != nil {
		onSubmitted(txHash)
	}
	receipt, err := response.GetReceipt(client)
	if err != nil {
		return txHash, fmt.Errorf("settle receipt: %w", err)
	}
	if receipt.Status != hiero.StatusSuccess {
		return txHash, fmt.Errorf("settle status %s", receipt.Status.String())
	}
	lib.Log(lib.LOG_INFO, "PrismV2 settle succeeded: %s", txHash)
	return txHash, nil
}

// recordFillBookkeeping updates the derived price, position and volume data after a
// fill is finalized. Failures are logged; they never cause a settlement retry.
func (hs *HederaService) recordFillBookkeeping(net string, record repositories.MatchV2, bidRow *sqlc.PredictionIntent, askRow *sqlc.PredictionIntent) {
	marketID := record.MarketID.String()
	price := float64(record.ExecutionYesPrice) / float64(lib.PriceScale)

	if err := hs.priceRepository.SavePriceHistory(marketID, record.BidTxID.String(), price); err != nil {
		lib.Log(lib.LOG_ERROR, "match %s: save price history: %v", record.MatchID, err)
	}

	if record.FillShares <= math.MaxInt64 {
		for _, row := range []*sqlc.PredictionIntent{bidRow, askRow} {
			hs.applyPositionDelta(marketID, row, int64(record.FillShares), record.ExecutionYesPrice)
		}
	}

	if err := hs.dbRepository.UpdateTotalValueMatchedUsd(float64(record.FillShares) / record.UnitScale); err != nil {
		lib.Log(lib.LOG_ERROR, "match %s: update total value matched: %v", record.MatchID, err)
	}

	hcsTxID, err := hs.PublishHCSmessage(net, fmt.Sprintf("[%s,%s,%s]", record.BidTxID, record.AskTxID, record.MatchID))
	if err != nil {
		lib.Log(lib.LOG_ERROR, "match %s: publish HCS message: %v", record.MatchID, err)
		return
	}
	if err := hs.matchesRepository.SetMatchHcsTxId(record.MatchID, hcsTxID); err != nil {
		lib.Log(lib.LOG_ERROR, "match %s: record HCS transaction: %v", record.MatchID, err)
	}
}

// applyPositionDelta moves one signer's YES or NO balance by a fill. Cost basis uses the
// price of the token traded: YES at the execution price, NO at its complement.
func (hs *HederaService) applyPositionDelta(marketID string, row *sqlc.PredictionIntent, fill int64, executionYesPrice uint64) {
	nYes, nNo := int64(0), int64(0)
	positions, err := hs.positionsRepository.GetUserPositionsByMarketId(row.Evmaddress, marketID)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "positions for %s on %s: %v", row.Evmaddress, marketID, err)
		return
	}
	if len(positions) > 0 {
		nYes, nNo = positions[0].NYes, positions[0].NNo
	}
	delta := fill
	if lib.Action(row.Action.Int16) == lib.ActionSELL {
		delta = -fill
	}
	tokenPrice := float64(executionYesPrice) / float64(lib.PriceScale)
	if lib.Side(row.Side.Int16) == lib.SideYES {
		nYes += delta
	} else {
		nNo += delta
		tokenPrice = 1 - tokenPrice
	}
	if _, err := hs.positionsRepository.UpsertUserPositions(row.Evmaddress, marketID, max(nYes, 0), max(nNo, 0), tokenPrice); err != nil {
		lib.Log(lib.LOG_ERROR, "update positions for %s on %s: %v", row.Evmaddress, marketID, err)
	}
}

// authorizationFromIntent rebuilds the signed Authorization from a persisted order.
func authorizationFromIntent(row *sqlc.PredictionIntent) (lib.AuthorizationV2, error) {
	if !row.ChainID.Valid || !row.VerifyingContract.Valid || !row.Side.Valid || !row.Action.Valid ||
		!row.LimitYesPrice.Valid || !row.Deadline.Valid {
		return lib.AuthorizationV2{}, errors.New("missing V2 authorization fields")
	}
	qty, err := parseNumeric(row.QtyShares)
	if err != nil {
		return lib.AuthorizationV2{}, fmt.Errorf("qty_shares: %w", err)
	}
	collateralCap, err := parseNumeric(row.CollateralCap)
	if err != nil {
		return lib.AuthorizationV2{}, fmt.Errorf("collateral_cap: %w", err)
	}
	return lib.NewAuthorizationV2(
		uint64(row.ChainID.Int64), row.VerifyingContract.String, row.Evmaddress,
		row.MarketID.String(), row.TxID.String(),
		uint32(row.Side.Int16), uint32(row.Action.Int16),
		uint64(row.LimitYesPrice.Int64), qty, collateralCap, uint64(row.Deadline.Int64),
	)
}

// clobOrderFromIntent is the CLOB representation of a persisted order and its fill state.
func clobOrderFromIntent(row *sqlc.PredictionIntent) (*pb_clob.CreateOrderRequestClob, error) {
	a, err := authorizationFromIntent(row)
	if err != nil {
		return nil, err
	}
	sharesFilled, err := strconv.ParseUint(row.SharesFilled, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("shares_filled: %w", err)
	}
	collateralFilled, err := strconv.ParseUint(row.CollateralFilled, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("collateral_filled: %w", err)
	}
	return &pb_clob.CreateOrderRequestClob{
		TxId:              row.TxID.String(),
		Net:               row.Net,
		MarketId:          row.MarketID.String(),
		AccountId:         row.AccountID,
		Sig:               row.Sig,
		PublicKey:         row.PublicKeyHex,
		EvmAddress:        row.Evmaddress,
		KeyType:           row.Keytype,
		ChainId:           a.ChainID.Uint64(),
		VerifyingContract: strings.TrimPrefix(a.VerifyingContract, "0x"),
		Side:              uint32(a.Side),
		Action:            uint32(a.Action),
		LimitYesPrice:     a.LimitYesPrice.Uint64(),
		QtyShares:         a.QtyShares.Uint64(),
		CollateralCap:     a.CollateralCap.Uint64(),
		Deadline:          a.Deadline,
		SharesFilled:      sharesFilled,
		CollateralFilled:  collateralFilled,
	}, nil
}

// signatureMap wraps a persisted signature in the protobuf SignatureMap HAS expects.
func signatureMap(row *sqlc.PredictionIntent) ([]byte, error) {
	publicKey, err := lib.PublicKeyForKeyType(row.PublicKeyHex, lib.HederaKeyType(row.Keytype))
	if err != nil {
		return nil, fmt.Errorf("public key: %w", err)
	}
	sig, err := base64.StdEncoding.DecodeString(row.Sig)
	if err != nil {
		return nil, fmt.Errorf("signature: %w", err)
	}
	return lib.BuildSignatureMap(publicKey, sig, lib.HederaKeyType(row.Keytype))
}

func parseNumeric(value sql.NullString) (uint64, error) {
	if !value.Valid {
		return 0, errors.New("missing value")
	}
	return strconv.ParseUint(value.String, 10, 64)
}

// predictionIntentResponseFromRow is the public view of a persisted PrismV2 order.
func predictionIntentResponseFromRow(row *sqlc.PredictionIntent) (*pb_api.PredictionIntentResponse, error) {
	order, err := clobOrderFromIntent(row)
	if err != nil {
		return nil, err
	}
	return &pb_api.PredictionIntentResponse{
		TxId:             order.TxId,
		Net:              order.Net,
		MarketId:         order.MarketId,
		GeneratedAt:      row.GeneratedAt.UTC().Format(time.RFC3339),
		AccountId:        order.AccountId,
		Side:             order.Side,
		Action:           order.Action,
		LimitYesPrice:    order.LimitYesPrice,
		QtyShares:        order.QtyShares,
		CollateralCap:    order.CollateralCap,
		Deadline:         order.Deadline,
		SharesFilled:     order.SharesFilled,
		CollateralFilled: order.CollateralFilled,
	}, nil
}
