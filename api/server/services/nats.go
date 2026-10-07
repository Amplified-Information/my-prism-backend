package services

import (
	"encoding/json"
	"errors"
	"fmt"
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
	js                           nats.JetStreamContext
	hederaService                *HederaService
	dbRepository                 *repositories.DbRepository
	matchesRepository            *repositories.MatchesRepository
	predictionIntentsRepository  *repositories.PredictionIntentsRepository
	smartContractEventRepository *repositories.SmartContractEventRepository
}

func (ns *NatsService) InitNATS(h *HederaService, d *repositories.DbRepository, m *repositories.MatchesRepository, p *repositories.PredictionIntentsRepository, scer *repositories.SmartContractEventRepository) error {

	// connect to NATS
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = nats.DefaultURL
	}
	natsUser, natsPassword := os.Getenv("NATS_USER"), os.Getenv("NATS_PASSWORD")
	if natsUser == "" || natsPassword == "" {
		return lib.LogAndError(lib.LOG_ERROR, "NATS_USER and NATS_PASSWORD are required")
	}
	natsConn, err := nats.Connect(natsURL,
		nats.UserInfo(natsUser, natsPassword),
		nats.Name("prism-api"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
	)
	if err != nil {
		return lib.LogAndError(lib.LOG_ERROR, "failed to connect to NATS: %v", err)
	}
	ns.nats = natsConn
	js, err := natsConn.JetStream(nats.PublishAsyncMaxPending(256))
	if err != nil { return lib.LogAndError(lib.LOG_ERROR, "JetStream is required: %v", err) }
	ns.js = js
	for _, cfg := range []*nats.StreamConfig{
		{Name: "CLOB_ORDERS", Subjects: []string{"clob.orders", "clob.orders.cancel"}, Storage: nats.FileStorage, Retention: nats.WorkQueuePolicy, MaxAge: 7 * 24 * time.Hour, Duplicates: 24 * time.Hour},
		{Name: "CLOB_MATCHES", Subjects: []string{"clob.matches.*"}, Storage: nats.FileStorage, Retention: nats.WorkQueuePolicy, MaxAge: 30 * 24 * time.Hour, Duplicates: 24 * time.Hour},
	} {
		if _, err := js.StreamInfo(cfg.Name); err != nil {
			if _, err = js.AddStream(cfg); err != nil { return lib.LogAndError(lib.LOG_ERROR, "create JetStream stream %s: %v", cfg.Name, err) }
		}
	}

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
	return ns.PublishWithID(subject, data, "")
}

func (ns *NatsService) PublishWithID(subject string, data []byte, messageID string) error {
	if ns.nats == nil {
		return lib.LogAndError(lib.LOG_ERROR, "NATS connection not initialized")
	}
	if ns.js == nil { return lib.LogAndError(lib.LOG_ERROR, "JetStream not initialized") }
	msg := nats.NewMsg(subject)
	msg.Data = data
	if messageID != "" { msg.Header.Set(nats.MsgIdHdr, messageID) }
	_, err := ns.js.PublishMsg(msg)
	return err
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
	// CLOB_MATCHES is a work-queue stream, which refuses consumers with overlapping
	// subjects. Remove the V1 consumer (clob.matches.*) so the V2 one can be created.
	if err := ns.js.DeleteConsumer("CLOB_MATCHES", "api-settlement-v1"); err != nil && !errors.Is(err, nats.ErrConsumerNotFound) {
		lib.Log(lib.LOG_WARN, "could not remove the legacy V1 settlement consumer: %v", err)
	}
	_, err := ns.js.QueueSubscribe(lib.NATS_CLOB_MATCHES_SETTLE, "api-settlement", func(msg *nats.Msg) {
		// Valid matches stay unacknowledged until PrismV2 settlement is final, so
		// JetStream redelivers them after a failure. Invalid matches are terminated.
		var match pb_clob.ClobMatch
		outcome := settlementRejected
		var err error
		if err = json.Unmarshal(msg.Data, &match); err != nil {
			err = fmt.Errorf("invalid match payload: %w", err)
		} else {
			outcome, err = ns.settleMatchV2(&match)
		}

		switch outcome {
		case settlementDone:
			if ackErr := msg.Ack(); ackErr != nil {
				lib.Log(lib.LOG_ERROR, "failed to ACK settled match: %v", ackErr)
			}
		case settlementRetry:
			lib.Log(lib.LOG_ERROR, "match settlement will be retried (bid=%s ask=%s): %v", orderTxID(match.Bid), orderTxID(match.Ask), err)
			if nakErr := msg.NakWithDelay(5 * time.Second); nakErr != nil {
				lib.Log(lib.LOG_ERROR, "failed to NAK match message: %v", nakErr)
			}
		default:
			lib.Log(lib.LOG_CRITICAL, "match rejected and will not be settled (bid=%s ask=%s): %v", orderTxID(match.Bid), orderTxID(match.Ask), err)
			if termErr := msg.Term(); termErr != nil {
				lib.Log(lib.LOG_ERROR, "failed to terminate match message: %v", termErr)
			}
		}
	}, nats.Durable("api-settlement-v2"), nats.ManualAck(), nats.AckExplicit(),
		nats.AckWait(5*time.Minute), nats.MaxDeliver(20), nats.MaxAckPending(1),
		nats.DeliverAll(), nats.BindStream("CLOB_MATCHES"))
	return err
}

func orderTxID(order *pb_clob.CreateOrderRequestClob) string {
	if order == nil {
		return ""
	}
	return order.TxId
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

		// PrismV2 events are routed separately: several share a name with a V1 event but not its arguments.
		if cfg, cfgErr := lib.GetPrismV2Network(network); cfgErr == nil && cfg.ContractID.String() == contractId {
			ns.handlePrismV2Event(network, contractId, eventType, eventArgs, timestampNano, txHash, hostname, md5uniq)
			return
		}

		// Legacy V1 contract events (old markets can still be redeemed on the V1 contract).
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

// handlePrismV2Event stores every PrismV2 event verbatim and mirrors resolutions and
// redemptions into the tables the portfolio already reads.
func (ns *NatsService) handlePrismV2Event(network string, contractId string, eventType string, args map[string]interface{}, timestamp time.Time, txHash string, hostname string, md5uniq string) {
	inserted, err := ns.smartContractEventRepository.CreateEventV2(network, contractId, eventType, args, txHash, timestamp, hostname, md5uniq)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "failed to store PrismV2 %s event (%s): %v", eventType, txHash, err)
		return
	}
	if !inserted {
		return // redelivery
	}

	switch eventType {
	case "MarketStateChanged":
		// MarketState: 4 = RESOLVED_YES, 5 = RESOLVED_NO, 6 = VOID -> legacy outcome 1 / 0 / 2
		outcomes := map[string]string{"4": "1", "5": "0", "6": "2"}
		outcome, isResolution := outcomes[fmt.Sprintf("%v", args["state"])]
		if !isResolution {
			return
		}
		legacy := map[string]interface{}{"marketId": args["marketId"], "outcome": outcome}
		if err := ns.smartContractEventRepository.CreateMarketResolvedEvent(network, contractId, timestamp, txHash, hostname, md5uniq, legacy); err != nil {
			lib.Log(lib.LOG_ERROR, "failed to record PrismV2 resolution (%s): %v", txHash, err)
		}
	case "Redeemed":
		legacy := map[string]interface{}{"marketId": args["marketId"], "winner": args["account"], "amount": fmt.Sprintf("%v", args["net"])}
		marketId, account, err := ns.smartContractEventRepository.CreateWinningsRedeemedEvent(network, contractId, timestamp, txHash, hostname, md5uniq, legacy)
		if err != nil || marketId == nil || account == nil {
			lib.Log(lib.LOG_ERROR, "failed to record PrismV2 redemption (%s): %v", txHash, err)
			return
		}
		if err := ns.predictionIntentsRepository.MarkPredictionIntentAsRedeemedForAccount(*marketId, *account); err != nil {
			lib.Log(lib.LOG_ERROR, "failed to mark orders redeemed for %s on %s: %v", *account, *marketId, err)
		}
	default:
		lib.Log(lib.LOG_INFO, "PrismV2 %s event stored (%s)", eventType, txHash)
	}
}
