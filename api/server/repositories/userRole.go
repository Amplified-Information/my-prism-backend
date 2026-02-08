package repositories

import (
	sqlc "api/gen/sqlc"
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

type UserRoleRepository struct {
	db *sql.DB
}

func (urr *UserRoleRepository) CloseDb() error {
	var err = urr.db.Close()
	if err != nil {
		return fmt.Errorf("failed to close database: %v", err)
	}
	return nil
}

func (urr *UserRoleRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}
	urr.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	log.Println("DB: UserRoleRepository connected successfully")
	return nil
}

func (urr *UserRoleRepository) GetUserChallenge(accountId string, network string) (int64, error) {
	if urr.db == nil {
		return 0, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(urr.db)
	result, err := q.GetUserChallenge(context.Background(), sqlc.GetUserChallengeParams{
		WalletID: accountId,
		Network:  network,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to get user challenge: %v", err)
	}
	return int64(result), nil
}

func (urr *UserRoleRepository) UpdateUserChallenge(accountId string, network string, challenge int64) (bool, error) {
	if urr.db == nil {
		return false, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(urr.db)
	err := q.UpdateUserChallenge(context.Background(), sqlc.UpdateUserChallengeParams{
		WalletID: accountId,
		Network:  network,
		Column1:  challenge, // int64
	})
	if err != nil {
		return false, fmt.Errorf("failed to update user challenge: %v", err)
	}
	return true, nil
}

func (urr *UserRoleRepository) GetRolesByUserAndNetwork(accountId string, network string) ([]string, error) {
	if urr.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(urr.db)
	results, err := q.GetRolesByUserAndNetwork(context.Background(), sqlc.GetRolesByUserAndNetworkParams{
		WalletID: accountId,
		Network:  network,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get roles by user and network: %v", err)
	}

	var roles []string
	for _, r := range results {
		roles = append(roles, r)
	}
	return roles, nil
}
