package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

type MarketsRepository struct {
	db *sql.DB
}

func (marketsRepository *MarketsRepository) CloseDb() error {
	var err = marketsRepository.db.Close()
	if err != nil {
		return fmt.Errorf("failed to close database: %v", err)
	}
	return nil
}

func (marketsRepository *MarketsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}
	marketsRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	log.Println("DB: MarketsRepository connected successfully")
	return nil
}

func (marketsRepository *MarketsRepository) GetMarketById(marketId string) (*sqlc.Market, error) {
	if marketsRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, fmt.Errorf("invalid marketId uuid: %v", err)
	}

	q := sqlc.New(marketsRepository.db)
	market, err := q.GetMarket(context.Background(), marketUUID)
	if err != nil {
		return nil, fmt.Errorf("GetMarket failed: %v", err)
	}

	// log.Printf("Fetched market from database: %s", market.MarketID.String())
	return &market, nil
}

func (marketsRepository *MarketsRepository) GetMarkets(limit int32, offset int32) ([]sqlc.Market, error) {
	if marketsRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	markets, err := q.GetMarkets(context.Background(), sqlc.GetMarketsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("GetMarkets failed: %v", err)
	}

	// log.Printf("Fetched %d markets from database", len(markets))
	return markets, nil
}

func (marketsRepository *MarketsRepository) CreateMarket(marketId string, _net string, _imageUrl string, _statement string, _closesAt string, _description string, smartContractId string) (*sqlc.Market, error) {
	if marketsRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, fmt.Errorf("invalid marketId uuid: %v", err)
	}

	net := strings.ToLower(_net)
	isValid := lib.IsValidNetwork(net)
	if !isValid {
		return nil, fmt.Errorf("invalid network: %s", net)
	}

	imageUrl := strings.TrimSpace(_imageUrl)

	statement := strings.TrimSpace(_statement)

	isValidSmartContractId := lib.IsValidAccountId(smartContractId)
	if !isValidSmartContractId {
		return nil, fmt.Errorf("invalid smart contract ID: %s", smartContractId)
	}

	closesAt := time.Now().Add(30 * 24 * time.Hour) // default: 30 days from now
	if _closesAt != "" {                            // the optional param is not set
		closesAtTime, err := time.Parse(time.RFC3339, _closesAt)
		if err != nil {
			return nil, fmt.Errorf("invalid closesAt time format (must be RFC3339): %v", err)
		}
		closesAt = closesAtTime
	}

	description := strings.TrimSpace(_description)

	// OK
	// Start a transaction
	tx, err := marketsRepository.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}

	// Use the transaction with the query builder
	q := sqlc.New(tx)
	market, err := q.CreateMarket(context.Background(), sqlc.CreateMarketParams{
		MarketID:        marketUUID,
		Net:             net,
		Statement:       statement,
		ImageUrl:        sql.NullString{String: imageUrl, Valid: imageUrl != ""},
		SmartContractID: smartContractId,
		ClosesAt:        closesAt,
		Description:     description,
	})
	if err != nil {
		tx.Rollback() // Rollback the transaction on error
		return nil, fmt.Errorf("CreateMarket failed: %v", err)
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	log.Printf("Created new market in database: %s", market.MarketID.String())
	return &market, nil
}

func (marketsRepository *MarketsRepository) CountUnresolvedMarkets() (int64, error) {
	if marketsRepository.db == nil {
		return 0, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	count, err := q.CountUnresolvedMarkets(context.Background())
	if err != nil {
		return 0, fmt.Errorf("CountUnresolvedMarkets failed: %v", err)
	}

	return count, nil
}

func (marketsRepository *MarketsRepository) GetAllUnresolvedMarkets() ([]sqlc.Market, error) {
	if marketsRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	markets, err := q.GetAllUnresolvedMarkets(context.Background())
	if err != nil {
		return nil, fmt.Errorf("GetUnresolvedMarkets failed: %v", err)
	}

	return markets, nil
}
