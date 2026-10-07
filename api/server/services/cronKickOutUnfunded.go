package services

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	repositories "api/server/repositories"
	"fmt"
	"os"
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

			usdcAddress, err := hiero.ContractIDFromString(os.Getenv(fmt.Sprintf("%s_USDC_ADDRESS", strings.ToUpper(market.Net))))
			if err != nil {
				lib.Log(lib.LOG_ERROR, "invalid %s_USDC_ADDRESS: %v", strings.ToUpper(market.Net), err)
				continue
			}

			// BUY orders spend collateral: they need both a token balance and an allowance to the contract.
			allowance, err := lib.GetSpenderAllowance(*net, accountId, smartContractId, usdcAddress)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to fetch allowance for account ID %s: %v", accountIdStr, err)
				continue
			}
			usdcBalance, err := lib.GetUsdcBalanceUsd(*net, accountId) // smallest units
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to fetch USDC balance for account ID %s: %v", accountIdStr, err)
				continue
			}
			available := min(allowance, usdcBalance)
			lib.Log(lib.LOG_INFO, "-> Account ID %s: allowance=%d balance=%d (collateral units)", accountIdStr, allowance, usdcBalance)

			// retrieve all live orderIntents for this market, for this specific accountId
			usersOpenPredictionIntents, err := cs.predictionIntentsRepository.GetAllOpenPredictionIntentsByMarketIdAndAccountId(market.MarketID, accountIdStr)
			if err != nil {
				lib.Log(lib.LOG_ERROR, " Failed to fetch live prediction intents for market ID %s and account ID %s: %v", market.MarketID, accountIdStr, err)
				continue
			}

			var buyOrders, sellOrders []sqlc.PredictionIntent
			for _, pi := range usersOpenPredictionIntents {
				if lib.Action(pi.Action.Int16) == lib.ActionBUY {
					buyOrders = append(buyOrders, pi)
				} else {
					sellOrders = append(sellOrders, pi)
				}
			}

			cs.validateAndKickoutBuyOrders(buyOrders, &market, accountIdStr, available)
			if len(sellOrders) > 0 {
				cs.validateAndKickoutSellOrders(sellOrders, &market, smartContractId)
			}
		}
	}
}

// validateAndKickoutBuyOrders evicts BUY orders, oldest first kept, once the remaining
// collateral caps of the user's open BUYs exceed what the contract can pull from them.
func (cs *CronKickOutUnfundedService) validateAndKickoutBuyOrders(buyOrders []sqlc.PredictionIntent, market *sqlc.Market, accountIdStr string, available uint64) {
	var required uint64
	for _, pi := range buyOrders {
		order, err := clobOrderFromIntent(&pi)
		if err != nil {
			lib.Log(lib.LOG_ERROR, "[buy] skipping txId=%s: %v", pi.TxID, err)
			continue
		}
		if order.CollateralCap > order.CollateralFilled {
			required += order.CollateralCap - order.CollateralFilled
		}
		if required > available {
			cs.evict(market, pi, fmt.Sprintf("insufficient collateral (required %d, available %d)", required, available))
		}
	}
}

// validateAndKickoutSellOrders evicts SELL orders when the user's on-chain YES or NO
// balance no longer covers the unfilled quantity of their open SELLs on that side.
func (cs *CronKickOutUnfundedService) validateAndKickoutSellOrders(sellOrders []sqlc.PredictionIntent, market *sqlc.Market, contractId hiero.ContractID) {
	evmAddress := sellOrders[0].Evmaddress
	yesBalance, noBalance, err := cs.hederaService.GetUserPositionBalancesV2(market.Net, contractId, market.MarketID.String(), evmAddress)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to get position balances for %s on market %s: %v", evmAddress, market.MarketID, err)
		return
	}

	var requiredYes, requiredNo uint64
	for _, pi := range sellOrders {
		order, err := clobOrderFromIntent(&pi)
		if err != nil {
			lib.Log(lib.LOG_ERROR, "[sell] skipping txId=%s: %v", pi.TxID, err)
			continue
		}
		remaining := order.QtyShares - order.SharesFilled
		if lib.Side(order.Side) == lib.SideYES {
			requiredYes += remaining
			if requiredYes > yesBalance {
				cs.evict(market, pi, fmt.Sprintf("insufficient YES shares (required %d, have %d)", requiredYes, yesBalance))
			}
		} else {
			requiredNo += remaining
			if requiredNo > noBalance {
				cs.evict(market, pi, fmt.Sprintf("insufficient NO shares (required %d, have %d)", requiredNo, noBalance))
			}
		}
	}
}

func (cs *CronKickOutUnfundedService) evict(market *sqlc.Market, pi sqlc.PredictionIntent, reason string) {
	if _, err := cs.predictionIntentsService.CancelPredictionIntentNoSigCheck(market.MarketID.String(), pi.TxID.String()); err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to cancel prediction intent txId %s: %v", pi.TxID.String(), err)
		return
	}
	if err := cs.predictionIntentsRepository.MarkPredictionIntentAsEvicted(pi.TxID); err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to mark as evicted prediction intent txId %s: %v", pi.TxID.String(), err)
		return
	}
	lib.Log(lib.LOG_WARN, "-> Evicted prediction intent txId %s on market %s: %s", pi.TxID.String(), market.MarketID, reason)
}
