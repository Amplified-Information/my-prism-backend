package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

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
		return fmt.Errorf("failed to close database: %v", err)
	}
	return nil
}

func (dbRepository *DbRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}
	dbRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	log.Println("DB: DbRepository connected successfully")
	return nil
}

func (dbRepository *DbRepository) IsDuplicateTxId(txId uuid.UUID) (bool, error) {
	if dbRepository.db == nil {
		return false, fmt.Errorf("could not connect to database")
	}

	q := sqlc.New(dbRepository.db)
	isDuplicate, err := q.IsDuplicateTxId(context.Background(), txId)
	if err != nil && err != sql.ErrNoRows {
		return false, fmt.Errorf("failed to check duplicate txId: %v", err)
	}
	return isDuplicate == true, nil
}

func (dbRepository *DbRepository) CreateNewsletterSubscription(email string, ipAddress string, userAgent string) error {
	if dbRepository.db == nil {
		return fmt.Errorf("database not initialized")
	}

	params := sqlc.CreateNewsletterSubscriptionParams{
		Email:     email,
		IpAddress: sql.NullString{String: ipAddress, Valid: ipAddress != ""},
		UserAgent: sql.NullString{String: userAgent, Valid: userAgent != ""},
	}

	q := sqlc.New(dbRepository.db)
	err := q.CreateNewsletterSubscription(context.Background(), params)
	if err != nil {
		return fmt.Errorf("CreateNewsletterSubscription failed: %v", err)
	}

	log.Printf("Created newsletter subscription for email: %s", email)
	return nil
}

func (dbRepository *DbRepository) GetTotalVolumeUsdInTimePeriod(timePeriod string) (float64, error) {
	if dbRepository.db == nil {
		return 0, fmt.Errorf("database not initialized")
	}

	// TODO - implement real total volume calculation
	// q := sqlc.New(dbRepository.db)
	// totalVolume, err := q.GetTotalVolumeUsdInTimePeriod(context.Background(), timePeriod)
	// if err != nil {
	// 	return 0, fmt.Errorf("GetTotalVolumeUsdInTimePeriod failed: %v", err)
	// }

	return 42, nil
}

func (dbRepository *DbRepository) GetNumActiveTraders() (uint32, error) {
	if dbRepository.db == nil {
		return 0, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(dbRepository.db)
	nActiveTraders, err := q.GetNumActiveTradersLast30days(context.Background())
	if err != nil {
		return 0, fmt.Errorf("GetNumActiveTraders failed: %v", err)
	}

	return uint32(nActiveTraders), nil
}
