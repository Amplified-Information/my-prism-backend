package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
	"google.golang.org/grpc/metadata"
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
		as.log.Log(INFO, "sig OK - walletId: %s, network: %s", walletIdStr, network)
		return true, nil
	}

	return false, as.log.Log(ERROR, "invalid signature - unknown reason")
}

func (as *AuthService) HasRole(ctx context.Context, role lib.RolesType) bool {
	md, ok := metadata.FromIncomingContext(ctx)
	if ok {
		authHeaders := md.Get("authorization")
		if len(authHeaders) > 0 {
			token := authHeaders[0] // "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

			// 0. Extract the JWT token from the context
			var tokenString = ""
			parts := strings.Split(token, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			} else {
				as.log.Log(ERROR, "invalid authorization header format")
				return false
			}

			// 1. Validate sig and parse the token and extract the user's claims
			// fmt.Println("JWT_SECRET env:", os.Getenv("JWT_SECRET")) // Debug
			claims := jwt.MapClaims{}
			tok, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
				// fmt.Println("Verifying with secret:", os.Getenv("JWT_SECRET")) // Debug
				// fmt.Println("tokenSting: ", tokenString)                       // Debug
				return []byte(os.Getenv("JWT_SECRET")), nil
			})
			if err != nil || !tok.Valid {
				as.log.Log(ERROR, "invalid JWT token: %v", err)
				return false
			}

			// 3. Validate the token and check if it is expired
			as.log.Log(INFO, "JWT claims: %+v", claims)
			exp, ok := claims["exp"].(float64)
			if !ok {
				as.log.Log(ERROR, "invalid exp claim in JWT token")
				return false
			}

			now := float64(time.Now().Unix())
			if exp < now {
				as.log.Log(ERROR, "JWT token has expired")
				return false
			}

			// 4. Check if the required role is in the user's roles
			rolesClaim, ok := claims["roles"].([]interface{})
			if !ok {
				as.log.Log(ERROR, "invalid roles claim in JWT token")
				return false
			}

			for _, r := range rolesClaim {
				if roleStr, ok := r.(string); ok && roleStr == string(role) {
					return true
				}
			}
			as.log.Log(ERROR, "required role %s not found in user's roles", role)

			// 5. Let's also check the database for the user's role (e.g. revoked tokens won't work)
			// TODO - may not be needed - sig check sufficient
			// as.userRoleRepository.Get(claims["sub"].(string), claims["network"].(string))

			as.log.Log(INFO, "User logged in OK %s", claims["accountId"].(string))
			return true
		}
	}

	return false
}

func (as *AuthService) GetRoles(ctx context.Context, accountId string, network string) ([]string, error) {
	return as.userRoleRepository.GetRolesByUserAndNetwork(accountId, network)
}
