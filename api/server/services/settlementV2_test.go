package services

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"testing"

	"api/gen/sqlc"
	"api/server/lib"

	"github.com/google/uuid"
	"github.com/hiero-ledger/hiero-sdk-go/v2/proto/services"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
	protobuf "google.golang.org/protobuf/proto"
)

// signedIntentRow builds a persisted order exactly as CreateOrderIntentRequestWithOutbox stores it.
func signedIntentRow(t *testing.T, key hiero.PrivateKey, keyType lib.HederaKeyType) (*sqlc.PredictionIntent, lib.AuthorizationV2) {
	t.Helper()
	marketID := uuid.MustParse("01890f3e-7c10-7cc1-98bc-0242ac120002")
	txID := uuid.MustParse("01890f3e-7c10-7cc1-98bc-0242ac120009")
	auth, err := lib.NewAuthorizationV2(296, "1111111111111111111111111111111111111111", "2222222222222222222222222222222222222222", marketID.String(), txID.String(), 1, 0, 400000, 5_000_000, 3_000_000, 2_000_000_000)
	if err != nil {
		t.Fatal(err)
	}
	message, err := auth.SigningMessage()
	if err != nil {
		t.Fatal(err)
	}
	return &sqlc.PredictionIntent{
		TxID:              txID,
		Net:               "testnet",
		MarketID:          marketID,
		AccountID:         "0.0.1234",
		Sig:               base64.StdEncoding.EncodeToString(key.Sign(message)),
		PublicKeyHex:      key.PublicKey().StringRaw(),
		Evmaddress:        "2222222222222222222222222222222222222222",
		Keytype:           int32(keyType),
		ProtocolVersion:   2,
		ChainID:           sql.NullInt64{Int64: 296, Valid: true},
		VerifyingContract: sql.NullString{String: "1111111111111111111111111111111111111111", Valid: true},
		Side:              sql.NullInt16{Int16: 1, Valid: true},
		Action:            sql.NullInt16{Int16: 0, Valid: true},
		LimitYesPrice:     sql.NullInt64{Int64: 400000, Valid: true},
		QtyShares:         sql.NullString{String: "5000000", Valid: true},
		CollateralCap:     sql.NullString{String: "3000000", Valid: true},
		Deadline:          sql.NullInt64{Int64: 2_000_000_000, Valid: true},
		SharesFilled:      "1000000",
		CollateralFilled:  "600000",
	}, auth
}

func TestAuthorizationFromIntentRebuildsTheSignedHash(t *testing.T) {
	key, err := hiero.PrivateKeyGenerateEd25519()
	if err != nil {
		t.Fatal(err)
	}
	row, signed := signedIntentRow(t, key, lib.KEY_TYPE_ED25519)
	rebuilt, err := authorizationFromIntent(row)
	if err != nil {
		t.Fatal(err)
	}
	want, _ := signed.StructHash()
	got, _ := rebuilt.StructHash()
	if !bytes.Equal(got, want) {
		t.Fatal("authorization rebuilt from the database must hash to what the user signed")
	}
	pub := key.PublicKey()
	if ok, err := rebuilt.VerifySignature(&pub, row.Sig); err != nil || !ok {
		t.Fatalf("persisted signature must verify against the rebuilt authorization: ok=%t err=%v", ok, err)
	}

	row.LimitYesPrice.Valid = false
	if _, err := authorizationFromIntent(row); err == nil {
		t.Fatal("a row without V2 fields must be rejected")
	}
}

func TestClobOrderAndResponseCarryFillState(t *testing.T) {
	key, _ := hiero.PrivateKeyGenerateEd25519()
	row, _ := signedIntentRow(t, key, lib.KEY_TYPE_ED25519)
	order, err := clobOrderFromIntent(row)
	if err != nil {
		t.Fatal(err)
	}
	if order.Side != 1 || order.Action != 0 || order.LimitYesPrice != 400000 || order.QtyShares != 5_000_000 ||
		order.CollateralCap != 3_000_000 || order.SharesFilled != 1_000_000 || order.CollateralFilled != 600000 ||
		order.ChainId != 296 || order.VerifyingContract != "1111111111111111111111111111111111111111" {
		t.Fatalf("unexpected CLOB order: %+v", order)
	}
	resp, err := predictionIntentResponseFromRow(row)
	if err != nil {
		t.Fatal(err)
	}
	if resp.SharesFilled != 1_000_000 || resp.QtyShares != 5_000_000 || resp.Side != 1 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestSignatureMapWrapsTheRawSignatureForHAS(t *testing.T) {
	for _, tc := range []struct {
		generate func() (hiero.PrivateKey, error)
		keyType  lib.HederaKeyType
	}{{hiero.PrivateKeyGenerateEd25519, lib.KEY_TYPE_ED25519}, {hiero.PrivateKeyGenerateEcdsa, lib.KEY_TYPE_ECDSA}} {
		key, err := tc.generate()
		if err != nil {
			t.Fatal(err)
		}
		row, _ := signedIntentRow(t, key, tc.keyType)
		blob, err := signatureMap(row)
		if err != nil {
			t.Fatal(err)
		}
		var sigMap services.SignatureMap
		if err := protobuf.Unmarshal(blob, &sigMap); err != nil || len(sigMap.SigPair) != 1 {
			t.Fatalf("invalid SignatureMap: %v", err)
		}
		raw, _ := base64.StdEncoding.DecodeString(row.Sig)
		pair := sigMap.SigPair[0]
		var got []byte
		if tc.keyType == lib.KEY_TYPE_ED25519 {
			got = pair.GetEd25519()
		} else {
			got = pair.GetECDSASecp256K1()
		}
		if !bytes.Equal(got, raw) {
			t.Fatalf("key type %d: SignatureMap must carry the raw signature", tc.keyType)
		}
	}
}
