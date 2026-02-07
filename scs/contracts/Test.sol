// SPDX-License-Identifier: MIT
// compile with:
// solcjs ./contracts/Sig.sol --bin --base-path ./node_modules/ -o ./contracts/out && cd contracts/out && for f in *.bin; do [ -e \"$f\" ] || continue; new=\"${f##*_}\"; [ \"$f\" = \"$new\" ] && continue; mv -f -- \"$f\" \"$new\"; done && ls -altr .
// then do:
// ts-node 0_deploy.ts
// then run:
// ts-node onChainVerify4.ts

pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "../node_modules/@openzeppelin/contracts/utils/Base64.sol";

// Simple Hedera Token Service (HTS) precompile interface (testnet/mainnet share the same precompile)
// https://github.com/hashgraph/hedera-smart-contracts/blob/main/contracts/system-contracts/hedera-account-service/IHederaAccountService.sol
interface IHederaAccountService {
  /// Determines if the signature is valid for the given message hash and account.
  /// It is assumed that the signature is composed of a single EDCSA or ED25519 key.
  /// @param account The account to check the signature against.
  /// @param messageHash The hash of the message to check the signature against.
  /// @param signature The signature to check.
  /// @return responseCode The response code for the status of the request.  SUCCESS is 22.
  /// @return authorized True if the signature is valid, false otherwise.
  function isAuthorizedRaw(
    address account,
    bytes memory messageHash,
    bytes memory signature
  ) external returns (int64 responseCode, bool authorized);

  /// Determines if the signature is valid for the given message and account.
  /// It is assumed that the signature is composed of a possibly complex cryptographic key.
  /// @param account The account to check the signature against.
  /// @param message The message to check the signature against.
  /// @param signature The signature to check encoded as bytes.
  /// @return responseCode The response code for the status of the request.  SUCCESS is 22.
  /// @return authorized True if the signature is valid, false otherwise.
  function isAuthorized(
    address account,
    bytes memory message,
    bytes memory signature
  ) external returns (int64 responseCode, bool authorized);
}

contract Test {
  IHederaAccountService constant HAS = IHederaAccountService(address(0x16a));

  address owner;

  event AccountAuthorizationResponse(int64 responseCode, address account, bool response);

  constructor() {
    owner = msg.sender;
  }

  /// @notice Verifies if a signature was signed by the account's key(s)
  /// @param account The account address to verify the signature against
  /// @param messageHash The hash of the message that was signed
  /// @param signature The signature to verify
  /// @return responseCode The response code indicating success or failure
  /// @return authorized True if the signature is valid for the account, false otherwise
  function isAuthorizedRawPublic(address account, bytes memory messageHash, bytes memory signature) public returns (int64 responseCode, bool authorized) {
    (responseCode, authorized) = HAS.isAuthorizedRaw(account, messageHash, signature);
    if (responseCode != 22) { // 22 = SUCCESS, HederaResponseCodes.sol
      revert("isAuthorizedRawPublic not a SUCCESS");
    }
    emit AccountAuthorizationResponse(responseCode, account, authorized);
  }

  // function isAuthorizedRawPublic(address account, bytes memory messageHash, bytes memory signature) public returns(bool success, bytes memory result) {
  //   (success, result) = address(0x16a).call(abi.encodeWithSelector(IHederaAccountService.isAuthorizedRaw.selector, account, messageHash, signature));
  // }

  /// Determines if the signature is valid for the given message and account.
  /// It is assumed that the signature is composed of a possibly complex cryptographic key.
  /// @param account The account to check the signature against.
  /// @param message The message to check the signature against.
  /// @param signature The signature to check encoded as bytes.
  /// @return responseCode The response code for the status of the request.  SUCCESS is 22.
  /// @return authorized True if the signature is valid, false otherwise.
  function isAuthorizedPublic(address account, bytes memory message, bytes memory signature) public returns (int64 responseCode, bool authorized) {
    (responseCode, authorized) = HAS.isAuthorized(account, message, signature);
    if (responseCode != 22) { // 22 = SUCCESS, HederaResponseCodes.sol
      revert();
    }
    emit AccountAuthorizationResponse(responseCode, account, authorized);
  }

  function hello() external pure returns (string memory) {
    return "Hello, Hedera!";
  }

  function test(
    uint128 marketId,
    address signerYes,
    uint256 collateralUsdAbsScaled,
    uint128 txIdYes,
    bytes calldata sigYes
  ) external returns (uint8){
    require(isAuthorizedPublicWrapper(signerYes, prefixMessageToSign(keccak256(abi.encodePacked(collateralUsdAbsScaled, marketId, txIdYes))), sigYes), "isAuthorized YES failed");

    return 0x17;
  }

  // TODO - delete
  function prefixMessageToSign(bytes32 messageHash) public pure returns (bytes memory) {
      return abi.encodePacked("\x19Hedera Signed Message:\n", messageHash.length, messageHash);
  }

  function prefixMessageFixed40(string memory messageHashBase64) public pure returns (bytes memory) {
      return abi.encodePacked("\x19Hedera Signed Message:\n40", messageHashBase64);
  }

  // TODO - delete
  function prefixMessageFixed31(bytes32 messageHash) public pure returns (bytes memory) {
      return abi.encodePacked("\x19Hedera Signed Message:\n31", messageHash);
  }

  function isAuthorizedPublicWrapper(address account, bytes memory message, bytes memory signature) public returns (bool) {
   (int64 responseCode, bool authorized) = isAuthorizedPublic(account, message, signature);
   require(responseCode == 22, "isAuthorizedPublicWrapper failed");
   emit AccountAuthorizationResponse(responseCode, account, authorized);
   return authorized;
  }

  function test2() external pure returns (bytes memory, bytes32) {
    uint256 collateralUsd = 0x0000000000000000000000000000000000000000000000000000000000004e20;
    uint128 marketId = 0x0189c0a87e807e808000000000000003;
    uint128 txId = 0x019af3cfbabc70ed8271834875ab221a;

    bytes memory assembled = abi.encodePacked(collateralUsd, marketId, txId);
    bytes32 messageHash = keccak256(assembled);
    
    return (assembled, messageHash);
  }


  function assemblyTest(uint256 collateralUsd, uint128 marketId, uint128 txId) external pure returns (bytes memory, bytes32, bytes memory, string memory, bytes memory) {
    bytes memory assembled = abi.encodePacked(collateralUsd, marketId, txId);
    bytes32 keccak = keccak256(assembled);

    bytes memory prefixedKeccak = prefixMessageFixed31(keccak);

    string memory base64 = Base64.encode(abi.encodePacked(keccak)); // string(keccak) ?
    bytes memory prefixedKeccak64 = prefixMessageFixed40(base64);
    
    return (assembled, keccak, prefixedKeccak, base64, prefixedKeccak64);
  }

  /**
    This function takes the USDC collateral amount, market ID, and transaction ID and assembles them together
    Then calculates the keccak256 hash of the assembled payload
    Then it converts the keccak hash to a base64-encoded string (which will have a fixed length of 44 characters)
    Finally, it prefixes the base64-encoded string with the Hedera Signed Message header (using a hard-coded input string length of 44 characters)
    */
    function assemblePayload(uint8 buySell, uint256 collateralUsd, address evmAddr, uint128 marketId, uint128 txId) external pure returns (bytes memory) {
      // note: when using encodePacked, a bool gets encoded to 0x00 or 0x01 - this zero prefix prevents an odd register length
      bytes memory assembled = abi.encodePacked(buySell, collateralUsd, evmAddr, marketId, txId);
      bytes32 keccak = keccak256(assembled);

      string memory base64 = Base64.encode(abi.encodePacked(keccak));

      bytes memory prefixedKeccak64 = prefixMessageFixed(base64);

      return prefixedKeccak64;
    }

    /**
    This function takes a base64-encoded message has and prefixes it with the Hedera Signed Message header.
    N.B. the length of the base64-encoded keccak256 hash is always 44 characters.
    @param messageHashBase64 The base64 message to be prefixed.
    @return The prefixed message as bytes.
    */
    function prefixMessageFixed(string memory messageHashBase64) public pure returns (bytes memory) {
      return abi.encodePacked("\x19Hedera Signed Message:\n44", messageHashBase64);
    }
}




// pragma solidity ^0.8.19;

// /// @notice Minimal IHederaAccountService interface (per HIP-632 spec).
// interface IHederaAccountService {
//     // isAuthorizedRaw(address alias, bytes32 messageHash, bytes signatureBlob)
//     // function isAuthorizedRaw(address add, bytes32 messageHash, bytes calldata signatureBlob)
//     //     external
//     //     returns (int256 /* ResponseCode */, bool);

//     // isAuthorized(address alias, bytes message, bytes signatureBlob)
//     function isAuthorized(address add, bytes calldata message, bytes calldata signatureBlob)
//         external
//         returns (int256 /* ResponseCode */, bool);
// }

// /// @dev HAS precompile system address on Hedera (documented address)
// address constant HAS_PRECOMPILE = address(0x16a); // 0x16a = precompile for HederaAccountService

// contract Sig {
//     IHederaAccountService constant HAS = IHederaAccountService(HAS_PRECOMPILE);

//     /// Example: verify a 65-byte ECDSA signature (r||s||v)
//     /// - `add` is the 20-byte account add (Hedera account-num alias or EVM alias)
//     /// - `message` is the original data that was signed (we hash it here with keccak256)
//     /// - `sig` is a 65-byte ECDSA signature: r(32) || s(32) || v(1)
//     // function verifyEcdsaRaw(address add, bytes calldata message, bytes calldata sig) external returns (bool ok) {
//     //     require(sig.length == 65, "ECDSA signature must be 65 bytes");

//     //     // compute the message hash that was signed
//     //     bytes32 messageHash = keccak256(message);

//     //     // Call isAuthorizedRaw(add, messageHash, signatureBlob)
//     //     // returns (ResponseCode, bool). ResponseCode handling omitted for brevity.
//     //     (int256 responseCode, bool authorized) = HAS.isAuthorizedRaw(add, messageHash, sig);

//     //     // In practice you should check responseCode==0 (SUCCESS) per Hedera response code table.
//     //     // This demo returns the boolean authorization indicator.
//     //     ok = authorized;
//     // }

//     /// Example: verify using isAuthorized with a protobuf signatureBlob (multi-sig / complex keys)
//     /// - signatureBlob should be the serialized protobuf SignatureMap/SignatureList built off-chain.
//     function verifyWithSignatureMap(address add, bytes calldata message, bytes calldata signatureBlob) external returns (bool ok) {
//         // isAuthorized expects the *original* message bytes (not hashed) per spec.
//         (int256 responseCode, bool authorized) = HAS.isAuthorized(add, message, signatureBlob);

//         ok = authorized;
//     }

//     function hello() external pure returns (string memory) {
//         return "Hello, Hedera!";
//     }
// }



////  pragma solidity ^0.8.20;

// interface IHederaAccountService {
//   function isAuthorizedRaw(address account, bytes calldata messageHash, bytes calldata signatureBlob) external view returns (bool);
// }

// contract Sig {

//   address constant HAS = address(0x16a);

//   function verify(bytes32 r, bytes32 s, uint8 v, bytes32 msgHash) public pure returns (address) {
//     // Recover the signer's address using ecrecover
//     address signer = ecrecover(msgHash /* ethSignedMessageHash */, v, r, s);
//     return signer;
//   }
//   /// Determines if the signature is valid for the given message hash and account.
//   /// It is assumed that the signature is composed of a single EDCSA or ED25519 key.
//   /// @param account The account to check the signature against
//   /// @param messageHash The hash of the message to check the signature against
//   /// @param signature The signature to check
//   /// @return response True if the signature is valid, false otherwise
//   function isAuthorizedRaw(address account, bytes memory messageHash, bytes memory signature) external returns (bool response) {
//     (bool success, bytes memory result) = HAS.call(abi.encodeWithSelector(IHederaAccountService.isAuthorizedRaw.selector, account, messageHash, signature));
//     response = success ? abi.decode(result, (bool)) : false;
//   }

//   // function verifyHAS(address account, bytes memory messageHash, bytes memory signature) external returns (bool, int64) {
//   //     (bool success, bytes memory result) = HAS.call(
//   //         abi.encodeWithSelector(
//   //             bytes4(keccak256("isAuthorized(address,bytes,bytes)")),
//   //             account,
//   //             messageHash,
//   //             signature
//   //         )
//   //     );
//   //     // require(success, "HTS call failed");
//   //     int64 responseCode = abi.decode(result, (int64));
//   //     // require(responseCode == 22, "Association not successful ");
//   //     return (success, responseCode);
//   //   }
// }




// // pragma solidity ^0.8.20;

// // interface IHederaAccountService {
// //   /** 
// //   Determines if the signature is valid for the given message hash and account.
// //   It is assumed that the signature is composed of a single EDCSA or ED25519 key.
// //   @param account The account to check the signature against.
// //   @param messageHash The hash of the message to check the signature against.
// //   @param signature The signature to check.
// //   @return responseCode The response code for the status of the request.  SUCCESS is 22.
// //   @return authorized True if the signature is valid, false otherwise.
// //   */
// //   function isAuthorizedRaw(address account, bytes memory messageHash, bytes memory signature) external returns (int64 responseCode, bool authorized);
// // }

// // contract Sig {
// //   function verify(bytes32 r, bytes32 s, uint8 v, bytes32 msgHash) public pure returns (address) {
// //     // Recover the signer's address using ecrecover
// //     address signer = ecrecover(msgHash /* ethSignedMessageHash */, v, r, s);
// //     return signer;
// //   }

// //   // function verifyAddPrefix(bytes32 r, bytes32 s, uint8 v, bytes32 msgHash) public pure returns (address) {
// //   //   // Prefix the message hash with the Hedera Signed Message prefix
// //   //   bytes32 msgHashPrefixed = keccak256(
// //   //       abi.encodePacked("\x19Hedera Signed Message:\n32", msgHash)
// //   //   );

// //   //   // Recover the signer's address using ecrecover
// //   //   address signer = ecrecover(msgHashPrefixed, v, r, s);
// //   //   return signer;
// //   // }

// //   address constant HAS = address(0x16a);

// //   event AccountAuthorizationResponse(int64 responseCode, bool response);

// //   int32 internal constant SUCCESS = 22;
// //   int32 internal constant UNKNOWN = 21;

// //   /** 
// //   @param account: A 20-byte identifier used to represent an account on the Hedera network or an EVM-compatible account.
// //   @param messageHash: A cryptographic hash of the message, calculated using an algorithm like SHA-256 or Keccak-256. This is typically what is signed instead of the raw message.
// //   @param signature: A concatenation of the digital signature components, typically including r, s, and v values for ECDSA, or the equivalent data for ED25519 signatures.
// //   https://docs.hedera.com/hedera/core-concepts/smart-contracts/understanding-hederas-evm-differences-and-compatibility/for-evm-developers-migrating-to-hedera/accounts-signature-verification-and-keys-ecdsa-vs.-ed25519
// //   https://github.com/hashgraph/hedera-smart-contracts/blob/main/contracts/system-contracts/hedera-account-service/HederaAccountService.sol#L89
// //   */
// //   function isAuthorizedRaw(address account, bytes memory messageHash, bytes memory signature) public returns (int64 responseCode, bool authorized) {
// //     (bool success, bytes memory result) = HAS.call(
// //         abi.encodeWithSelector(IHederaAccountService.isAuthorizedRaw.selector, // 0xb2a31da4
// //           account, messageHash, signature));
// //     (responseCode, authorized) = success ? (SUCCESS, abi.decode(result, (bool))) : (UNKNOWN, false);
// //     if (responseCode != SUCCESS) {
// //       revert();
// //     }
// //     emit AccountAuthorizationResponse(responseCode, authorized);
// //   }
// //   // function isAuthorizedRaw(address account, bytes memory messageHash, bytes memory signature) internal returns (int64 responseCode, bool authorized) {
// //   //       (bool success, bytes memory result) = HAS.call(
// //   //           abi.encodeWithSelector(IHederaAccountService.isAuthorizedRaw.selector,
// //   //               account, messageHash, signature));
// //   //       (responseCode, authorized) = success ? (/* HederaResponseCodes.SUCCESS */ uint64(22), abi.decode(result, (bool))) : (/* HederaResponseCodes.UNKNOWN */ uint64(21), false);
// //   //   }
// //   // function verifyHedera(
// //   //   address aliasOrAddress,
// //   //   bytes memory messageHash,
// //   //   bytes memory signatureBlob
// //   //   ) external returns (int64 responseCode,
// //   //           bool authorized)  {
// //   //       return IHederaAccountService(HAS).isAuthorizedRaw(
// //   //           aliasOrAddress,
// //   //           messageHash,
// //   //           signatureBlob
// //   //       );
// //   //   }
// //   // function verifyHedera(address accountAlias, bytes32 messageHash, bytes memory signatureBlob) public returns (bool success, bytes memory result) {
// //   //   (bool _success, bytes memory _result) = HAS.call(
// //   //     abi.encodeWithSignature(
// //   //       "isAuthorizedRaw(address,bytes32,bytes)",
// //   //       accountAlias,
// //   //       messageHash,
// //   //       signatureBlob
// //   //     )
// //   //   );
// //   //   return (_success, _result);
// //   // }

// //   // /**
// //   // @param accountAlias: A 20-byte identifier used to represent an account on the Hedera network or an EVM-compatible account.
// //   // @param messageHash: A cryptographic hash of the message, calculated using an algorithm like SHA-256 or Keccak-256. This is typically what is signed instead of the raw message.
// //   // @param signatureBlob: A concatenation of the digital signature components, typically including r, s, and v values for ECDSA, or the equivalent data for ED25519 signatures.
// //   // */
// //   // function isAuthorizedRaw(
// //   //   address accountAlias,
// //   //   bytes32 messageHash,
// //   //   bytes memory signatureBlob
// //   // ) public returns (bool) {
// //   //   return IHederaAccountService(HAS).isAuthorizedRaw(
// //   //       accountAlias,
// //   //       messageHash,
// //   //       signatureBlob
// //   //   );
// //   // }


// //   // /// Determines if the signature is valid for the given message hash and account.
// //   // /// It is assumed that the signature is composed of a single EDCSA or ED25519 key.
// //   // /// @param account The account to check the signature against.
// //   // /// @param messageHash The hash of the message to check the signature against.
// //   // /// @param signature The signature to check.
// //   // /// @return response True if the signature is valid, false otherwise.
// //   // function isAuthorizedRaw(address account, bytes memory messageHash, bytes memory signature) internal
// //   // returns (bool response) {
// //   //     (, bytes memory result) = HAS.call(
// //   //         abi.encodeWithSelector(IHederaAccountService.isAuthorizedRaw.selector,
// //   //             account, messageHash, signature));
// //   //     // _not_ checking `success` allows this call to revert on error
// //   //     response = abi.decode(result, (bool));
// //   // }
// // }
