package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type AuthService struct {
	log                *LogService
	userRoleRepository *repositories.UserRoleRepository

	hederaService *HederaService
}

func (a *AuthService) Init(log *LogService, d *repositories.UserRoleRepository, h *HederaService) error {
	a.log = log
	a.userRoleRepository = d
	a.hederaService = h

	a.log.Log(INFO, "Service: Auth service initialized successfully")
	return nil
}

func (as *AuthService) GetChallenge(accountId string, network string) (int64, error) {
	challenge, err := as.userRoleRepository.GetUserChallenge(accountId, network)
	if err != nil {
		return 0, as.log.Log(ERROR, "failed to get user challenge: %v", err)
	}

	// TODO - no, only do this after an authentication attempt (successful or not) to prevent DoS attacks where an attacker could flood the server with GetChallenge requests
	// and update the challenge to a new random value for the next authentication attempt:
	// isOK, err := as.UpdateChallenge(accountId, network)
	// if err != nil || !isOK {
	// 	return 0, as.log.Log(ERROR, "failed to update challenge: %v", err)
	// }

	return challenge, nil
}

func (as *AuthService) UpdateChallenge(accountId string, network string) (bool, error) {
	// Generate a high entropy random int64 challenge
	challengeBytes := make([]byte, 8)
	_, err := rand.Read(challengeBytes)
	if err != nil {
		return false, as.log.Log(ERROR, "failed to generate random challenge: %v", err)
	}
	challenge := int64(binary.BigEndian.Uint64(challengeBytes))

	updated, err := as.userRoleRepository.UpdateUserChallenge(accountId, network, challenge)
	if err != nil {
		return false, as.log.Log(ERROR, "failed to update user challenge: %v", err)
	}
	return updated, nil
}

func (as *AuthService) VerifyChallenge(walletIdStr string, network string, sigBase64 string, payload string) (bool, error) {
	// guards
	walletId, err := hiero.AccountIDFromString(walletIdStr)
	if err != nil {
		return false, err
	}

	// look up the public key from the walletId and network
	publicKey, _, err := as.hederaService.GetPublicKey(walletId, network) // keyType is implicit
	if err != nil {
		return false, as.log.Log(ERROR, "failed to get public key: %v", err)
	}

	// ensure payload has length > 5 and length < 2048
	if len(payload) < 5 || len(payload) > 2048 {
		return false, as.log.Log(ERROR, "invalid payload length: %d", len(payload))
	}
	payloadHex := fmt.Sprintf("%x", payload)

	// ensure sigBase64 is of type base64
	// protobuf enforces this

	// OK

	isOK, err := lib.VerifySig(publicKey, payloadHex, sigBase64)
	if err != nil {
		return false, as.log.Log(ERROR, "failed to verify signature: %v", err)
	}
	if !isOK {
		return false, as.log.Log(ERROR, "invalid signature")
	}

	// only return true if the signature is valid
	if isOK {
		return true, nil
	}

	return false, as.log.Log(ERROR, "invalid signature - unknown reason")
	// var publicKeyHex = "03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787"
	// // var sigHex = "c16d1016ab110e4c8ad33cfa10d334dadc192dedf39df15af79c3f64bbd217a334444e7ac3821f9271492d98a425fc55f0bc833ace3a2275c123dfeaaf227a1e"
	// var sigBase64 = "wW0QFqsRDkyK0zz6ENM02twZLe3znfFa95w/ZLvSF6M0RE56w4IfknFJLZikJfxV8LyDOs46InXBI9/qryJ6Hg=="
	// // var payload = ""
	// // var keccakHex = "0x9824e68c38df027394be5abb0d396def93d09589fd8073d1757858b5da88eba3"

	// publicKey, err := hiero.PublicKeyFromStringECDSA(publicKeyHex)
	// if err != nil {
	// 	log.Fatalf("Failed to parse public key: %v", err)
	// }

	// var payloadHex = fmt.Sprintf("%x", "1770462418776")
	// log.Printf("payloadHex: %s", payloadHex)

	// // payload, err := lib.Hex2utf8("1770462418776")
	// // keccak := lib.Keccak256([]byte(payload))
	// // log.Printf("keccak (hex) calc'd on back-end: %x", keccak)
	// // log.Printf(keccakHex)

	// result, err := lib.VerifySig(&publicKey, payloadHex, sigBase64)
	// log.Printf("Signature valid: %v, error: %v", result, err)

	// retrieve the challenge for the walletId and network from the database
	// challenge, err := as.userRoleRepository.GetUserChallenge(walletIdStr, network)
	// if err != nil {
	// 	return false, as.log.Log(ERROR, "failed to get user challenge: %v", err)
	// }

	// // verify the signature of the challenge using the public key
	// // Convert int64 challenge to []byte
	// challengeBytes := make([]byte, 8)
	// binary.BigEndian.PutUint64(challengeBytes, uint64(challenge))
	// as.log.Log(INFO, "Verifying signature (%s) for walletId: %s on network: %s with challenge: %d", sig, walletIdStr, network, challenge)
	// sigUtf8, err := lib.Hex2utf8(sig)
	// if err != nil {
	// 	return false, as.log.Log(ERROR, "failed to decode signature: %v", err)
	// }
	// isValid := publicKey.VerifySignedMessage(challengeBytes, []byte(sigUtf8))
	// if !isValid {
	// 	return false, as.log.Log(ERROR, "invalid signature")
	// }

	// // return true if the signature is valid, false otherwise
	// return true, nil
}

func (as *AuthService) HasRole(ctx context.Context, role lib.RolesType) bool {
	// TODO
	// Extract the JWT token from the context
	// Parse the token and extract the user's roles
	// Validate the token and check if it is expired
	// Check if the required role is in the user's roles
	return false
}

func (as *AuthService) GetRoles(ctx context.Context, accountId string, network string) ([]string, error) {
	return as.userRoleRepository.GetRolesByUserAndNetwork(accountId, network)
}
