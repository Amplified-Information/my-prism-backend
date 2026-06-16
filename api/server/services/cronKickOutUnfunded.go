package services

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	repositories "api/server/repositories"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type CronKickOutUnfundedService struct {
	marketsRepository           *repositories.MarketsRepository
	predictionIntentsRepository *repositories.PredictionIntentsRepository
	hederaService               *HederaService
	predictionIntentsService    *PredictionIntentsService
}

func (cs *CronKickOutUnfundedService) Init(mr *repositories.MarketsRepository, pir *repositories.PredictionIntentsRepository, hs *HederaService, pis *PredictionIntentsService) error {
	// inject deps
	cs.marketsRepository = mr
	cs.predictionIntentsRepository = pir
	cs.hederaService = hs
	cs.predictionIntentsService = pis

	lib.Log(lib.LOG_INFO, "Service: CronKickOutUnfunded service initialized successfully")
	return nil
}

func (cs *CronKickOutUnfundedService) CronJob() {
	lib.Log(lib.LOG_INFO, "CronKickOutUnfundedService: Running CronJob...")

	cs.KickOutOrderIntentsNotBackedByFunds()

	lib.Log(lib.LOG_INFO, "CronKickOutUnfundedService: CronJob completed.")
}

func (cs *CronKickOutUnfundedService) KickOutOrderIntentsNotBackedByFunds() {
	lib.Log(lib.LOG_INFO, "KickOutOrderIntentsNotBackedByFunds: Starting process to kick out order intents not backed by funds...")

	markets, err := cs.marketsRepository.GetAllUnresolvedMarkets()
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to fetch unresolved markets: %v", err)
		return
	}

	for _, market := range markets {
		lib.Log(lib.LOG_INFO, "verifying all orderIntents for market ID %s", market.MarketID)

		// retrieve all unique accountIds with live positions...
		accountIds, err := cs.predictionIntentsRepository.GetAllAccountIdsForMarketId(market.MarketID)
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Failed to fetch account IDs for market ID %s: %v", market.MarketID, err)
			continue
		}

		for _, accountIdStr := range accountIds {
			lib.Log(lib.LOG_INFO, "verifying orderIntents for account ID %s in market ID %s", accountIdStr, market.MarketID)

			// get the allowance for each accountId
			net, err := hiero.LedgerIDFromString(strings.ToLower(market.Net))
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to parse net %s for account ID %s: %v", market.Net, accountIdStr, err)
				continue
			}

			accountId, err := hiero.AccountIDFromString(accountIdStr)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to parse account ID %s: %v", accountIdStr, err)
				continue
			}

			smartContractId, err := hiero.ContractIDFromString(market.SmartContractID)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to parse smart contract ID %s for market ID %s: %v", market.SmartContractID, market.MarketID, err)
				continue
			}

			usdcAddressStr := os.Getenv(fmt.Sprintf("%s_USDC_ADDRESS", strings.ToUpper(market.Net)))
			usdcDecimalsStr := os.Getenv("USDC_DECIMALS")

			if usdcAddressStr == "" || usdcDecimalsStr == "" {
				lib.Log(lib.LOG_ERROR, "USDC_ADDRESS or USDC_DECIMALS environment variable is not set")
				continue
			}
			usdcDecimals, err := strconv.ParseUint(usdcDecimalsStr, 10, 64)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "invalid USDC_DECIMALS: %v", err)
				continue
			}
			usdcAddress, err := hiero.ContractIDFromString(usdcAddressStr)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "invalid USDC address: %v", err)
				continue
			}

			allowance, err := lib.GetSpenderAllowanceUsd(*net, accountId, smartContractId, usdcAddress, usdcDecimals)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to fetch allowance for account ID %s: %v", accountIdStr, err)
				continue
			}
			lib.Log(lib.LOG_INFO, "-> Account ID %s has allowance %f", accountIdStr, allowance)

			usdcBalanceInt64, err := lib.GetUsdcBalanceUsd(*net, accountId)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to fetch USDC balance for account ID %s: %v", accountIdStr, err)
				continue
			}
			usdcBalance := float64(usdcBalanceInt64) / math.Pow(10, float64(usdcDecimals))

			lib.Log(lib.LOG_INFO, "-> Account ID %s has USDC balance %f", accountIdStr, usdcBalance)

			// retrieve all live orderIntents for this market, for this specific accountId
			usersOpenPredictionIntents, err := cs.predictionIntentsRepository.GetAllOpenPredictionIntentsByMarketIdAndAccountId(market.MarketID, accountIdStr)
			if err != nil {
				lib.Log(lib.LOG_ERROR, " Failed to fetch live prediction intents for market ID %s and account ID %s: %v", market.MarketID, accountIdStr, err)
				continue
			}

			var txIds []string
			for _, pi := range usersOpenPredictionIntents {
				txIds = append(txIds, pi.TxID.String())
			}
			lib.Log(lib.LOG_INFO, "usersOpenPredictionIntents (%d): %v", len(usersOpenPredictionIntents), txIds)

			// Separate primary and secondary orders
			var primaryOrders, secondaryOrders []sqlc.PredictionIntent
			for _, pi := range usersOpenPredictionIntents {
				if pi.PrimarySecondary == "p" {
					primaryOrders = append(primaryOrders, pi)
				} else {
					secondaryOrders = append(secondaryOrders, pi)
				}
			}

			// Validate primary orders (USDC-backed)
			cs.validateAndKickoutPrimaryOrders(primaryOrders, &market, accountIdStr, usdcBalance, allowance)

			// Validate secondary orders (position token-backed)
			if len(secondaryOrders) > 0 {
				cs.validateAndKickoutSecondaryOrders(secondaryOrders, &market, accountIdStr, *net)
			}
		}
	}
}
func (cs *CronKickOutUnfundedService) validateAndKickoutPrimaryOrders(primaryOrders []sqlc.PredictionIntent, market *sqlc.Market, accountIdStr string, usdcBalance float64, allowance float64) {
	sumTotalOfAllPrimaryIntents := 0.0
	for _, pi := range primaryOrders {
		lib.Log(lib.LOG_INFO, "[primary] processing txId=%s", pi.TxID.String())
		sumTotalOfAllPrimaryIntents += (math.Abs(pi.PriceUsd) * pi.Qty)
		lib.Log(lib.LOG_INFO, "[primary] sumTotalOfAllPrimaryIntents: %f", sumTotalOfAllPrimaryIntents)

		if sumTotalOfAllPrimaryIntents > usdcBalance {
			_, err := cs.predictionIntentsService.CancelPredictionIntentNoSigCheck(market.MarketID.String(), pi.TxID.String())
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to cancel primary prediction intent txId %s for market ID %s and account ID %s: %v", pi.TxID.String(), market.MarketID, accountIdStr, err)
				continue
			}
			lib.Log(lib.LOG_WARN, "-> Cancelled primary prediction intent txId %s for market ID %s and account ID %s due to insufficient USDC (total required: %f, balance: %f)", pi.TxID.String(), market.MarketID, accountIdStr, sumTotalOfAllPrimaryIntents, usdcBalance)

			err = cs.predictionIntentsRepository.MarkPredictionIntentAsEvicted(pi.TxID)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to mark as evicted prediction intent txId %s: %v", pi.TxID.String(), err)
				continue
			}
			lib.Log(lib.LOG_WARN, "-> Marked as evicted prediction intent txId %s", pi.TxID.String())
		}
	}
}

func (cs *CronKickOutUnfundedService) validateAndKickoutSecondaryOrders(secondaryOrders []sqlc.PredictionIntent, market *sqlc.Market, accountIdStr string, net hiero.LedgerID) {
	if len(secondaryOrders) == 0 {
		return
	}

	template := secondaryOrders[0]
	evmAddress := template.Evmaddress

	// yesTokens, noTokens, err := cs.hederaService.GetUserPositionTokenBalanceOnChain(net, market.MarketID.String(), evmAddress)
	yesTokens, noTokens, err := cs.hederaService.GetUserPositionTokenBalanceFromDb(market.MarketID.String(), evmAddress)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to get position token balance for account %s on market %s: %v", evmAddress, market.MarketID, err)
		return
	}
	lib.Log(lib.LOG_INFO, "[secondary] User %s has YES=%.8f NO=%.8f tokens on market %s", evmAddress, yesTokens, noTokens, market.MarketID)

	var sumYesRequired, sumNoRequired float64
	for _, pi := range secondaryOrders {
		lib.Log(lib.LOG_INFO, "[secondary] processing txId=%s with priceUsd=%.2f qty=%.8f", pi.TxID.String(), pi.PriceUsd, pi.Qty)

		if pi.PriceUsd < 0 {
			sumYesRequired += pi.Qty
		} else {
			sumNoRequired += pi.Qty
		}
	}

	lib.Log(lib.LOG_INFO, "[secondary] Required: YES=%.8f NO=%.8f | Have: YES=%.8f NO=%.8f", sumYesRequired, sumNoRequired, yesTokens, noTokens)

	if sumYesRequired > yesTokens {
		for _, pi := range secondaryOrders {
			if pi.PriceUsd < 0 {
				_, err := cs.predictionIntentsService.CancelPredictionIntentNoSigCheck(market.MarketID.String(), pi.TxID.String())
				if err != nil {
					lib.Log(lib.LOG_ERROR, "Failed to cancel secondary YES prediction intent txId %s: %v", pi.TxID.String(), err)
					continue
				}
				lib.Log(lib.LOG_WARN, "-> Cancelled secondary YES prediction intent txId %s due to insufficient YES tokens (required: %.8f, have: %.8f)", pi.TxID.String(), sumYesRequired, yesTokens)

				err = cs.predictionIntentsRepository.MarkPredictionIntentAsEvicted(pi.TxID)
				if err != nil {
					lib.Log(lib.LOG_ERROR, "Failed to mark as evicted prediction intent txId %s: %v", pi.TxID.String(), err)
				}
			}
		}
	}

	if sumNoRequired > noTokens {
		for _, pi := range secondaryOrders {
			if pi.PriceUsd > 0 {
				_, err := cs.predictionIntentsService.CancelPredictionIntentNoSigCheck(market.MarketID.String(), pi.TxID.String())
				if err != nil {
					lib.Log(lib.LOG_ERROR, "Failed to cancel secondary NO prediction intent txId %s: %v", pi.TxID.String(), err)
					continue
				}
				lib.Log(lib.LOG_WARN, "-> Cancelled secondary NO prediction intent txId %s due to insufficient NO tokens (required: %.8f, have: %.8f)", pi.TxID.String(), sumNoRequired, noTokens)

				err = cs.predictionIntentsRepository.MarkPredictionIntentAsEvicted(pi.TxID)
				if err != nil {
					lib.Log(lib.LOG_ERROR, "Failed to mark as evicted prediction intent txId %s: %v", pi.TxID.String(), err)
				}
			}
		}
	}
}
