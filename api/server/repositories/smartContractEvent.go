package repositories

import (
	"api/server/lib"
	"database/sql"
	"fmt"
	"os"
)

type SmartContractEventRepository struct {
	db *sql.DB
}

func (scer *SmartContractEventRepository) CloseDb() error {
	var err = scer.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (scer *SmartContractEventRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	scer.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "SmartContractEventRepository")
	return nil
}

func (scer *SmartContractEventRepository) CreatePositionTokensPurchasedEvent(event map[string]interface{}) error {
	if scer.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	// TODO
	// note: the event map contains string values - parse them safely - the event interface could change

	// params := sqlc.CreatePositionTokensPurchasedParams{
	// 	Net:              "testnet",
	// 	SmartContractID:  "",
	// 	TimestampNano:    time.Now(),
	// 	TxHash:           "",
	// 	Hostname:         "",
	// 	Md5Uniq:          "",
	// 	MarketID:         0,
	// 	Buyer:            "",
	// 	CollateralUsd:    0,
	// 	QtyScaled:        0,
	// 	PrimarySecondary: false,
	// }
	return nil
}

func (scer *SmartContractEventRepository) CreateMarketResolvedEvent(event map[string]interface{}) error {
	// TODO
	// note: the event map contains string values - parse them safely - the event interface could change

	return nil
}

func (scer *SmartContractEventRepository) CreateWinningsRedeemedEvent(event map[string]interface{}) error {
	// TODO
	// note: the event map contains string values - parse them safely - the event interface could change

	return nil
}
func (scer *SmartContractEventRepository) CreateTokenAssociatedEvent(event map[string]interface{}) error {
	// TODO
	// note: the event map contains string values - parse them safely - the event interface could change

	return nil
}
