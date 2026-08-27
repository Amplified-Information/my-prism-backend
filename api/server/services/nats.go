package services

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

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
	predictionIntentsRepository  *repositories.PredictionIntentsRepository
	smartContractEventRepository *repositories.SmartContractEventRepository
	matchDedup                   map[string]bool
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
	ns.predictionIntentsRepository = p
	// and inject the SmartContractEventRepository:
	ns.smartContractEventRepository = scer
	if ns.matchDedup == nil {
		ns.matchDedup = make(map[string]bool)
	}

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
			lib.Log(lib.LOG_ERROR, "PROBLEM: orderRequestClobTuple[0].PriceUsd  is 0.0 - this is not allowed (txid=%s).", orderRequestClobTuple[0].TxId)
			return
		}
		if orderRequestClobTuple[1].PriceUsd == 0.0 {
			lib.Log(lib.LOG_ERROR, "PROBLEM: orderRequestClobTuple[1].PriceUsd  is 0.0 - this is not allowed (txid=%s).", orderRequestClobTuple[1].TxId)
			return
		}

		// assert that the keyType is not 0
		if orderRequestClobTuple[0].KeyType == 0 || orderRequestClobTuple[1].KeyType == 0 {
			lib.Log(lib.LOG_ERROR, "PROBLEM: keyType is 0 - this is not allowed (txid0=%s, txid1=%s).", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
			return
		}

		// Normalize tuple order for downstream code paths.
		// CLOB no longer normalizes publish order; ensure tuple[0] is positive and tuple[1] is negative.
		if err := lib.NormalizeMatchTupleByPriceSign(&orderRequestClobTuple); err != nil {
			lib.Log(lib.LOG_ERROR, "PROBLEM: failed to normalize match tuple by price sign (txid0=%s, txid1=%s).", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
			return
		}

		if err := validateMatchTupleInvariant(orderRequestClobTuple); err != nil {
			lib.Log(lib.LOG_CRITICAL, "CRITICAL PROTOCOL ERROR: invalid match tuple invariant: %v", err)
			return
		}

		matchKey := matchTupleKey(orderRequestClobTuple)
		if matchKey != "" {
			if seen, ok := ns.matchDedup[matchKey]; ok && seen {
				lib.Log(lib.LOG_WARN, "Skipping duplicate match tuple: %s", matchKey)
				return
			}
			ns.matchDedup[matchKey] = true
		}

		// OK

		/////
		// db
		// Record the match on a database (auditing)
		/////

		_, err := ns.matchesRepository.CreateMatch(
			// note: orderRequestClobTuple[0] is positive-price leg and [1] is negative-price leg
			[2]*pb_clob.CreateOrderRequestClob{orderRequestClobTuple[0], orderRequestClobTuple[1]},
			"notYetAvailable",
		)
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Error recording match in database: %v", err)
		}

		/////
		// Determine which order(s) are fully consumed. Match tuple QtyRem values
		// are executed quantities; a zero value identifies a consumed side only
		// when the CLOB has explicitly emitted a zero residual for that side.
		/////
		isPartial := msg.Subject == lib.NATS_CLOB_MATCHES_PARTIAL
		markAsMatched := fullyMatchedOrderIndexFromTuple(orderRequestClobTuple, isPartial)

		marketId := orderRequestClobTuple[0].MarketId
		if orderRequestClobTuple[0] != nil {
			err = ns.predictionIntentsRepository.UpdatePredictionIntentQtyRem(marketId, orderRequestClobTuple[0].TxId, orderRequestClobTuple[0].QtyRem)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Error decrementing qty_rem for tx0 (%s): %v", orderRequestClobTuple[0].TxId, err)
			}
		}
		if orderRequestClobTuple[1] != nil {
			err = ns.predictionIntentsRepository.UpdatePredictionIntentQtyRem(marketId, orderRequestClobTuple[1].TxId, orderRequestClobTuple[1].QtyRem)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Error decrementing qty_rem for tx1 (%s): %v", orderRequestClobTuple[1].TxId, err)
			}
		}
		if markAsMatched[0] == true { // mark tx0 for deletion
			lib.Log(lib.LOG_INFO, "marking tx0 (%s) as fully matched with tx1 (%s)", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
			err = ns.predictionIntentsRepository.MarkPredictionIntentAsFullyMatched(marketId, orderRequestClobTuple[0].TxId)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Error marking prediction intent as fully matched in database: %v", err)
			}
		}
		if markAsMatched[1] == true { // mark tx1 for deletion
			lib.Log(lib.LOG_INFO, "marking tx1 (%s) as fully matched with tx0 (%s)", orderRequestClobTuple[1].TxId, orderRequestClobTuple[0].TxId)
			err = ns.predictionIntentsRepository.MarkPredictionIntentAsFullyMatched(marketId, orderRequestClobTuple[1].TxId)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Error marking prediction intent as fully matched in database: %v", err)
			}
		}

		/////
		// smart contract
		// Now submit BOTH matches to the smart contract
		// BuyPositionTokens determines which account recieves the YES and which account receives the NO (price_usd < 0 => NO)
		/////

		isOK, err := ns.hederaService.BuyOrSellPositionTokens(orderRequestClobTuple[0], orderRequestClobTuple[1])
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Error submitting match to smart contract: %v ", err)
		}
		if !isOK {
			lib.Log(lib.LOG_ERROR, "BuyOrSellPositionTokens returned !isOK for txId=%s, txId=%s", orderRequestClobTuple[0].TxId, orderRequestClobTuple[1].TxId)
		}

		// TODO - handle situation when smart contract fails
	})
	if err != nil {
		return err
	}
	return nil
}

func matchTupleKey(tuple [2]*pb_clob.CreateOrderRequestClob) string {
	if tuple[0] == nil || tuple[1] == nil {
		return ""
	}

	leftTx, rightTx := tuple[0].TxId, tuple[1].TxId
	leftQty, rightQty := tuple[0].QtyRem, tuple[1].QtyRem
	if leftTx > rightTx {
		leftTx, rightTx = rightTx, leftTx
		leftQty, rightQty = rightQty, leftQty
	}

	return tuple[0].MarketId + "|" + leftTx + "|" + rightTx + "|" + fmt.Sprintf("%.12f", leftQty) + "|" + fmt.Sprintf("%.12f", rightQty)
}

func validateMatchTupleInvariant(tuple [2]*pb_clob.CreateOrderRequestClob) error {
	if tuple[0] == nil || tuple[1] == nil {
		return lib.ErrorLog("match tuple contains nil order")
	}

	if tuple[0].MarketId != tuple[1].MarketId {
		return lib.ErrorLog("match tuple invariant failed",
			"marketId0", tuple[0].MarketId,
			"marketId1", tuple[1].MarketId,
			"txId0", tuple[0].TxId,
			"txId1", tuple[1].TxId,
		)
	}

	if tuple[0].PriceUsd == 0.0 || tuple[1].PriceUsd == 0.0 {
		return lib.ErrorLog("match tuple invariant failed",
			"txId0", tuple[0].TxId,
			"price0", tuple[0].PriceUsd,
			"txId1", tuple[1].TxId,
			"price1", tuple[1].PriceUsd,
		)
	}

	if (tuple[0].PriceUsd > 0.0 && tuple[1].PriceUsd > 0.0) || (tuple[0].PriceUsd < 0.0 && tuple[1].PriceUsd < 0.0) {
		return lib.ErrorLog("match tuple invariant failed",
			"txId0", tuple[0].TxId,
			"price0", tuple[0].PriceUsd,
			"txId1", tuple[1].TxId,
			"price1", tuple[1].PriceUsd,
		)
	}

	if math.Abs(tuple[0].QtyRem-tuple[1].QtyRem) > 1e-9 {
		return lib.ErrorLog("match tuple invariant failed",
			"txId0", tuple[0].TxId,
			"qty0", tuple[0].QtyRem,
			"txId1", tuple[1].TxId,
			"qty1", tuple[1].QtyRem,
		)
	}

	return nil
}

func fullyMatchedOrderIndexFromTuple(tuple [2]*pb_clob.CreateOrderRequestClob, isPartial bool) [2]bool {
	markAsMatched := [2]bool{false, false}
	if !isPartial {
		markAsMatched[0] = true
		markAsMatched[1] = true
		return markAsMatched
	}

	if tuple[0] == nil || tuple[1] == nil {
		return markAsMatched
	}

	// For a partial match, the CLOB emits the executed quantity in QtyRem. The
	// order-book residual is tracked separately by the CLOB/database state, so
	// this zero-value check is only valid if the producer explicitly emits a
	// zero marker for a consumed side.
	qtyRem0Abs := math.Abs(tuple[0].QtyRem)
	qtyRem1Abs := math.Abs(tuple[1].QtyRem)
	markAsMatched[0] = qtyRem0Abs <= 1e-9
	markAsMatched[1] = qtyRem1Abs <= 1e-9
	return markAsMatched
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
	// case {PositionTokensPurchased, MarketResolved, WinningsRedeemed, TokenAssociated, AccountAuthorizationResponse}
	// just generate the case statement - I will implement the logic for each case later
	// example: event {"type":"contract","net":"testnet","event":"PositionTokensPurchased","args":{"marketId":"2150312433911680295076121848404177111","buyer":"0xc3cE4543c2d1a797E46A9dbA3a95d62Cb09bF9e0","collateralUsd":"1000000","qtyScaled":"1960784","primarySecondary":"false"},"timestamp":"1778699820.273164963","txHash":"0xc65d3a722da207b20629eae581b50a13ae1facb6dc3302e387cb46daa2a44131","host":"ionneb"}
	// example: event {"type":"contract","net":"testnet","event":"MarketResolved","args":{"marketId":"2150303002968926159019224772567976782","outcome":"true"},"timestamp":"1778689217.019002918","txHash":"0xbcddb781fe1d1ee3477ed65655b329a0a666d69ba6f24f20bdd5c526a65e4933","host":"ionneb"}
	// example: event {"type":"contract","net":"testnet","event":"WinningsRedeemed","args":{"marketId":"2150303002968926159019224772567976782","winner":"0x440A1D7AF93b92920BCe50B4c0d2a8e6DCfeBfD6","amount":"200000"},"timestamp":"1778689299.499882673","txHash":"0xbc55313b0783cea8260bbc2485c55e11b5ea6b1c796d9ded46d82837d290ba86","host":"ionneb"}
	// example: event {"type":"contract","net":"testnet","event":"TokenAssociated","args":{"token":"0x0000000000000000000000000000000000068cDa"},"timestamp":"1778684870.156664154","txHash":"0xdfc2357ac64a15c111b46ade2718fb923675e10bfba35c37628fd0e53d9074bb","host":"ionneb"}

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

		// Validate the smart contract ID format:
		_, err := hiero.ContractIDFromString(contractId)
		if err != nil {
			lib.Log(lib.LOG_WARN, "Invalid contractId: %s", contractId)
			return
		}

		// NO - log all events, regardless of the smart contract ID configured in env vars for this net
		// Validate it's the contractId of interest
		// expectedContractId := os.Getenv(fmt.Sprintf("%s_SMART_CONTRACT_ID", strings.ToUpper(network)))
		// if contractId != expectedContractId {
		// 	lib.Log(lib.LOG_WARN, "Received event for unexpected contractId: %s (expected: %s)", contractId, expectedContractId)
		// 	return
		// }

		/////
		// OK - let's look at the body
		/////
		// Parse event JSON
		var event map[string]interface{}
		if err := json.Unmarshal(msg.Data, &event); err != nil {
			lib.Log(lib.LOG_ERROR, "Failed to parse event JSON: %v", err)
			return
		}

		// common fields:
		eventType, _ := event["event"].(string)
		timestampStr, _ := event["timestamp"].(string)
		timestampNano, err := time.Parse(time.RFC3339Nano, timestampStr)
		if err != nil {
			// Some emitters send unix seconds with fractional nanos (e.g. "1780412710.315602953").
			unixSeconds, parseErr := strconv.ParseFloat(timestampStr, 64)
			if parseErr != nil {
				lib.Log(lib.LOG_WARN, "Invalid event timestamp format: %s", timestampStr)
				timestampNano = time.Now().UTC()
			} else {
				secs := int64(unixSeconds)
				nanos := int64((unixSeconds - float64(secs)) * 1e9)
				timestampNano = time.Unix(secs, nanos).UTC()
			}
		}
		txHash, _ := event["txHash"].(string)
		hostname, _ := event["host"].(string)
		md5uniq := lib.Md5(msg.Subject + string(msg.Data)) // concatenation of the subject and the stringified body
		eventArgs, ok := event["args"].(map[string]interface{})
		if !ok {
			lib.Log(lib.LOG_ERROR, "Event payload missing args object: %v", event)
			return
		}

		// specific fields will be parsed in the relevant case statements below

		// event DaoUpdated(address newDao);
		// event MarketResolved(uint128 marketId, uint8 outcome);
		// event OracleUpdated(address newOracle);
		// event PositionTokensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled, bool primarySecondary);
		// event RakeUpdated(uint256 newRakePercentScaled100);
		// event TokenAssociated(address indexed token);
		// event WinningsRedeemed(uint128 marketId, address indexed winner, uint256 amount);

		switch eventType {
		case "DaoUpdated":
			lib.Log(lib.LOG_INFO, "Received DaoUpdated event (%s:%s): %v", network, contractId, event)
			err = ns.smartContractEventRepository.CreateDaoUpdatedEvent(network, contractId, timestampNano, txHash, hostname, md5uniq, eventArgs)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to CreateDaoUpdatedEvent: %v", err)
			}
		case "MarketResolved":
			lib.Log(lib.LOG_INFO, "Received MarketResolved event (%s:%s): %v", network, contractId, event)
			err = ns.smartContractEventRepository.CreateMarketResolvedEvent(network, contractId, timestampNano, txHash, hostname, md5uniq, eventArgs)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to CreateMarketResolvedEvent: %v", err)
			}
		case "OracleUpdated":
			lib.Log(lib.LOG_INFO, "Received OracleUpdated event (%s:%s): %v", network, contractId, event)
			err = ns.smartContractEventRepository.CreateOracleUpdatedEvent(network, contractId, timestampNano, txHash, hostname, md5uniq, eventArgs)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to CreateOracleUpdatedEvent: %v", err)
			}
		case "PositionTokensPurchased":
			lib.Log(lib.LOG_INFO, "Received PositionTokensPurchased event (%s:%s): %v", network, contractId, event)
			err = ns.smartContractEventRepository.CreatePositionTokensPurchasedEvent(network, contractId, timestampNano, txHash, hostname, md5uniq, eventArgs)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to CreatePositionTokensPurchasedEvent: %v", err)
			}
		case "RakeUpdated":
			lib.Log(lib.LOG_INFO, "Received RakeUpdated event (%s:%s): %v", network, contractId, event)
			err = ns.smartContractEventRepository.CreateRakeUpdatedEvent(network, contractId, timestampNano, txHash, hostname, md5uniq, eventArgs)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to CreateRakeUpdatedEvent: %v", err)
			}
		case "TokenAssociated":
			lib.Log(lib.LOG_INFO, "Received TokenAssociated event (%s:%s): %v", network, contractId, event)
			err = ns.smartContractEventRepository.CreateTokenAssociatedEvent(network, contractId, timestampNano, txHash, hostname, md5uniq, eventArgs)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to CreateTokenAssociatedEvent: %v", err)
			}
		case "WinningsRedeemed":
			lib.Log(lib.LOG_INFO, "Received WinningsRedeemed event (%s:%s): %v", network, contractId, event)
			marketId, winningEvm, err := ns.smartContractEventRepository.CreateWinningsRedeemedEvent(network, contractId, timestampNano, txHash, hostname, md5uniq, eventArgs)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to CreateWinningsRedeemedEvent: %v", err)
				return
			}
			if marketId == nil || winningEvm == nil {
				lib.Log(lib.LOG_ERROR, "CreateWinningsRedeemedEvent returned nil values (marketId=%v, winningEvm=%v)", marketId, winningEvm)
				return
			}

			// Finally, set redeemed_at timestamp in prediction_intents table
			err = ns.predictionIntentsRepository.MarkPredictionIntentAsRedeemedForAccount(*marketId, *winningEvm)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to MarkPredictionIntentAsRedeemedForAccount: %v", err)
			}
		default:
			lib.Log(lib.LOG_WARN, "Unknown event type: %s", eventType)
		}
	})
	if err != nil {
		return lib.LogAndError(lib.LOG_ERROR, "failed to handle smart contract events: %v", err)
	}
	return nil
}
