import { apiClient, authClient, authHeaders } from '../grpcClient'
import { useEffect, useState } from 'react'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useWalletContext } from '../src/contexts/WalletContext'
import { keccak256 } from 'ethers'
import { setToken, clearToken } from '../lib/authToken'
import { signWithWallet } from '../lib/signWithWallet'

import toast from 'react-hot-toast'

const Login = () => {
  const { networkSelected } = useNetworkContext()
  const { signerZero, userAccountInfo } = useWalletContext()
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [challenge, setChallenge] = useState(BigInt(0))
  const [challengeReady, setChallengeReady] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    (async () => {
      console.log('signerZero', signerZero)
      if (typeof signerZero === 'undefined') {
        console.error('No signer available')
        setIsWalletConnected(false)
        setChallengeReady(false)
        return
      } else {
        setIsWalletConnected(true)
      }

      try {
        setChallengeReady(false)
        const accountId = signerZero.getAccountId().toString()
        const result = await authClient.getChallenge({accountId, network: networkSelected.toString().toLowerCase()})
        console.log('result', result.response.message)
        const c = BigInt(result.response.message)
        setChallenge(c)
        // Guard against submitting a placeholder challenge if the backend
        // ever returns "0" — the user should never sign a zero payload.
        setChallengeReady(c !== BigInt(0))
      } catch (error) {
        console.error('Error fetching challenge:', error)
        setChallengeReady(false)
        toast.error('Could not fetch login challenge. Please retry.')
      }
    })()
  }, [signerZero, networkSelected])

  // Gate the button on everything the click handler actually reads. In
  // particular `userAccountInfo` is populated asynchronously by
  // `bindFromSession` (mirror-node lookup); clicking before it resolves
  // used to burn a real wallet approval and then throw silently on
  // `userAccountInfo.key.key`.
  const canLogin =
    isWalletConnected &&
    !isSigningIn &&
    challengeReady &&
    !!userAccountInfo?.key?.key

  return (
    <div className="">
      <h1 className="text-4xl font-bold">Login Page</h1>

      { isWalletConnected ? (
        <button
          className='btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
          title='Login'
          disabled={!canLogin}
          onClick={async () => {
          if (!canLogin) return
          setIsSigningIn(true)
          try {
            // Canonical Hedera signing pattern (matches Orders / Cancel / Comments):
            //   1. keccak256(challenge)                → 32 bytes
            //   2. base64(keccak)                      → 44-char string
            //   3. wallet.sign(utf8(base64))           → wallet auto-prefixes
            //                                            "\x19Hedera Signed Message:\n44"
            // Signing raw 32-byte digest bytes would produce the wrong "\n32"
            // prefix and fail verification on the WalletConnect DAppSigner path
            // (published hosts, outside the Lovable iframe).
            const keccakHex = keccak256(Buffer.from(challenge.toString()))
            const keccakB64 = Buffer.from(keccakHex.slice(2), 'hex').toString('base64')
            console.log('[Login] keccak (hex)', keccakHex, 'keccak (b64)', keccakB64)

            // Serialize behind the shared wallet mutex + timeout so a login
            // click can't race an order-sign / allowance / comment prompt
            // and get silently dropped by the wallet's FIFO queue.
            const sig = await signWithWallet(
              'login.sign',
              async () => (await signerZero!.sign([Buffer.from(keccakB64, 'utf8')]))[0].signature as Uint8Array,
              { meta: { messageLen: keccakB64.length } },
            )

            console.log('[Login] sig (base64):', Buffer.from(sig).toString('base64'), 'publicKey:', userAccountInfo!.key.key)

            // verify the challenge:
            console.log('challenge: ', challenge.toString())
            const result = await authClient.verifyChallenge({
              challengeResponseBase64: Buffer.from(sig).toString('base64'),
              payload: challenge.toString(),
              challengeRequest: {
                accountId: signerZero!.getAccountId().toString(),
                network: networkSelected.toString().toLowerCase()
              }
            })

            // receive the auth token:
            console.log('verifyChallenge result (headers)', result.headers)
            console.log('verifyChallenge result (response)', result.response)

            // TODO: backend should set an HttpOnly cookie here instead of
            // returning the token in a response header. See
            // docs/auth-cookie-migration.md.
            setToken(result.headers['authorization'] as string)
            toast.success('Signed in')
          } catch (error) {
            console.error('Error signing challenge:', error)
            const msg = error instanceof Error ? error.message : String(error)
            toast.error(msg || 'Login failed')
          } finally {
            setIsSigningIn(false)
          }
        }
        }>{isSigningIn ? 'Signing…' : 'Login'}</button>
      ) : (
        <p className="mt-4 text-red-600">No wallet connected</p>
      )}


      &nbsp;&nbsp;
      <button onClick={async () => {
        console.log('logout')
        clearToken()
        // TODO: also call a backend logout endpoint to clear the HttpOnly
        // cookie once that lands. See docs/auth-cookie-migration.md.
      }}>logout</button>
     

      <br/>
      <br/>
      <div>
        <button onClick={async () => {
          // try an authenticated:
          const test = await apiClient.getAllMatches({limit: 25, offset: 0}, authHeaders())
          console.log(test.response)
        }}>getAllMatches</button>

        <br/>
        <button onClick={async () => {
          // try an authenticated:
          const test = await apiClient.getAllPositions({limit: 25, offset: 0}, authHeaders())
          console.log(test.response)
        }}>getAllPositions</button>

        <br/>
        <button onClick={async () => {
          // try an authenticated:
          const test = await apiClient.getAllPredictionIntents({limit: 25, offset: 0}, authHeaders())
          console.log(test.response)
        }}>getAllPredictionIntents</button>

      </div>
    </div>
  )
}

export default Login
