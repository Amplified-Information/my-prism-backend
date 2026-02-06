package services

import (
	"encoding/json"
	"math"
	"os"

	pb_clob "api/gen/clob"
	"api/server/lib"
	repositories "api/server/repositories"

	"github.com/nats-io/nats.go"
)

type NatsService struct {
	log               *LogService
	nats              *nats.Conn
	hederaService     *HederaService
	dbRepository      *repositories.DbRepository
	matchesRepository *repositories.MatchesRepository
	predictionIntents *repositories.PredictionIntentsRepository
}

func (ns *NatsService) InitNATS(log *LogService, h *HederaService, d *repositories.DbRepository, m *repositories.MatchesRepository, p *repositories.PredictionIntentsRepository) error {
	ns.log = log

	// connect to NATS
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = nats.DefaultURL
	}
	natsConn, err := nats.Connect(natsURL)
	if err != nil {
		return ns.log.Log(ERROR, "failed to connect to NATS: %v", err)
	}
	ns.nats = natsConn

	// and inject the HederaService:
	ns.hederaService = h
	// and inject the DbService:
	ns.dbRepository = d
	// and inject the MatchesRepository:
	ns.matchesRepository = m
	// and inject the PredictionIntentsRepository:
	ns.predictionIntents = p

	ns.log.Log(INFO, "Service: NATS service initialized successfully")
	return nil
}

func (ns *NatsService) CloseNATS() error {
	if ns.nats != nil {
		ns.nats.Close()
	}
	return nil
}

func (ns *NatsService) Publish(subject string, data []byte) error {
	if ns.nats == nil {
		return ns.log.Log(ERROR, "NATS connection not initialized")
	}
	if err := ns.nats.Publish(subject, data); err != nil {
		return err
	}
	return nil
}

func (ns *NatsService) Subscribe(subject string, handler nats.MsgHandler) (*nats.Subscription, error) {
	if ns.nats == nil {
		return nil, ns.log.Log(ERROR, "NATS connection not initialized")
	}

	subscription, err := ns.nats.Subscribe(subject, handler)
	if err != nil {
		return nil, ns.log.Log(ERROR, "failed to subscribe to subject %s: %v", subject, err)
	}

	return subscription, nil
}

func (ns *NatsService) HandleOrderMatches() error {
	ns.log.Log(INFO, "HandleOrderMatches subscription starting...")
	_, err := ns.Subscribe(lib.NATS_CLOB_MATCHES_WILDCARD, func(msg *nats.Msg) {

		ns.log.Log(INFO, "NATS %s: %s\n", msg.Subject, string(msg.Data))

		// Guards
		var orderRequestClobTuple [2]*pb_clob.CreateOrderRequestClob
		if err := json.Unmarshal(msg.Data, &orderRequestClobTuple); err != nil {
			ns.log.Log(ERROR, "Error parsing order data: %v", err)
			return
		}

		// assert that [0].marketId and [1].marketId are the same
		if orderRequestClobTuple[0].MarketId != orderRequestClobTuple[1].MarketId {
			ns.log.Log(ERROR, "PROBLEM: the marketIds (%s, %s) don't match! (txid=%s).", orderRequestClobTuple[0].MarketId, orderRequestClobTuple[1].MarketId, orderRequestClobTuple[0].TxId)
			return
		}

		/////
		// N.B. ///// this is an invalid assertion because a high bid can be higher than the lowest ask and vice-versa
		/////
		// assert that the two priceUsd's cancel each other out
		// priceDiff := orderRequestClobTuple[0].PriceUsd + orderRequestClobTuple[1].PriceUsd
		// if priceDiff != 0.0 {
		// 	log.Printf("PROBLEM: orderRequestClobTuple[0] + orderRequestClobTuple[1] is %f and not 0.0", priceDiff)
		// 	return
		// }

		// assert that priceUsd is not 0.0
		if orderRequestClobTuple[0].PriceUsd == 0.0 {
			ns.log.Log(ERROR, "PROBLEM: priceUsd is 0.0 - this is not allowed (txid=%s).", orderRequestClobTuple[0].TxId)
			return
		}

		// assert that the keyType is not 0
		if orderRequestClobTuple[0].KeyType == 0 || orderRequestClobTuple[1].KeyType == 0 {
			ns.log.Log(ERROR, "PROBLEM: keyType is 0 - this is not allowed (txid=%s).", orderRequestClobTuple[0].TxId)
			return
		}

		// TODO - assert that the user's allowance >= the size of the matched order
		// ensure user has provided enough of an allowance to the smart contract:
		// spenderAllowanceUsd, err := ns.hederaService.GetSpenderAllowanceUsd(*_networkSelected, accountId, _smartContractId, usdcAddress, usdcDecimals)
		// if err != nil {
		// 	return "", ns.log.Log(ERROR, "failed to get spender allowance: %v", err)
		// }
		// ns.log.Log(INFO, "Spender allowance for account %s on contract %s: $%.2f", accountId.String(), _smartContractId.String(), spenderAllowanceUsd)
		// if spenderAllowanceUsd < math.Abs(req.GetPriceUsd()*req.GetQty()) {
		// 	return "", ns.log.Log(ERROR, "Spender allowance ($USD%.2f USD token = %s) too low for this predictionIntent ($USD%.2f)", spenderAllowanceUsd, usdcAddress.String(), req.GetPriceUsd()*req.GetQty())
		// }

		// // ensure the spenderAllowanceUsd is >= usdc balance currently in the user's wallet
		// currentUserBalanceUsdc, err := ns.hederaService.GetUsdcBalanceUsd(*_networkSelected, accountId)
		// if err != nil {
		// 	return "", ns.log.Log(ERROR, "failed to get user's USDC balance: %v", err)
		// }
		// if currentUserBalanceUsdc < spenderAllowanceUsd {
		// 	return "", ns.log.Log(ERROR, "User's USDC balance ($USD%.2f) is less than the allowance ($USD%.2f)", currentUserBalanceUsdc, spenderAllowanceUsd)
		// }

		// OK

		/////
		// db
		// Record the match on a database (auditing)
		/////
		// isPartial := false
		// switch msg.Subject {
		// case lib.NATS_CLOB_MATCHES_PARTIAL:
		// 	isPartial = true
		// case lib.NATS_CLOB_MATCHES_FULL:
		// 	isPartial = false
		// default:
		// 	ns.log.Log(ERROR, "NATS: Invalid subject")
		// 	return
		// }

		_, err := ns.matchesRepository.CreateMatch(
			// note: orderRequestClobTuple[0] is YES side (positive priceUsd)
			//			 orderRequestClobTuple[1] is NO side (negative priceUsd)
			[2]*pb_clob.CreateOrderRequestClob{orderRequestClobTuple[0], orderRequestClobTuple[1]},
			"notYetAvailable",
		)
		if err != nil {
			ns.log.Log(ERROR, "Error recording match in database: %v", err)
		}

		/////
		// Now, for every match (doesn't matter if partial or full), if the qty remaining is <=0; mark the relevant prediction intent (timestamp) as "fully matched" in the db
		// find out if it's tx1 or tx2 that is fully matched
		var amountUsdTx0 float64 = orderRequestClobTuple[0].Qty / orderRequestClobTuple[0].PriceUsd
		var amountUsdTx1 float64 = math.Abs(orderRequestClobTuple[1].Qty / orderRequestClobTuple[1].PriceUsd)

		markAsMatched := [2]bool{false, false}
		if amountUsdTx0 < amountUsdTx1 {
			markAsMatched[0] = true // mark tx0 for deletion
		} else {
			markAsMatched[1] = true // mark tx1 for deletion
		}
		if amountUsdTx0 == amountUsdTx1 {
			markAsMatched[0] = true // mark both for deletion
			markAsMatched[1] = true
		}

		marketId := orderRequestClobTuple[0].MarketId
		if markAsMatched[0] == true { // mark tx0 for deletion
			ns.log.Log(INFO, "marking tx0 (%s) as fully matched with tx1 (%s)", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
			err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(marketId, orderRequestClobTuple[0].TxId)
			if err != nil {
				ns.log.Log(ERROR, "Error marking prediction intent as fully matched in database: %v", err)
			}
		}
		if markAsMatched[1] == true { // mark tx1 for deletion
			ns.log.Log(INFO, "marking tx1 (%s) as fully matched with tx0 (%s)", orderRequestClobTuple[1].TxId, orderRequestClobTuple[0].TxId)
			err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(marketId, orderRequestClobTuple[0].TxId)
			if err != nil {
				ns.log.Log(ERROR, "Error marking prediction intent as fully matched in database: %v", err)
			}
		}

		// if amountUsdTx0-amountUsdTx1 <= 0 {
		// 	// check if one side if wiped out:
		// 	// Only mark as fully matched if the difference is <= 0
		// 	ns.log.Log(INFO, "Marking txId %s as fully matched in database (amountUsdTx0 - amountUsdTx1 <= 0)", orderRequestClobTuple[0].TxId)
		// 	err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, orderRequestClobTuple[0].TxId)
		// 	if err != nil {
		// 		ns.log.Log(ERROR, "Error marking prediction intent as fully matched in database: %v", err)
		// 	}
		// } else if amountUsdTx1-amountUsdTx0 <= 0 {
		// 	// also must check if the other side is wiped out:
		// 	// Only mark as fully matched if the difference is <= 0
		// 	ns.log.Log(INFO, "Marking txId %s as fully matched in database (amountUsdTx1 - amountUsdTx0 <= 0)", orderRequestClobTuple[1].TxId)
		// 	err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, orderRequestClobTuple[1].TxId)
		// 	if err != nil {
		// 		ns.log.Log(ERROR, "Error marking prediction intent as fully matched in database: %v", err)
		// 	}
		// } else if amountUsdTx1 == amountUsdTx0 { // full match
		// 	// also much check if there's an exact match:
		// 	// exact match - both are fully matched
		// 	ns.log.Log(INFO, "Marking BOTH txIds %s and %s as fully matched in database (amountUsdTx1 == amountUsdTx0)", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
		// 	err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, orderRequestClobTuple[0].TxId)
		// 	if err != nil {
		// 		ns.log.Log(ERROR, "Error marking prediction intent as fully matched in database: %v", err)
		// 	}
		// 	err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, orderRequestClobTuple[1].TxId)
		// 	if err != nil {
		// 		ns.log.Log(ERROR, "Error marking prediction intent as fully matched in database: %v", err)
		// 	}
		// }

		// // if it's a full match, log the relevant txId as "fully_match_at" on prediction_intents table...
		// // this fully_matched_at timestamp is useful for the cron job to avoid scanning over too large a set of order requests
		// if !isPartial { // a full match
		// 	// find out if it's tx1 or tx2 that is fully matched
		// 	var fullyMatchedTxId string
		// 	if orderRequestClobTuple[0].Qty-orderRequestClobTuple[1].Qty <= 0 {
		// 		fullyMatchedTxId = orderRequestClobTuple[0].TxId
		// 	} else if orderRequestClobTuple[1].Qty-orderRequestClobTuple[0].Qty <= 0 {
		// 		fullyMatchedTxId = orderRequestClobTuple[1].TxId
		// 	} else {
		// 		ns.log.Log(ERROR, "invalid fullyMatchTxId")
		// 	}

		// 	// err := ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, fullyMatchedTxId)
		// 	// if err != nil {
		// 	// 	ns.log.Log(ERROR, "Error marking prediction intent as fully matched in database: %v", err)
		// 	// }
		// }

		/////
		// smart contract
		// Now submit BOTH matches to the smart contract
		// BuyPositionTokens determines which account recieves the YES and which account receives the NO (price_usd < 0 => NO)
		/////

		isOK, err := ns.hederaService.BuyPositionTokens(orderRequestClobTuple[0], orderRequestClobTuple[1])
		if err != nil {
			ns.log.Log(ERROR, "Error submitting match to smart contract: %v ", err)
		}
		if !isOK {
			ns.log.Log(ERROR, "BuyPositionTokens returned !isOK for txId=%s, txId=%s", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
		}
	})
	if err != nil {
		return err
	}
	return nil
}
