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

func (scer *SmartContractEventRepository) CreatePositionTokensPurchased(event map[string]interface{}) error {
	if scer.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	// string event = "";
	// string smartContractId = "";

	// // id SERIAL PRIMARY KEY,
	// //   net VARCHAR(20) NOT NULL CHECK (net IN ('previewnet', 'testnet', 'mainnet')),
	// //   smart_contract_id VARCHAR(256) NOT NULL,
	// //   timestamp_nano TIMESTAMP(9) NOT NULL,
	// //   tx_hash VARCHAR(256) NOT NULL,
	// //   hostname VARCHAR(256) NOT NULL,
	// //   created_at TIMESTAMPTZ DEFAULT NOW(),

	// //    -- prevent duplicates!
	// //   md5_uniq VARCHAR(32) NOT NULL UNIQUE,

	// //   -- PositionTOkensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled)
	// //   market_id INTEGER NOT NULL,
	// //   buyer TEXT NOT NULL,
	// //   collateral_usd DOUBLE PRECISION NOT NULL,
	// //   qty_scaled DOUBLE PRECISION NOT NULL
	// params := sqlc.CreatePositionTokensPurchasedParams{
	// 	Net: event.Net,
	// 	SmartContractID: smartContractId,
	// 	Timestamp
	// }
	return nil
}

func (scer *SmartContractEventRepository) CreateMarketResolved(event map[string]interface{}) error {
	return nil
}

func (scer *SmartContractEventRepository) CreateWinningsRedeemed(event map[string]interface{}) error {
	return nil
}
func (scer *SmartContractEventRepository) CreateTokenAssociated(event map[string]interface{}) error {
	return nil
}
