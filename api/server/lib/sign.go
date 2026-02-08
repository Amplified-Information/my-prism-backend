package lib

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"math"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/hiero-ledger/hiero-sdk-go/v2/proto/services"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
	"golang.org/x/crypto/sha3"

	protobuf "google.golang.org/protobuf/proto"

	pb_api "api/gen"
)

/**
* Assembles a payload hex string for signing from the PredictionIntentRequest object
* See: prism/README.md for format definition details
* Also see: ./web.eng/lib/utils.ts
* @param predictionIntentRequest PredictionIntentRequest object from front-end
* @param usdcDecimals number of decimals for USDC
* @returns a long string conforming to the format
 */
func AssemblePayloadHexForSigning(req *pb_api.PredictionIntentRequest, usdcDecimals uint64) (string, error) {
	log.Printf("%v", req)

	collateralUsdAbs := math.Abs(req.PriceUsd * req.Qty)
	collateralUsdAbsScaled, err := FloatToBigIntScaledDecimals(collateralUsdAbs, int(usdcDecimals))
	if err != nil {
		return "", fmt.Errorf("failed to scale collateralUsdAbs: %v", err)
	}
	log.Printf("collateralUsdAbsScaled: %s", collateralUsdAbsScaled.String())

	marketIdBigInt, err := Uuid7_to_bigint(req.MarketId)
	if err != nil {
		return "", fmt.Errorf("failed to convert MarketId: %v", err)
	}

	txIdBigInt, err := Uuid7_to_bigint(req.TxId)
	if err != nil {
		return "", fmt.Errorf("failed to convert TxId: %v", err)
	}

	evmAddressBigInt := new(big.Int)
	evmAddressBigInt.SetString(strings.TrimPrefix(req.EvmAddress, "0x"), 16)

	buySell := 0xf0 // buy
	if req.PriceUsd < 0 {
		buySell = 0xf1 // sell
	}

	// The format specifier "%002x" is used to ensure that the value of `buySell`
	// is formatted as a two-character hexadecimal string, padded with leading zeros
	// if necessary. Here's the breakdown:
	// - `%`: Indicates the start of a format verb.
	// - `0`: Specifies that the padding character is '0'.
	// - `2`: Specifies the minimum width of the output (2 characters).
	// - `x`: Specifies that the value should be formatted as a hexadecimal number.
	//
	// The double zeros (`%002x`) ensure that the output is always 2 characters long,
	// even if the value of `buySell` is less than 16 (0x10 in hexadecimal). This
	// avoids odd-length hex strings, which could cause issues in contexts where
	// fixed-length formatting is required.
	payloadHex := fmt.Sprintf( // beautiful :)   example: 0100000000000000000000000000004e20000000000000000000000000440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b45b837017342a16c7fb8a8023f17
		"%02x%064x%040x%032x%032x",

		buySell,                // note: 8 bits. The hex len is 2 chars (padded left with '0') to avoid odd length hex strings. 0xf0 = buy, 0xf1 = sell
		collateralUsdAbsScaled, // yes, uint256
		evmAddressBigInt,       // note: an evm address is exactly 20 bytes = 40 hex chars
		marketIdBigInt,         // uint128
		txIdBigInt,             // uint128
	)
	return payloadHex, nil
}

func Uuid7_to_bigint(uuid7 string) (*big.Int, error) {
	// Remove all hyphens from the UUID7 string
	uuid7Cleaned := strings.ReplaceAll(uuid7, "-", "")

	// Prefix with 0x to indicate hexadecimal
	hexString := "0x" + uuid7Cleaned

	// Convert the hexadecimal string to a big.Int
	bigIntValue := new(big.Int)
	_, success := bigIntValue.SetString(hexString, 0) // Base 0 auto-detects the prefix
	if !success {
		return nil, fmt.Errorf("failed to convert UUID7 to big.Int: %s", uuid7)
	}

	return bigIntValue, nil
}

// func Uuid7_to_bytes(uuid7 string) ([]byte, error) {
// 	// Remove all hyphens from the UUID7 string
// 	uuid7Cleaned := strings.ReplaceAll(uuid7, "-", "")

// 	// Prefix with 0x to indicate hexadecimal
// 	hexString := "0x" + uuid7Cleaned

// 	bytes, err := hex.DecodeString(hexString)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to decode UUID7 hex string: %s", uuid7)
// 	}
// 	return bytes, nil
// }

func PrefixMessageToSign(messageStr string) string {
	msg := fmt.Sprintf("\x19Hedera Signed Message:\n44%s", messageStr) // fixed length 44 for base64-encoded keccak256 hash
	return msg
}

func Keccak256(data []byte) []byte {
	h := sha3.NewLegacyKeccak256()
	h.Write(data)
	return h.Sum(nil) // 32 bytes
}

func BuildSignatureMap(publicKey *hiero.PublicKey, signatureBytes []byte, keyType HederaKeyType) ([]byte, error) {
	sigMap := &services.SignatureMap{}

	switch keyType {
	case KEY_TYPE_ECDSA:
		// fmt.Println("ECDSA")
		ecdsaPair := &services.SignaturePair_ECDSASecp256K1{
			ECDSASecp256K1: signatureBytes,
		}

		sigPair := &services.SignaturePair{
			PubKeyPrefix: publicKey.BytesRaw(), // or Bytes(), depending on your key source
			Signature:    ecdsaPair,
		}

		sigMap = &services.SignatureMap{
			SigPair: []*services.SignaturePair{sigPair},
		}

	case KEY_TYPE_ED25519:
		// fmt.Println("ED25519")
		ed25519Pair := &services.SignaturePair_Ed25519{
			Ed25519: signatureBytes,
		}

		sigPair := &services.SignaturePair{
			PubKeyPrefix: publicKey.BytesRaw(), // or Bytes(), depending on your key source
			Signature:    ed25519Pair,
		}

		sigMap = &services.SignatureMap{
			SigPair: []*services.SignaturePair{sigPair},
		}
	default:
		return nil, fmt.Errorf("unsupported keyType: %d", keyType)
	}

	bytes, err := protobuf.Marshal(sigMap)
	if err != nil {
		return nil, err
	}
	return bytes, nil
}

func FloatToBigIntScaledDecimals(value float64, nDecimals int) (*big.Int, error) {
	// JavaScript version - utils.ts
	// const floatToBigIntScaledDecimals = (value: number, nDecimals: number): bigint => {
	// 	const [integerPart, fractionalPart = ''] = value.toString().split('.')
	// 	const scaledValue = '' + integerPart + '' + fractionalPart.padEnd(nDecimals, '0').slice(0, nDecimals)
	// 	return BigInt(scaledValue)
	// }
	valueStr := fmt.Sprintf("%f", value)
	// valueStr := strconv.FormatFloat(value, 'f', -1, 64) // N.B. preserves all digits, no rounding
	parts := strings.Split(valueStr, ".")
	integerPart := parts[0]
	fractionalPart := ""
	if len(parts) == 2 {
		fractionalPart = parts[1]
	}
	if len(parts) > 2 {
		return nil, fmt.Errorf("invalid float value: %f", value)
	}

	// Pad or truncate the fractional part to nDecimals
	if len(fractionalPart) < nDecimals {
		fractionalPart = fractionalPart + strings.Repeat("0", nDecimals-len(fractionalPart))
	} else if len(fractionalPart) > nDecimals {
		fractionalPart = fractionalPart[:nDecimals]
	}

	scaledValueStr := integerPart + fractionalPart
	scaledValueBigInt := new(big.Int)
	_, ok := scaledValueBigInt.SetString(scaledValueStr, 10)
	if !ok {
		return nil, fmt.Errorf("failed to convert scaled value to big.Int: %s", scaledValueStr)
	}

	return scaledValueBigInt, nil
}

func VerifySig(publicKey *hiero.PublicKey, payloadHex string, sigBase64 string) (bool, error) {
	sigBytes, err := base64.StdEncoding.DecodeString(sigBase64)
	if err != nil {
		return false, fmt.Errorf("failed to decode signature: %w", err)
	}
	sigHex := fmt.Sprintf("%x", sigBytes)
	sig := make([]byte, len(sigHex)/2)
	_, err = hex.Decode(sig, []byte(sigHex))
	if err != nil {
		return false, fmt.Errorf("Error decoding signature hex: %v", err)
	}

	payload, err := Hex2utf8(payloadHex)
	keccak := Keccak256([]byte(payload))
	log.Printf("keccak (hex) calc'd on back-end: %x", keccak)

	// JavaScript equivalent (see: test.ts:55):

	keccak64 := base64.StdEncoding.EncodeToString(keccak) // N.B. this line is required for base64 hashpack encoding
	keccak64PrefixedStr := PrefixMessageToSign(keccak64)

	// Now verify the signature
	isValid := publicKey.VerifySignedMessage([]byte(keccak64PrefixedStr), sig)
	if isValid {
		return true, nil
	}
	return false, fmt.Errorf("Invalid signature")
}

func GenerateJWT(secret string, claims map[string]interface{}) (string, error) {
	token := jwt.New(jwt.SigningMethodHS256)
	claimsMap := token.Claims.(jwt.MapClaims)
	for k, v := range claims {
		claimsMap[k] = v
	}

	jwtExpiryHoursStr := os.Getenv("JWT_EXPIRY_HOURS")
	jwtExpiryHours, err := strconv.Atoi(jwtExpiryHoursStr)
	if err != nil {
		jwtExpiryHours = 24 // default to 24 hours if env var is not set or invalid
	}

	claimsMap["exp"] = time.Now().Add(time.Hour * time.Duration(jwtExpiryHours)).Unix()

	return token.SignedString([]byte(secret))
}
