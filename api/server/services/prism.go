package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	pb_api "api/gen"
	pb_clob "api/gen/clob"
	"api/server/lib"
	repositories "api/server/repositories"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Prism struct {
	dbRepository      *repositories.DbRepository
	marketsRepository *repositories.MarketsRepository
	matchesRepository *repositories.MatchesRepository

	natsService              *NatsService
	hederaService            *HederaService
	marketsService           *MarketsService
	predictionIntentsService *PredictionIntentsService
}

func (p *Prism) InitPrism(dbRepository *repositories.DbRepository, marketsRepository *repositories.MarketsRepository, matchesRepository *repositories.MatchesRepository, natsService *NatsService, hederaService *HederaService, marketsService *MarketsService, predictionIntentsService *PredictionIntentsService) error {
	// inject deps:
	p.dbRepository = dbRepository
	p.marketsRepository = marketsRepository
	p.matchesRepository = matchesRepository

	p.natsService = natsService
	p.hederaService = hederaService
	p.marketsService = marketsService
	p.predictionIntentsService = predictionIntentsService

	lib.Log(lib.LOG_INFO, "Service: Prism service initialized successfully, %p", p)
	return nil
}

func (p *Prism) MacroMetadata() (*pb_api.MacroMetadataResponse, error) {
	networksEnv := os.Getenv("AVAILABLE_NETWORKS")
	networks := strings.Split(networksEnv, ",")

	networksAdminEnv := os.Getenv("AVAILABLE_NETWORKS_ADMIN")
	networksAdmin := strings.Split(networksAdminEnv, ",")

	smartContractIdsMap := make(map[string]string)
	for _, net := range networks { // loop through networks and get the smart contract IDs from env vars
		netLower := strings.ToLower(strings.TrimSpace(net))
		// YES, use the current X_SMART_CONTRACT_ID loaded from env vars
		envVarName := fmt.Sprintf("%s_SMART_CONTRACT_ID", strings.ToUpper(netLower))
		smartContractId := os.Getenv(envVarName)
		if smartContractId != "" {
			smartContractIdsMap[netLower] = smartContractId
		}
	}

	usdcTokenIdsMap := make(map[string]string)
	for _, net := range networks { // loop through networks and get the USDC addresses from env vars
		netLower := strings.ToLower(strings.TrimSpace(net))
		envVarName := fmt.Sprintf("%s_USDC_ADDRESS", strings.ToUpper(netLower))
		usdcTokenId := os.Getenv(envVarName)
		if usdcTokenId != "" {
			usdcTokenIdsMap[netLower] = usdcTokenId
		}
	}

	usdcDecimalsEnv := os.Getenv("USDC_DECIMALS")
	usdcDecimals, err := strconv.ParseUint(usdcDecimalsEnv, 10, 64)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "USDC_DECIMALS environment variable is not a valid uint: %v", err)
	}

	marketCreationFeeUsdc := os.Getenv("MARKET_CREATION_FEE_USDC")
	// Validate MARKET_CREATION_FEE_USDC is not empty and is a valid number
	if marketCreationFeeUsdc == "" {
		return nil, lib.LogAndError(lib.LOG_ERROR, "MARKET_CREATION_FEE_USDC environment variable is empty")
	}
	marketCreationFeeScaledUsdc, err := strconv.ParseUint(marketCreationFeeUsdc, 10, 64)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "MARKET_CREATION_FEE_USDC environment variable is not a valid float: %v", err)
	}

	tokenIdsMap := make(map[string]string)
	for _, net := range networks { // loop through networks and get the token addresses from env vars
		netLower := strings.ToLower(strings.TrimSpace(net))
		envVarName := fmt.Sprintf("%s_TOKEN", strings.ToUpper(netLower))
		tokenId := os.Getenv(envVarName)
		if tokenId != "" {
			tokenIdsMap[netLower] = tokenId
		}
	}

	minOrderSizeUsdEnv := os.Getenv("MIN_ORDER_SIZE_USD")
	minOrderSizeUsd, err := strconv.ParseFloat(minOrderSizeUsdEnv, 64)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "MIN_ORDER_SIZE_USD environment variable is not a valid float: %v", err)
	}

	totalVolumeUsd := make(map[string]float64)

	for _, period := range lib.VolumeResolutionPeriods {
		period := strings.ToLower(strings.TrimSpace(period))
		volume, err := p.dbRepository.GetTotalValueMatchedUsdInTimePeriod(period)
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get total volume USD for network %s: %v", period, err)
		}
		totalVolumeUsd[period] = volume
	}

	nActiveTraders, err := p.dbRepository.GetNumActiveTraders()
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get number of active traders: %v", err)
	}

	tvPendingUsd, err := p.clob_getTotalValuePendingUsd()
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get TVL USD: %v", err)
	}

	tvMatchedUsd, err := p.dbRepository.GetTotalValueMatchedUsd()
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get TVL USD: %v", err)
	}

	tvMatchedUsdOpenMarkets, err := p.dbRepository.GetTotalValueMatchedUsdOpenMarkets()
	// log.Printf("tvMatchedUsdOpenMarkets: %f", tvMatchedUsdOpenMarkets)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get GetTotalValueMatchedUsdOpenMarkets: %v", err)
	}

	categories, err := p.marketsRepository.GetCategories()
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get categories: %v", err)
	}
	categoriesMapped := make([]*pb_api.Category, len(categories))
	for i, category := range categories {
		categoriesMapped[i] = &pb_api.Category{
			Id:   category.ID,
			Name: category.Name,
		}
	}

	proxyAddresses := make(map[string]string)
	chainIds := make(map[string]uint64)
	for _, net := range networks {
		if cfg, err := lib.GetPrismV2Network(strings.TrimSpace(net)); err == nil {
			proxyAddresses[cfg.Net] = cfg.ProxyAddress
			chainIds[cfg.Net] = cfg.ChainID
		}
	}

	sigSchemeDateRanges := make([]*pb_api.UnixDateRange, len(lib.SigSchemeDateRanges))
	for i, dateRange := range lib.SigSchemeDateRanges {
		sigSchemeDateRanges[i] = &pb_api.UnixDateRange{
			Start: int32(dateRange[0]),
			End:   int32(dateRange[1]),
		}
	}

	response := &pb_api.MacroMetadataResponse{
		AvailableNetworks:           networks,
		AvailableNetworksAdmin:      networksAdmin,
		SmartContractIds:            smartContractIdsMap,
		UsdcTokenIds:                usdcTokenIdsMap,
		UsdcDecimals:                uint32(usdcDecimals),
		MarketCreationFeeScaledUsdc: marketCreationFeeScaledUsdc,
		NMarkets:                    p.marketsService.GetNumMarkets(),
		TokenIds:                    tokenIdsMap,
		MinOrderSizeUsd:             minOrderSizeUsd,
		TvPendingUsd:                tvPendingUsd,
		TvMatchedUsd:                tvMatchedUsd,
		TvlUsd:                      tvMatchedUsdOpenMarkets, // + tvPendingUsd, // TVL = matched + pending
		TotalVolumeUsd:              totalVolumeUsd,
		ActiveTraders:               nActiveTraders,
		Categories:                  categoriesMapped,
		SigSchemeDateRanges:         sigSchemeDateRanges,
		PrismV2ProxyAddresses:       proxyAddresses,
		ChainIds:                    chainIds,
	}

	return response, nil
}

func (p *Prism) TriggerRecreateClob() (bool, error) {
	lib.Log(lib.LOG_INFO, "TriggerRecreateClob called on Prism instance: %p", p)

	if p.dbRepository == nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "dbRepository is not initialized")
	}

	// OK

	// retrieve all unresolved markets from the database:
	markets, err := p.marketsRepository.GetAllUnresolvedMarkets()
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to get unresolved markets: %v", err)
	}
	lib.Log(lib.LOG_INFO, "Found %d unresolved markets in the database for recreation on the CLOB", len(markets))

	// loop through each unresolved market:
	for _, market := range markets {

		/////
		// step 1 - create the market on the CLOB:
		/////
		lib.Log(lib.LOG_INFO, "- marketId: %s", market.MarketID.String())
		err = lib.CreateMarketOnClob(market.MarketID.String())
		if err != nil {
			return false, lib.LogAndError(lib.LOG_ERROR, "failed to create new market (marketId=%s) on CLOB: %v", market.MarketID.String(), err)
		}

		/////
		// step 2 - retrieve from db all the PredictionIntents for restoring to the CLOB
		/////
		// Marshal the CLOB req: *pb_api.PredictionIntentRequest to JSON
		allPredictionIntents, err := p.predictionIntentsService.GetAllOpenPredictionIntentsByMarketId(market.MarketID.String())
		if err != nil {
			return false, lib.LogAndError(lib.LOG_ERROR, "failed to GetAllOpenPredictionIntentsByMarketId(marketId=%s): %v", market.MarketID.String(), err)
		}
		lib.Log(lib.LOG_INFO, "--> Found %d open PredictionIntents on marketId %s", len(*allPredictionIntents), market.MarketID.String())

		n := 0
		for _, pi := range *allPredictionIntents {
			lib.Log(lib.LOG_INFO, "\t - txId: %s", pi.TxID.String())

			// The persisted fill state counts finalized fills. Fills still being settled
			// (pending, submitted, or failed but retrying) are also counted, so the
			// rebuilt book never offers shares that may already be committed.
			clobRequestObj, err := clobOrderFromIntent(&pi)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "\tskipping txId %s: %v", pi.TxID.String(), err)
				continue
			}
			allMatches, err := p.matchesRepository.GetAllMatchesForMarketIdTxId(pi.MarketID, pi.TxID)
			if err != nil {
				return false, lib.LogAndError(lib.LOG_ERROR, "failed to load matches for txId %s: %v", pi.TxID.String(), err)
			}
			for _, match := range allMatches {
				if match.ProtocolVersion != 2 || match.Status == "finalized" {
					continue
				}
				fill, err := parseNumeric(match.FillShares)
				if err != nil {
					continue
				}
				legCollateral := match.YesCollateral
				if lib.Side(clobRequestObj.Side) == lib.SideNO {
					legCollateral = match.NoCollateral
				}
				collateral, _ := parseNumeric(legCollateral)
				clobRequestObj.SharesFilled += fill
				clobRequestObj.CollateralFilled += collateral
			}
			if clobRequestObj.SharesFilled >= clobRequestObj.QtyShares {
				continue // nothing left to restore
			}

			clobRequestJSON, err := json.Marshal(clobRequestObj)
			if err != nil {
				return false, lib.LogAndError(lib.LOG_ERROR, "failed to marshal CLOB request: %v", err)
			}

			lib.Log(lib.LOG_INFO, "\tre-creating txId %s (sharesFilled=%d of %d)", clobRequestObj.TxId, clobRequestObj.SharesFilled, clobRequestObj.QtyShares)

			/////
			// And push to CLOB via NATS
			/////
			subject := lib.SUBJECT_CLOB_ORDERS
			err = p.natsService.Publish(subject, clobRequestJSON)
			if err != nil {
				return false, lib.LogAndError(lib.LOG_ERROR, "failed to publish to NATS subject %s: %v", subject, err)
			}
			lib.Log(lib.LOG_INFO, "\tCLOB notified.")

			/////
			// finally, mark the PredictionIntent as 'regenerated' in the database
			/////
			err = p.dbRepository.MarkPredictionIntentAsRegenerated(pi.TxID.String())
			if err != nil {
				return false, lib.LogAndError(lib.LOG_ERROR, "failed to MarkPredictionIntentAsRegenerated(txId=%s): %v", pi.TxID.String(), err)
			}

			n = n + 1
		}

		lib.Log(lib.LOG_INFO, "--> Done. Added %d orders to CLOB for marketId %s", n, market.MarketID.String())
	}

	return true, nil
}

func (p *Prism) clob_getTotalValuePendingUsd() (float64, error) {
	// this is a CLOB query because of the complexity of calculating the pending USD value from the PredictionIntents and Matches tables (partially matched orders, etc.)
	// it's easier to just query the CLOB which has the current state of all open orders
	clobAddr := os.Getenv("CLOB_HOST") + ":" + os.Getenv("CLOB_PORT")

	conn, err := grpc.NewClient(clobAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "Failed to open grpc connection to CLOB %v", err)
	}
	defer conn.Close()

	clobClient := pb_clob.NewClobInternalClient(conn)
	tvPending, err := clobClient.GetTvPendingUsd(
		context.Background(),
		&pb_clob.Empty{},
	)
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "failed to get total value pending USD from CLOB (%s): %v", clobAddr, err)
	}
	if tvPending.ErrorCode != 0 {
		return 0, lib.LogAndError(lib.LOG_ERROR, "failed to get total value pending USD from CLOB (%s): %v", clobAddr, tvPending.ErrorCode)
	}
	// The CLOB reports collateral in the token's smallest unit.
	tvPendingUnits, err := strconv.ParseFloat(tvPending.Message, 64)
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "failed to parse total value pending from CLOB: %v", err)
	}
	unitScale, err := lib.CollateralUnitScale()
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "%v", err)
	}
	return tvPendingUnits / float64(unitScale), nil
}
