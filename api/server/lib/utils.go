package lib

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/mail"
	"os"
	"strings"
	"time"

	pb "api/gen"
	pb_clob "api/gen/clob"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
	"google.golang.org/protobuf/encoding/protojson"
	"gopkg.in/gomail.v2"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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
		Log(LOG_WARN, "Invalid JSON: %v", err)
		return input
	}

	pretty, err := json.MarshalIndent(obj, "", "  ")
	if err != nil {
		Log(LOG_ERROR, "Error pretty printing: %v", err)
		return input
	}

	return string(pretty)
}

// JsonMarshaller marshals protobuf messages to JSON using protojson to respect json_name annotations
// Produces compact JSON without spaces for signature verification compatibility
func JsonMarshaller(req *pb.PrismPredictionIntentRequest) ([]byte, error) {
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
		return "", ErrorLog("failed to decode hex string", "error", err, "hexLength", len(hexStr))
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
			return nil, ErrorLog("failed to parse publicKeyHex (ECDSA) from bytes", "error", err)
		}
		publicKey = result
	case 1: // ed25519
		result, err := hiero.PublicKeyFromStringEd25519(publicKeyHex)
		if err != nil {
			return nil, ErrorLog("failed to parse publicKeyHex (ed25519) from bytes", "error", err)
		}
		publicKey = result
	default:
		return nil, ErrorLog("unsupported keyType", "keyType", keyType)
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
// 		return -1, err
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
		Log(LOG_WARN, "Invalid email address: %v", err)
		return err
	}

	// don't send email if SEND_EMAIL is not true (e.g. lower environments)
	if os.Getenv("SEND_EMAIL") != "true" {
		Log(LOG_INFO, "SEND_EMAIL is not set to true. Skipping email sending.")
		return err
	}

	from := os.Getenv("EMAIL_ADDRESS")
	smtpUser := os.Getenv("SMTP_USERNAME")
	smtpPass := os.Getenv("SMTP_PWORD")
	smtpHost := os.Getenv("SMTP_ENDPOINT")
	smtpPort := 587

	if from == "" || smtpUser == "" || smtpPass == "" {
		Log(LOG_ERROR, "Missing required environment variables for email sending.")
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
		Log(LOG_ERROR, "Failed to send email: %v", err)
		return err
	}

	Log(LOG_INFO, "Email sent successfully.")
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
		return ErrorLog("failed to create new market - connect to CLOB gRPC server failed", "error", err, "marketId", marketId, "clobAddr", clobAddr)
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
		return LogAndError(LOG_ERROR, "failed to create market on CLOB(marketId=%s): %v", marketId, err)
	}

	return nil
}

/*
*
Close a market on the clob (ensure smart contract is resolved first)
*/
func CloseMarketOnClob(marketId string) error {
	// TODO - use NATS
	clobAddr := os.Getenv("CLOB_HOST") + ":" + os.Getenv("CLOB_PORT")

	conn, err := grpc.NewClient(clobAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return LogAndError(LOG_ERROR, "failed to close market on CLOB(marketId=%s) - connect to CLOB gRPC server failed: %v", marketId, err)
	}
	defer conn.Close()

	clobClient := pb_clob.NewClobInternalClient(conn)
	_, err = clobClient.CloseMarket(
		context.Background(),
		&pb_clob.MarketIdRequest{
			MarketId: marketId,
		},
	)
	if err != nil {
		return LogAndError(LOG_ERROR, "failed to close market on CLOB(marketId=%s): %v", marketId, err)
	}
	return nil
}

func SaveImageToS3(imageData []byte, fileName string, mimeType string) (string, error) {
	// guards
	if len(imageData) == 0 {
		return "", ErrorLog("image data is empty")
	}
	if fileName == "" {
		return "", ErrorLog("file name is empty")
	}
	if mimeType == "" {
		return "", ErrorLog("MIME type is empty")
	}

	s3BucketName := os.Getenv("S3_BUCKET_NAME")
	if s3BucketName == "" {
		return "", ErrorLog("S3_BUCKET_NAME environment variable is not set")
	}

	s3awsRegion := os.Getenv("S3_AWS_REGION")
	if s3awsRegion == "" {
		return "", ErrorLog("S3_AWS_REGION environment variable is not set or empty")
	}
	// very basic DNS name validation:
	if strings.ContainsAny(s3awsRegion, " /\\@:") || len(s3awsRegion) < 5 {
		return "", ErrorLog("S3_AWS_REGION environment variable is not a valid region string", "value", s3awsRegion)
	}

	// OK now we can save the image to S3 and return the URL
	// Load AWS config (N.B. uses IAM role if running on EC2/ECS)
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(s3awsRegion))
	if err != nil {
		return "", ErrorLog("unable to load AWS config", "error", err)
	}

	client := s3.NewFromConfig(cfg)

	_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(s3BucketName),
		Key:         aws.String(fileName),
		Body:        bytes.NewReader(imageData),
		ContentType: aws.String(mimeType),
		// ACL:         "public-read", // Optional: make public if you want public access
	})
	if err != nil {
		return "", ErrorLog("failed to upload to S3", "error", err, "bucket", s3BucketName, "fileName", fileName)
	}

	Log(LOG_INFO, "New S3 object uploaded: ", "bucket", s3BucketName, "fileName", fileName)

	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s3BucketName, s3awsRegion, fileName), nil
}

func ParseDuration(period string) time.Duration {
	switch period {
	case "1h":
		return 1 * time.Hour
	case "24h":
		return 24 * time.Hour
	case "7d":
		return 7 * 24 * time.Hour
	case "30d":
		return 30 * 24 * time.Hour
	default:
		return 0
	}
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
		return nil, ErrorLog("failed to convert UUID7 to big.Int", "uuid7", uuid7)
	}

	return bigIntValue, nil
}

func Bigint_to_uuid7(bigIntValue *big.Int) (string, error) {
	// e.g. bigIntValue = 2150303002968926159019224772567976782 -> 019e221f-9322-7383-a038-6964c1a94b4e

	// Convert big.Int to hexadecimal string
	hexString := fmt.Sprintf("%032x", bigIntValue)

	// Insert hyphens to format as UUID7: 8-4-4-4-12
	if len(hexString) != 32 {
		return "", ErrorLog("bigIntValue does not represent a valid UUID7", "bigIntValue", bigIntValue.String())
	}
	uuid7 := fmt.Sprintf("%s-%s-%s-%s-%s",
		hexString[0:8],
		hexString[8:12],
		hexString[12:16],
		hexString[16:20],
		hexString[20:32],
	)

	return uuid7, nil
}

// Md5 returns the hex-encoded MD5 hash of the input string.
func Md5(s string) string {
	h := md5.Sum([]byte(s))
	return hex.EncodeToString(h[:])
}

// NormalizeMatchTupleByPriceSign ensures tuple[0] is the positive-price leg and
// tuple[1] is the negative-price leg, regardless of publish order.
// This allows valid matches where both legs target the same token side
// (for example YES buy vs YES sell).
func NormalizeMatchTupleByPriceSign(tuple *[2]*pb_clob.CreateOrderRequestClob) error {
	if tuple == nil || tuple[0] == nil || tuple[1] == nil {
		return LogAndError(LOG_ERROR, "PROBLEM: nil order in match tuple")
	}

	if tuple[0].PriceUsd == 0.0 || tuple[1].PriceUsd == 0.0 {
		return LogAndError(
			LOG_ERROR,
			"PROBLEM: invalid zero price in match tuple: [tx0=%s price0=%f | tx1=%s price1=%f]",
			tuple[0].TxId,
			tuple[0].PriceUsd,
			tuple[1].TxId,
			tuple[1].PriceUsd,
		)
	}

	if tuple[0].PriceUsd > 0.0 && tuple[1].PriceUsd < 0.0 {
		return nil
	}

	if tuple[0].PriceUsd < 0.0 && tuple[1].PriceUsd > 0.0 {
		tuple[0], tuple[1] = tuple[1], tuple[0]
		return nil
	}

	return LogAndError(
		LOG_ERROR,
		"PROBLEM: invalid price signs in match tuple: [tx0=%s price0=%f ps0=%s | tx1=%s price1=%f ps1=%s]",
		tuple[0].TxId,
		tuple[0].PriceUsd,
		tuple[0].PrimarySecondary,
		tuple[1].TxId,
		tuple[1].PriceUsd,
		tuple[1].PrimarySecondary,
	)
}
