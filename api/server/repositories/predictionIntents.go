package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"

	pb_api "api/gen"
)

type PredictionIntentsRepository struct {
	db *sql.DB
}

type OrderOutboxRecord struct {
	ID      int64
	TxID    uuid.UUID
	Subject string
	Payload []byte
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


// CreateOrderIntentRequestWithOutbox commits the authoritative order and its
// publication request in one database transaction. A NATS outage can delay an
// order, but can no longer create an order that exists only in the CLOB.
// unitScale is 10^collateral decimals; it only derives the legacy display columns.
func (pir *PredictionIntentsRepository) CreateOrderIntentRequestWithOutbox(req *pb_api.PrismPredictionIntentRequest, unitScale float64, subject string, payload []byte) (*sqlc.PredictionIntent, error) {
	if pir.db == nil { return nil, lib.ErrorLog("database not initialized") }
	if req.LimitYesPrice > lib.PriceScale || req.QtyShares > math.MaxInt64 || req.CollateralCap > math.MaxInt64 || req.ChainId > math.MaxInt64 || req.Deadline > math.MaxInt64 {
		return nil, lib.ErrorLog("authorization field out of range", "txId", req.TxId)
	}
	tx, err := pir.db.BeginTx(context.Background(), &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil { return nil, lib.ErrorLog("begin order transaction", "error", err) }
	defer tx.Rollback()

	txUUID, err := uuid.Parse(req.TxId)
	if err != nil { return nil, lib.ErrorLog("invalid txId uuid", "error", err) }
	marketUUID, err := uuid.Parse(req.MarketId)
	if err != nil { return nil, lib.ErrorLog("invalid marketId uuid", "error", err) }

	// Legacy columns, kept for portfolio/analytics code: bids carry a positive YES
	// price, asks a negative one; BUY maps to primary ("p") and SELL to secondary ("s").
	priceUsd := float64(req.LimitYesPrice) / float64(lib.PriceScale)
	if !lib.IsBid(lib.Side(req.Side), lib.Action(req.Action)) { priceUsd = -priceUsd }
	primarySecondary := "p"
	if lib.Action(req.Action) == lib.ActionSELL { primarySecondary = "s" }
	qty := float64(req.QtyShares) / unitScale

	q := sqlc.New(tx)
	row, err := q.CreatePredictionIntent(context.Background(), sqlc.CreatePredictionIntentParams{
		TxID: txUUID, Net: req.Net, MarketID: marketUUID, AccountID: req.AccountId,
		PriceUsd: priceUsd, QtyOrig: qty, QtyRem: qty, Sig: req.Sig,
		GeneratedAt: time.Now().UTC(), PublicKeyHex: req.PublicKey, Evmaddress: req.EvmAddress,
		Keytype: int32(req.KeyType), PrimarySecondary: primarySecondary,
		ChainID:           sql.NullInt64{Int64: int64(req.ChainId), Valid: true},
		VerifyingContract: sql.NullString{String: strings.ToLower(req.VerifyingContract), Valid: true},
		Side:              sql.NullInt16{Int16: int16(req.Side), Valid: true},
		Action:            sql.NullInt16{Int16: int16(req.Action), Valid: true},
		LimitYesPrice:     sql.NullInt64{Int64: int64(req.LimitYesPrice), Valid: true},
		QtyShares:         strconv.FormatUint(req.QtyShares, 10),
		CollateralCap:     strconv.FormatUint(req.CollateralCap, 10),
		Deadline:          sql.NullInt64{Int64: int64(req.Deadline), Valid: true},
	})
	if err != nil { return nil, lib.ErrorLog("CreatePredictionIntent failed", "error", err, "txId", req.TxId) }
	if _, err = tx.ExecContext(context.Background(), `
		INSERT INTO order_outbox (tx_id, subject, payload)
		VALUES ($1, $2, $3::jsonb)
		ON CONFLICT (tx_id, subject) DO NOTHING`, txUUID, subject, payload); err != nil {
		return nil, lib.ErrorLog("create order outbox entry", "error", err, "txId", req.TxId)
	}
	if err = tx.Commit(); err != nil { return nil, lib.ErrorLog("commit order transaction", "error", err) }
	lib.Info("prediction intent and outbox committed", "txId", req.TxId)
	return &row, nil
}

func (pir *PredictionIntentsRepository) PendingOrderOutbox(limit int) ([]OrderOutboxRecord, error) {
	if pir.db == nil { return nil, lib.ErrorLog("database not initialized") }
	rows, err := pir.db.QueryContext(context.Background(), `
		SELECT id, tx_id, subject, payload::text::bytea
		FROM order_outbox
		WHERE delivered_at IS NULL AND next_attempt_at <= NOW()
		ORDER BY id LIMIT $1`, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var result []OrderOutboxRecord
	for rows.Next() {
		var r OrderOutboxRecord
		if err := rows.Scan(&r.ID, &r.TxID, &r.Subject, &r.Payload); err != nil { return nil, err }
		result = append(result, r)
	}
	return result, rows.Err()
}

func (pir *PredictionIntentsRepository) MarkOrderOutboxDelivered(id int64) error {
	_, err := pir.db.ExecContext(context.Background(), `UPDATE order_outbox SET delivered_at=NOW(), last_error=NULL WHERE id=$1 AND delivered_at IS NULL`, id)
	return err
}

func (pir *PredictionIntentsRepository) RecordOrderOutboxFailure(id int64, cause error) error {
	_, err := pir.db.ExecContext(context.Background(), `
		UPDATE order_outbox SET attempts=attempts+1, last_error=$2,
		next_attempt_at=NOW() + LEAST(INTERVAL '5 minutes', INTERVAL '1 second' * power(2, LEAST(attempts, 8)))
		WHERE id=$1 AND delivered_at IS NULL`, id, cause.Error())
	return err
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
