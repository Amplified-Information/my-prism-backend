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
	prediction_intent_tx_id uuid.UUID,
	total_lom_score float64,
	cron_ran_at time.Time,
	hedera_tx_hash string,
) error {
	if prismLomRepository.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(prismLomRepository.db)
	err := q.CreateLOMentryForUserOnMarket(context.Background(), sqlc.CreateLOMentryForUserOnMarketParams{
		MarketID:             market_id,
		AccountID:            account_id,
		PredictionIntentTxID: prediction_intent_tx_id,
		TotalLomScore:        total_lom_score,
		CronRanAt:            cron_ran_at,
		HederaTxHash:         hedera_tx_hash,
	})
	return err
}
