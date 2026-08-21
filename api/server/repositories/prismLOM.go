package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/google/uuid"
)

type PrismLomRepository struct {
	db *sql.DB
}

func (prismLomRepository *PrismLomRepository) CloseDb() error {
	var err = prismLomRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (prismLomRepository *PrismLomRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	prismLomRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "PrismLomRepository")
	return nil
}

func (prismLomRepository *PrismLomRepository) CreateLOMentryForUserOnMarket(
	market_id uuid.UUID,
	account_id string,
	distance float64,
	duration float64,
	size float64,
	lom_score float64,
) error {
	if prismLomRepository.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(prismLomRepository.db)
	err := q.CreateLOMentryForUserOnMarket(context.Background(), sqlc.CreateLOMentryForUserOnMarketParams{
		MarketID:    market_id,
		AccountID:   account_id,
		Distance:    distance,
		Duration:    duration,
		DollarValue: size,
		LomScore:    lom_score,
	})
	return err
}

func (prismLomRepository *PrismLomRepository) GetLOMrewardsByMarketId(market_id string) ([]sqlc.PrismLom, error) {
	if prismLomRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	// ensure market_id is a valid UUID
	marketIdStr, err := uuid.Parse(market_id)
	if err != nil {
		return nil, lib.ErrorLog("invalid market_id: %s", market_id)
	}

	q := sqlc.New(prismLomRepository.db)
	result, err := q.GetLOMrewardsByMarketId(context.Background(), marketIdStr)
	return result, err
}

func (prismLomRepository *PrismLomRepository) GetLOMrewardsByAccountId(account_id string) ([]sqlc.PrismLom, error) {
	if prismLomRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(prismLomRepository.db)
	result, err := q.GetLOMrewardsByAccountId(context.Background(), account_id)
	return result, err
}
