package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
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

/*
Solidity: event DaoUpdated(address newDao)
*/
func (scer *SmartContractEventRepository) CreateDaoUpdatedEvent(net string, contractId string, timestampNano time.Time, txHash string, hostname string, md5uniq string, event map[string]interface{}) error {
	if scer.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	// note: the event map contains string values - parse them safely - the event interface could change

	newDao, _ := event["newDao"].(string)

	params := sqlc.CreateDaoUpdatedEventParams{
		Net:             net,
		SmartContractID: contractId,
		TimestampNano:   timestampNano,
		TxHash:          txHash,
		Hostname:        hostname,
		Md5Uniq:         md5uniq,
		// args:
		NewDaoAddress: newDao,
	}

	q := sqlc.New(scer.db)
	_, err := q.CreateDaoUpdatedEvent(context.Background(), params)
	if err != nil {
		return lib.ErrorLog("EventDaoUpdated failed", "error", err, "txId", txHash, "newDao", newDao)
	}

	lib.Info("EventDaoUpdated", "txId", txHash, "newDao", newDao)
	return nil
}

/*
Solidity: event MarketResolved(uint128 marketId, uint8 outcome);
*/
func (scer *SmartContractEventRepository) CreateMarketResolvedEvent(net string, contractId string, timestampNano time.Time, txHash string, hostname string, md5uniq string, event map[string]interface{}) error {
	if scer.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	// note: the event map contains string values - parse them safely - the event interface could change

	marketIdBigInt, ok := new(big.Int).SetString(fmt.Sprintf("%v", event["marketId"]), 10)
	if !ok {
		return lib.ErrorLog("failed to parse marketId from event", "event", event)
	}
	marketID, err := lib.Bigint_to_uuid7(marketIdBigInt)
	if err != nil {
		return lib.ErrorLog("failed to convert marketId to UUID7", "event", event)
	}

	outcomeStr, _ := event["outcome"].(string)
	outcomeInt, err := strconv.Atoi(outcomeStr)
	if err != nil {
		return lib.ErrorLog("failed to parse outcome from event", "event", event)
	}
	outcome := int32(outcomeInt)

	params := sqlc.CreateMarketResolvedEventParams{
		Net:             net,
		SmartContractID: contractId,
		TimestampNano:   timestampNano,
		TxHash:          txHash,
		Hostname:        hostname,
		Md5Uniq:         md5uniq,
		// args:
		MarketID: marketID,
		Outcome:  sql.NullInt32{Int32: outcome, Valid: true},
	}

	q := sqlc.New(scer.db)
	_, err = q.CreateMarketResolvedEvent(context.Background(), params)
	if err != nil {
		return lib.ErrorLog("EventMarketResolved failed", "error", err, "txId", txHash, "marketId", marketID, "outcome", outcome)
	}

	lib.Info("EventMarketResolved", "txId", txHash, "marketId", marketID, "outcome", outcome)
	return nil
}

/*
Solidity: event OracleUpdated(address newOracle)
*/
func (scer *SmartContractEventRepository) CreateOracleUpdatedEvent(net string, contractId string, timestampNano time.Time, txHash string, hostname string, md5uniq string, event map[string]interface{}) error {
	if scer.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	// note: the event map contains string values - parse them safely - the event interface could change

	newOracle, _ := event["newOracle"].(string)

	params := sqlc.CreateOracleUpdatedEventParams{
		Net:             net,
		SmartContractID: contractId,
		TimestampNano:   timestampNano,
		TxHash:          txHash,
		Hostname:        hostname,
		Md5Uniq:         md5uniq,
		// args:
		NewOracleAddress: newOracle,
	}

	q := sqlc.New(scer.db)
	_, err := q.CreateOracleUpdatedEvent(context.Background(), params)
	if err != nil {
		return lib.ErrorLog("EventOracleUpdated failed", "error", err, "txId", txHash, "newOracle", newOracle)
	}

	lib.Info("EventOracleUpdated", "txId", txHash, "newOracle", newOracle)
	return nil
}

/*
Solidity: event PositionTokensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled, bool primarySecondary);
*/
func (scer *SmartContractEventRepository) CreatePositionTokensPurchasedEvent(net string, contractId string, timestampNano time.Time, txHash string, hostname string, md5uniq string, event map[string]interface{}) error {
	if scer.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	// note: the event map contains string values - parse them safely - the event interface could change

	marketIdBigInt, ok := new(big.Int).SetString(fmt.Sprintf("%v", event["marketId"]), 10)
	if !ok {
		return lib.ErrorLog("failed to parse marketId from event", "event", event)
	}
	marketID, err := lib.Bigint_to_uuid7(marketIdBigInt)
	if err != nil {
		return lib.ErrorLog("failed to convert marketId to UUID7", "event", event)
	}

	buyer, _ := event["buyer"].(string)

	collateralUsdBig, ok := new(big.Int).SetString(fmt.Sprintf("%v", event["collateralUsd"].(string)), 10)
	if !ok {
		return lib.ErrorLog("failed to parse collateralUsd from event", "event", event)
	}
	// usdcDecimalsStr := os.Getenv("USDC_DECIMALS")
	// usdcDecimals, err := strconv.ParseUint(usdcDecimalsStr, 10, 64)
	// if err != nil {
	// 	return lib.ErrorLog("invalid USDC_DECIMALS", "error", err)
	// }
	// collateralUsdBigDec := new(big.Float).Quo(new(big.Float).SetInt(collateralUsdBig), new(big.Float).SetFloat64(math.Pow10(int(usdcDecimals))))
	collateralUsdFloat64, _ := collateralUsdBig.Float64()

	qtyScaledBig, _ := new(big.Int).SetString(fmt.Sprintf("%v", event["qtyScaled"].(string)), 10)
	qtyScaledFloat64, _ := qtyScaledBig.Float64()

	primarySecondaryStr, _ := event["primarySecondary"].(string)
	primarySecondary := strings.ToLower(primarySecondaryStr) == "true"

	params := sqlc.CreatePositionTokensPurchasedEventParams{
		Net:             net,
		SmartContractID: contractId,
		TimestampNano:   timestampNano,
		TxHash:          txHash,
		Hostname:        hostname,
		Md5Uniq:         md5uniq,
		// args:
		MarketID:         marketID,
		Buyer:            buyer,
		CollateralUsd:    collateralUsdFloat64, // scaled
		QtyScaled:        qtyScaledFloat64,     // scaled
		PrimarySecondary: primarySecondary,
	}

	q := sqlc.New(scer.db)
	_, err = q.CreatePositionTokensPurchasedEvent(context.Background(), params)
	if err != nil {
		return lib.ErrorLog("EventPositionTokensPurchased failed", "error", err, "txId", txHash, "marketId", marketID, "buyer", buyer, "collateralUsdFloat64", collateralUsdFloat64, "qtyScaledFloat64", qtyScaledFloat64, "primarySecondary", primarySecondary)
	}

	lib.Info("EventPositionTokensPurchased", "txId", txHash, "marketId", marketID, "buyer", buyer, "collateralUsdFloat64", collateralUsdFloat64, "qtyScaledFloat64", qtyScaledFloat64, "primarySecondary", primarySecondary)
	return nil
}

/*
Solidity: event RakeUpdated(uint256 newRakePercentScaled100);
*/
func (scer *SmartContractEventRepository) CreateRakeUpdatedEvent(net string, contractId string, timestampNano time.Time, txHash string, hostname string, md5uniq string, event map[string]interface{}) error {
	if scer.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	// note: the event map contains string values - parse them safely - the event interface could change

	newRakePercentScaled100Str, _ := event["newRakePercentScaled100"].(string)
	// newRakePercentScaled100Big, ok := new(big.Int).SetString(newRakePercentScaled100Str, 10)
	// if !ok {
	// 	return lib.ErrorLog("failed to parse newRakePercentScaled100 from event", "event", event)
	// }
	// newRakePercentScaled100Float64, _ := newRakePercentScaled100Big.Float64()

	params := sqlc.CreateRakeUpdatedEventParams{
		Net:             net,
		SmartContractID: contractId,
		TimestampNano:   timestampNano,
		TxHash:          txHash,
		Hostname:        hostname,
		Md5Uniq:         md5uniq,
		// args:
		NewRakePercentScaled100: newRakePercentScaled100Str, // yes, sql NUMERIC is a string to avoid precision loss
	}

	q := sqlc.New(scer.db)
	_, err := q.CreateRakeUpdatedEvent(context.Background(), params)
	if err != nil {
		return lib.ErrorLog("EventRakeUpdated failed", "error", err, "txId", txHash, "newRakePercentScaled100Str", newRakePercentScaled100Str)
	}

	lib.Info("EventRakeUpdated", "txId", txHash, "newRakePercentScaled100Str", newRakePercentScaled100Str)
	return nil
}

/*
Solidity: event TokenAssociated(address indexed token);
*/
func (scer *SmartContractEventRepository) CreateTokenAssociatedEvent(net string, contractId string, timestampNano time.Time, txHash string, hostname string, md5uniq string, event map[string]interface{}) error {
	if scer.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	// note: the event map contains string values - parse them safely - the event interface could change

	token, _ := event["token"].(string)

	params := sqlc.CreateTokenAssociatedEventParams{
		Net:             net,
		SmartContractID: contractId,
		TimestampNano:   timestampNano,
		TxHash:          txHash,
		Hostname:        hostname,
		Md5Uniq:         md5uniq,
		// args:
		Token: token,
	}

	q := sqlc.New(scer.db)
	_, err := q.CreateTokenAssociatedEvent(context.Background(), params)
	if err != nil {
		return lib.ErrorLog("EventTokenAssociated failed", "error", err, "txId", txHash, "token", token)
	}

	lib.Info("EventTokenAssociated", "txId", txHash, "token", token)
	return nil
}

/*
Solidity: event WinningsRedeemed(uint128 marketId, address indexed winner, uint256 amount);
*/
func (scer *SmartContractEventRepository) CreateWinningsRedeemedEvent(net string, contractId string, timestampNano time.Time, txHash string, hostname string, md5uniq string, event map[string]interface{}) (*string, *string, error) {
	if scer.db == nil {
		return nil, nil, lib.ErrorLog("database not initialized")
	}

	// note: the event map contains string values - parse them safely - the event interface could change

	marketIdBigInt, ok := new(big.Int).SetString(fmt.Sprintf("%v", event["marketId"]), 10)
	if !ok {
		return nil, nil, lib.ErrorLog("failed to parse marketId from event", "event", event)
	}
	marketIDuuidStr, err := lib.Bigint_to_uuid7(marketIdBigInt)
	if err != nil {
		return nil, nil, lib.ErrorLog("failed to convert marketId to UUID7", "event", event)
	}

	winner, _ := event["winner"].(string)
	amountBig, ok := new(big.Int).SetString(fmt.Sprintf("%v", event["amount"].(string)), 10)
	if !ok {
		return nil, nil, lib.ErrorLog("failed to parse amount from event", "event", event)
	}
	amountFloat64, _ := amountBig.Float64()

	params := sqlc.CreateWinningsRedeemedEventParams{
		Net:             net,
		SmartContractID: contractId,
		TimestampNano:   timestampNano,
		TxHash:          txHash,
		Hostname:        hostname,
		Md5Uniq:         md5uniq,
		// args:
		MarketID: marketIDuuidStr,
		Winner:   winner,
		Amount:   amountFloat64, // scaled
	}

	q := sqlc.New(scer.db)
	_, err = q.CreateWinningsRedeemedEvent(context.Background(), params)
	if err != nil {
		return nil, nil, lib.ErrorLog("EventWinningsRedeemed failed", "error", err, "txId", txHash, "marketIDuuidStr", marketIDuuidStr, "winner", winner, "amountFloat64", amountFloat64)
	}

	lib.Info("EventWinningsRedeemed", "txId", txHash, "marketIDuuidStr", marketIDuuidStr, "winner", winner, "amountFloat64", amountFloat64)

	return &marketIDuuidStr, &winner, nil
}

func (scer *SmartContractEventRepository) GetMarketResolvedEventByMarketId(marketId string) (*sqlc.EventMarketResolved, error) {
	if scer.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	// validate marketId is a valid UUID
	if _, err := uuid.Parse(marketId); err != nil {
		return nil, lib.ErrorLog("invalid marketId format", "error", err, "marketId", marketId)
	}

	q := sqlc.New(scer.db)
	event, err := q.GetMarketResolvedEventByMarketId(context.Background(), marketId)
	if err != nil {
		return nil, lib.ErrorLog("failed to get MarketResolved event by marketId", "error", err, "marketId", marketId)
	}
	return &event, nil
}

func (scer *SmartContractEventRepository) GetWinningsRedeemedEventByMarketIdAndWinner(marketId string, winnerEvmAddr string) (*sqlc.EventWinningsRedeemed, error) {
	if scer.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	// validate marketId is a valid UUID
	if _, err := uuid.Parse(marketId); err != nil {
		return nil, lib.ErrorLog("invalid marketId format", "error", err, "marketId", marketId)
	}

	q := sqlc.New(scer.db)
	event, err := q.GetWinningsRedeemedEventByMarketIdAndWinner(context.Background(), sqlc.GetWinningsRedeemedEventByMarketIdAndWinnerParams{
		MarketID: marketId,
		Winner:   winnerEvmAddr,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, lib.ErrorLog("failed to GetWinningsRedeemedEventByMarketIdAndWinner by marketId", "error", err, "marketId", marketId)
	}
	return &event, nil
}
