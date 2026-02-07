package repositories

import (
	sqlc "api/gen/sqlc"
	"context"
	"database/sql"
	"fmt"
	"log"
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
		return fmt.Errorf("failed to close database: %v", err)
	}
	return nil
}

func (pir *PredictionIntentsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}
	pir.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	log.Println("DB: PredictionIntentsRepository connected successfully")
	return nil
}

// SaveOrderRequest saves an order request to the database
func (pir *PredictionIntentsRepository) CreateOrderIntentRequest(req *pb_api.PredictionIntentRequest) (*sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, fmt.Errorf("could not connect to database")
	}

	txUUID, err := uuid.Parse(req.TxId)
	if err != nil {
		return nil, fmt.Errorf("invalid txId uuid: %v", err)
	}

	marketUUID, err := uuid.Parse(req.MarketId)
	if err != nil {
		return nil, fmt.Errorf("invalid marketId uuid: %v", err)
	}

	generatedAt, err := time.Parse(time.RFC3339, req.GeneratedAt) // Zulu time (RFC3339)
	if err != nil {
		return nil, fmt.Errorf("invalid GeneratedAt timestamp: %v", err)
	}
	generatedAt = generatedAt.UTC()

	params := sqlc.CreatePredictionIntentParams{
		TxID:         txUUID,
		Net:          req.Net,
		MarketID:     marketUUID,
		AccountID:    req.AccountId,
		MarketLimit:  req.MarketLimit,
		PriceUsd:     req.PriceUsd,
		Qty:          req.Qty,
		Sig:          req.Sig,
		GeneratedAt:  generatedAt,
		PublicKeyHex: req.PublicKey,
		Evmaddress:   req.EvmAddress,
		Keytype:      int32(req.KeyType),
	}

	q := sqlc.New(pir.db)
	newPredictionIntent, err := q.CreatePredictionIntent(context.Background(), params)
	if err != nil {
		return nil, fmt.Errorf("CreatePredictionIntent failed: %v", err)
	}

	log.Printf("Saved prediction intent to database for account %s", req.AccountId)
	return &newPredictionIntent, nil
}

func (pir *PredictionIntentsRepository) CancelPredictionIntent(txId string) error {
	if pir.db == nil {
		return fmt.Errorf("database not initialized")
	}

	txUUID, err := uuid.Parse(txId)
	if err != nil {
		return fmt.Errorf("invalid txId uuid: %v", err)
	}

	q := sqlc.New(pir.db)
	err = q.CancelPredictionIntent(context.Background(), txUUID)
	if err != nil {
		return fmt.Errorf("CancelPredictionIntent failed: %v", err)
	}

	log.Printf("Cancelled prediction intent in database for txId: %s", txId)
	return nil
}

func (pir *PredictionIntentsRepository) GetAllOpenPredictionIntentsByMarketId(marketId string) (*[]sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, fmt.Errorf("invalid marketId uuid: %v", err)
	}

	q := sqlc.New(pir.db)
	predictionIntents, err := q.GetAllOpenPredictionIntentsByMarketId(context.Background(), marketUUID)
	if err != nil {
		return nil, fmt.Errorf("GetAllOpenPredictionIntentsByMarketId failed: %v", err)
	}

	// log.Printf("Fetched %d prediction intents from database for market ID: %s", len(predictionIntents), marketId)
	return &predictionIntents, nil
}

func (dbRepository *DbRepository) MarkPredictionIntentAsRegenerated(txId string) error {
	if dbRepository.db == nil {
		return fmt.Errorf("database not initialized")
	}

	q := sqlc.New(dbRepository.db)
	err := q.MarkPredictionIntentAsRegenerated(context.Background(), uuid.MustParse(txId))
	if err != nil {
		return fmt.Errorf("MarkPredictionIntentAsRegenerated failed: %v", err)
	}
	return nil
}

func (pir *PredictionIntentsRepository) MarkPredictionIntentAsFullyMatched(marketId string, txId string) error {
	if pir.db == nil {
		return fmt.Errorf("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return fmt.Errorf("invalid marketId uuid: %v", err)
	}

	txUUID, err := uuid.Parse(txId)
	if err != nil {
		return fmt.Errorf("invalid txId uuid: %v", err)
	}

	q := sqlc.New(pir.db)
	_, err = q.MarkPredictionIntentAsFullyMatched(context.Background(), sqlc.MarkPredictionIntentAsFullyMatchedParams{
		MarketID: marketUUID,
		TxID:     txUUID,
	})
	if err != nil {
		return fmt.Errorf("MarkPredictionIntentAsFullyMatched failed: %v", err)
	}

	log.Printf("Marked prediction intent as fully matched in database for txId: %s", txId)
	return nil
}

func (pir *PredictionIntentsRepository) GetAllAccountIdsForMarketId(marketId uuid.UUID) ([]string, error) {
	if pir.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(pir.db)
	accountIds, err := q.GetAllAccountIdsForMarketId(context.Background(), marketId)
	if err != nil {
		return nil, fmt.Errorf("GetAllAccountIdsForMarketId failed: %v", err)
	}

	return accountIds, nil
}

func (pir *PredictionIntentsRepository) GetAllOpenPredictionIntentsByMarketIdAndAccountId(marketId uuid.UUID, accountId string) ([]sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(pir.db)
	orderIntents, err := q.GetAllOpenPredictionIntentsByMarketIdAndAccountId(context.Background(), sqlc.GetAllOpenPredictionIntentsByMarketIdAndAccountIdParams{
		MarketID:  marketId,
		AccountID: accountId,
	})
	if err != nil {
		return nil, fmt.Errorf("GetAllOpenPredictionIntentsByMarketIdAndAccountId failed: %v", err)
	}

	return orderIntents, nil
}

func (pir *PredictionIntentsRepository) MarkPredictionIntentAsEvicted(txId uuid.UUID) error {
	if pir.db == nil {
		return fmt.Errorf("database not initialized")
	}

	q := sqlc.New(pir.db)
	err := q.MarkPredictionIntentAsEvicted(context.Background(), txId)
	if err != nil {
		return fmt.Errorf("MarkPredictionIntentAsEvicted failed: %v", err)
	}
	return nil
}

func (pir *PredictionIntentsRepository) GetAllOpenPredictionIntentsByEvmAddress(evmAddress string) ([]sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(pir.db)
	predictionIntents, err := q.GetAllOpenPredictionIntentsByEvmAddress(context.Background(), evmAddress)
	if err != nil {
		return nil, fmt.Errorf("GetAllOpenPredictionIntentsByEvmAddress failed: %v", err)
	}

	return predictionIntents, nil
}

func (pir *PredictionIntentsRepository) GetAllPredictionIntents(limit int, offset int) ([]sqlc.PredictionIntent, error) {
	if pir.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(pir.db)
	predictionIntents, err := q.GetAllPredictionIntents(context.Background(), sqlc.GetAllPredictionIntentsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("GetAllPredictionIntents failed: %v", err)
	}

	return predictionIntents, nil
}