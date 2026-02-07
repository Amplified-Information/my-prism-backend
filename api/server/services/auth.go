package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"context"
	"crypto/rand"
	"encoding/binary"

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
		return 0, err
	}
	return challenge, nil
}

func (as *AuthService) UpdateChallenge(accountId string, network string) (bool, error) {
	// Generate a high entropy random int64 challenge
	challengeBytes := make([]byte, 8)
	_, err := rand.Read(challengeBytes)
	if err != nil {
		return false, err
	}
	challenge := int64(binary.BigEndian.Uint64(challengeBytes))

	updated, err := as.userRoleRepository.UpdateUserChallenge(accountId, network, challenge)
	if err != nil {
		return false, err
	}
	return updated, nil
}

func (as *AuthService) VerifyChallenge(walletIdStr string, network string, sig string) (bool, error) {
	walletId, err := hiero.AccountIDFromString(walletIdStr)
	if err != nil {
		return false, err
	}

	// look up the public key from the walletId and network
	publicKey, _, err := as.hederaService.GetPublicKey(walletId, network)
	if err != nil {
		return false, as.log.Log(ERROR, "failed to get public key: %v", err)
	}

	// retrieve the challenge for the walletId and network from the database
	challenge, err := as.userRoleRepository.GetUserChallenge(walletIdStr, network)
	if err != nil {
		return false, as.log.Log(ERROR, "failed to get user challenge: %v", err)
	}

	// verify the signature of the challenge using the public key
	isValid := publicKey.VerifySignedMessage([]byte(string(challenge)), []byte(sig))
	if !isValid {
		return false, as.log.Log(ERROR, "invalid signature")
	}

	// return true if the signature is valid, false otherwise
	return true, nil
}

func (as *AuthService) HasRole(ctx context.Context, role lib.RolesType) bool {
	// TODO
	// Extract the JWT token from the context
	// Parse the token and extract the user's roles
	// Validate the token and check if it is expired
	// Check if the required role is in the user's roles
	return false
}
