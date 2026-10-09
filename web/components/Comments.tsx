import { useEffect, useState } from 'react'
import { apiClient } from '../grpcClient'
import { Comment, CreateCommentRequest } from '../gen/api'
import { useWalletContext } from '../src/contexts/WalletContext'
import { keyTypeToInt, normalizeSignatureBase64 } from '../lib/utils'
import { keccak256 } from 'ethers'
import { RefreshCw, Users, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../src/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../src/components/ui/collapsible'
import toast from 'react-hot-toast'
import { signWithWallet } from '../lib/signWithWallet'

const Comments = ({ marketId }: { marketId: string }) => {
  const { signerZero, userAccountInfo } = useWalletContext()
  const [comment, setComment] = useState<string>('')
  const [comments, setComments] = useState<Array<Comment>>([])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Connection and validation state
  const isConnected = !!signerZero && !!userAccountInfo
  const canSubmit = isConnected && comment.trim().length > 0 && !isSubmitting

  const fetchComments = async () => {
    console.log(`[Comments] fetchComments called for marketId: ${marketId}`)
    try {
      console.log(`[Comments] Making API call to getComments...`)
      const result = await apiClient.getComments({ marketId, limit: 100, offset: 0 })
      console.log('[Comments] API response:', result)
      console.log('[Comments] result.response:', result.response)
      console.log('[Comments] result.response.comments:', result.response.comments)
      setComments(result.response.comments ?? [])
      console.log(`[Comments] Set ${(result.response.comments ?? []).length} comments`)
    } catch (err) {
      console.error('[Comments] Failed to fetch comments:', err)
      console.error('[Comments] Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err as object)))
    }
  }

  useEffect(() => {
    fetchComments()
  }, [marketId])

  // Sort comments newest first (newest at top)
  const sortedComments = [...comments].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <Card className="border-border bg-card">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
              <Users className="h-5 w-5 text-primary" />
              Community Board
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-y-auto border border-border rounded-lg bg-muted/30">
              {sortedComments.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No comments yet. Be the first to share your thoughts!</p>
              ) : (
                <div className="divide-y divide-border">
                  {sortedComments.map((comment, index) => (
                    <div key={index} className="px-3 py-2 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-xs font-mono shrink-0">
                          {comment.accountId || 'Anonymous'}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(comment.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <p className="text-foreground text-sm break-words w-full">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <textarea 
                value={comment}
                placeholder="Leave a comment..."
                className="w-full h-20 p-2 border-2 border-foreground/50 rounded resize-none text-sm bg-background text-foreground focus:border-foreground focus:outline-none"
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
              <button
                  className={`${!canSubmit ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 cursor-pointer'} text-white rounded px-4 py-2 text-sm transition-colors`}
                  disabled={!canSubmit}
                  onClick={async () => {
                    // Guard against missing connection
                    if (!signerZero || !userAccountInfo) {
                      toast.error('Please connect your wallet first')
                      return
                    }
                    
                    // Guard against empty comment
                    if (!comment.trim()) {
                      toast.error('Please enter a comment')
                      return
                    }

                    try {
                      setIsSubmitting(true)

                      // Backend signature payload format (updated):
                      //   `${marketId}:${accountId}:${content}`
                      // See docs/backend-sync.md and
                      // .lovable/memory/technical/hedera-signature-encoding.md.
                      const accountIdStr = signerZero.getAccountId().toString()
                      const payloadStr = `${marketId}:${accountIdStr}:${comment}`
                      const payloadBytes = Buffer.from(payloadStr, 'utf8')
                      console.log(`comment payload (len=${payloadStr.length}): ${payloadStr}`)

                      const hashHex = keccak256(payloadBytes).slice(2)
                      const hashB64 = Buffer.from(hashHex, 'hex').toString('base64')
                      console.log(`keccak256(comment payload) hashB64 (len=${hashB64.length}): ${hashB64}`)

                      // Sign UTF-8 bytes of base64(hash) so wallet UI shows a printable payload.
                      // Serialize behind the shared wallet mutex + timeout so a comment
                      // prompt can't race an order-sign / allowance / login prompt and
                      // get silently dropped by the wallet's FIFO queue.
                      const sigRaw = await signWithWallet(
                        'comment.sign',
                        async () => (await signerZero.sign([Buffer.from(hashB64, 'utf8')]))[0].signature,
                        { meta: { marketId, messageLen: hashB64.length } },
                      )

                      const sigB64 = normalizeSignatureBase64(sigRaw)
                      console.log(`comment sig base64 (bytes=${Buffer.from(sigB64, 'base64').length}): ${sigB64}`)

                      const createCommentRequest: CreateCommentRequest = {
                        marketId,
                        accountId: signerZero.getAccountId().toString(),
                        content: comment,
                        sig: sigB64,
                        publicKey: userAccountInfo.key.key,
                        keyType: keyTypeToInt(userAccountInfo.key._type)
                      }
                      console.log(createCommentRequest)
                      // Content moderation is enforced server-side in
                      // `ApiService.CreateComment` — see
                      // `docs/comment-moderation-spec.md`. Do NOT add
                      // client-side filtering here: it can be bypassed by
                      // calling the RPC directly and gives a false sense
                      // of security.
                      const result = await apiClient.createComment(createCommentRequest)
                      console.log(result)
                      if (result.status.code === 'OK') {
                        toast.success('Comment posted!')
                        setComment('')
                        await fetchComments()
                      } else {
                        console.error('Failed to create comment:', result.status)
                        toast.error('Failed to post comment')
                      }
                    } catch (error) {
                      console.error('Error submitting comment:', error)
                      const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
                      if (msg.includes('rejected by moderation')) {
                        // Backend (comments_moderation.go) returns "comment rejected by moderation: <reason>"
                        const reason = (error instanceof Error ? error.message : String(error))
                          .split('rejected by moderation:')[1]?.trim()
                        toast.error(
                          reason
                            ? `Your comment was rejected by our content policy (${reason}).`
                            : 'Your comment was rejected by our content policy.'
                        )
                      } else if (
                        msg.includes('duplicate key') ||
                        msg.includes('comments_unique_sig') ||
                        msg.includes('already exists')
                      ) {
                        // Backend migration 000050 adds a unique constraint on comment signature (replay guard)
                        toast.error("You've already posted this comment.")
                      } else {
                        toast.error('Failed to submit comment. Please try again.')
                      }
                    } finally {
                      setIsSubmitting(false)
                    }
                  }}
                >
                  {!isConnected ? 'Connect wallet to comment' : isSubmitting ? 'Sign comment in your wallet' : 'Submit Comment'}
                </button>
                <button
                  className={`${isRefreshing ? 'animate-spin' : ''} bg-muted text-foreground border border-border rounded p-2 cursor-pointer text-sm hover:bg-muted/80`}
                  disabled={isRefreshing}
                  onClick={async () => {
                    setIsRefreshing(true)
                    await fetchComments()
                    setIsRefreshing(false)
                  }}
                  title="Refresh comments"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export default Comments
