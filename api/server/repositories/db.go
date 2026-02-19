package repositories

import (
	"api/server/lib"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	sqlc "api/gen/sqlc"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type DbRepository struct {
	db *sql.DB
}

func (dbRepository *DbRepository) CloseDb() error {
	var err = dbRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (dbRepository *DbRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	dbRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "DbRepository")
	return nil
}

func (dbRepository *DbRepository) IsDuplicateTxId(txId uuid.UUID) (bool, error) {
	if dbRepository.db == nil {
		return false, lib.ErrorLog("could not connect to database")
	}

	q := sqlc.New(dbRepository.db)
	isDuplicate, err := q.IsDuplicateTxId(context.Background(), txId)
	if err != nil && err != sql.ErrNoRows {
		return false, lib.ErrorLog("failed to check duplicate txId", "error", err, "txId", txId.String())
	}
	return isDuplicate == true, nil
}

func (dbRepository *DbRepository) CreateNewsletterSubscription(email string, ipAddress string, userAgent string) error {
	if dbRepository.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	params := sqlc.CreateNewsletterSubscriptionParams{
		Email:     email,
		IpAddress: sql.NullString{String: ipAddress, Valid: ipAddress != ""},
		UserAgent: sql.NullString{String: userAgent, Valid: userAgent != ""},
	}

	q := sqlc.New(dbRepository.db)
	err := q.CreateNewsletterSubscription(context.Background(), params)
	if err != nil {
		return lib.ErrorLog("CreateNewsletterSubscription failed", "error", err, "email", email)
	}

	lib.Info("newsletter subscription created", "email", email)
	return nil
}

func (dbRepository *DbRepository) GetTotalValueMatchedUsdInTimePeriod(timePeriod string) (float64, error) {
	// guards
	if dbRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	// validate that timePeriod is in: {"1h", "24h", "7d", "30d"}
	valid := false
	for _, period := range lib.VolumeResolutionPeriods {
		if timePeriod == period {
			valid = true
			break
		}
	}
	if !valid {
		return 0, lib.ErrorLog("invalid time period", "timePeriod", timePeriod)
	}

	/////
	// OK - proceed
	/////
	q := sqlc.New(dbRepository.db)
	params := sqlc.GetTotalValueMatchedUsdInTimePeriodParams{
		CreatedAt:   time.Now().Add(0 - lib.ParseDuration(timePeriod)),
		CreatedAt_2: time.Now(),
	}
	totalVolume, err := q.GetTotalValueMatchedUsdInTimePeriod(context.Background(), params)
	if err != nil {
		return 0, fmt.Errorf("GetTotalValueMatchedUsdInTimePeriod failed: %v", err)
	}

	totalVolumeFloat, err := strconv.ParseFloat(totalVolume, 64)
	if err != nil {
		return 0, lib.ErrorLog("failed to parse total volume to float64", "error", err)
	}

	return totalVolumeFloat, nil
}

func (dbRepository *DbRepository) GetNumActiveTraders() (uint32, error) {
	if dbRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(dbRepository.db)
	nActiveTraders, err := q.GetNumActiveTradersLast30days(context.Background())
	if err != nil {
		return 0, lib.ErrorLog("GetNumActiveTraders failed", "error", err)
	}

	return uint32(nActiveTraders), nil
}

// query the CLOB for this...
// this db query doesn't take into account partially matched order_intents
// func (dbRepository *DbRepository) GetTotalValuePendingUsd() (float64, error) {
// 	if dbRepository.db == nil {
// 		return 0, lib.ErrorLog("database not initialized")
// 	}

// 	q := sqlc.New(dbRepository.db)
// 	totalValuePendingUsd, err := q.GetTotalValuePendingUsd(context.Background())
// 	if err != nil {
// 		return 0, lib.ErrorLog("GetTotalValuePendingUsd failed", "error", err)
// 	}

// 	tvlFloat, err := strconv.ParseFloat(totalValuePendingUsd, 64)
// 	if err != nil {
// 		return 0, lib.ErrorLog("failed to parse TVL to float64", "error", err)
// 	}

// 	return tvlFloat, nil
// }

func (dbRepository *DbRepository) GetTotalValueMatchedUsdOpenMarkets() (float64, error) {
	if dbRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(dbRepository.db)
	params := sqlc.GetTotalValueMatchedUsdInTimePeriodParams{
		CreatedAt:   time.UnixMicro(0), // 1/1/1970
		CreatedAt_2: time.Now(),
	}
	tvMatchedUsdOpenMarkets, err := q.GetTotalValueMatchedUsdInTimePeriod(context.Background(), params)
	if err != nil {
		return 0, lib.ErrorLog("GetTotalValueMatchedUsdInTimePeriod failed", "error", err)
	}

	tvMatchedUsdOpenMarketsFloat, err := strconv.ParseFloat(tvMatchedUsdOpenMarkets, 64)
	if err != nil {
		return 0, lib.ErrorLog("failed to parse TVL to float64", "error", err)
	}

	return tvMatchedUsdOpenMarketsFloat, nil
}

func (dbRepository *DbRepository) GetTotalValueMatchedUsd() (float64, error) {
	if dbRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(dbRepository.db)
	totalValueMatchedUsd, err := q.GetTotalValueMatchedUsd(context.Background())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, lib.ErrorLog("GetTotalValueMatchedUsd failed", "error", err)
	}

	return totalValueMatchedUsd, nil
}

func (dbRepository *DbRepository) GetTvlUsd() (float64, error) {
	if dbRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	// q := sqlc.New(dbRepository.db)
	// tvlUsd, err := q.GetTvlUsd(context.Background())
	var tvlUsd float64 = 0.0
	// if err != nil {
	// 	return 0, lib.ErrorLog("GetTvlUsd failed", "error", err)
	// }

	// tvlFloat, err := strconv.ParseFloat(tvlUsd, 64)
	// if err != nil {
	// 	return 0, lib.ErrorLog("failed to parse TVL to float64", "error", err)
	// }

	return tvlUsd, nil
}

func (dbRepository *DbRepository) UpdateTotalValueMatchedUsd(incrementBy float64) error {
	if dbRepository.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(dbRepository.db)
	err := q.IncrementTotalValueMatchedUsd(context.Background(), incrementBy)
	if err != nil {
		return lib.ErrorLog("UpdateTotalValueMatchedUsd failed", "error", err)
	}

	return nil
}
