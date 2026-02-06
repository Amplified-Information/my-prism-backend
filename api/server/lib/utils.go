package lib

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/mail"
	"os"
	"strings"

	pb "api/gen"
	pb_clob "api/gen/clob"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
	"google.golang.org/protobuf/encoding/protojson"
	"gopkg.in/gomail.v2"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type HTTPMethod string

const (
	GET    HTTPMethod = "GET"
	POST   HTTPMethod = "POST"
	PUT    HTTPMethod = "PUT"
	PATCH  HTTPMethod = "PATCH"
	DELETE HTTPMethod = "DELETE"
)

var GloboMarshaler = protojson.MarshalOptions{
	UseProtoNames:   false, // Use json_name annotations
	EmitUnpopulated: false, // Don't include zero values
	Indent:          "",    // Ensure compact JSON with no indentation or spaces
	Multiline:       false, // Ensure single-line JSON
}

func Fetch(method HTTPMethod, url string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(string(method), url, body)
	if err != nil {
		return nil, err
	}
	return http.DefaultClient.Do(req)
}

func PrettyJSON(input string) string {
	var obj interface{}
	if err := json.Unmarshal([]byte(input), &obj); err != nil {
		log.Println("Invalid JSON:", err)
		return input
	}

	pretty, err := json.MarshalIndent(obj, "", "  ")
	if err != nil {
		log.Println("Error pretty printing:", err)
		return input
	}

	return string(pretty)
}

// JsonMarshaller marshals protobuf messages to JSON using protojson to respect json_name annotations
// Produces compact JSON without spaces for signature verification compatibility
func JsonMarshaller(req *pb.PredictionIntentRequest) ([]byte, error) {
	jsonBytes, err := GloboMarshaler.Marshal(req)
	if err != nil {
		return nil, err
	}

	// TODO - this is a hack:
	jsonBytesNoSpacesBetweenFields := bytes.ReplaceAll(jsonBytes, []byte(" "), []byte(""))

	return jsonBytesNoSpacesBetweenFields, nil
}

func Int64ToBytes(n int64) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, uint64(n))
	return b
}

func BytesToInt64(b []byte) int64 {
	return int64(binary.BigEndian.Uint64(b))
}

// func FloatToBigIntScaledDecimals(value float64) (*big.Int, error) {
// 	// scale the float64s for the number of USDC_DECIMALS
// 	usdcDecimalsStr := os.Getenv("USDC_DECIMALS")
// 	usdcDecimals, err := strconv.ParseInt(usdcDecimalsStr, 10, 64)
// 	if err != nil {
// 		return nil, fmt.Errorf("invalid USDC_DECIMALS: %w", err)
// 	}

// 	scaledValue := new(big.Float).Mul(big.NewFloat(value), new(big.Float).SetFloat64(math.Pow10(int(usdcDecimals))))
// 	bigIntValue, _ := scaledValue.Int(nil)
// 	return bigIntValue, nil
// }

// hex2utf8 converts a hex string to a UTF-8 string.
// Invalid byte sequences are replaced with the Unicode replacement character.
func Hex2utf8(hexStr string) (string, error) {
	// Decode the hex string into bytes
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return "", fmt.Errorf("failed to decode hex string: %w", err)
	}

	// Convert bytes to a UTF-8 string
	utf8Str := string(bytes)
	return utf8Str, nil
}

// utf82hex converts a UTF-8 string back to a hex string.
func Utf82hex(utf8Str string) string {
	// Convert the UTF-8 string to bytes
	bytes := []byte(utf8Str)

	// Encode the bytes as a hex string
	hexStr := hex.EncodeToString(bytes)
	return hexStr
}

func IsValidNetwork(s string) bool {
	var validNetworks = map[ValidNetworksType]struct{}{
		TESTNET:    {},
		MAINNET:    {},
		PREVIEWNET: {},
	}

	_, ok := validNetworks[ValidNetworksType(s)]
	return ok
}

func IsValidKeyType(n uint32) bool {
	var validKeyTypes = map[HederaKeyType]struct{}{
		KEY_TYPE_ECDSA:   {},
		KEY_TYPE_ED25519: {},
	}

	_, ok := validKeyTypes[HederaKeyType(n)]
	return ok
}

func IsValidAccountId(accountId string) bool {
	_, err := hiero.AccountIDFromString(accountId)
	return err == nil
}

func PublicKeyForKeyType(publicKeyHex string, keyType HederaKeyType) (*hiero.PublicKey, error) {
	publicKey := hiero.PublicKey{}
	switch keyType {
	case 2: // ECDSA
		result, err := hiero.PublicKeyFromStringECDSA(publicKeyHex)
		if err != nil {
			return nil, fmt.Errorf("failed to parse publicKeyHex (ECDSA) from bytes: %v", err)
		}
		publicKey = result
	case 1: // ed25519
		result, err := hiero.PublicKeyFromStringEd25519(publicKeyHex)
		if err != nil {
			return nil, fmt.Errorf("failed to parse publicKeyHex (ed25519) from bytes: %v", err)
		}
		publicKey = result
	default:
		return nil, fmt.Errorf("unsupported keyType: %d", keyType)
	}

	return &publicKey, nil
}

// /*
// *
// This function determines the type of a given Hedera public key (offline).
// @param publicKey - the public key to check
// */
// func (h *HederaService) PublicKeyType(publicKey *hiero.PublicKey) (HederaKeyType, error) {
// 	decodedKey, err := base64.StdEncoding.DecodeString(publicKey.String())
// 	if err != nil {
// 		log.Fatalf("Failed to decode public key: %v", err)
// 	}

// 	switch len(decodedKey) {
// 	case 32:
// 		return ED25519, nil
// 	case 33, 65:
// 		return ECDSA, nil
// 	default:
// 		return -1, fmt.Errorf("unknown key type with length: %d", len(decodedKey))
// 	}
// }

func GetUserAgentFromContext(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}

	// gRPC uses "user-agent" header
	if ua := md.Get("user-agent"); len(ua) > 0 {
		return ua[0]
	}

	// If behind a proxy like Envoy, check grpcgateway-user-agent
	if ua := md.Get("grpcgateway-user-agent"); len(ua) > 0 {
		return ua[0]
	}

	return ""
}

func GetIPFromContext(ctx context.Context) string {
	// Check for forwarded headers first (from proxy)
	md, ok := metadata.FromIncomingContext(ctx)
	if ok {
		// X-Forwarded-For may contain multiple IPs: "client, proxy1, proxy2"
		if xff := md.Get("x-forwarded-for"); len(xff) > 0 && xff[0] != "" {
			// Take the first IP (original client)
			ip := xff[0]
			if idx := bytes.IndexByte([]byte(ip), ','); idx != -1 {
				ip = ip[:idx]
			}
			return strings.TrimSpace(ip)
		}
		if xri := md.Get("x-real-ip"); len(xri) > 0 && xri[0] != "" {
			return strings.TrimSpace(xri[0])
		}
	}

	// Fallback to peer address
	p, ok := peer.FromContext(ctx)
	if !ok {
		return ""
	}
	host, _, err := net.SplitHostPort(p.Addr.String())
	if err != nil {
		return p.Addr.String()
	}
	return host
}

func SendEmail(to string, subject string, body string) error {
	// validate to is a valid email address
	_, err := mail.ParseAddress(to)
	if err != nil {
		log.Printf("Invalid email address: %v", err)
		return err
	}

	// don't send email if SEND_EMAIL is not true (e.g. lower environments)
	if os.Getenv("SEND_EMAIL") != "true" {
		log.Println("SEND_EMAIL is not set to true. Skipping email sending.")
		return err
	}

	from := os.Getenv("EMAIL_ADDRESS")
	smtpUser := os.Getenv("SMTP_USERNAME")
	smtpPass := os.Getenv("SMTP_PWORD")
	smtpHost := os.Getenv("SMTP_ENDPOINT")
	smtpPort := 587

	if from == "" || smtpUser == "" || smtpPass == "" {
		log.Println("Missing required environment variables for email sending.")
		return err
	}

	// Create a new email message
	m := gomail.NewMessage()
	m.SetHeader("From", from)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	// Create a new SMTP dialer
	d := gomail.NewDialer(smtpHost, smtpPort, smtpUser, smtpPass)

	// Send the email
	if err := d.DialAndSend(m); err != nil {
		log.Printf("Failed to send email: %v", err)
		return err
	}

	log.Println("Email sent successfully.")
	return nil
}

/*
*
Create a market on the clob
*/
func CreateMarketOnClob(marketId string) error {
	// (noauth on port 500051 - not thru the proxy)
	// grpcurl -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000001","net":"testnet"}' $SERVER clob.Clob/AddMarket
	//

	// TODO - use NATS

	clobAddr := os.Getenv("CLOB_HOST") + ":" + os.Getenv("CLOB_PORT")

	conn, err := grpc.NewClient(clobAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return fmt.Errorf("failed to create new market (marketId=%s) - connect to CLOB gRPC server failed: %w", marketId, err)
	}
	defer conn.Close()

	clobClient := pb_clob.NewClobInternalClient(conn)
	_, err = clobClient.CreateMarket(
		context.Background(),
		&pb_clob.CreateMarketRequest{
			MarketId: marketId,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create a market (marketId=%s) on the CLOB (%s): %w", marketId, clobAddr, err)
	}

	return nil
}
