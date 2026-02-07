package services

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	pb_api "api/gen"
	pb_clob "api/gen/clob"
	"api/server/lib"
	repositories "api/server/repositories"
)

type Prism struct {
	log               *LogService
	dbRepository      *repositories.DbRepository
	marketsRepository *repositories.MarketsRepository
	matchesRepository *repositories.MatchesRepository

	natsService              *NatsService
	hederaService            *HederaService
	marketsService           *MarketsService
	predictionIntentsService *PredictionIntentsService
}

func (p *Prism) InitPrism(log *LogService, dbRepository *repositories.DbRepository, marketsRepository *repositories.MarketsRepository, matchesRepository *repositories.MatchesRepository, natsService *NatsService, hederaService *HederaService, marketsService *MarketsService, predictionIntentsService *PredictionIntentsService) error {
	// inject deps:
	p.log = log
	p.dbRepository = dbRepository
	p.marketsRepository = marketsRepository
	p.matchesRepository = matchesRepository

	p.natsService = natsService
	p.hederaService = hederaService
	p.marketsService = marketsService
	p.predictionIntentsService = predictionIntentsService

	p.log.Log(INFO, "Service: Prism service initialized successfully, %p", p)
	return nil
}

func (p *Prism) MacroMetadata() (*pb_api.MacroMetadataResponse, error) {
	networksEnv := os.Getenv("AVAILABLE_NETWORKS")
	networks := strings.Split(networksEnv, ",")

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

	marketCreationFeeUsdc := os.Getenv("MARKET_CREATION_FEE_USDC")
	// Validate MARKET_CREATION_FEE_USDC is not empty and is a valid number
	if marketCreationFeeUsdc == "" {
		return nil, p.log.Log(ERROR, "MARKET_CREATION_FEE_USDC environment variable is empty")
	}
	marketCreationFeeScaledUsdc, err := strconv.ParseUint(marketCreationFeeUsdc, 10, 64)
	if err != nil {
		return nil, p.log.Log(ERROR, "MARKET_CREATION_FEE_USDC environment variable is not a valid float: %v", err)
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
		return nil, p.log.Log(ERROR, "MIN_ORDER_SIZE_USD environment variable is not a valid float: %v", err)
	}

	totalVolumeUsd := make(map[string]float64)
	resolutionPeriods := []string{"1h", "24h", "7d", "30d"}
	for _, period := range resolutionPeriods {
		period := strings.ToLower(strings.TrimSpace(period))
		volume, err := p.dbRepository.GetTotalVolumeUsdInTimePeriod(period)
		if err != nil {
			return nil, p.log.Log(ERROR, "failed to get total volume USD for network %s: %v", period, err)
		}
		totalVolumeUsd[period] = volume
	}

	nActiveTraders, err := p.dbRepository.GetNumActiveTraders()
	if err != nil {
		return nil, p.log.Log(ERROR, "failed to get number of active traders: %v", err)
	}

	response := &pb_api.MacroMetadataResponse{
		AvailableNetworks:           networks,
		SmartContractIds:            smartContractIdsMap,
		UsdcTokenIds:                usdcTokenIdsMap,
		UsdcDecimals:                6,
		MarketCreationFeeScaledUsdc: marketCreationFeeScaledUsdc,
		NMarkets:                    p.marketsService.GetNumMarkets(),
		TokenIds:                    tokenIdsMap,
		MinOrderSizeUsd:             minOrderSizeUsd,
		TvlUsd:                      1234567.89,     // TODO - implement real TVL calculation
		TotalVolumeUsd:              totalVolumeUsd, // TODO - implement a real total volume
		ActiveTraders:               nActiveTraders,
	}

	return response, nil
}

func (p *Prism) TriggerRecreateClob() (bool, error) {
	p.log.Log(INFO, "TriggerRecreateClob called on Prism instance: %p", p)

	if p.dbRepository == nil {
		return false, p.log.Log(ERROR, "dbRepository is not initialized")
	}

	// OK

	// retrieve all unresolved markets from the database:
	markets, err := p.marketsRepository.GetAllUnresolvedMarkets()
	if err != nil {
		return false, p.log.Log(ERROR, "failed to get unresolved markets: %v", err)
	}

	// loop through each unresolved market:
	for _, market := range markets {

		/////
		// step 1 - create the market on the CLOB:
		/////
		p.log.Log(INFO, "- marketId: %s", market.MarketID.String())
		err = lib.CreateMarketOnClob(market.MarketID.String())
		if err != nil {
			return false, p.log.Log(ERROR, "failed to create new market (marketId=%s) on CLOB: %v", market.MarketID.String(), err)
		}

		/////
		// step 2 - retrieve from db all the PredictionIntents for restoring to the CLOB
		/////
		// Marshal the CLOB req: *pb_api.PredictionIntentRequest to JSON
		allPredictionIntents, err := p.predictionIntentsService.GetAllOpenPredictionIntentsByMarketId(market.MarketID.String())
		if err != nil {
			return false, p.log.Log(ERROR, "failed to GetAllOpenPredictionIntentsByMarketId(marketId=%s): %v", market.MarketID.String(), err)
		}
		p.log.Log(INFO, "--> Found %d open PredictionIntents on marketId %s", len(*allPredictionIntents), market.MarketID.String())

		n := 0
		for _, predictionIntent := range *allPredictionIntents {
			p.log.Log(INFO, "\t - txId: %s", predictionIntent.TxID.String())

			// calculate "qtyRemaining" to be placed on CLOB (may not exist)
			var qtyRemaining float64 = predictionIntent.Qty // set to Qty by default

			allMatches, err := p.matchesRepository.GetAllMatchesForMarketIdTxId(predictionIntent.MarketID, predictionIntent.TxID)
			p.log.Log(INFO, "\t - allMatches for txId %s on marketId %s: %v", predictionIntent.TxID.String(), predictionIntent.MarketID.String(), allMatches)
			if err != nil || len(allMatches) == 0 {
				// no matches for this predictionIntent qty found: qtyRemaining = req.Qty (default)
				// qtyRemaining is predictionIntent.Qty - OK
			} else {
				// we must find the latest qtyRemaining for this txId

				// loop through allMatches
				// calculate the Qty for predictionIntent.TxID
				// subtract this Qty from qtyRemaining
				// at the end of the loop, if qtyRemaining is > 0, continue to add the order to the CLOB
				// otherwise, don't add anything to the clob
				for _, match := range allMatches {
					p.log.Log(INFO, "\t row on 'match': %v", match)
					// Each match has a Qty field that represents the amount matched for this TxID
					if match.TxId1 == predictionIntent.TxID {
						// log.Print("%s", match.Qty1)
						qtyRemaining -= match.Qty2
					} else if match.TxId2 == predictionIntent.TxID {
						qtyRemaining -= match.Qty1
					}
				}
			}

			if qtyRemaining <= 0 {
				// All qty has been matched, nothing to restore to CLOB for this predictionIntent
				continue
			}

			/////
			// Next, recreate the CLOB order request object
			/////

			clobRequestObj := &pb_clob.CreateOrderRequestClob{
				TxId:        predictionIntent.TxID.String(),
				Net:         predictionIntent.Net,
				MarketId:    predictionIntent.MarketID.String(),
				AccountId:   predictionIntent.AccountID,
				MarketLimit: predictionIntent.MarketLimit,
				PriceUsd:    predictionIntent.PriceUsd,
				Qty:         qtyRemaining,
				QtyOrig:     predictionIntent.Qty, // need to keep track of the original qty for on/off-chain signature validation
				Sig:         predictionIntent.Sig,
				PublicKey:   predictionIntent.PublicKeyHex, // passing extra key info - i) avoid lookups ii) handle situation where user has changed their key
				EvmAddress:  predictionIntent.Evmaddress,
				KeyType:     int32(predictionIntent.Keytype),
			}
			clobRequestJSON, err := json.Marshal(clobRequestObj)
			if err != nil {
				return false, p.log.Log(ERROR, "failed to marshal CLOB request: %v", err)
			}

			p.log.Log(INFO, "\tre-creating tx (qty=%f, qtyOrig=%f): %v", clobRequestObj.Qty, clobRequestObj.QtyOrig, clobRequestObj)

			/////
			// And push to CLOB via NATS
			/////
			subject := lib.SUBJECT_CLOB_ORDERS
			err = p.natsService.Publish(subject, clobRequestJSON)
			if err != nil {
				return false, p.log.Log(ERROR, "failed to publish to NATS subject %s: %v", subject, err)
			}
			p.log.Log(INFO, "\tCLOB notified.")

			/////
			// finally, mark the PredictionIntent as 'regenerated' in the database
			/////
			err = p.dbRepository.MarkPredictionIntentAsRegenerated(predictionIntent.TxID.String())
			if err != nil {
				return false, p.log.Log(ERROR, "failed to MarkPredictionIntentAsRegenerated(txId=%s): %v", predictionIntent.TxID.String(), err)
			}

			n = n + 1
		}

		p.log.Log(INFO, "--> Done. Added %d orders to CLOB for marketId %s", n, market.MarketID.String())
	}

	return true, nil
}
