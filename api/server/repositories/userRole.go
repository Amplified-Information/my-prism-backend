package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

type UserRoleRepository struct {
	db *sql.DB
}

func (urr *UserRoleRepository) CloseDb() error {
	var err = urr.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (urr *UserRoleRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	urr.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "UserRoleRepository")
	return nil
}

func (urr *UserRoleRepository) GetUserChallenge(accountId string, network string) (int64, error) {
	if urr.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(urr.db)
	result, err := q.GetUserChallenge(context.Background(), sqlc.GetUserChallengeParams{
		WalletID: accountId,
		Network:  network,
	})
	if err != nil {
		return 0, lib.ErrorLog("failed to get user challenge", "error", err, "accountId", accountId, "network", network)
	}
	return int64(result), nil
}

func (urr *UserRoleRepository) UpdateUserChallenge(accountId string, network string, challenge int64) (bool, error) {
	if urr.db == nil {
		return false, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(urr.db)
	err := q.UpdateUserChallenge(context.Background(), sqlc.UpdateUserChallengeParams{
		WalletID: accountId,
		Network:  network,
		Column1:  challenge, // int64
	})
	if err != nil {
		return false, lib.ErrorLog("failed to update user challenge", "error", err, "accountId", accountId, "network", network)
	}
	return true, nil
}

func (urr *UserRoleRepository) GetRolesByUserAndNetwork(accountId string, network string) ([]string, error) {
	if urr.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(urr.db)
	results, err := q.GetRolesByUserAndNetwork(context.Background(), sqlc.GetRolesByUserAndNetworkParams{
		WalletID: accountId,
		Network:  network,
	})
	if err != nil {
		return nil, lib.ErrorLog("failed to get roles by user and network", "error", err, "accountId", accountId, "network", network)
	}

	var roles []string
	for _, r := range results {
		roles = append(roles, r)
	}
	return roles, nil
}
