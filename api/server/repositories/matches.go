package repositories

import (
	sqlc "api/gen/sqlc"
	"context"
	"database/sql"
	"fmt"
	"log"
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
		return fmt.Errorf("failed to close database: %v", err)
	}
	return nil
}

func (matchesRepository *MatchesRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}
	matchesRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	log.Println("DB: MatchesRepository connected successfully")
	return nil
}

// Record the match in the database for auditing
func (matchesRepository *MatchesRepository) CreateMatch(orderRequestClobTuple [2]*pb_clob.CreateOrderRequestClob, txHash string) (*sqlc.Match, error) {
	// guards
	if matchesRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	// txId1 MUST be the YES side (positive priceUsd)
	// txId2 MUST be the NO side (negative priceUsd)
	// the CLOB should already be enforcing this on the way in to this function - if not, error here
	if orderRequestClobTuple[0].PriceUsd < 0 {
		return nil, fmt.Errorf("txId1 must be the YES side (positive priceUsd), but got negative priceUsd: %f", orderRequestClobTuple[0].PriceUsd)
	}
	if orderRequestClobTuple[1].PriceUsd > 0 {
		return nil, fmt.Errorf("txId2 must be the NO side (negative priceUsd), but got positive priceUsd: %f", orderRequestClobTuple[1].PriceUsd)
	}

	// marketIds should match
	if orderRequestClobTuple[0].MarketId != orderRequestClobTuple[1].MarketId {
		return nil, fmt.Errorf("marketIds do not match: %s vs %s", orderRequestClobTuple[0].MarketId, orderRequestClobTuple[1].MarketId)
	}

	marketId, err := uuid.Parse(orderRequestClobTuple[0].MarketId)
	if err != nil {
		return nil, fmt.Errorf("invalid marketId uuid: %v", err)
	}

	txId1, err := uuid.Parse(orderRequestClobTuple[0].TxId)
	if err != nil {
		return nil, fmt.Errorf("invalid txId1 uuid: %v", err)
	}

	txId2, err := uuid.Parse(orderRequestClobTuple[1].TxId)
	if err != nil {
		return nil, fmt.Errorf("invalid txId2 uuid: %v", err)
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
		return nil, fmt.Errorf("failed to record match for txIds %s and %s: %v", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId, err)
	}

	log.Printf("Recorded match on database for txIds: {%s, %s}", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)

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

func (matchesRepository *MatchesRepository) UpdateMatchTxHash(marketId string, tx1 string, tx2 string, txHash string) error {
	if matchesRepository.db == nil {
		return fmt.Errorf("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return fmt.Errorf("invalid marketId uuid: %v", err)
	}

	txId1, err := uuid.Parse(tx1)
	if err != nil {
		return fmt.Errorf("invalid txId1 uuid: %v", err)
	}

	txId2, err := uuid.Parse(tx2)
	if err != nil {
		return fmt.Errorf("invalid txId2 uuid: %v", err)
	}

	q := sqlc.New(matchesRepository.db)
	err = q.UpdateMatchTxHash(context.Background(), sqlc.UpdateMatchTxHashParams{
		MarketID: marketUUID,
		TxId1:    txId1,
		TxId2:    txId2,
		TxHash:   txHash,
	})
	if err != nil {
		return fmt.Errorf("UpdateMatchTxHash failed: %v", err)
	}

	log.Printf("Updated match txHash on database for txIds: {%s, %s}", tx1, tx2)

	return nil
}

func (matchesRepository *MatchesRepository) GetAllMatchesForMarketIdTxId(marketID uuid.UUID, txId uuid.UUID) ([]sqlc.Match, error) {
	if matchesRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	q := sqlc.New(matchesRepository.db)
	matches, err := q.GetAllMatchesForMarketIdTxId(context.Background(), sqlc.GetAllMatchesForMarketIdTxIdParams{
		MarketID: marketID,
		TxId1:    txId,
	})
	if err != nil {
		return nil, fmt.Errorf("GetAllMatchesForMarketIdTxId failed: %v", err)
	}

	return matches, nil
}
