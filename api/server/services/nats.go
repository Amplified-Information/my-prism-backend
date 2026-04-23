package services

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strings"

	pb_clob "api/gen/clob"
	"api/server/lib"
	repositories "api/server/repositories"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
	"github.com/nats-io/nats.go"
)

type NatsService struct {
	nats                         *nats.Conn
	hederaService                *HederaService
	dbRepository                 *repositories.DbRepository
	matchesRepository            *repositories.MatchesRepository
	predictionIntents            *repositories.PredictionIntentsRepository
	smartContractEventRepository *repositories.SmartContractEventRepository
}

func (ns *NatsService) InitNATS(h *HederaService, d *repositories.DbRepository, m *repositories.MatchesRepository, p *repositories.PredictionIntentsRepository, scer *repositories.SmartContractEventRepository) error {

	// connect to NATS
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = nats.DefaultURL
	}
	natsConn, err := nats.Connect(natsURL)
	if err != nil {
		return lib.LogAndError(lib.LOG_ERROR, "failed to connect to NATS: %v", err)
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
	// and inject the SmartContractEventRepository:
	ns.smartContractEventRepository = scer

	lib.Log(lib.LOG_INFO, "Service: NATS service initialized successfully")
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
		return lib.LogAndError(lib.LOG_ERROR, "NATS connection not initialized")
	}
	if err := ns.nats.Publish(subject, data); err != nil {
		return err
	}
	return nil
}

func (ns *NatsService) subscribe(subject string, handler nats.MsgHandler) (*nats.Subscription, error) {
	if ns.nats == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "NATS connection not initialized")
	}

	subscription, err := ns.nats.Subscribe(subject, handler)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to subscribe to subject %s: %v", subject, err)
	}

	return subscription, nil
}

func (ns *NatsService) HandleOrderMatches() error {
	lib.Log(lib.LOG_INFO, "HandleOrderMatches subscription starting...")
	_, err := ns.subscribe(lib.NATS_CLOB_MATCHES_WILDCARD, func(msg *nats.Msg) {

		lib.Log(lib.LOG_INFO, "NATS %s: %s\n", msg.Subject, string(msg.Data))

		// Guards
		var orderRequestClobTuple [2]*pb_clob.CreateOrderRequestClob
		if err := json.Unmarshal(msg.Data, &orderRequestClobTuple); err != nil {
			lib.Log(lib.LOG_ERROR, "Error parsing order data: %v", err)
			return
		}

		// assert that [0].marketId and [1].marketId are the same
		if orderRequestClobTuple[0].MarketId != orderRequestClobTuple[1].MarketId {
			lib.Log(lib.LOG_ERROR, "PROBLEM: the marketIds (%s, %s) don't match! (txid=%s).", orderRequestClobTuple[0].MarketId, orderRequestClobTuple[1].MarketId, orderRequestClobTuple[0].TxId)
			return
		}

		/////
		// N.B. ///// this is an invalid assertion because a high bid can be higher than the lowest ask and vice-versa
		/////
		// assert that the two priceUsd's cancel each other out
		// priceDiff := orderRequestClobTuple[0].PriceUsd + orderRequestClobTuple[1].PriceUsd
		// if priceDiff != 0.0 {
		// 	debug: orderRequestClobTuple[0] + orderRequestClobTuple[1] is non-zero
		// 	return
		// }

		// assert that priceUsd is not 0.0
		if orderRequestClobTuple[0].PriceUsd == 0.0 {
			lib.Log(lib.LOG_ERROR, "PROBLEM: priceUsd is 0.0 - this is not allowed (txid=%s).", orderRequestClobTuple[0].TxId)
			return
		}

		// assert that the keyType is not 0
		if orderRequestClobTuple[0].KeyType == 0 || orderRequestClobTuple[1].KeyType == 0 {
			lib.Log(lib.LOG_ERROR, "PROBLEM: keyType is 0 - this is not allowed (txid=%s).", orderRequestClobTuple[0].TxId)
			return
		}

		// assert that orderRequestClobTuple[0].priceUsd > 0 and orderRequestClobTuple[1].priceUsd < 0 (i.e. one is a bid and the other is an ask)
		if orderRequestClobTuple[0].PriceUsd < 0.0 {
			lib.Log(lib.LOG_ERROR, "PROBLEM: orderRequestClobTuple[0].PriceUsd(%f) MUST be greater than 0 (txid=%s).", orderRequestClobTuple[0].PriceUsd, orderRequestClobTuple[0].TxId)
			return
		}
		if orderRequestClobTuple[1].PriceUsd > 0.0 {
			lib.Log(lib.LOG_ERROR, "PROBLEM: orderRequestClobTuple[1].PriceUsd(%f) MUST be less than 0 (txid=%s).", orderRequestClobTuple[1].PriceUsd, orderRequestClobTuple[1].TxId)
			return
		}

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
		// 	lib.Log(lib.LOG_ERROR, "NATS: Invalid subject")
		// 	return
		// }

		_, err := ns.matchesRepository.CreateMatch(
			// note: orderRequestClobTuple[0] is YES side (positive priceUsd)
			//			 orderRequestClobTuple[1] is NO side (negative priceUsd)
			[2]*pb_clob.CreateOrderRequestClob{orderRequestClobTuple[0], orderRequestClobTuple[1]},
			"notYetAvailable",
		)
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Error recording match in database: %v", err)
		}

		/////
		// Now, for every match (doesn't matter if partial or full), if the qty remaining is <=0; mark the relevant prediction intent (timestamp) as "fully matched" in the db
		// find out if it's tx1 or tx2 that is fully matched
		var amountUsdTx0Abs float64 = math.Abs(orderRequestClobTuple[0].Qty / orderRequestClobTuple[0].PriceUsd)
		var amountUsdTx1Abs float64 = math.Abs(orderRequestClobTuple[1].Qty / orderRequestClobTuple[1].PriceUsd)

		markAsMatched := [2]bool{false, false}
		if amountUsdTx0Abs < amountUsdTx1Abs {
			markAsMatched[0] = true // mark tx0 for deletion
		} else {
			markAsMatched[1] = true // mark tx1 for deletion
		}
		if amountUsdTx0Abs == amountUsdTx1Abs {
			markAsMatched[0] = true // mark both for deletion
			markAsMatched[1] = true
		}

		marketId := orderRequestClobTuple[0].MarketId
		if markAsMatched[0] == true { // mark tx0 for deletion
			lib.Log(lib.LOG_INFO, "marking tx0 (%s) as fully matched with tx1 (%s)", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
			err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(marketId, orderRequestClobTuple[0].TxId)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Error marking prediction intent as fully matched in database: %v", err)
			}
		}
		if markAsMatched[1] == true { // mark tx1 for deletion
			lib.Log(lib.LOG_INFO, "marking tx1 (%s) as fully matched with tx0 (%s)", orderRequestClobTuple[1].TxId, orderRequestClobTuple[0].TxId)
			err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(marketId, orderRequestClobTuple[1].TxId)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Error marking prediction intent as fully matched in database: %v", err)
			}
		}

		// if amountUsdTx0-amountUsdTx1 <= 0 {
		// 	// check if one side if wiped out:
		// 	// Only mark as fully matched if the difference is <= 0
		// 	lib.Log(lib.LOG_INFO, "Marking txId %s as fully matched in database (amountUsdTx0 - amountUsdTx1 <= 0)", orderRequestClobTuple[0].TxId)
		// 	err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, orderRequestClobTuple[0].TxId)
		// 	if err != nil {
		// 		lib.Log(lib.LOG_ERROR, "Error marking prediction intent as fully matched in database: %v", err)
		// 	}
		// } else if amountUsdTx1-amountUsdTx0 <= 0 {
		// 	// also must check if the other side is wiped out:
		// 	// Only mark as fully matched if the difference is <= 0
		// 	lib.Log(lib.LOG_INFO, "Marking txId %s as fully matched in database (amountUsdTx1 - amountUsdTx0 <= 0)", orderRequestClobTuple[1].TxId)
		// 	err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, orderRequestClobTuple[1].TxId)
		// 	if err != nil {
		// 		lib.Log(lib.LOG_ERROR, "Error marking prediction intent as fully matched in database: %v", err)
		// 	}
		// } else if amountUsdTx1 == amountUsdTx0 { // full match
		// 	// also much check if there's an exact match:
		// 	// exact match - both are fully matched
		// 	lib.Log(lib.LOG_INFO, "Marking BOTH txIds %s and %s as fully matched in database (amountUsdTx1 == amountUsdTx0)", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
		// 	err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, orderRequestClobTuple[0].TxId)
		// 	if err != nil {
		// 		lib.Log(lib.LOG_ERROR, "Error marking prediction intent as fully matched in database: %v", err)
		// 	}
		// 	err = ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, orderRequestClobTuple[1].TxId)
		// 	if err != nil {
		// 		lib.Log(lib.LOG_ERROR, "Error marking prediction intent as fully matched in database: %v", err)
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
		// 		lib.Log(lib.LOG_ERROR, "invalid fullyMatchTxId")
		// 	}

		// 	// err := ns.predictionIntents.MarkPredictionIntentAsFullyMatched(orderRequestClobTuple[0].MarketId, fullyMatchedTxId)
		// 	// if err != nil {
		// 	// 	lib.Log(lib.LOG_ERROR, "Error marking prediction intent as fully matched in database: %v", err)
		// 	// }
		// }

		/////
		// smart contract
		// Now submit BOTH matches to the smart contract
		// BuyPositionTokens determines which account recieves the YES and which account receives the NO (price_usd < 0 => NO)
		/////

		isOK, err := ns.hederaService.BuyPositionTokens(orderRequestClobTuple[0], orderRequestClobTuple[1])
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Error submitting match to smart contract: %v ", err)
		}
		if !isOK {
			lib.Log(lib.LOG_ERROR, "BuyPositionTokens returned !isOK for txId=%s, txId=%s", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
		}

		// TODO - handle situation when smart contract fails
	})
	if err != nil {
		return err
	}
	return nil
}

func (ns *NatsService) HandleSmartContractEvents() error {
	lib.Log(lib.LOG_INFO, "HandleSmartContractEvents subscription starting...")

	// listen to every event
	// parse the subject
	// subject format: "testnet:0.0.7907066"
	// if testnet of type ValidNetworksType, proceed
	// if 0.0.790066 of type hiero.SmartContractID, proceed
	// extract the value for the "event" key
	// switch on event value:
	// case {PositionTokensPurchased, MarketResolved, WinningsRedeemed, TokenAssociated, AccountAuthorizationResponse,}
	// just generate the case statement - I will implement the logic for each case later

	_, err := ns.subscribe(">", func(msg *nats.Msg) {
		// Parse the subject: "testnet:0.0.7907066"
		subjectParts := strings.Split(msg.Subject, ":")
		if len(subjectParts) != 2 {
			// simply return silently if the subject doesn't match the expected format:
			return
		}

		network := subjectParts[0]
		contractId := subjectParts[1]

		// Validate network
		if !lib.IsValidNetwork(network) {
			lib.Log(lib.LOG_WARN, "Unknown network: %s", network)
			return
		}
		// Validate it's the contractId of interest
		expectedContractId := os.Getenv(fmt.Sprintf("%s_SMART_CONTRACT_ID", strings.ToUpper(network)))
		if contractId != expectedContractId {
			lib.Log(lib.LOG_WARN, "Received event for unexpected contractId: %s (expected: %s)", contractId, expectedContractId)
			return
		}
		// Validate contractId (optional, if you want to check format)
		_, err := hiero.ContractIDFromString(contractId)
		if err != nil {
			lib.Log(lib.LOG_WARN, "Invalid contractId: %s", contractId)
			return
		}

		/////
		// OK - let's look at the body
		/////
		// Parse event JSON
		var event map[string]interface{}
		if err := json.Unmarshal(msg.Data, &event); err != nil {
			lib.Log(lib.LOG_ERROR, "Failed to parse event JSON: %v", err)
			return
		}
		eventType, _ := event["event"].(string)

		// event PositionTokensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled);
		// event MarketResolved(uint128 marketId, bool outcome);
		// event WinningsRedeemed(uint128 marketId, address indexed winner, uint256 amount);
		// event TokenAssociated(address indexed token);
		switch eventType {
		case "PositionTokensPurchased":
			lib.Log(lib.LOG_INFO, "Received PositionTokensPurchased event (%s): %v", contractId, event)
			ns.smartContractEventRepository.CreatePositionTokensPurchased(event)
		case "MarketResolved":
			lib.Log(lib.LOG_INFO, "Received MarketResolved event (%s): %v", contractId, event)
			ns.smartContractEventRepository.CreateMarketResolved(event)
		case "WinningsRedeemed":
			lib.Log(lib.LOG_INFO, "Received WinningsRedeemed event (%s): %v", contractId, event)
			ns.smartContractEventRepository.CreateWinningsRedeemed(event)
		case "TokenAssociated":
			lib.Log(lib.LOG_INFO, "Received TokenAssociated event (%s): %v", contractId, event)
			ns.smartContractEventRepository.CreateTokenAssociated(event)
		case "AccountAuthorizationResponse":
			lib.Log(lib.LOG_WARN, "AccountAuthorizationResponse event received - not stored in database")
		default:
			lib.Log(lib.LOG_WARN, "Unknown event type: %s", eventType)
		}
	})
	if err != nil {
		return lib.LogAndError(lib.LOG_ERROR, "failed to handle smart contract events: %v", err)
	}
	return nil
}
