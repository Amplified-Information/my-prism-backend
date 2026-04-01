package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
)

type PrismPointsRepository struct {
	db *sql.DB
}

func (prismPointsRepository *PrismPointsRepository) CloseDb() error {
	var err = prismPointsRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (prismPointsRepository *PrismPointsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	prismPointsRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "PrismPointsRepository")
	return nil
}

func (prismPointsRepository *PrismPointsRepository) UpsertPrismPointsAddPoints(marketId string, evmAddress string, pointsAwarded float64) error {
	if prismPointsRepository.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(prismPointsRepository.db)
	err := q.UpsertPrismPointsAddPoints(context.Background(), sqlc.UpsertPrismPointsAddPointsParams{
		PointsAwarded: pointsAwarded,
		MarketID:      marketId,
		EvmAddress:    evmAddress,
	})
	return err
}

func (prismPointsRepository *PrismPointsRepository) GetPrismPointsByUser(evmAddress string) ([]sqlc.PrismPoint, error) {
	if prismPointsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	// if evmAddress does not start with "0x", prepend 0x
	if !strings.HasPrefix(evmAddress, "0x") {
		evmAddress = "0x" + evmAddress
	}
	// make sure evmAddress is prefixed with "0x" and is 42 characters long
	if !strings.HasPrefix(evmAddress, "0x") || len(evmAddress) != 42 {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid EVM address format: %s", evmAddress)
	}

	// OK - proceed

	q := sqlc.New(prismPointsRepository.db)
	result, err := q.GetPrismPointsByUser(context.Background(), evmAddress)
	return result, err
}
