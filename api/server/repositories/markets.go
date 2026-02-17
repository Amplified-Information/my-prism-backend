package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
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
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (marketsRepository *MarketsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	marketsRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "MarketsRepository")
	return nil
}

func (marketsRepository *MarketsRepository) GetMarketById(marketId string) (*sqlc.Market, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(marketsRepository.db)
	market, err := q.GetMarket(context.Background(), marketUUID)
	if err != nil {
		return nil, lib.ErrorLog("GetMarket failed", "error", err, "marketId", marketId)
	}

	// debug: fetched market from database
	return &market, nil
}

func (marketsRepository *MarketsRepository) GetMarkets(limit int32, offset int32) ([]sqlc.Market, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	markets, err := q.GetMarkets(context.Background(), sqlc.GetMarketsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, lib.ErrorLog("GetMarkets failed", "error", err, "limit", limit, "offset", offset)
	}

	// debug: fetched markets from database
	return markets, nil
}

func (marketsRepository *MarketsRepository) CreateMarket(marketId string, _net string, _imageUrl string, _statement string, _closesAt string, _description string, smartContractId string) (*sqlc.Market, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	net := strings.ToLower(_net)
	isValid := lib.IsValidNetwork(net)
	if !isValid {
		return nil, lib.ErrorLog("invalid network", "network", net)
	}

	imageUrl := strings.TrimSpace(_imageUrl)

	statement := strings.TrimSpace(_statement)

	isValidSmartContractId := lib.IsValidAccountId(smartContractId)
	if !isValidSmartContractId {
		return nil, lib.ErrorLog("invalid smart contract ID", "smartContractId", smartContractId)
	}

	closesAt := time.Now().Add(30 * 24 * time.Hour) // default: 30 days from now
	if _closesAt != "" {                            // the optional param is not set
		closesAtTime, err := time.Parse(time.RFC3339, _closesAt)
		if err != nil {
			return nil, lib.ErrorLog("invalid closesAt time format (must be RFC3339)", "error", err, "closesAt", _closesAt)
		}
		closesAt = closesAtTime
	}

	description := strings.TrimSpace(_description)

	// OK
	// Start a transaction
	tx, err := marketsRepository.db.Begin()
	if err != nil {
		return nil, lib.ErrorLog("failed to begin transaction", "error", err)
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
		return nil, lib.ErrorLog("CreateMarket failed", "error", err, "marketId", marketId)
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return nil, lib.ErrorLog("failed to commit transaction", "error", err)
	}

	lib.Info("market created", "marketId", market.MarketID.String())
	return &market, nil
}

func (marketsRepository *MarketsRepository) CountUnresolvedMarkets() (int64, error) {
	if marketsRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	count, err := q.CountUnresolvedMarkets(context.Background())
	if err != nil {
		return 0, lib.ErrorLog("CountUnresolvedMarkets failed", "error", err)
	}

	return count, nil
}

func (marketsRepository *MarketsRepository) GetAllUnresolvedMarkets() ([]sqlc.Market, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	markets, err := q.GetAllUnresolvedMarkets(context.Background())
	if err != nil {
		return nil, lib.ErrorLog("GetUnresolvedMarkets failed", "error", err)
	}

	return markets, nil
}
