package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"
)

type PrismRewardsRepository struct {
	db *sql.DB
}

func (prismRewardsRepository *PrismRewardsRepository) CloseDb() error {
	var err = prismRewardsRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (prismRewardsRepository *PrismRewardsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	prismRewardsRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "PrismRewardsRepository")
	return nil
}

func (prismRewardsRepository *PrismRewardsRepository) CreatePrismReward(
	net string,
	destAccountID string,
	nPrismScaled int64,
	ratioOfAllocation float64,
	cronRanAt time.Time,
	campaignID int64,
) error {
	if prismRewardsRepository.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(prismRewardsRepository.db)
	err := q.CreatePrismReward(context.Background(), sqlc.CreatePrismRewardParams{ // schedule PRISM send/redeem
		Net:               net,
		DestAccountID:     destAccountID,
		NPrismScaled:      nPrismScaled,
		RatioOfAllocation: ratioOfAllocation,
		CronRanAt:         sql.NullTime{Time: cronRanAt, Valid: true},
		CampaignID:        campaignID,
	})
	if err != nil {
		return lib.ErrorLog("failed to create prism reward", "error", err)
	}
	return nil
}

func (prismRewardsRepository *PrismRewardsRepository) GetUnredeemedPrismRewardsByUser(net string, accountId string) ([]sqlc.PrismReward, error) {
	if prismRewardsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	// validate Hedera account ID format: X.X.X
	if !lib.IsValidHederaAccountID(accountId) {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid Hedera account ID format: %s", accountId)
	}

	q := sqlc.New(prismRewardsRepository.db)
	result, err := q.GetUnredeemedPrismRewardsByUser(context.Background(), sqlc.GetUnredeemedPrismRewardsByUserParams{
		Net:           net,
		DestAccountID: accountId,
	})
	return result, err
}

func (prismRewardsRepository *PrismRewardsRepository) GetTotalUnredeemedPrismRewardsByUser(net string, accountId string) (uint64, error) {
	if prismRewardsRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}
	// validate Hedera account ID format: X.X.X
	if !lib.IsValidHederaAccountID(accountId) {
		return 0, lib.LogAndError(lib.LOG_ERROR, "invalid Hedera account ID format: %s", accountId)
	}

	q := sqlc.New(prismRewardsRepository.db)
	result, err := q.GetTotalUnredeemedPrismRewardsByUser(context.Background(), sqlc.GetTotalUnredeemedPrismRewardsByUserParams{
		Net:           net,
		DestAccountID: accountId,
	})
	if err != nil {
		return 0, err
	}
	return uint64(result), nil
}

func (prismRewardsRepository *PrismRewardsRepository) GetRedeemablePrismRewardsByUser(net string, accountId string) ([]sqlc.PrismReward, error) {
	if prismRewardsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	// validate Hedera account ID format: X.X.X
	if !lib.IsValidHederaAccountID(accountId) {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid Hedera account ID format: %s", accountId)
	}

	q := sqlc.New(prismRewardsRepository.db)
	result, err := q.GetRedeemablePrismRewardsByUser(context.Background(), sqlc.GetRedeemablePrismRewardsByUserParams{
		Net:           net,
		DestAccountID: accountId,
	})
	return result, err
}

func (prismRewardsRepository *PrismRewardsRepository) GetTotalRedeemablePrismRewardsByUser(net string, accountId string) (uint64, error) {
	if prismRewardsRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}
	// validate Hedera account ID format: X.X.X
	if !lib.IsValidHederaAccountID(accountId) {
		return 0, lib.LogAndError(lib.LOG_ERROR, "invalid Hedera account ID format: %s", accountId)
	}

	q := sqlc.New(prismRewardsRepository.db)
	result, err := q.GetTotalRedeemablePrismRewardsByUser(context.Background(), sqlc.GetTotalRedeemablePrismRewardsByUserParams{
		Net:           net,
		DestAccountID: accountId,
	})
	if err != nil {
		return 0, err
	}
	return uint64(result), nil
}

func (prismRewardsRepository *PrismRewardsRepository) GetRedeemedPrismRewardsByUser(net string, accountId string) ([]sqlc.PrismReward, error) {
	if prismRewardsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	// validate Hedera account ID format: X.X.X
	if !lib.IsValidHederaAccountID(accountId) {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid Hedera account ID format: %s", accountId)
	}
	q := sqlc.New(prismRewardsRepository.db)
	result, err := q.GetRedeemedPrismRewardsByUser(context.Background(), sqlc.GetRedeemedPrismRewardsByUserParams{
		Net:           net,
		DestAccountID: accountId,
	})
	return result, err
}

func (prismRewardsRepository *PrismRewardsRepository) GetTotalRedeemedPrismRewardsByUser(net string, accountId string) (uint64, error) {
	if prismRewardsRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}
	// validate Hedera account ID format: X.X.X
	if !lib.IsValidHederaAccountID(accountId) {
		return 0, lib.LogAndError(lib.LOG_ERROR, "invalid Hedera account ID format: %s", accountId)
	}

	q := sqlc.New(prismRewardsRepository.db)
	result, err := q.GetTotalRedeemedPrismRewardsByUser(context.Background(), sqlc.GetTotalRedeemedPrismRewardsByUserParams{
		Net:           net,
		DestAccountID: accountId,
	})
	if err != nil {
		return 0, err
	}
	return uint64(result), nil
}
