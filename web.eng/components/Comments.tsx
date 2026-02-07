
import { useEffect, useState } from 'react'
import { apiClient } from '../grpcClient'
import { Comment, CreateCommentRequest } from '../gen/api'
import { useAppContext } from '../AppProvider'
import { keyTypeToInt } from '../lib/utils'
import { keccak256 } from 'ethers'

const Comments = ({ marketId }: { marketId: string }) => {
  const { signerZero, userAccountInfo } = useAppContext()
  const [comment, setComment] = useState<string>('')
  const [comments, setComments] = useState<Array<Comment>>([])
  const [thinger, setThinger] = useState<boolean>(false)

  useEffect(() => {
    (async () => {
      console.log(`Fetching comments for marketId: ${marketId}`)
      const comments = await apiClient.getComments({ marketId, limit: 100, offset: 0 })
      console.log('comments', comments.response)
      setComments(comments.response.comments)
    })()
  }, [marketId])

  return (
    <div>
      <div className="my-5 flex flex-col gap-2">
        <textarea value={comment}
          placeholder="Leave a comment..."
          className="w-full h-20 p-2 border border-gray-300 rounded resize-none text-sm"
          onChange={(e) => setComment(e.target.value)}
        ></textarea>
        <button
          className={`${thinger ? 'bg-blue-400 cursor-not-allowed' : ''} self-end bg-blue-500 text-white rounded px-4 py-2 cursor-pointer text-sm hover:bg-blue-600`}
          disabled={thinger}
          onClick={async () => {
            try {
              setThinger(true)

              /**
              - string to buffer
              - keccak256(buffer)
              - ~~base64(keccak256(buffer)))~~
              - sign(keccak256(buffer))
              - send signature along with comment
              */

              const buffer = Buffer.from(comment)
              console.log(`comment buffer (len=${buffer.length}): ${buffer.toString('hex')}`)

              const bufferHash = keccak256(buffer).slice(2)
              console.log(`keccak256 hash of comment (len=${bufferHash.length}): ${bufferHash}`)

              // const bufferHash64 = Buffer.from(bufferHash, 'hex').toString('base64')
              // console.log(`msgToSign (base64) (len=${bufferHash64.length}): ${bufferHash64}`)

              const sigHex = (await signerZero!.sign([Buffer.from(bufferHash, 'hex')], { encoding: 'base64' }))[0].signature
              console.log(`sig (hex) (len=${sigHex.length}): ${Buffer.from(sigHex).toString('hex')}`)
              console.log(`sig (base64): ${Buffer.from(sigHex).toString('base64')}`)

              const createCommentRequest: CreateCommentRequest = {
                marketId,
                accountId: signerZero?.getAccountId().toString(),
                content: comment,
                sig: Buffer.from(sigHex).toString('base64'),
                publicKey: userAccountInfo.key.key,
                keyType: keyTypeToInt(userAccountInfo.key._type)
              }
              console.log(createCommentRequest)
              const result = await apiClient.createComment(createCommentRequest)
              console.log(result)
              if (result.status.code === 'OK') {
                console.log('Comment created successfully')
                // Prepend the new comment to the comments list
                setComments([result.response.comment, ...comments])
                setComment('')
              } else {
                console.error('Failed to create comment:', result.status)
              }
            } catch (error) {
              console.error('Error submitting comment:', error)
            } finally {
              setThinger(false)
            }
          }}
        >
          Submit Comment
        </button>
      </div>

      {comments.map((comment, index) => (
        <div key={index} style={{ border: '1px solid gray', margin: '10px', padding: '10px' }}>
          <b>{comment.accountId || 'Anonymous'}</b> ({new Date(comment.createdAt).toLocaleString()}):
          <p>{comment.content}</p>
        </div>
      ))}
    </div>
  )
}

export default Comments
