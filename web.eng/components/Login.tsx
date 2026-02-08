import { authClient } from '../grpcClient'
import { useEffect, useState } from 'react'
import { useAppContext } from '../AppProvider'
import { keccak256 } from 'ethers'

const Login = () => {
  const { networkSelected, signerZero, userAccountInfo } = useAppContext()
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [challenge, setChallenge] = useState(BigInt(0))
  
  useEffect(() => {
    (async () => {
      console.log('hi')
      console.log('signerZero', signerZero)
      if (typeof signerZero === 'undefined') {
        console.error('No signer available')
        setIsWalletConnected(false)
        return
      } else {
        setIsWalletConnected(true)
      }

      try {
        const accountId = signerZero.getAccountId().toString()
        const result = await authClient.getChallenge({accountId, network: networkSelected.toString().toLowerCase()})
        console.log('result', result.response.message)
        setChallenge(BigInt(result.response.message))
      } catch (error) {
        console.error('Error fetching challenge:', error)
      }
    })()
  }, [signerZero, networkSelected])
  
  return (
    <div className="flex items-center justify-center">
      <h1 className="text-4xl font-bold">Login Page</h1>

      { isWalletConnected ? (
        <button className='btn-primary flex items-center gap-2' title='Login' onClick={async () => {
          try {
            // hash the challenge:
            const keccakHex = keccak256(Buffer.from(challenge.toString()))
            console.log('keccak (hex)', keccakHex)
            const keccak = Buffer.from(keccakHex.slice(2), 'hex')

            // sign the challenge
            const sig = (await signerZero!.sign([keccak], { encoding: 'base64' }))[0].signature
            console.log(`sig (hex) ${Buffer.from(sig).toString('hex')}`)
            console.log(`sig (base64): ${Buffer.from(sig).toString('base64')}`)


            console.log('publicKey: ', userAccountInfo.key.key)
            // const sigRaw = await signerZero.sign([Buffer.from(challenge.toString())], { encoding: 'base64' })
            // console.log('sig (hex):', Buffer.from(sigRaw[0].signature).toString('hex'))
            // // console.log('sig (base64):', Buffer.from(sigRaw[0].signature).toString('base64'))


            // verify the challenge:
            const result = await authClient.verifyChallenge({
              challengeResponseBase64: Buffer.from(sig).toString('base64'),
              payload: challenge.toString(),
              challengeRequest: {
                accountId: signerZero.getAccountId().toString(),
                network: networkSelected.toString().toLowerCase()
              }
            })
            console.log('verifyChallenge result (headers)', result.headers)
            console.log('verifyChallenge result (response)', result.response)

            // // receive the auth token:


            
          } catch (error) {
            console.error('Error signing challenge:', error)
          }
        }
        }>Login</button>
      ) : (
        <p className="mt-4 text-red-600">No wallet connected</p>
      )}
     
    </div>
  )
}

export default Login
