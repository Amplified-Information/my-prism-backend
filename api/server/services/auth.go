package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
	"google.golang.org/grpc/metadata"
)

type AuthService struct {
	userRoleRepository *repositories.UserRoleRepository
}

func metadataKeys(md metadata.MD) []string {
	keys := make([]string, 0, len(md))
	for k := range md {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func maskTokenForLog(token string) string {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return "<empty>"
	}
	if len(trimmed) <= 18 {
		return trimmed
	}
	return trimmed[:12] + "..." + trimmed[len(trimmed)-6:]
}

func (a *AuthService) Init(d *repositories.UserRoleRepository) error {
	a.userRoleRepository = d

	lib.Log(lib.LOG_INFO, "Service: Auth service initialized successfully")
	return nil
}

func (as *AuthService) GetChallenge(accountId string, network string) (int64, error) {
	challenge, err := as.userRoleRepository.GetUserChallenge(accountId, network)
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "failed to get user challenge: %v", err)
	}

	// UpdateChallenge only do this after an authentication attempt (successful or not) to prevent DoS attacks where an attacker could flood the server with GetChallenge requests

	return challenge, nil
}

func (as *AuthService) UpdateChallenge(accountId hiero.AccountID, network string) (bool, error) {
	// Generate a high entropy random int64 challenge
	challengeBytes := make([]byte, 8)
	_, err := rand.Read(challengeBytes)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to generate random challenge: %v", err)
	}
	challenge := int64(binary.BigEndian.Uint64(challengeBytes))

	updated, err := as.userRoleRepository.UpdateUserChallenge(accountId.String(), network, challenge)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to update user challenge: %v", err)
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
	publicKey, _, err := lib.GetPublicKey(walletId, network) // keyType is implicit
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to get public key: %v", err)
	}

	// ensure payload has length > 5 and length < 2048
	if len(payload) < 5 || len(payload) > 2048 {
		return false, lib.LogAndError(lib.LOG_ERROR, "invalid payload length: %d", len(payload))
	}
	payloadHex := fmt.Sprintf("%x", payload)

	// it's not enough to just verify the signature on its own...
	// must also verify that the payload contains the correct challenge for this walletId and network
	challenge, err := as.GetChallenge(walletIdStr, network)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to get challenge: %v", err)
	}

	// check that the payload exactly matches the correct challenge
	if payload != fmt.Sprintf("%d", challenge) {
		return false, lib.LogAndError(lib.LOG_ERROR, "payload does not exactly match the correct challenge: %d", challenge)
	}

	// ensure sigBase64 is of type base64
	// protobuf enforces this

	// OK

	isOK, err := lib.VerifySig(publicKey, payloadHex, sigBase64)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to verify signature (publicKey=%s, payloadHex=%s, sigBase64=%s). Error: %v", publicKey, payloadHex, sigBase64, err)
	}
	if !isOK {
		return false, lib.LogAndError(lib.LOG_ERROR, "invalid signature (publicKey=%s, payloadHex=%s, sigBase64=%s)", publicKey, payloadHex, sigBase64)
	}

	// only return true if the signature is valid
	if isOK {
		lib.Log(lib.LOG_INFO, "sig OK - walletId: %s, network: %s", walletIdStr, network)

		// don't forget to update the challenge after a successful verification to prevent replay attacks// and update the challenge to a new random value for the next authentication attempt:
		isOK, err := as.UpdateChallenge(walletId, network)
		if err != nil || !isOK {
			return false, lib.LogAndError(lib.LOG_ERROR, "failed to update challenge: %v", err)
		}

		return true, nil
	}

	return false, lib.LogAndError(lib.LOG_ERROR, "invalid signature - unknown reason")
}

func (as *AuthService) HasRole(ctx context.Context, role lib.RolesType) bool {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		lib.Log(lib.LOG_INFO, "HasRole: no metadata in context; treating as anonymous. Checked for role: %s", role)
		return false
	} else {
		authHeaders := md.Get("authorization")
		if len(authHeaders) > 0 {
			token := authHeaders[0] // "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

			// 0. Extract the JWT token from the context
			var tokenString = ""
			parts := strings.Split(token, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			} else {
				lib.Log(
					lib.LOG_ERROR,
					"invalid authorization header format: role=%s raw_header=%q raw_header_masked=%s parts=%d metadata_keys=%v",
					role,
					token,
					maskTokenForLog(token),
					len(parts),
					metadataKeys(md),
				)
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
				lib.Log(
					lib.LOG_WARN,
					"invalid JWT token: role=%s err=%v token_masked=%s token_len=%d metadata_keys=%v",
					role,
					err,
					maskTokenForLog(tokenString),
					len(tokenString),
					metadataKeys(md),
				)
				return false
			}

			// 3. Validate the token and check if it is expired
			lib.Log(lib.LOG_INFO, "JWT claims: %+v", claims)
			exp, ok := claims["exp"].(float64)
			if !ok {
				lib.Log(lib.LOG_ERROR, "invalid exp claim in JWT token: role=%s exp_type=%T exp_value=%v claims=%+v", role, claims["exp"], claims["exp"], claims)
				return false
			}

			now := float64(time.Now().Unix())
			if exp < now {
				lib.Log(lib.LOG_ERROR, "JWT token has expired: role=%s exp=%v now=%v claims=%+v", role, exp, now, claims)
				return false
			}

			// 4. Check if the required role is in the user's roles
			rolesClaim, ok := claims["roles"].([]interface{})
			if !ok {
				lib.Log(lib.LOG_ERROR, "invalid roles claim in JWT token: role=%s roles_type=%T roles_value=%v claims=%+v", role, claims["roles"], claims["roles"], claims)
				return false
			}

			tokenHasRole := false
			for _, r := range rolesClaim {
				if roleStr, ok := r.(string); ok && roleStr == string(role) {
					tokenHasRole = true
					break
				}
			}
			if !tokenHasRole {
				lib.Log(lib.LOG_WARN, "required role %s not found in token roles: available_roles=%v accountId=%v network=%v", role, rolesClaim, claims["accountId"], claims["network"])
				return false
			}

			// 5. Let's also check the database for the user's role (e.g. revoked tokens won't work)
			// sig check may not be sufficient on its own?
			// Can I remove the db check completely? (stateless auth)
			if as.userRoleRepository == nil {
				lib.Log(lib.LOG_ERROR, "HasRole: userRoleRepository is nil; cannot verify DB role accountId=%v network=%v required_role=%s", claims["accountId"], claims["network"], role)
				return false
			}

			accountIdClaim, ok := claims["accountId"].(string)
			if !ok || strings.TrimSpace(accountIdClaim) == "" {
				lib.Log(lib.LOG_ERROR, "invalid accountId claim in JWT token: required_role=%s accountId_type=%T accountId_value=%v claims=%+v", role, claims["accountId"], claims["accountId"], claims)
				return false
			}

			networksToCheck := []string{}
			networkClaim, ok := claims["network"].(string)
			networkClaim = strings.ToLower(strings.TrimSpace(networkClaim))
			if ok && networkClaim != "" && lib.IsValidNetwork(networkClaim) {
				networksToCheck = append(networksToCheck, networkClaim)
			} else {
				// Backward-compatible path for legacy JWTs that omit network.
				// TODO - remove this fallback completely - network should be included in the JWT for all future tokens.
				// For now, we will check all networks if the network claim is missing or invalid.
				networksToCheck = append(networksToCheck, string(lib.TESTNET), string(lib.MAINNET), string(lib.PREVIEWNET))
				lib.Log(lib.LOG_WARN, "JWT missing/invalid network claim; falling back to DB role lookup across all networks: required_role=%s accountId=%s network_type=%T network_value=%v", role, accountIdClaim, claims["network"], claims["network"])
			}

			for _, net := range networksToCheck {
				dbRoles, err := as.userRoleRepository.GetRolesByUserAndNetwork(accountIdClaim, net)
				if err != nil {
					lib.Log(lib.LOG_WARN, "DB role lookup failed for one network: accountId=%s network=%s required_role=%s err=%v", accountIdClaim, net, role, err)
					continue
				}

				for _, dbRole := range dbRoles {
					if dbRole == string(role) {
						/////
						// Authorized
						/////
						return true
					}
				}
			}
			lib.Log(lib.LOG_WARN, "required role %s not found in DB roles: accountId=%s checked_networks=%v", role, accountIdClaim, networksToCheck)

			return false
		}

		// lib.Log(lib.LOG_ERROR, "HasRole: missing authorization header for required role=%s metadata_keys=%v", role, metadataKeys(md))
	}

	return false
}

func (as *AuthService) GetRoles(ctx context.Context, accountId string, network string) ([]string, error) {
	return as.userRoleRepository.GetRolesByUserAndNetwork(accountId, network)
}
