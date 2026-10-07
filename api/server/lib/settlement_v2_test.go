package lib

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"testing"

	"github.com/google/uuid"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

// Reference values in this file were produced independently with ethers v6
// (AbiCoder / Interface.encodeFunctionData), not with this package.

func goldenBidAsk(t *testing.T) (AuthorizationV2, AuthorizationV2) {
	t.Helper()
	const market = "01890f3e-7c10-7cc1-98bc-0242ac120002"
	bid, err := NewAuthorizationV2(296, "1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222", market, "01890f3e-7c10-7cc1-98bc-0242ac120003", 0, 0, 625000, 10_000_000, 6_250_000, 2_000_000_000)
	if err != nil {
		t.Fatal(err)
	}
	ask, err := NewAuthorizationV2(296, "0x1111111111111111111111111111111111111111", "3333333333333333333333333333333333333333", market, "01890f3e-7c10-7cc1-98bc-0242ac120004", 1, 0, 600000, 4_000_000, 1_600_000, 2_000_000_000)
	if err != nil {
		t.Fatal(err)
	}
	return bid, ask
}

func TestAuthorizationV2StructHashMatchesEthers(t *testing.T) {
	bid, _ := goldenBidAsk(t)
	hash, err := bid.StructHash()
	if err != nil {
		t.Fatal(err)
	}
	if got, want := hex.EncodeToString(hash), "29ab294f817112bc815c5cc131ca9375e9e8bd7b935fb41bedaad2557f9f36c0"; got != want {
		t.Fatalf("struct hash\n got %s\nwant %s", got, want)
	}
	msg, err := bid.SigningMessage()
	if err != nil {
		t.Fatal(err)
	}
	if got, want := hex.EncodeToString(msg), "19486564657261205369676e6564204d6573736167653a0a34344b617370543446784572794258467a424d63715464656e6f76587554583751623761725356582b664e73413d"; got != want {
		t.Fatalf("signing message\n got %s\nwant %s", got, want)
	}
}

func TestMatchIDMatchesEthers(t *testing.T) {
	bid, ask := goldenBidAsk(t)
	id, err := MatchID(bid.VerifyingContract, bid.MarketID, bid.TxID, ask.TxID, 0, 0, 4_000_000, 600000)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := hex.EncodeToString(id[:]), "8b314feec224c594f69c4a6ce1788f8680dea143587a3e87228b902701a9ff61"; got != want {
		t.Fatalf("match id\n got %s\nwant %s", got, want)
	}
	other, _ := MatchID(bid.VerifyingContract, bid.MarketID, bid.TxID, ask.TxID, 4_000_000, 0, 4_000_000, 600000)
	if other == id {
		t.Fatal("a later fill of the same pair must produce a different match id")
	}
}

func TestEncodeSettleCalldataMatchesEthers(t *testing.T) {
	bid, ask := goldenBidAsk(t)
	id, _ := MatchID(bid.VerifyingContract, bid.MarketID, bid.TxID, ask.TxID, 0, 0, 4_000_000, 600000)
	sigA := bytes.Repeat([]byte{0xab}, 70)
	sigB := bytes.Repeat([]byte{0xcd}, 3)
	got, err := EncodeSettleCalldata(bid, sigA, ask, sigB, 4_000_000, 600000, id)
	if err != nil {
		t.Fatal(err)
	}
	want := "f08faeed" +
		"0000000000000000000000000000000000000000000000000000000000000002" +
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
		"0000000000000000000000000000000000000000000000000000000077359400" +
		"00000000000000000000000000000000000000000000000000000000000003a0" +
		"0000000000000000000000000000000000000000000000000000000000000002" +
		"0000000000000000000000000000000000000000000000000000000000000128" +
		"0000000000000000000000001111111111111111111111111111111111111111" +
		"0000000000000000000000003333333333333333333333333333333333333333" +
		"0000000000000000000000000000000001890f3e7c107cc198bc0242ac120002" +
		"0000000000000000000000000000000001890f3e7c107cc198bc0242ac120004" +
		"0000000000000000000000000000000000000000000000000000000000000001" +
		"0000000000000000000000000000000000000000000000000000000000000000" +
		"00000000000000000000000000000000000000000000000000000000000927c0" +
		"00000000000000000000000000000000000000000000000000000000003d0900" +
		"0000000000000000000000000000000000000000000000000000000000186a00" +
		"0000000000000000000000000000000000000000000000000000000077359400" +
		"0000000000000000000000000000000000000000000000000000000000000420" +
		"00000000000000000000000000000000000000000000000000000000003d0900" +
		"00000000000000000000000000000000000000000000000000000000000927c0" +
		"8b314feec224c594f69c4a6ce1788f8680dea143587a3e87228b902701a9ff61" +
		"0000000000000000000000000000000000000000000000000000000000000046" +
		strings.Repeat("ab", 70) + strings.Repeat("00", 26) +
		"0000000000000000000000000000000000000000000000000000000000000003" +
		"cdcdcd" + strings.Repeat("00", 29)
	if hex.EncodeToString(got) != want {
		t.Fatalf("settle calldata mismatch\n got %s\nwant %s", hex.EncodeToString(got), want)
	}
}

func TestSplitCollateralMirrorsContractRounding(t *testing.T) {
	yes, no, err := SplitCollateral(4_000_000, 600000)
	if err != nil || yes != 2_400_000 || no != 1_600_000 {
		t.Fatalf("got yes=%d no=%d err=%v", yes, no, err)
	}
	// floor on the YES leg: 7 * 333333 / 1e6 = 2.33 -> 2, NO pays 5
	yes, no, err = SplitCollateral(7, 333333)
	if err != nil || yes != 2 || no != 5 {
		t.Fatalf("got yes=%d no=%d err=%v", yes, no, err)
	}
	if _, _, err = SplitCollateral(1, 500000); err == nil {
		t.Fatal("a fill where one leg pays zero must be rejected (the contract reverts InvalidFill)")
	}
	if _, _, err = SplitCollateral(10, 1_000_000); err == nil {
		t.Fatal("price must be below PRICE_SCALE")
	}
	// no overflow for very large fills
	yes, no, err = SplitCollateral(^uint64(0), 999999)
	if err != nil || yes+no != ^uint64(0) {
		t.Fatalf("large fill: yes=%d no=%d err=%v", yes, no, err)
	}
}

func TestBidAskClassificationAndLimits(t *testing.T) {
	cases := []struct {
		side   Side
		action Action
		bid    bool
	}{{SideYES, ActionBUY, true}, {SideNO, ActionSELL, true}, {SideYES, ActionSELL, false}, {SideNO, ActionBUY, false}}
	for _, c := range cases {
		if IsBid(c.side, c.action) != c.bid {
			t.Fatalf("side=%d action=%d: IsBid=%t", c.side, c.action, !c.bid)
		}
	}
	if CheckLimit(SideYES, ActionBUY, 600000, 600001) == nil {
		t.Fatal("bid must reject a price above its limit")
	}
	if CheckLimit(SideNO, ActionBUY, 600000, 599999) == nil {
		t.Fatal("ask must reject a price below its limit")
	}
	if CheckLimit(SideNO, ActionSELL, 600000, 600000) != nil || CheckLimit(SideYES, ActionSELL, 600000, 600000) != nil {
		t.Fatal("price equal to the limit must be accepted")
	}
}

func TestNewAuthorizationV2RejectsZeroBuyCap(t *testing.T) {
	_, err := NewAuthorizationV2(296, "1111111111111111111111111111111111111111", "2222222222222222222222222222222222222222", uuid.NewString(), uuid.NewString(), 0, 0, 500000, 1_000_000, 0, 2_000_000_000)
	if err == nil {
		t.Fatal("expected a zero collateral cap on a BUY to be rejected")
	}
}

func TestVerifySignatureAgainstHederaFraming(t *testing.T) {
	bid, _ := goldenBidAsk(t)
	message, err := bid.SigningMessage()
	if err != nil {
		t.Fatal(err)
	}
	for _, generate := range []func() (hiero.PrivateKey, error){hiero.PrivateKeyGenerateEd25519, hiero.PrivateKeyGenerateEcdsa} {
		key, err := generate()
		if err != nil {
			t.Fatal(err)
		}
		pub := key.PublicKey()
		sig := key.Sign(message)
		ok, err := bid.VerifySignature(&pub, encodeB64(sig))
		if err != nil || !ok {
			t.Fatalf("valid signature rejected: ok=%t err=%v", ok, err)
		}
		tampered := bid
		tampered.CollateralCap = bid.QtyShares
		if ok, _ := tampered.VerifySignature(&pub, encodeB64(sig)); ok {
			t.Fatal("signature must not verify for a different authorization")
		}
	}
}

func encodeB64(b []byte) string { return base64.StdEncoding.EncodeToString(b) }

func TestReadSelectorsMatchEthers(t *testing.T) {
	cases := map[string]string{
		"markets(uint128)":            "3d3e49fc",
		"yesBalance(uint128,address)": "95758d7f",
		"noBalance(uint128,address)":  "64a08777",
		"executedMatches(bytes32)":    "ccf44e05",
	}
	for sig, want := range cases {
		if got := hex.EncodeToString(selector(sig)); got != want {
			t.Fatalf("%s selector = %s, want %s", sig, got, want)
		}
	}
}
