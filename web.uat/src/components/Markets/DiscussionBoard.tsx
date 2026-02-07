import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, ThumbsUp, ThumbsDown, Reply, Flag, Loader2, Wallet, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMarketComments, Comment } from "@/hooks/useMarketComments";
import { useWallet } from "@/contexts/WalletContext";
import { useWalletByAccountId } from "@/hooks/useHederaWallets";

interface DiscussionBoardProps {
  marketId: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DiscussionBoard = ({ marketId, isOpen = true, onOpenChange }: DiscussionBoardProps) => {
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'YES' | 'NO' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { wallet, connect, isLoading: walletLoading } = useWallet();
  const { data: walletData } = useWalletByAccountId(wallet.accountId || '');
  const { comments, loading, error, addComment, toggleReaction } = useMarketComments(marketId);

  const handleConnectWallet = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmitting || !wallet.isConnected) return;
    
    try {
      setIsSubmitting(true);
      await addComment(newComment, selectedPosition, replyingTo);
      // Only clear form on success
      setNewComment("");
      setReplyingTo(null);
      setSelectedPosition(null);
    } catch (error: any) {
      // Keep the comment in the textarea so user can edit it
      // Check if it's a moderation error - don't clear the form
      const errorData = error?.context?.body;
      if (!errorData?.moderation_error) {
        // For non-moderation errors, still keep the comment
        console.log('Comment submission failed, keeping form content');
      }
      // Form content is preserved for user to edit
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReaction = async (commentId: string, reactionType: 'like' | 'dislike') => {
    if (!wallet.isConnected) return;
    await toggleReaction(commentId, reactionType);
  };

  const truncateWalletId = (walletId: string) => {
    if (walletId.length <= 12) return walletId;
    return `${walletId.slice(0, 6)}...${walletId.slice(-4)}`;
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}>
      <div className="flex gap-3 p-4 rounded-lg border bg-card">
        <Avatar 
          className="h-8 w-8"
          style={comment.personaColor ? { backgroundColor: comment.personaColor } : undefined}
        >
          <AvatarFallback 
            className="text-xs font-semibold"
            style={comment.personaColor ? { 
              backgroundColor: comment.personaColor,
              color: '#000000'
            } : undefined}
          >
            {comment.personaName 
              ? comment.personaName.charAt(0).toUpperCase()
              : comment.author.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {comment.personaName ? (
              <>
                <span 
                  className="font-medium text-sm"
                  style={comment.personaColor ? { color: comment.personaColor } : undefined}
                >
                  {comment.personaName}
                </span>
                {comment.walletId && (
                  <span className="text-xs text-muted-foreground font-mono">
                    ({truncateWalletId(comment.walletId)})
                  </span>
                )}
              </>
            ) : (
              <span className="font-medium text-sm font-mono">
                {comment.walletId ? truncateWalletId(comment.walletId) : comment.author}
              </span>
            )}
            {comment.position && (
              <Badge 
                variant={comment.position === 'YES' ? 'default' : 'destructive'}
                className={`text-xs px-2 py-0 ${comment.position === 'YES' ? 'bg-yes hover:bg-yes/80' : ''}`}
              >
                {comment.position}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(comment.timestamp)} ago
            </span>
          </div>
          
          <p className="text-sm leading-relaxed">{comment.content}</p>
          
          <div className="flex items-center gap-4 pt-1">
            <button 
              onClick={() => handleReaction(comment.id, 'like')}
              className={`flex items-center gap-1 text-xs transition-colors ${
                wallet.isConnected 
                  ? 'text-muted-foreground hover:text-primary cursor-pointer' 
                  : 'text-muted-foreground/50 cursor-not-allowed'
              }`}
              disabled={!wallet.isConnected}
            >
              <ThumbsUp className="h-3 w-3" />
              {comment.likes}
            </button>
            <button 
              onClick={() => handleReaction(comment.id, 'dislike')}
              className={`flex items-center gap-1 text-xs transition-colors ${
                wallet.isConnected 
                  ? 'text-muted-foreground hover:text-destructive cursor-pointer' 
                  : 'text-muted-foreground/50 cursor-not-allowed'
              }`}
              disabled={!wallet.isConnected}
            >
              <ThumbsDown className="h-3 w-3" />
              {comment.dislikes}
            </button>
            <button 
              onClick={() => wallet.isConnected && setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                wallet.isConnected 
                  ? 'text-muted-foreground hover:text-primary cursor-pointer' 
                  : 'text-muted-foreground/50 cursor-not-allowed'
              }`}
              disabled={!wallet.isConnected}
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <Flag className="h-3 w-3" />
              Report
            </button>
          </div>
          
          {replyingTo === comment.id && wallet.isConnected && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Post Reply
                </Button>
                <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {comment.replies && comment.replies.map(reply => renderComment(reply, true))}
    </div>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className="w-full">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Discussion
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{comments.length} comments</Badge>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
        {/* Connect Wallet or New Comment Form */}
        {!wallet.isConnected ? (
          <div className="space-y-3 p-6 rounded-lg border bg-muted/30 text-center">
            <div className="flex flex-col items-center gap-3">
              <Wallet className="h-8 w-8 text-muted-foreground" />
              <div>
                <h3 className="font-medium text-lg mb-1">Connect Your Wallet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  You need to connect your wallet to participate in discussions and react to comments.
                </p>
              </div>
              <Button 
                onClick={handleConnectWallet}
                disabled={walletLoading}
                className="min-w-[140px]"
              >
                {walletLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Wallet className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
            <Textarea
              placeholder="Share your thoughts, analysis, or ask questions about this market..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button 
                  variant={selectedPosition === 'YES' ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSelectedPosition(selectedPosition === 'YES' ? null : 'YES')}
                  className={selectedPosition === 'YES' ? 'bg-yes hover:bg-yes/80' : ''}
                >
                  <Badge variant="default" className="mr-1 bg-yes hover:bg-yes/80">YES</Badge>
                  Position
                </Button>
                <Button 
                  variant={selectedPosition === 'NO' ? "destructive" : "outline"} 
                  size="sm"
                  onClick={() => setSelectedPosition(selectedPosition === 'NO' ? null : 'NO')}
                >
                  <Badge variant="destructive" className="mr-1">NO</Badge>
                  Position
                </Button>
              </div>
              <Button 
                onClick={handleSubmitComment} 
                disabled={!newComment.trim() || isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Post Comment as {walletData?.persona_name ? `'${walletData.persona_name}'` : ''} | {truncateWalletId(wallet.accountId || '')}
              </Button>
            </div>
          </div>
        )}
        
        {/* Comments List */}
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p className="text-muted-foreground">Loading comments...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{error}</p>
          </div>
        ) : comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map(comment => renderComment(comment))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No comments yet. Be the first to start the discussion!</p>
          </div>
          )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default DiscussionBoard;