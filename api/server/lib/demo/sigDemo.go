package main

// usage: `go run sigDemo.go`

import (
	"api/server/lib"
	"encoding/hex"
	"fmt"
	"unicode/utf8"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

func main() {
	payloadHex := "0000000000000000000000000000000000000000000000000000000000004e200189c0a87e807e808000000000000002019aeeb456ec75b4829cb41fdfd67610"
	sigHex := "58029b63c4145c35bfcf300c3cd2b307facc18f52b53957f7f10a5816b3b64801e8687cadb06cd07648098fe1c85c7dec252068a249d57c1ff315d6bdba8989a"
	// N := 32 // 14, 86

	// payloadHex := "0000000000000000000000000000000000000000000000000000000000003a980189c0a87e807e808000000000000002019aeeb456ec75b4829cb41fdfd67610"
	// sigHex := "8a10968171368e9ea94978431068dcbbaacfec1d70ea5956bc349cb6f0cdbb4145a6cec3325b9b8285b51b14b513b4933471c2cd3039ce5a211c0de46319d830"
	// N := 30 // 14, 86

	// payloadHex := "000000000000000000000000000000000000000000000000000000000001fbd00189c0a87e807e808000000000000002019aeee638da713fa247a4b7937616dd"
	// sigHex := "c147748f875487a7a4e23f95d45308d2fedfb27a1d5be6a7a2991a42733d9a1455d1c06d64ebaee73ee8e48ee02eb49b65637e366097ea3347675af7e51f2331"
	// N := 30 // 13, 84

	// payloadHex := "000000000000000000000000000000000000000000000000000000000001fbd00189c0a87e807e808000000000000002019aeeea8bbe76c9ac87c066bd29e9cf"
	// sigHex := "fda24ae925be081e964d48a0ace6afef0c05464d20251ba8622bc75a4560a9fa7ae111ddabbed20d1ad02a7f06f41558df1172b9c3de0a53a69679679d99ddfb"
	// N := 27 // ???

	// payloadHex := "000000000000000000000000000000000000000000000000000000000001ffb80189c0a87e807e808000000000000002019aeefee15575de89fdc80cd2679655"
	// sigHex := "1284ac7d3e329740e2e144d5c9a0fc30efa31cbde4626b7d3082e4781eaf882e143a80d77a98186ca77626380dbccf714604af300c80456060cb33dfa11d7d78"
	// N := 29 // 10, 78

	// payloadHex := "000000000000000000000000000000000000000000000000000000000001fbd00189c0a87e807e808000000000000002019aef0d6768773499ea9a9727e26c94"
	// sigHex := "f46880b0407a570db1746c23a607a620be422c3215972cb57dc00987dbfff8076a75d97f761564f6d74b3275f2d375a759e79c480c48335ca8ebbb6e4abf1667"
	// N := 32 // 13, 84

	// payloadHex := "000000000000000000000000000000000000000000000000000000000001ffb80189c0a87e807e808000000000000002019aef10408b70578850c8975f012489"
	// sigHex := "d0d54810f170b385e9dae222a2f4e42c32b334f43f1d344a1bee93238cee2a2819c6b2c2bc7933054e47772d28bcbae7e98ab56419125bbd301f0884a5340296"
	// N := 31 // 14, 86

	payloadUtf8 := payloadHex
	fmt.Printf("payload: %s\n", payloadUtf8)
	fmt.Printf("sigHex: %s\n", sigHex)
	// fmt.Printf("%x\n", payloadUtf8)
	keccak := lib.Keccak256([]byte(payloadUtf8))
	fmt.Printf("keccak (hex) (len=%d): %x\n", len(keccak), keccak)
	binaryRepresentation := ""
	for _, b := range keccak {
		binaryRepresentation += fmt.Sprintf("%08b ", b)
	}
	fmt.Printf("Binary representation of keccak: %s\n", binaryRepresentation)
	keccakHex := fmt.Sprintf("%x", keccak)

	// nudged := customConversion("82f2421684ffafb2fba374c79fa3c718fe8cb4a082f5d4aa056c6565fc487e1b")
	// keccakNudgedHex := nudgeStrForSigning(keccakHex)
	// fmt.Printf("%s\n", keccakNudgedHex)
	// keccakNudged := hex.EncodeToString([]byte(keccakNudgedHex))
	// fmt.Printf("keccakHex: %s\n", keccakHex)
	// keccakBytes := hex.EncodeToString(keccak)
	// if err != nil {
	// 	fmt.Printf("Error decoding hex string: %v\n", err)
	// 	return
	// }
	// fmt.Printf("keccakBytes: %x\n", keccakBytes)
	// keccakUtf8 := string(keccak)
	// fmt.Printf("keccakUtf8: %s\n", keccakUtf8)
	fmt.Printf("sig len = %f\n", float64(len(sigHex))/2)
	keccakUtf8 := string(keccak)
	fmt.Printf("keccakUtf8 len: %d\n", len(keccakUtf8))

	// N.B. JavaScript .length uses a UTF-16 code unit count, not a byte count nor a rune count
	// So we need to count the number of UTF-16 code units in keccakUtf8
	// One way to approximate this in Go is to count the number of runes (which are UTF-32 code points)
	// This works because each rune will correspond to one or two UTF-16 code units
	// For our specific case, since the input is hex characters, each rune corresponds to one UTF-16 code unit
	// So we can use len([]rune(keccakUtf8)) to get the number of UTF-16 code units
	// However, this is not a perfect method for all possible strings, but it works for our specific case
	// For a more general solution, we would need to convert the string to UTF-16 and count the code units
	// But for our case, this suffices
	N := len([]rune(keccakUtf8))
	fmt.Printf("Number of UTF-16 code units: %d\n", len([]rune(keccakUtf8)))

	keccakPrefixedUtf8 := PrefixMessageToSign(keccakHex, N)
	fmt.Printf("keccakPrefixedUtf8: %s\n", keccakPrefixedUtf8)

	publicKeyHex := "03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787"
	publicKey, err := hiero.PublicKeyFromString(publicKeyHex)
	if err != nil {
		fmt.Printf("Error creating public key: %v\n", err)
		return
	}

	sig := make([]byte, len(sigHex)/2)
	_, err = hex.Decode(sig, []byte(sigHex))
	if err != nil {
		fmt.Printf("Error decoding signature hex: %v\n", err)
		return
	}

	isValid := publicKey.VerifySignedMessage([]byte(keccakPrefixedUtf8), sig)

	if isValid {
		fmt.Println("Signature is valid")
	} else {
		fmt.Println("Signature is invalid")
	}
}

func nudgeStrForSigning(keccakHex string) string {
	// Input keccakHex string
	// keccakHex := "82f2421684ffafb2fba374c79fa3c718fe8cb4a082f5d4aa056c6565fc487e1b"
	// returns: efbfbdefbfbd4216efbfbdefbfbdefbfbdefbfbdefbfbdefbfbd74c79fefbfbdefbfbd18efbfbdefbfbdefbfbdefbfbdefbfbdefbfbdd4aa056c6565efbfbd487e1b

	// Decode the hex string into bytes
	keccakBytes, err := hex.DecodeString(keccakHex)
	if err != nil {
		fmt.Printf("Error decoding hex string: %v\n", err)
		return ""
	}

	// Replace invalid UTF-8 sequences
	validUtf8Bytes := ReplaceInvalidUTF8(keccakBytes)

	// Convert the UTF-8 bytes back to a hex string
	validUtf8Hex := hex.EncodeToString(validUtf8Bytes)

	// Print the results
	// fmt.Printf("keccakHex: %s\n", keccakHex)
	// fmt.Printf("keccakUtf8 (hex): %s\n", validUtf8Hex)

	return validUtf8Hex
}

func PrefixMessageToSign(messageUtf8NotNudged string, N int) string {
	messageUtf8 := nudgeStrForSigning(messageUtf8NotNudged)

	fmt.Println("---- prefixMessageToSign -----")
	// fmt.Printf("hex representation of messageUtf8: %x\n", messageUtf8)
	fmt.Printf("nudged representation of keccakNudgedHex: %s\n", messageUtf8)

	// Convert the hex string messageUtf8 to a UTF-8 string
	messageStr, err := HexToUTF8(messageUtf8)
	if err != nil {
		fmt.Printf("Error converting hex to UTF-8: %v\n", err)
		return ""
	}
	messageUtf8NotNudgedBytes := []byte(messageUtf8NotNudged)
	fmt.Printf("%d\n", len(messageUtf8NotNudgedBytes))
	fmt.Printf("%d\n", len(messageUtf8))
	fmt.Printf("%d\n", len(messageStr))
	fmt.Printf("%d\n", len([]byte(messageUtf8NotNudged)))
	fmt.Printf("Converted messageUtf8 to string: %s\n", messageStr)

	// const binaryRepresentation = messageUtf8
	//   .split('')
	//   .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
	//   .join(' ')
	// console.log(`Binary representation of messageUtf8: ${binaryRepresentation}`)

	fmt.Println("---- END prefixMessageToSign -----")
	msg := fmt.Sprintf("\x19Hedera Signed Message:\n%d%s", N, messageStr)
	fmt.Printf("%d %d\n", N, len(msg))
	return msg
}

func ReplaceInvalidUTF8(input []byte) []byte {
	validUtf8 := make([]byte, 0, len(input))
	n := 0
	for len(input) > 0 {
		r, size := utf8.DecodeRune(input)
		if r == utf8.RuneError && size == 1 {
			// Replace invalid byte with the UTF-8 replacement character
			validUtf8 = append(validUtf8, []byte("\uFFFD")...)
			input = input[size:]
			n++
		} else {
			validUtf8 = append(validUtf8, input[:size]...)
			input = input[size:]
		}
	}
	fmt.Printf("*** Number of replaced invalid UTF-8 sequences: %d\n", n)
	return validUtf8
}

// HexToUTF8 converts a hex string to a UTF-8 string.
// Invalid byte sequences are replaced with the Unicode replacement character.
func HexToUTF8(hexStr string) (string, error) {
	// Decode the hex string into bytes
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return "", fmt.Errorf("failed to decode hex string: %w", err)
	}

	// Convert bytes to a UTF-8 string
	utf8Str := string(bytes)
	return utf8Str, nil
}

// UTF8ToHex converts a UTF-8 string back to a hex string.
func UTF8ToHex(utf8Str string) string {
	// Convert the UTF-8 string to bytes
	bytes := []byte(utf8Str)

	// Encode the bytes as a hex string
	hexStr := hex.EncodeToString(bytes)
	return hexStr
}
