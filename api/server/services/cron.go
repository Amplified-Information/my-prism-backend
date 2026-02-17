package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type CronService struct {
	priceRepository             *repositories.PriceRepository
	marketsRepository           *repositories.MarketsRepository
	predictionIntentsRepository *repositories.PredictionIntentsRepository
	hederaService               *HederaService
	predictionIntentsService    *PredictionIntentsService
}

func (cs *CronService) Init(mr *repositories.MarketsRepository, pir *repositories.PredictionIntentsRepository, hs *HederaService, pis *PredictionIntentsService) error {
	// inject deps
	cs.marketsRepository = mr
	cs.predictionIntentsRepository = pir
	cs.hederaService = hs
	cs.predictionIntentsService = pis

	lib.Log(lib.LOG_INFO, "Service: Cron service initialized successfully")
	return nil
}

func (cs *CronService) CronJob() {
	lib.Log(lib.LOG_INFO, "CronService: Running CronJob...")

	cs.KickOutOrderIntentsNotBackedByFunds()

	lib.Log(lib.LOG_INFO, "CronService: CronJob completed.")
}

func (cs *CronService) UpdatePositionsWithRealPositions() error {
	lib.Log(lib.LOG_INFO, "UpdatePositionsWithRealPositions...")
	// TODO: implement

	return nil
}

func (cs *CronService) KickOutOrderIntentsNotBackedByFunds() {
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

			allowance, err := cs.hederaService.GetSpenderAllowanceUsd(*net, accountId, smartContractId, usdcAddress, usdcDecimals)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to fetch allowance for account ID %s: %v", accountIdStr, err)
				continue
			}
			lib.Log(lib.LOG_INFO, "-> Account ID %s has allowance %f", accountIdStr, allowance)

			usdcBalance, err := cs.hederaService.GetUsdcBalanceUsd(*net, accountId)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to fetch USDC balance for account ID %s: %v", accountIdStr, err)
				continue
			}
			lib.Log(lib.LOG_INFO, "-> Account ID %s has USDC balance %f", accountIdStr, usdcBalance)

			// retrieve all live orderIntents for this market, for this specific accountId
			sumTotalOfAllPredictionIntents := 0.0
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

			for _, pi := range usersOpenPredictionIntents {
				lib.Log(lib.LOG_INFO, "processing txId=%s", pi.TxID.String())
				sumTotalOfAllPredictionIntents += (math.Abs(pi.PriceUsd) * pi.Qty)
				lib.Log(lib.LOG_INFO, "sumTotalOfAllPredictionIntent: %f", sumTotalOfAllPredictionIntents)

				if sumTotalOfAllPredictionIntents > usdcBalance {
					// cancel this prediction intent
					_, err := cs.predictionIntentsService.CancelPredictionIntent(market.MarketID.String(), pi.TxID.String())
					// err = cs.predictionIntentsRepository.CancelPredictionIntent(pi.TxID.String())
					if err != nil {
						lib.Log(lib.LOG_ERROR, "Failed to cancel prediction intent txId %s for market ID %s and account ID %s: %v", pi.TxID.String(), market.MarketID, accountIdStr, err)
						continue
					}
					lib.Log(lib.LOG_WARN, "-> Cancelled prediction intent txId %s for market ID %s and account ID %s due to insufficient funds (total required: %f, allowance: %f, balance: %f)", pi.TxID.String(), market.MarketID, accountIdStr, sumTotalOfAllPredictionIntents, allowance, usdcBalance)

					// and mark predictionIntent as evicted:
					err = cs.predictionIntentsRepository.MarkPredictionIntentAsEvicted(pi.TxID)
					if err != nil {
						lib.Log(lib.LOG_ERROR, "Failed to mark as evicted prediction intent txId %s for market ID %s and account ID %s: %v", pi.TxID.String(), market.MarketID, accountIdStr, err)
						continue
					}
					lib.Log(lib.LOG_WARN, "-> Marked as evicted prediction intent txId %s for market ID %s and account ID %s", pi.TxID.String(), market.MarketID, accountIdStr)
				}
			}
		}
	}
}
