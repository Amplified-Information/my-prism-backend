package lib

import (
	"encoding/hex"
	"math/big"
	"testing"

	"github.com/google/uuid"
)

func TestAuthorizationV2GoldenABIEncoding(t *testing.T) {
	market := uuid.MustParse("01890f3e-7c10-7cc1-98bc-0242ac120002")
	tx := uuid.MustParse("01890f3e-7c10-7cc1-98bc-0242ac120003")
	a := AuthorizationV2{
		Version: 2, ChainID: big.NewInt(296),
		VerifyingContract: "0x1111111111111111111111111111111111111111",
		Signer: "0x2222222222222222222222222222222222222222",
		MarketID: market, TxID: tx, Side: SideYES, Action: ActionBUY,
		LimitYesPrice: big.NewInt(625000), QtyShares: big.NewInt(10_000_000),
		CollateralCap: big.NewInt(6_250_000), Deadline: 2_000_000_000,
	}
	got, err := a.ABIEncode()
	if err != nil { t.Fatal(err) }
	want := "0000000000000000000000000000000000000000000000000000000000000002" +
		"0000000000000000000000000000000000000000000000000000000000000128" +
		"0000000000000000000000001111111111111111111111111111111111111111" +
		"0000000000000000000000002222222222222222222222222222222222222222" +
		"0000000000000000000000000000000001890f3e7c107cc198bc0242ac120002" +
		"0000000000000000000000000000000001890f3e7c107cc198bc0242ac120003" +
		"0000000000000000000000000000000000000000000000000000000000000000" +
		"0000000000000000000000000000000000000000000000000000000000000000" +
		"0000000000000000000000000000000000000000000000000000000000098968" +
		"0000000000000000000000000000000000000000000000000000000000989680" +
		"00000000000000000000000000000000000000000000000000000000005f5e10" +
		"0000000000000000000000000000000000000000000000000000000077359400"
	if hex.EncodeToString(got) != want { t.Fatalf("encoding mismatch\n got %s\nwant %s", hex.EncodeToString(got), want) }
}

func TestAuthorizationV2RejectsExpiredAndOutOfRangePrice(t *testing.T) {
	a := AuthorizationV2{Version: 2, ChainID: big.NewInt(1), VerifyingContract: "1111111111111111111111111111111111111111", Signer: "2222222222222222222222222222222222222222", MarketID: uuid.New(), TxID: uuid.New(), LimitYesPrice: big.NewInt(1_000_001), QtyShares: big.NewInt(1), CollateralCap: big.NewInt(1), Deadline: 5}
	if err := a.Validate(1); err == nil { t.Fatal("expected out-of-range price error") }
	a.LimitYesPrice = big.NewInt(1)
	if err := a.Validate(5); err == nil { t.Fatal("expected expiry error") }
}

func TestAuthorizationV2HederaSigningFrame(t *testing.T) {
	a := AuthorizationV2{
		Version: 2, ChainID: big.NewInt(296),
		VerifyingContract: "0x1111111111111111111111111111111111111111",
		Signer: "0x2222222222222222222222222222222222222222",
		MarketID: uuid.MustParse("01890f3e-7c10-7cc1-98bc-0242ac120002"),
		TxID: uuid.MustParse("01890f3e-7c10-7cc1-98bc-0242ac120003"),
		Side: SideYES, Action: ActionBUY, LimitYesPrice: big.NewInt(625000),
		QtyShares: big.NewInt(10_000_000), CollateralCap: big.NewInt(6_250_000),
		Deadline: 2_000_000_000,
	}
	hash, err := a.StructHash()
	if err != nil { t.Fatal(err) }
	if len(hash) != 32 { t.Fatalf("hash length = %d, want 32", len(hash)) }
	message, err := a.SigningMessage()
	if err != nil { t.Fatal(err) }
	const prefix = "\x19Hedera Signed Message:\n44"
	if len(message) != len(prefix)+44 { t.Fatalf("message length = %d", len(message)) }
	if string(message[:len(prefix)]) != prefix { t.Fatalf("unexpected signing prefix") }
}
