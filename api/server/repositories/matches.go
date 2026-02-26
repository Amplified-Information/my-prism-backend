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

	// txId1 MUST be the YES side (positive priceUsd)
	// txId2 MUST be the NO side (negative priceUsd)
	// the CLOB should already be enforcing this on the way in to this function - if not, error here
	if orderRequestClobTuple[0].PriceUsd < 0 {
		return nil, lib.ErrorLog("txId1 must be the YES side (positive priceUsd)", "txId1", orderRequestClobTuple[0].TxId, "priceUsd", orderRequestClobTuple[0].PriceUsd)
	}
	if orderRequestClobTuple[1].PriceUsd > 0 {
		return nil, lib.ErrorLog("txId2 must be the NO side (negative priceUsd)", "txId2", orderRequestClobTuple[1].TxId, "priceUsd", orderRequestClobTuple[1].PriceUsd)
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

// func (dbRepository *DbRepository) CreateMatch(sideYes *pb_clob.CreateOrderRequestClob, sideNo *pb_clob.CreateOrderRequestClob, txHash string) error {
// 	// guards
// 	if dbRepository.db == nil {
// 		return fmt.Errorf("database not initialized")
// 	}

// 	txId1, err := uuid.Parse(sideYes.TxId)
// 	if err != nil {
// 		return fmt.Errorf("invalid txId1 uuid: %v", err)
// 	}

// 	txId2, err := uuid.Parse(sideNo.TxId)
// 	if err != nil {
// 		return fmt.Errorf("invalid txId2 uuid: %v", err)
// 	}

// 	marketUUID, err := uuid.Parse(sideYes.MarketId)
// 	if err != nil {
// 		return fmt.Errorf("invalid marketId uuid: %v", err)
// 	}

// 	if len(txHash) == 0 {
// 		return fmt.Errorf("txHash must be non-empty")
// 	}

// 	// OK
// 	params := sqlc.CreateMatchParams{
// 		MarketID:      marketUUID,
// 		TxId1:         txId1,
// 		TxId2:         txId2,
// 		Qty1Remaining: sideYes.Qty,
// 		Qty2Remaining: sideNo.Qty,
// 		TxHash:        sql.NullString{String: txHash, Valid: txHash != ""},
// 	}

// 	q := sqlc.New(dbRepository.db)
// 	_, err = q.CreateMatch(context.Background(), params)
// 	if err != nil {
// 		return fmt.Errorf("CreateMatch failed: %v", err)
// 	}

// 	return nil
// }

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
