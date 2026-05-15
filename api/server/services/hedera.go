package services

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"

	"os"

	pb_api "api/gen"
	pb_clob "api/gen/clob"
	"api/server/lib"
	repositories "api/server/repositories"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type HederaService struct {
	hedera_clients      map[string]*hiero.Client // look up based on 'previewnet', 'testnet', 'mainnet'
	dbRepository        *repositories.DbRepository
	priceRepository     *repositories.PriceRepository
	marketsRepository   *repositories.MarketsRepository
	matchesRepository   *repositories.MatchesRepository
	positionsRepository *repositories.PositionsRepository
}

func (hs *HederaService) InitHedera(dbRepository *repositories.DbRepository, priceRepository *repositories.PriceRepository, marketsRepository *repositories.MarketsRepository, matchesRepository *repositories.MatchesRepository, positionsRepository *repositories.PositionsRepository) error {
	hs.dbRepository = dbRepository
	hs.priceRepository = priceRepository
	hs.marketsRepository = marketsRepository
	hs.matchesRepository = matchesRepository
	hs.positionsRepository = positionsRepository

	// First initialize the map to avoid nil map assignment
	hs.hedera_clients = make(map[string]*hiero.Client)

	var err error

	hs.hedera_clients["previewnet"], err = hs.initHederaNet("previewnet")
	if err != nil {
		return err
	}

	hs.hedera_clients["mainnet"], err = hs.initHederaNet("mainnet")
	if err != nil {
		return err
	}

	hs.hedera_clients["testnet"], err = hs.initHederaNet("testnet")
	if err != nil {
		return err
	}

	return nil
}

func (hs *HederaService) initHederaNet(networkSelected string) (*hiero.Client, error) {
	operatorIdStr := os.Getenv(fmt.Sprintf("%s_HEDERA_OPERATOR_ID", strings.ToUpper(networkSelected)))
	operatorKeyType := strings.ToUpper(os.Getenv(fmt.Sprintf("%s_HEDERA_OPERATOR_KEY_TYPE", strings.ToUpper(networkSelected))))

	// validate the accountId
	operatorId, err := hiero.AccountIDFromString(operatorIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid %s_HEDERA_OPERATOR_ID: %v", strings.ToUpper(networkSelected), err)
	}

	operatorKey := hiero.PrivateKey{}
	switch operatorKeyType {
	case "ECDSA":
		operatorKey, err = hiero.PrivateKeyFromStringECDSA(os.Getenv(fmt.Sprintf("%s_HEDERA_OPERATOR_KEY", strings.ToUpper(networkSelected))))
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "invalid %s_HEDERA_OPERATOR_KEY: %v", strings.ToUpper(networkSelected), err)
		}
	case "ED25519":
		operatorKey, err = hiero.PrivateKeyFromStringEd25519(os.Getenv(fmt.Sprintf("%s_HEDERA_OPERATOR_KEY", strings.ToUpper(networkSelected))))
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "invalid %s_HEDERA_OPERATOR_KEY: %v", strings.ToUpper(networkSelected), err)
		}
	default:
		return nil, lib.LogAndError(lib.LOG_ERROR, "unsupported %s_HEDERA_OPERATOR_KEY_TYPE: %s", strings.ToUpper(networkSelected), operatorKeyType)
	}

	client, err := hiero.ClientForName(networkSelected)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to create Hedera client: %v", err)
	}

	client.SetOperator(operatorId, operatorKey)

	lib.Log(lib.LOG_INFO, "Service: Hedera service (%s) initialized successfully", strings.ToUpper(networkSelected))
	return client, nil
}

/*
*
This function takes a number of input parameters from the YES and NO side
- performs validation
- determines which side (YES or NO) gets the YES or NO position tokens (the negative USD side gets the NO, the positive side gets the YES)
- in the event of a partial match, the lower collatoralUsd amount (priceUsd * qty) is used for the collateral
- constructs sigObjYes/sigObjNo off-chain. sigObjYes and sigObjNo have key type information embedded in them
- submits to the posColToksOnBehalfAtomic(...) function on the Prism smart contract

* @param marketId - nique market ID for the transaction (UUIDv7 string)
* @param origQtyYes - quantity of YES position tokens requested by the user when they originally placed the order
* @param origQtyNo - quantity of NO position tokens requested by the user when they originally placed the order
* @param origPriceUsdYes - price (USD) of the market when the user originally placed the order (negative number => YES, positive number => NO)
* @param origPriceUsdNo - price (USD) of the market when the user originally placed the order (negative number => YES, positive number => NO)
* @param txIdUuidYes -
* @param txIdUuidNo -
* @param sigYes64 -
* @param sigNo64 -
* @param publicKeyYesHex -
* @param publicKeyNoHex -
* @param evmYes -
* @param evmNo -
* @param keyTypeYes -
* @param keyTypeNo -

* @return bool - Returns true if the transaction is successful, otherwise false.
* @return error - Returns an error if the transaction fails or the receipt cannot be retrieved.
*/
func (hs *HederaService) BuyPositionTokens(sideYes *pb_clob.CreateOrderRequestClob, sideNo *pb_clob.CreateOrderRequestClob) (bool, error) {
	// validate that sideYes.MarketId == sideNo.MarketId and sideYes.MarketId != ""
	if sideYes.MarketId != sideNo.MarketId || sideYes.MarketId == "" {
		return false, lib.LogAndError(lib.LOG_ERROR, "market IDs do not match or invalid: %s vs %s", sideYes.MarketId, sideNo.MarketId)
	}

	// validate that a price is not zero
	if sideYes.PriceUsd == 0.0 || sideNo.PriceUsd == 0.0 {
		return false, lib.LogAndError(lib.LOG_ERROR, "priceUsd cannot be zero: %f vs %f", sideYes.PriceUsd, sideNo.PriceUsd)
	}

	// validate that one price is negative and one price is positive
	if (sideYes.PriceUsd > 0 && sideNo.PriceUsd > 0) || (sideYes.PriceUsd < 0 && sideNo.PriceUsd < 0) {
		return false, lib.LogAndError(lib.LOG_ERROR, "both prices have the same sign: %f vs %f", sideYes.PriceUsd, sideNo.PriceUsd)
	}

	// validate that both orders are on the same network
	if (sideYes.Net != sideNo.Net) || (sideYes.Net == "") {
		return false, lib.LogAndError(lib.LOG_ERROR, "networks do not match or are invalid: %s vs %s", sideYes.Net, sideNo.Net)
	}

	// OK - proceed

	// sideYes should have the positive priceUsd, sideNo should have the negative priceUsd
	if sideYes.PriceUsd <= 0 {
		// flip yes and no sides
		sideYes, sideNo = sideNo, sideYes
	}

	usdcDecimalsStr := os.Getenv("USDC_DECIMALS")
	usdcDecimals, err := strconv.ParseUint(usdcDecimalsStr, 10, 64)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "invalid USDC_DECIMALS: %v", err)
	}
	// For signature verification, we need seperate reconstruction of the payloads for YES and NO positions, including collateralUsd
	// const collateralUsd_abs_scaled = floatToBigIntScaledDecimals(Math.abs(predictionIntentRequest.priceUsd*predictionIntentRequest.qty), usdcDecimals).toString()
	collateralUsdAbsScaledYes, err := lib.FloatToBigIntScaledDecimals(math.Abs(sideYes.PriceUsd*sideYes.QtyOrig /* N.B. use QtyOrig and not Qty (remaining amount) */), int(usdcDecimals))
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to scale collateralUsdAbsYes: %v", err)
	}

	collateralUsdAbsScaledNo, err := lib.FloatToBigIntScaledDecimals(math.Abs(sideNo.PriceUsd*sideNo.QtyOrig /* N.B. use QtyOrig and not Qty (remaining amount) */), int(usdcDecimals))
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to scale collateralUsdAbsNo: %v", err)
	}

	qtyScaledYesBig, err := lib.FloatToBigIntScaledDecimals(sideYes.QtyOrig, int(usdcDecimals))
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to calculate qtyScaledYesBig: %v", err)
	}

	qtyScaledNoBig, err := lib.FloatToBigIntScaledDecimals(sideNo.QtyOrig, int(usdcDecimals))
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to calculate qtyScaledNoBig: %v", err)
	}

	// priceUsdAbsScaledYesBig, err := lib.FloatToBigIntScaledDecimals(math.Abs(sideYes.PriceUsd), int(usdcDecimals))
	// if err != nil {
	// 	return false, lib.LogAndError(lib.LOG_ERROR, "failed to calculate priceUsdAbsScaledYesBig: %v", err)
	// }

	// priceUsdAbsScaledNoBig, err := lib.FloatToBigIntScaledDecimals(math.Abs(sideNo.PriceUsd), int(usdcDecimals))
	// if err != nil {
	// 	return false, lib.LogAndError(lib.LOG_ERROR, "failed to calculate priceUsdAbsScaledNoBig: %v", err)
	// }

	sigYes, err := base64.StdEncoding.DecodeString(sideYes.Sig) // Sig is base64-encoded
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Error decoding sigYes64 from base64: %v", err)
		return false, err
	}
	sigNo, err := base64.StdEncoding.DecodeString(sideNo.Sig) // Sig is base64-encoded
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Error decoding sigNo64 from base64: %v", err)
		return false, err
	}

	lib.Log(lib.LOG_INFO, "sigYes (len=%d): %x", len(sigYes), sigYes)
	lib.Log(lib.LOG_INFO, "sigNo (len=%d): %x", len(sigNo), sigNo)

	serializedPayloadYes, err := lib.AssemblePayloadHexForSigning(&pb_api.PrismPredictionIntentRequest{
		PriceUsd:   sideYes.PriceUsd,
		Qty:        sideYes.QtyOrig, // N.B. use QtyOrig and not Qty (remaining amount) - digital sig verifies based on original quantity, not current available Qty
		MarketId:   sideYes.MarketId,
		EvmAddress: sideYes.EvmAddress,
		TxId:       sideYes.TxId,
	}, usdcDecimals)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to extract YES payload for signing: %v", err)
	}

	serializedPayloadNo, err := lib.AssemblePayloadHexForSigning(&pb_api.PrismPredictionIntentRequest{
		PriceUsd:   sideNo.PriceUsd,
		Qty:        sideNo.QtyOrig, // N.B. use QtyOrig and not Qty (remaining amount) - digital sig verifies based on original quantity, not current available Qty
		MarketId:   sideNo.MarketId,
		EvmAddress: sideNo.EvmAddress,
		TxId:       sideNo.TxId,
	}, usdcDecimals)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to extract NO payload for signing: %v", err)
	}

	lib.Log(lib.LOG_INFO, "serializedPayloadYes: %s", serializedPayloadYes)
	lib.Log(lib.LOG_INFO, "serializedPayloadNo: %s", serializedPayloadNo)

	// calculate the keccak256 hash of the serialized payload
	payloadYes, _ := lib.Hex2utf8(serializedPayloadYes)
	payloadNo, _ := lib.Hex2utf8(serializedPayloadNo)
	keccakYes := lib.Keccak256([]byte(payloadYes))
	keccakNo := lib.Keccak256([]byte(payloadNo))
	lib.Log(lib.LOG_INFO, "keccakYes calc'd server-side (hex): %x", keccakYes)
	lib.Log(lib.LOG_INFO, "keccakNo calc'd server-side (hex): %x", keccakNo)

	// create a hiero public key for the hex string and key type (ecdasa/ed25519)
	publicKeyYes, err := lib.PublicKeyForKeyType(sideYes.PublicKey, lib.HederaKeyType(sideYes.KeyType))
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to get publicKeyYes: %v", err)
	}
	publicKeyNo, err := lib.PublicKeyForKeyType(sideNo.PublicKey, lib.HederaKeyType(sideNo.KeyType))
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to get publicKeyNo: %v", err)
	}

	/////
	// OK
	// now call the smart contract...
	/////
	marketIdBig, err := lib.Uuid7_to_bigint(sideYes.MarketId) // same for yes and no sides
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to convert marketId to bigint: %v", err)
	}

	txIdYesBig, err := lib.Uuid7_to_bigint(sideYes.TxId)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to convert txIdUuidYes to bigint: %v", err)
	}
	txIdNoBig, err := lib.Uuid7_to_bigint(sideNo.TxId)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to convert txIdUuidNo to bigint: %v", err)
	}

	// sigObjYes and sigObjNo (Hedera format signature objects)
	sigObjYes, err := lib.BuildSignatureMap(publicKeyYes, sigYes, lib.HederaKeyType(sideYes.KeyType))
	sigObjNo, err := lib.BuildSignatureMap(publicKeyNo, sigNo, lib.HederaKeyType(sideNo.KeyType))
	lib.Log(lib.LOG_INFO, "sigYes (keyType=%d) (hex): %x", sideYes.KeyType, sigYes)
	lib.Log(lib.LOG_INFO, "sigNo (keyType=%d) (hex): %x", sideNo.KeyType, sigNo)

	/////
	// submit to the smart contract :)
	/////
	params := hiero.NewContractFunctionParameters()
	params.AddUint128BigInt(marketIdBig)               // marketId
	params.AddAddress(sideYes.EvmAddress)              // signerYes
	params.AddAddress(sideNo.EvmAddress)               // signerNo
	params.AddUint256BigInt(collateralUsdAbsScaledYes) // collateralUsdAbsScaledYes
	params.AddUint256BigInt(collateralUsdAbsScaledNo)  // collateralUsdAbsScaledNo
	params.AddUint256BigInt(qtyScaledYesBig)
	params.AddUint256BigInt(qtyScaledNoBig)
	// params.AddUint256BigInt(priceUsdAbsScaledYesBig)
	// params.AddUint256BigInt(priceUsdAbsScaledNoBig)
	params.AddUint128BigInt(txIdYesBig)             // txIdYes
	params.AddUint128BigInt(txIdNoBig)              // txIdNo
	params.AddBytes(sigObjYes)                      // sigObjYes
	params.AddBytes(sigObjNo)                       // sigObjNo
	params.AddBool(strings.ToLower(sideYes.PrimarySecondary) == "s") // true => secondary (hedged), false => primary
	params.AddBool(strings.ToLower(sideNo.PrimarySecondary) == "s")  // true => secondary (hedged), false => primary

	lib.Log(lib.LOG_INFO, "Prepared smart contract parameters for BuyPositionTokens")
	lib.Log(lib.LOG_INFO, "marketIdBytes (hex): %s", hex.EncodeToString(marketIdBig.Bytes()))
	lib.Log(lib.LOG_INFO, "accountIdYes: %s", sideYes.EvmAddress)
	lib.Log(lib.LOG_INFO, "accountIdNo: %s", sideNo.EvmAddress)
	// lib.Log(lib.LOG_INFO, "collateralUsdAbsScaledYes: %s", collateralUsdAbsScaledYes.String())
	// lib.Log(lib.LOG_INFO, "collateralUsdAbsScaledNo: %s", collateralUsdAbsScaledNo.String())
	lib.Log(lib.LOG_INFO, "txIdYesBig (hex): %s", hex.EncodeToString(txIdYesBig.Bytes()))
	lib.Log(lib.LOG_INFO, "txIdNoBig (hex): %s", hex.EncodeToString(txIdNoBig.Bytes()))
	lib.Log(lib.LOG_INFO, "sigObjYes (len=%d): %x", len(sigObjYes), sigObjYes)
	lib.Log(lib.LOG_INFO, "sigObjNo (len=%d): %x", len(sigObjNo), sigObjNo)
	lib.Log(lib.LOG_INFO, "primarySecondaryYes: %t", sideYes.PrimarySecondary == "s")
	lib.Log(lib.LOG_INFO, "primarySecondaryNo: %t", sideNo.PrimarySecondary == "s")
	// NO - do not use the current X_SMART_CONTRACT_ID - use the one that is stored in the markets table
	// contractID, err := hiero.ContractIDFromString(
	// 	os.Getenv(fmt.Sprintf("%s_SMART_CONTRACT_ID", strings.ToUpper(sideYes.Net))),
	// )
	market, err := hs.marketsRepository.GetMarketById(sideYes.MarketId /* yes or no, doesn't matter*/, false)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "could not retrieve market: %v. Is the market suspended or paused?", err)
	}
	contractId, err := hiero.ContractIDFromString(market.SmartContractID)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "invalid contract ID in market record: %v", err)
	}

	tx, err := hiero.NewContractExecuteTransaction().
		SetContractID(contractId).
		SetGas(5_000_000). // TODO - can this be lowered? 2M in 4_buy.ts
		SetFunction("posColToksOnBehalfAtomic", params).
		Execute(hs.hedera_clients[sideYes.Net]) // both sides are guaranteed to be on the same network
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to execute contract: %v", err)
	}

	receipt, err := tx.GetReceipt(hs.hedera_clients[sideYes.Net]) // both sides are guaranteed to be on the same network
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to get transaction receipt: %v", err)
	}

	// the smart contract function returns (nYes, nNo)
	record, err := tx.GetRecord(hs.hedera_clients[sideYes.Net])
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to get transaction record: %v", err)
	}
	nYesTokens := new(big.Int).SetBytes(record.CallResult.GetUint256(0))
	nNoTokens := new(big.Int).SetBytes(record.CallResult.GetUint256(1))
	nYesTokens2 := new(big.Int).SetBytes(record.CallResult.GetUint256(2))
	nNoTokens2 := new(big.Int).SetBytes(record.CallResult.GetUint256(3))

	lib.Log(lib.LOG_INFO, "Token balances (marketId=%s): %s (yes=%s, no=%s) |  %s (yes=%s, no=%s)", sideYes.MarketId /* yes===no*/, sideYes.EvmAddress, nYesTokens.String(), nNoTokens.String(), sideNo.EvmAddress, nYesTokens2.String(), nNoTokens2.String())

	lib.Log(lib.LOG_INFO, "posColToksOnBehalfAtomic(marketId=%s, ...) status: %s", sideYes.MarketId, receipt.Status.String())

	/////
	// db
	// - 1. Record the tx on the database (auditing)
	// - 2. record the price on the price table
	// - 3. record the YES/NO balances
	// - 4. record the global tv_matched
	// - 5. log on Hedera HCS
	// - 6. update the matches record with the HCS message ID
	/////

	if hs.dbRepository == nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "dbRepository is not initialized")
	}

	// 1. record the successful on-chain match
	txHash := receipt.TransactionID.String()
	lib.Log(lib.LOG_INFO, "TransactionID (txHash) for successful match: %s", txHash)
	err = hs.matchesRepository.UpdateMatch(sideYes.MarketId, sideYes.TxId, sideNo.TxId, txHash, nil)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "Error logging a successful tx to matches table: %v", err)
	}

	// 2. record the price
	err = hs.priceRepository.SavePriceHistory(sideYes.MarketId, sideYes.TxId, sideYes.PriceUsd) // TODO - check this
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "Error saving price history for market %s: %v", sideYes.MarketId, err)
	}
	// don't need to save the No side
	// err = h.dbRepository.SavePriceHistory(sideNo.MarketId, sideNo.PriceUsd)
	// if err != nil {
	// 	return false, fmt.Errorf("Error saving price history for market %s: %v", sideNo.MarketId, err)
	// }

	// 3. record the YES/NO balances
	resultYes, err := hs.positionsRepository.UpsertUserPositions(sideYes.EvmAddress, sideYes.MarketId, nYesTokens.Int64(), nNoTokens.Int64(), sideYes.PriceUsd)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "Error upserting user position tokens for %s on market %s: %v", sideYes.EvmAddress, sideYes.MarketId, err)
	}
	lib.Log(lib.LOG_INFO, "In marketId=%s, user with evmAddress=%s, has nYes=%d | nNo=%d", resultYes.MarketID, resultYes.EvmAddress, resultYes.NYes, resultYes.NNo)
	resultNo, err := hs.positionsRepository.UpsertUserPositions(sideNo.EvmAddress, sideNo.MarketId, nYesTokens2.Int64(), nNoTokens2.Int64(), sideNo.PriceUsd)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "Error upserting user position tokens for %s on market %s: %v", sideNo.EvmAddress, sideNo.MarketId, err)
	}
	lib.Log(lib.LOG_INFO, "In marketId=%s, user with evmAddress=%s, has nYes=%d | nNo=%d", resultNo.MarketID, resultNo.EvmAddress, resultNo.NYes, resultNo.NNo)

	// 4. and update the global tv_matched value
	hs.dbRepository.UpdateTotalValueMatchedUsd(math.Min(math.Abs(sideYes.PriceUsd*sideYes.Qty), math.Abs(sideNo.PriceUsd*sideNo.Qty)) * 2) // N.B. multiply by 2 because both yes and no sides contribute to the total value matched!

	// 5. log on Hedera HCS
	hederaHcsTxId, err := hs.PublishHCSmessage(sideYes.Net, fmt.Sprintf("[%s,%s]", sideYes.TxId, sideNo.TxId))
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "Error publishing HCS message for market %s: %v", sideYes.MarketId, err)
	}

	// 6. update the matches record with the HCS message ID
	// call UpdateMatchTxHash again - this time include the hederaHcsTxId
	err = hs.matchesRepository.UpdateMatch(sideYes.MarketId, sideYes.TxId, sideNo.TxId, txHash, &hederaHcsTxId)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "Error logging a successful hederaHcsTxId to matches table: %v", err)
	}

	// if we get here, return true
	return true, nil
}

func (hs *HederaService) CreateNewMarket(marketId string, statement string, net string) (uint64, error) {
	// call the smart contract function createNewMarket(uint128 marketId, string memory _statement)
	marketIdBig, err := lib.Uuid7_to_bigint(marketId)
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "failed to convert marketId to bigint: %v", err)
	}
	params := hiero.NewContractFunctionParameters()
	params.AddUint128BigInt(marketIdBig) // marketId
	params.AddString(statement)          // statement

	// YES, use the X_SMART_CONTRACT_ID that's loaded in the env var (new market creation always uses the current one)
	contractID, err := hiero.ContractIDFromString(
		os.Getenv(fmt.Sprintf("%s_SMART_CONTRACT_ID", strings.ToUpper(net))),
	)
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "invalid smart contract ID: %v", err)
	}

	lib.Log(lib.LOG_INFO, "Creating a new market on Prism smart contract (%s)", contractID)
	result, err := hiero.NewContractExecuteTransaction().
		SetContractID(contractID).
		SetGas(2_000_000). // TODO - can this be lowered?
		SetFunction("createNewMarket", params).
		Execute(hs.hedera_clients[net])
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "failed to execute contract: %v", err)
	}

	record, err := result.GetRecord(hs.hedera_clients[net])
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "CreateNewMarket - tx failed (could not get transaction record). Hedera txId = %s. %v", result.TransactionID.String(), err)
	}

	// receipt, err := result.GetReceipt(hs.hedera_clients[net])
	// if err != nil {
	// 	return fmt.Errorf("failed to get transaction receipt: %v", err)
	// }

	remainingAllowance := new(big.Int).SetBytes(record.CallResult.GetUint256(0))

	lib.Log(lib.LOG_INFO, "Remaining allowance: %v", remainingAllowance.Uint64())

	lib.Log(lib.LOG_INFO, "CreateNewMarket - tx successful. Hedera txId = %s", result.TransactionID.String())

	return remainingAllowance.Uint64(), nil
}

func (hs *HederaService) ResolveMarketOnChain(net string, marketId string, contractIdStr string, noYes bool) (bool, error) {
	contractId, err := hiero.ContractIDFromString(contractIdStr)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to parse smart contract ID from market data: %v", err)
	}

	marketIdBig, err := lib.Uuid7_to_bigint(marketId)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to convert marketId to bigint: %v", err)
	}

	params := hiero.NewContractFunctionParameters()
	params.AddUint128BigInt(marketIdBig) // marketId
	params.AddBool(noYes)                // no = false, yes = true

	result, err := hiero.NewContractExecuteTransaction().
		SetContractID(contractId).
		SetGas(1_000_000). // TODO - can this be lowered? 2M in 4_buy.ts
		SetFunction("resolveMarket", params).
		Execute(hs.hedera_clients[net]) // both sides are guaranteed to be on the same network
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to execute contract: %v", err)
	}

	_, err = result.GetRecord(hs.hedera_clients[net])
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "ResolveMarket - tx failed (could not get transaction record). Hedera txId = %s. %v", result.TransactionID.String(), err)
	}

	lib.Log(lib.LOG_INFO, "ResolveMarket - tx successful. Hedera txId = %s", result.TransactionID.String())
	lib.Log(lib.LOG_INFO, "Market resolved as %s", map[bool]string{true: "YES", false: "NO"}[noYes])
	return true, nil
}

func (hs *HederaService) PublishHCSmessage(net string, message string) (string, error) {
	topicIdStr := os.Getenv(fmt.Sprintf("%s_HCS_TOPIC_ID", strings.ToUpper(net)))
	if topicIdStr == "" {
		return "", lib.LogAndError(lib.LOG_ERROR, "HCS_TOPIC_ID environment variable is not set for network %s", net)
	}

	topicId, err := hiero.TopicIDFromString(topicIdStr)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid HCS_TOPIC_ID for network %s: %v", net, err)
	}

	tx, err := hiero.NewTopicMessageSubmitTransaction().
		SetTopicID(topicId).
		SetMessage([]byte(message)).
		Execute(hs.hedera_clients[net])
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to submit HCS message: %v", err)
	}

	_, err = tx.GetReceipt(hs.hedera_clients[net])
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get receipt for HCS message: %v", err)
	}

	lib.Log(lib.LOG_INFO, "HCS message published successfully. Hedera txId = %s", tx.TransactionID.String())
	return tx.TransactionID.String(), nil
}

func (hs *HederaService) SendHTStokens(networkSelected hiero.LedgerID, tokenId hiero.TokenID, recipientAccountId hiero.AccountID, nTokens float64) (string, error) {
	txHash := ""

	nDecimalsStr := os.Getenv("TOKEN_DECIMALS")
	nDecimals, err := strconv.Atoi(nDecimalsStr)
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "invalid TOKEN_DECIMALS value: %v", err)
	}

	nHTStokensToSend := int64(nTokens * math.Pow10(nDecimals)) // assuming the token has nDecimals, adjust as needed

	tx, err := hiero.NewTransferTransaction().
		AddTokenTransfer(tokenId, hs.hedera_clients[networkSelected.String()].GetOperatorAccountID(), -nHTStokensToSend).
		AddTokenTransfer(tokenId, recipientAccountId, nHTStokensToSend).
		Execute(hs.hedera_clients[networkSelected.String()])
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to execute token transfer: %v", err)
	}

	receipt, err := tx.SetValidateStatus(true).GetReceipt(hs.hedera_clients[networkSelected.String()])
	if err != nil {
		return "", lib.LogAndError(lib.LOG_ERROR, "failed to get receipt for token transfer: %v", err)
	}

	txHash = tx.TransactionID.String()
	lib.Log(lib.LOG_INFO, "Token transfer successful: %s (status: %s)", txHash, receipt.Status.String())

	return txHash, nil
}

/*
on-chain : retrieve a user's number of position tokens
*/
func (hs *HederaService) GetUserPositionTokenBalance(networkSelected hiero.LedgerID, marketId string, userEvmAddress string) (float64, float64, error) {
	// Solidity:
	// getUserTokens(uint128 marketId, address user) returns (uint256)

	params := hiero.NewContractFunctionParameters()
	marketIdBig, err := lib.Uuid7_to_bigint(marketId)
	if err != nil {
		return 0, 0, lib.LogAndError(lib.LOG_ERROR, "invalid market ID: %v", err)
	}

	params.AddUint128BigInt(marketIdBig)
	params.AddAddress(userEvmAddress)

	market, err := hs.marketsRepository.GetMarketById(marketId, false)
	if err != nil {
		return 0, 0, lib.LogAndError(lib.LOG_ERROR, "could not retrieve market: %v. Is the market suspended or paused?", err)
	}
	contractId, err := hiero.ContractIDFromString(market.SmartContractID)
	if err != nil {
		return 0, 0, lib.LogAndError(lib.LOG_ERROR, "invalid contract ID in market record (GetPositionTokenBalance): %v", err)
	}

	query := hiero.NewContractCallQuery().
		SetContractID(contractId).
		SetGas(1_000_000).
		SetFunction("getUserTokens", params)

	result, err := query.
		Execute(hs.hedera_clients[networkSelected.String()])
	if err != nil {
		return 0, 0, lib.LogAndError(lib.LOG_ERROR, "failed to execute contract call (GetPositionTokenBalance): %v", err)
	}

	yesBytes := result.GetUint256(0)
	noBytes := result.GetUint256(1)

	yesBig := new(big.Int).SetBytes(yesBytes)
	noBig := new(big.Int).SetBytes(noBytes)

	nDecimals, err := strconv.ParseFloat(os.Getenv("USDC_DECIMALS"), 64)
	if err != nil {
		return 0, 0, lib.LogAndError(lib.LOG_ERROR, "failed to parse USDC_DECIMALS: %v", err)
	}

	yesTokens := float64(yesBig.Uint64()) / math.Pow(10, nDecimals)
	noTokens := float64(noBig.Uint64()) / math.Pow(10, nDecimals)

	return yesTokens, noTokens, nil
}
