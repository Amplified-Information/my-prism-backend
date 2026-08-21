package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"

	pb_api "api/gen"
)

type PredictionIntentsRepository struct {
	db *sql.DB
}

func (pir *PredictionIntentsRepository) CloseDb() error {
	var err = pir.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (pir *PredictionIntentsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	pir.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "PredictionIntentsRepository")
	return nil
}

// SaveOrderRequest saves an order request to the database
func (pir *PredictionIntentsRepository) CreateOrderIntentRequest(req *pb_api.PrismPredictionIntentRequest) (*sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, lib.ErrorLog("could not connect to database")
	}

	txUUID, err := uuid.Parse(req.TxId)
	if err != nil {
		return nil, lib.ErrorLog("invalid txId uuid", "error", err, "txId", req.TxId)
	}

	marketUUID, err := uuid.Parse(req.MarketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", req.MarketId)
	}

	generatedAt, err := time.Parse(time.RFC3339, req.GeneratedAt) // Zulu time (RFC3339)
	if err != nil {
		return nil, lib.ErrorLog("invalid GeneratedAt timestamp", "error", err, "generatedAt", req.GeneratedAt)
	}
	generatedAt = generatedAt.UTC()

	params := sqlc.CreatePredictionIntentParams{
		TxID:             txUUID,
		Net:              req.Net,
		MarketID:         marketUUID,
		AccountID:        req.AccountId,
		PriceUsd:         req.PriceUsd,
		QtyOrig:          req.Qty,
		QtyRem:           req.Qty,
		Sig:              req.Sig,
		GeneratedAt:      generatedAt,
		PublicKeyHex:     req.PublicKey,
		Evmaddress:       req.EvmAddress,
		Keytype:          int32(req.KeyType),
		PrimarySecondary: req.PrimarySecondary,
	}

	q := sqlc.New(pir.db)
	newPredictionIntent, err := q.CreatePredictionIntent(context.Background(), params)
	if err != nil {
		return nil, lib.ErrorLog("CreatePredictionIntent failed", "error", err, "accountId", req.AccountId, "txId", req.TxId)
	}

	lib.Info("prediction intent saved", "accountId", req.AccountId, "txId", req.TxId)
	return &newPredictionIntent, nil
}

func (pir *PredictionIntentsRepository) CancelPredictionIntent(txId string) error {
	if pir.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	txUUID, err := uuid.Parse(txId)
	if err != nil {
		return lib.ErrorLog("invalid txId uuid", "error", err, "txId", txId)
	}

	q := sqlc.New(pir.db)
	err = q.CancelPredictionIntent(context.Background(), txUUID)
	if err != nil {
		return lib.ErrorLog("CancelPredictionIntent failed", "error", err, "txId", txId)
	}

	lib.Info("prediction intent cancelled", "txId", txId)
	return nil
}

func (pir *PredictionIntentsRepository) GetAllOpenPredictionIntentsByMarketId(marketId string) (*[]sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(pir.db)
	predictionIntents, err := q.GetAllOpenPredictionIntentsByMarketId(context.Background(), marketUUID)
	if err != nil {
		return nil, lib.ErrorLog("GetAllOpenPredictionIntentsByMarketId failed", "error", err, "marketId", marketId)
	}

	filtered := make([]sqlc.PredictionIntent, 0, len(predictionIntents))
	for _, pi := range predictionIntents {
		if isOpenPredictionIntent(pi) {
			filtered = append(filtered, pi)
		}
	}

	return &filtered, nil
}

func (dbRepository *DbRepository) MarkPredictionIntentAsRegenerated(txId string) error {
	if dbRepository.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(dbRepository.db)
	err := q.MarkPredictionIntentAsRegenerated(context.Background(), uuid.MustParse(txId))
	if err != nil {
		return lib.ErrorLog("MarkPredictionIntentAsRegenerated failed", "error", err, "txId", txId)
	}

	lib.Info("called MarkPredictionIntentAsRegenerated", "txId", txId)
	return nil
}

func (pir *PredictionIntentsRepository) UpdatePredictionIntentQtyRem(marketId string, txId string, qtyToSubtract float64) error {
	if pir.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	txUUID, err := uuid.Parse(txId)
	if err != nil {
		return lib.ErrorLog("invalid txId uuid", "error", err, "txId", txId)
	}

	q := sqlc.New(pir.db)
	_, err = q.DecrementPredictionIntentQtyRem(context.Background(), sqlc.DecrementPredictionIntentQtyRemParams{
		MarketID: marketUUID,
		TxID:     txUUID,
		QtyRem:   qtyToSubtract,
	})
	if err != nil {
		return lib.ErrorLog("DecrementPredictionIntentQtyRem failed", "error", err, "marketId", marketId, "txId", txId, "qtyToSubtract", qtyToSubtract)
	}

	lib.Info("updated prediction intent remaining qty", "marketId", marketId, "txId", txId, "qtyToSubtract", qtyToSubtract)
	return nil
}

func (pir *PredictionIntentsRepository) MarkPredictionIntentAsFullyMatched(marketId string, txId string) error {
	if pir.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	txUUID, err := uuid.Parse(txId)
	if err != nil {
		return lib.ErrorLog("invalid txId uuid", "error", err, "txId", txId)
	}

	q := sqlc.New(pir.db)
	_, err = q.MarkPredictionIntentAsFullyMatched(context.Background(), sqlc.MarkPredictionIntentAsFullyMatchedParams{
		MarketID: marketUUID,
		TxID:     txUUID,
	})
	if err != nil {
		return lib.ErrorLog("MarkPredictionIntentAsFullyMatched failed", "error", err, "marketId", marketId, "txId", txId)
	}

	lib.Info("called MarkPredictionIntentAsFullyMatched", "marketId", marketId, "txId", txId)
	return nil
}

func (pir *PredictionIntentsRepository) MarkPredictionIntentAsRedeemedForAccount(marketId string, evmAddress string) error {
	if pir.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(pir.db)
	err = q.MarkPredictionIntentAsRedeemedForAccount(context.Background(), sqlc.MarkPredictionIntentAsRedeemedForAccountParams{
		MarketID:   marketUUID,
		Evmaddress: evmAddress,
	})
	if err != nil {
		return lib.ErrorLog("MarkPredictionIntentAsRedeemed failed", "error", err, "marketId", marketId, "evmAddress", evmAddress)
	}

	lib.Info("called MarkPredictionIntentAsRedeemedForAccount", "marketId", marketId, "evmAddress", evmAddress)
	return nil
}

func (pir *PredictionIntentsRepository) GetAllAccountIdsForMarketId(marketId uuid.UUID) ([]string, error) {
	if pir.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(pir.db)
	accountIds, err := q.GetAllAccountIdsForMarketId(context.Background(), marketId)
	if err != nil {
		return nil, lib.ErrorLog("GetAllAccountIdsForMarketId failed", "error", err, "marketId", marketId.String())
	}

	return accountIds, nil
}

func (pir *PredictionIntentsRepository) GetAllOpenPredictionIntentsByMarketIdAndAccountId(marketId uuid.UUID, accountId string) ([]sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(pir.db)
	orderIntents, err := q.GetAllOpenPredictionIntentsByMarketIdAndAccountId(context.Background(), sqlc.GetAllOpenPredictionIntentsByMarketIdAndAccountIdParams{
		MarketID:  marketId,
		AccountID: accountId,
	})
	if err != nil {
		return nil, lib.ErrorLog("GetAllOpenPredictionIntentsByMarketIdAndAccountId failed", "error", err, "marketId", marketId.String(), "accountId", accountId)
	}

	filtered := make([]sqlc.PredictionIntent, 0, len(orderIntents))
	for _, pi := range orderIntents {
		if isOpenPredictionIntent(pi) {
			filtered = append(filtered, pi)
		}
	}

	return filtered, nil
}

// GetMatchedQtyForPredictionIntent returns the total matched quantity for a tx across all match rows.
// It uses qty1 when txId is on the YES side and qty2 when txId is on the NO side.
func (pir *PredictionIntentsRepository) GetMatchedQtyForPredictionIntent(marketId uuid.UUID, txId uuid.UUID) (float64, error) {
	if pir.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(pir.db)
	matches, err := q.GetAllMatchesForMarketIdTxId(context.Background(), sqlc.GetAllMatchesForMarketIdTxIdParams{
		MarketID: marketId,
		TxId1:    txId,
	})
	if err != nil {
		return 0, lib.ErrorLog("GetAllMatchesForMarketIdTxId failed", "error", err, "marketId", marketId.String(), "txId", txId.String())
	}

	matchedQty := 0.0
	for _, match := range matches {
		if match.TxId1 == txId {
			matchedQty += match.Qty1
		} else if match.TxId2 == txId {
			matchedQty += match.Qty2
		}
	}

	return matchedQty, nil
}

func (pir *PredictionIntentsRepository) MarkPredictionIntentAsEvicted(txId uuid.UUID) error {
	if pir.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(pir.db)
	err := q.MarkPredictionIntentAsEvicted(context.Background(), txId)
	if err != nil {
		return lib.ErrorLog("MarkPredictionIntentAsEvicted failed", "error", err, "txId", txId.String())
	}
	return nil
}

func (pir *PredictionIntentsRepository) GetAllOpenPredictionIntentsByEvmAddress(evmAddress string) ([]sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(pir.db)
	predictionIntents, err := q.GetAllOpenPredictionIntentsByEvmAddress(context.Background(), evmAddress)
	if err != nil {
		return nil, lib.ErrorLog("GetAllOpenPredictionIntentsByEvmAddress failed", "error", err, "evmAddress", evmAddress)
	}

	filtered := make([]sqlc.PredictionIntent, 0, len(predictionIntents))
	for _, pi := range predictionIntents {
		if isOpenPredictionIntent(pi) {
			filtered = append(filtered, pi)
		}
	}

	return filtered, nil
}

func (pir *PredictionIntentsRepository) GetAllMatchedPredictionIntentsByEvmAddress(evmAddress string) ([]sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(pir.db)
	predictionIntents, err := q.GetAllMatchedPredictionIntentsByEvmAddress(context.Background(), evmAddress)
	if err != nil {
		return nil, lib.ErrorLog("GetAllMatchedPredictionIntentsByEvmAddress failed", "error", err, "evmAddress", evmAddress)
	}

	return predictionIntents, nil
}

func (pir *PredictionIntentsRepository) GetAllPredictionIntents(limit int, offset int) ([]sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(pir.db)
	predictionIntents, err := q.GetAllPredictionIntents(context.Background(), sqlc.GetAllPredictionIntentsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, lib.ErrorLog("GetAllPredictionIntents failed", "error", err, "limit", limit, "offset", offset)
	}

	return predictionIntents, nil
}

func (pir *PredictionIntentsRepository) CountAllPredictionIntents() (int64, error) {
	if pir.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(pir.db)
	total, err := q.CountAllPredictionIntents(context.Background())
	if err != nil {
		return 0, lib.ErrorLog("CountAllPredictionIntents failed", "error", err)
	}

	return total, nil
}

func (pir *PredictionIntentsRepository) GetTotalValueUsdForMarketId(marketId string) (float64, error) {
	if pir.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return 0, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(pir.db)
	totalValueUsd, err := q.GetTotalValueUsdForMarketId(context.Background(), marketUUID)
	if err != nil {
		return 0, lib.ErrorLog("GetTotalValueUsdForMarketId failed", "error", err, "marketId", marketId)
	}

	return totalValueUsd, nil
}

func (pir *PredictionIntentsRepository) GetPredictionIntentByTxId(txId string) (*sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	txUUID, err := uuid.Parse(txId)
	if err != nil {
		return nil, lib.ErrorLog("invalid txId uuid", "error", err, "txId", txId)
	}

	q := sqlc.New(pir.db)
	predictionIntent, err := q.GetPredictionIntentByTxId(context.Background(), txUUID)
	if err != nil {
		return nil, lib.ErrorLog("GetPredictionIntentByTxId failed", "error", err, "txId", txId)
	}

	return &predictionIntent, nil
}

func (pir *PredictionIntentsRepository) GetTxHashes(txId string) ([]sqlc.GetTxHashesByTxIdRow, error) {
	if pir.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	txUUID, err := uuid.Parse(txId)
	if err != nil {
		return nil, lib.ErrorLog("invalid txId uuid", "error", err, "txId", txId)
	}

	q := sqlc.New(pir.db)
	txHashes, err := q.GetTxHashesByTxId(context.Background(), txUUID)
	if err != nil {
		return nil, lib.ErrorLog("GetTxHashesByTxId failed", "error", err, "txId", txId)
	}

	return txHashes, nil
}

func isOpenPredictionIntent(pi sqlc.PredictionIntent) bool {
	if pi.QtyRem <= 0 {
		return false
	}
	if pi.CancelledAt.Valid || pi.FullyMatchedAt.Valid || pi.EvictedAt.Valid {
		return false
	}
	return true
}
