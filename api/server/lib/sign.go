package lib

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
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

)


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
		return nil, ErrorLog("unsupported keyType", "keyType", keyType)
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
		return nil, ErrorLog("invalid float value", "value", value)
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
		return nil, ErrorLog("failed to convert scaled value to big.Int", "scaledValueStr", scaledValueStr)
	}

	return scaledValueBigInt, nil
}

func VerifySig(publicKey *hiero.PublicKey, payloadHex string, sigBase64 string) (bool, error) {
	sigBytes, err := base64.StdEncoding.DecodeString(sigBase64)
	if err != nil {
		return false, ErrorLog("failed to decode signature", "error", err, "sigBase64Length", len(sigBase64))
	}
	sigHex := fmt.Sprintf("%x", sigBytes)
	sig := make([]byte, len(sigHex)/2)
	_, err = hex.Decode(sig, []byte(sigHex))
	if err != nil {
		return false, ErrorLog("error decoding signature hex", "error", err)
	}

	payload, err := Hex2utf8(payloadHex)
	if err != nil {
		return false, ErrorLog("failed to decode payload hex", "error", err, "payloadHex", payloadHex)
	}
	keccak := Keccak256([]byte(payload))
	Debug("keccak calculated on back-end", "keccakHex", fmt.Sprintf("%x", keccak))

	// JavaScript equivalent (see: test.ts:55):

	keccak64 := base64.StdEncoding.EncodeToString(keccak) // N.B. this line is required for base64 hashpack encoding
	keccak64PrefixedStr := PrefixMessageToSign(keccak64)

	// Now verify the signature
	isValid := publicKey.VerifySignedMessage([]byte(keccak64PrefixedStr), sig)
	if isValid {
		return true, nil
	}
	return false, ErrorLog("invalid signature")
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
