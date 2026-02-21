package services

import (
	pb_api "api/gen"
	sqlc "api/gen/sqlc"
	"api/server/lib"
	repositories "api/server/repositories"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type MarketsService struct {
	marketsRepository *repositories.MarketsRepository
	hederaService     *HederaService
	priceService      *PriceService
	priceRepository   *repositories.PriceRepository
}

func (ms *MarketsService) Init(marketsRepository *repositories.MarketsRepository, hederaService *HederaService, priceService *PriceService) error {
	ms.marketsRepository = marketsRepository
	ms.hederaService = hederaService
	ms.priceService = priceService
	ms.priceRepository = priceService.priceRepository

	lib.Log(lib.LOG_INFO, "Service: Market service initialized successfully")
	return nil
}

func (ms *MarketsService) GetMarketById(marketId string, isAdmin bool) (*pb_api.MarketResponse, error) {
	market, err := ms.marketsRepository.GetMarketById(marketId, isAdmin)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get market by id: %v", err)
	}

	response, err := ms.mapMarketToMarketResponse(market)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to map market to market response: %v", err)
	}
	return response, nil
}

func (ms *MarketsService) GetMarkets(limit int32, offset int32, isAdmin bool) (*pb_api.MarketsResponse, error) {
	result := os.Getenv("DB_MAX_ROWS")
	DB_MAX_ROWS, err := strconv.Atoi(result)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid DB_MAX_ROWS environment variable: %v", err)
	}
	if limit > int32(DB_MAX_ROWS) {
		lib.Log(lib.LOG_WARN, "Warning: limit %d exceeds DB_MAX_ROWS %d, setting limit to DB_MAX_ROWS", limit, DB_MAX_ROWS)
		limit = int32(DB_MAX_ROWS)
	}

	markets, err := ms.marketsRepository.GetMarkets(limit, offset, isAdmin)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get markets: %v", err)
	}

	var marketResponses []*pb_api.MarketResponse
	for _, market := range markets {
		marketResponse, err := ms.mapMarketToMarketResponse(&market)
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "failed to map market to market response: %v", err)
		}
		marketResponses = append(marketResponses, marketResponse)
	}

	response := &pb_api.MarketsResponse{
		Markets: marketResponses,
	}
	return response, nil
}

// TODO - idempotent?
func (ms *MarketsService) CreateMarket(req *pb_api.CreateMarketRequest) (*pb_api.CreateMarketResponse, error) {
	// guards
	// protobuf validation does a great job sofar ;)
	// closesAt is optional - if not set, default to 30 days from now
	closesAt := time.Now().Add(30 * 24 * time.Hour)
	if req.ClosesAt != nil && *req.ClosesAt != "" {
		closesAtTime, err := time.Parse(time.RFC3339, *req.ClosesAt)
		if err != nil {
			return nil, lib.ErrorLog("invalid closesAt time format (must be RFC3339)", "error", err, "closesAt", *req.ClosesAt)
		}
		closesAt = closesAtTime
	}

	/////
	// OK - 3 steps to create a new market
	/////

	// Step 1:
	// create a market on the **smart contract** - return with error if it fails
	remainingAllowance, err := ms.hederaService.CreateNewMarket(req.MarketId, req.Statement, req.Net)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to create new market (marketId=%s) on Hedera: %v", req.MarketId, err)
	}

	// Step 2:
	// create market on the **CLOB**
	err = lib.CreateMarketOnClob(req.MarketId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to create new market (marketId=%s) on CLOB: %v", req.MarketId, err)
	}

	// Step 3:
	// now record the tx on the **db**
	contractID, err := hiero.ContractIDFromString(
		// YES, use the current X_SMART_CONTRACT_ID loaded from env vars - we're creating a new market
		os.Getenv(fmt.Sprintf("%s_SMART_CONTRACT_ID", strings.ToUpper(req.Net))),
	)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to parse smart contract ID from env for net=%s: %v", req.Net, err)
	}
	market, err := ms.marketsRepository.CreateMarket(req.MarketId, req.Net, req.ImageUrl, req.Statement, closesAt, req.Description, contractID.String())
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to create a new market row (marketId=%s) on the db: %v", req.MarketId, err)
	}

	/////
	// Output: map the result to MarketResponse
	/////
	marketResponse, err := ms.mapMarketToMarketResponse(market)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to map market to market response: %v", err)
	}
	return &pb_api.CreateMarketResponse{
		MarketResponse:     marketResponse,
		RemainingAllowance: remainingAllowance,
	}, nil
}

func (ms *MarketsService) CreateMarketv2(req *pb_api.CreateMarketv2Request) (*pb_api.CreateMarketResponse, error) {
	// guards
	// protobuf validation does a great job sofar ;)

	closesAt := time.Now().Add(30 * 24 * time.Hour)
	if req.ClosesAt != nil && *req.ClosesAt != "" {
		closesAtTime, err := time.Parse(time.RFC3339, *req.ClosesAt)
		if err != nil {
			return nil, lib.ErrorLog("invalid closesAt time format (must be RFC3339)", "error", err, "closesAt", *req.ClosesAt)
		}
		closesAt = closesAtTime
	}

	/////
	// OK - 3 steps to create a new market
	/////

	// save the image to S3
	imgUrl, err := lib.SaveImageToS3(req.ImgChunk, req.ImgFileName, req.ImgMimeType)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to save image to S3: %v", err)
	}

	// Step 1:
	// create a market on the **smart contract** - return with error if it fails
	remainingAllowance, err := ms.hederaService.CreateNewMarket(req.MarketId, req.Statement, req.Net)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to create new market (marketId=%s) on Hedera: %v", req.MarketId, err)
	}

	// Step 2:
	// create market on the **CLOB**
	err = lib.CreateMarketOnClob(req.MarketId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to create new market (marketId=%s) on CLOB: %v", req.MarketId, err)
	}

	// Step 3:
	// now record the tx on the **db**
	contractID, err := hiero.ContractIDFromString(
		// YES, use the current X_SMART_CONTRACT_ID loaded from env vars - we're creating a new market
		os.Getenv(fmt.Sprintf("%s_SMART_CONTRACT_ID", strings.ToUpper(req.Net))),
	)
	market, err := ms.marketsRepository.CreateMarket(req.MarketId, req.Net, imgUrl, req.Statement, closesAt, req.Description, contractID.String())
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to create a new market row (marketId=%s) on the db: %v", req.MarketId, err)
	}

	/////
	// Output: map the result to MarketResponse
	/////
	marketResponse, err := ms.mapMarketToMarketResponse(market)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to map market to market response: %v", err)
	}
	return &pb_api.CreateMarketResponse{
		MarketResponse:     marketResponse,
		RemainingAllowance: remainingAllowance,
	}, nil
}

func (ms *MarketsService) mapMarketToMarketResponse(market *sqlc.Market) (*pb_api.MarketResponse, error) {
	var createdAt string
	var resolvedAt string
	if !market.CreatedAt.Valid {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid market: createdAt is null")
	}
	if !market.ResolvedAt.Valid {
		resolvedAt = "" // market may not yet be resolved
	}
	createdAt = market.CreatedAt.Time.Format("2006-01-02T15:04:05Z")
	resolvedAt = market.ResolvedAt.Time.Format("2006-01-02T15:04:05Z")

	var imageUrl string
	if market.ImageUrl.Valid {
		imageUrl = market.ImageUrl.String
	} else {
		imageUrl = ""
	}

	priceUsd, err := ms.priceService.GetLatestPriceByMarket(market.MarketID.String())
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get latest price for market %s: %v", market.MarketID.String(), err)
	}

	marketResponse := &pb_api.MarketResponse{
		MarketId:    market.MarketID.String(),
		Net:         market.Net,
		Statement:   market.Statement,
		IsPaused:    market.IsPaused,
		IsSuspended: market.IsSuspended,
		CreatedAt:   createdAt,
		ResolvedAt:  resolvedAt,
		ImageUrl:    imageUrl,
		PriceUsd:    priceUsd,
		Description: market.Description,
	}
	return marketResponse, nil
}

func (ms *MarketsService) PriceHistory(req *pb_api.PriceHistoryRequest) (*pb_api.PriceHistoryResponse, error) {
	// guards
	from, err := time.Parse(time.RFC3339, req.From)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid RFC3339 'from' timestamp: %v", err)
	}
	to, err := time.Parse(time.RFC3339, req.To)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid RFC3339 'to' timestamp: %v", err)
	}
	if to.Before(from) {
		return nil, lib.LogAndError(lib.LOG_ERROR, "'from' must be before 'to'")
	}

	// optionals
	var limit int32 = 100 // optional, default is 100
	var offset int32 = 0  // optional, default is 0
	if req.Limit != nil {
		limit = *req.Limit
	}
	if req.Offset != nil {
		offset = *req.Offset
	}

	// OK
	resolutionDurations := map[string]time.Duration{
		"second": time.Second,
		"minute": time.Minute,
		"hour":   time.Hour,
		"day":    24 * time.Hour,
		"week":   7 * 24 * time.Hour,
	}
	interval, ok := resolutionDurations[req.Resolution]
	if !ok {
		return nil, lib.LogAndError(lib.LOG_ERROR, "unsupported resolution: %s", req.Resolution)
	}

	// --- Enforce max duration based on limit ---
	maxDuration := interval * time.Duration(limit)
	if to.Sub(from) > maxDuration {
		return nil, lib.LogAndError(lib.LOG_ERROR, "time range too large for resolution %s (max %v)", req.Resolution, maxDuration)
	}

	rows, err := ms.priceRepository.GetPriceHistory(req.MarketId, from, to, limit, offset)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "query failed: %v", err)
	}

	ticks := make([]float32, len(rows))
	timestamps := make([]uint64, len(rows))
	for i, row := range rows {
		priceFloat, _ := strconv.ParseFloat(row.Price, 32) // convert price NUMERIC(18,10) to float32
		ticks[i] = float32(priceFloat)
		timestamps[i] = uint64(row.Ts.UnixMilli())
	}

	response := &pb_api.PriceHistoryResponse{
		TimestampMs: timestamps,
		PriceUsd:    ticks,
	}
	return response, nil

	// paginatedPriceHistory, err := m.dbRepository.GetAggregatedPriceHistory(req.MarketId, req.Limit, req.Offset, req.Zoom)
	// if err != nil {
	// 	return nil, err
	// }

	// // uniformArr := make([]float32, req.Limit)
	// // for _, ph := range paginatedPriceHistory { // Fill the uniformArr with price data
	// // 	index := int(ph.Ts.Sub(ts1) / duration) // Determine the index in uniformArr based on the timestamp
	// // 	if index >= 0 && index < int(req.Limit) {
	// // 		priceFloat, _ := strconv.ParseFloat(ph.Price, 32) // convert price NUMERIC(18,10) to float32
	// // 		uniformArr[index] = float32(priceFloat)
	// // 	}
	// // }

	// uniformArr := make([]float32, 0, len(paginatedPriceHistory)) // Preallocate capacity for efficiency
	// for _, ph := range paginatedPriceHistory {
	// 	uniformArr = append(uniformArr, float32(ph.AvgPrice))
	// }

	// response := &pb_api.PriceHistoryResponse{
	// 	Ticks: uniformArr,
	// 	From:  ts1.Format("2006-01-02T15:04:05Z"),
	// 	To:    ts2.Format("2006-01-02T15:04:05Z"),
	// }
	// return response, nil
}

func (ms *MarketsService) GetNumMarkets() uint32 {
	nMarkets, err := ms.marketsRepository.CountUnresolvedMarkets()
	if err != nil {
		return 0
	}
	return uint32(nMarkets)
}

func (ms *MarketsService) ResolveMarket(marketId string, noYes bool) (bool, error) {
	// step 1 - resolve on the smart contract
	market, err := ms.marketsRepository.GetMarketById(marketId, true)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to get market by id: %v", err)
	}

	isOK, err := ms.hederaService.ResolveMarketOnChain(market.Net, marketId, market.SmartContractID, noYes)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to resolve market on chain: %v", err)
	}
	if !isOK {
		return false, lib.LogAndError(lib.LOG_ERROR, "transaction failed to execute on chain for unknown reasons")
	}

	// step 2 - mark as resolved on the db
	isOK, err = ms.marketsRepository.ResolveMarket(marketId, noYes)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to resolve market on db: %v", err)
	}
	if !isOK {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to resolve market on db for unknown reasons")
	}

	return true, nil
}
