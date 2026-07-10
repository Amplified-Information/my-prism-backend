package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"

	pb_clob "api/gen/clob"

	"github.com/google/uuid"
)

type MatchesRepository struct {
	db *sql.DB
}

func (matchesRepository *MatchesRepository) CloseDb() error {
	var err = matchesRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (matchesRepository *MatchesRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	matchesRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "MatchesRepository")
	return nil
}

// Record the match in the database for auditing
func (matchesRepository *MatchesRepository) CreateMatch(orderRequestClobTuple [2]*pb_clob.CreateOrderRequestClob, txHash string) (*sqlc.Match, error) {
	// guards
	if matchesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	// // Normalize tuple order by sign so txId1/qty1 is always YES-side (positive)
	// // and txId2/qty2 is always NO-side (negative), independent of publish order.
	// if orderRequestClobTuple[0].PriceUsd < 0 && orderRequestClobTuple[1].PriceUsd > 0 {
	// 	orderRequestClobTuple[0], orderRequestClobTuple[1] = orderRequestClobTuple[1], orderRequestClobTuple[0]
	// } else if !(orderRequestClobTuple[0].PriceUsd > 0 && orderRequestClobTuple[1].PriceUsd < 0) {
	// 	return nil, lib.ErrorLog("invalid priceUsd signs for match tuple", "txId1", orderRequestClobTuple[0].TxId, "priceUsd1", orderRequestClobTuple[0].PriceUsd, "txId2", orderRequestClobTuple[1].TxId, "priceUsd2", orderRequestClobTuple[1].PriceUsd)
	// }

	// Normalize tuple to sign ordering for downstream code paths.
	// CLOB no longer does this normalization at publish time.
	if err := lib.NormalizeMatchTupleByPriceSign(&orderRequestClobTuple); err != nil {
		return nil, lib.ErrorLog("failed to normalize match tuple by price sign", "error", err)
	}

	// marketIds should match
	if orderRequestClobTuple[0].MarketId != orderRequestClobTuple[1].MarketId {
		return nil, lib.ErrorLog("marketIds do not match", "marketId1", orderRequestClobTuple[0].MarketId, "marketId2", orderRequestClobTuple[1].MarketId)
	}

	marketId, err := uuid.Parse(orderRequestClobTuple[0].MarketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", orderRequestClobTuple[0].MarketId)
	}

	txId1, err := uuid.Parse(orderRequestClobTuple[0].TxId)
	if err != nil {
		return nil, lib.ErrorLog("invalid txId1 uuid", "error", err, "txId1", orderRequestClobTuple[0].TxId)
	}

	txId2, err := uuid.Parse(orderRequestClobTuple[1].TxId)
	if err != nil {
		return nil, lib.ErrorLog("invalid txId2 uuid", "error", err, "txId2", orderRequestClobTuple[1].TxId)
	}

	// OK

	params := sqlc.CreateMatchParams{
		MarketID: marketId,
		TxId1:    txId1,
		TxId2:    txId2,
		Qty1:     orderRequestClobTuple[0].Qty,
		Qty2:     orderRequestClobTuple[1].Qty,
		TxHash:   txHash,
	}

	q := sqlc.New(matchesRepository.db)
	match, err := q.CreateMatch(context.Background(), params)
	if err != nil {
		return nil, lib.ErrorLog("failed to record match", "error", err, "txId1", orderRequestClobTuple[0].TxId, "txId2", orderRequestClobTuple[1].TxId)
	}

	lib.Info("match recorded", "txId1", orderRequestClobTuple[0].TxId, "txId2", orderRequestClobTuple[1].TxId)

	return &match, nil
}

func (matchesRepository *MatchesRepository) UpdateMatch(marketId string, tx1 string, tx2 string, txHash string, hcsTxId *string /* optional */) error {
	if matchesRepository.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	txId1, err := uuid.Parse(tx1)
	if err != nil {
		return lib.ErrorLog("invalid txId1 uuid", "error", err, "txId1", tx1)
	}

	txId2, err := uuid.Parse(tx2)
	if err != nil {
		return lib.ErrorLog("invalid txId2 uuid", "error", err, "txId2", tx2)
	}

	var hcsTxIDStr string
	if hcsTxId != nil {
		hcsTxIDStr = *hcsTxId
	}

	q := sqlc.New(matchesRepository.db)
	err = q.UpdateMatch(context.Background(), sqlc.UpdateMatchParams{
		MarketID: marketUUID,
		TxId1:    txId1,
		TxId2:    txId2,
		TxHash:   txHash,
		HcsTxID:  sql.NullString{String: hcsTxIDStr, Valid: hcsTxId != nil},
	})
	if err != nil {
		return lib.ErrorLog("UpdateMatch failed", "error", err, "marketId", marketId, "txId1", tx1, "txId2", tx2)
	}

	lib.Info("match row updated", "txId1", tx1, "txId2", tx2)

	return nil
}

func (matchesRepository *MatchesRepository) GetAllMatchesForMarketIdTxId(marketID uuid.UUID, txId uuid.UUID) ([]sqlc.Match, error) {
	if matchesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	q := sqlc.New(matchesRepository.db)
	matches, err := q.GetAllMatchesForMarketIdTxId(context.Background(), sqlc.GetAllMatchesForMarketIdTxIdParams{
		MarketID: marketID,
		TxId1:    txId,
	})
	if err != nil {
		return nil, lib.ErrorLog("GetAllMatchesForMarketIdTxId failed", "error", err, "marketId", marketID.String(), "txId", txId.String())
	}

	return matches, nil
}

func (matchesRepository *MatchesRepository) GetAllMatches(ctx context.Context, limit int, offset int) ([]sqlc.Match, error) {
	if matchesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	q := sqlc.New(matchesRepository.db)
	matches, err := q.GetAllMatches(context.Background(), sqlc.GetAllMatchesParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, lib.ErrorLog("GetAllMatches failed", "error", err, "limit", limit, "offset", offset)
	}

	return matches, nil
}

func (matchesRepository *MatchesRepository) GetPredictionIntentMatches(ctx context.Context, marketIdStr string, limit int32, offset int32) ([]sqlc.Match, error) {
	if matchesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketId, err := uuid.Parse(marketIdStr)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketIdStr)
	}

	q := sqlc.New(matchesRepository.db)
	matches, err := q.GetAllMatchesForMarketId(ctx, sqlc.GetAllMatchesForMarketIdParams{
		MarketID: marketId,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, lib.ErrorLog("GetPredictionIntentMatches failed", "error", err, "marketId", marketId, "limit", limit, "offset", offset)
	}

	return matches, nil
}
