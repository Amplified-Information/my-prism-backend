import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/contexts/WalletContext';

export interface Comment {
  id: string;
  author: string;
  walletId?: string | null;
  personaName?: string | null;
  personaColor?: string | null;
  content: string;
  timestamp: Date;
  likes: number;
  dislikes: number;
  replies?: Comment[];
  position?: 'YES' | 'NO' | null;
}

export const useMarketComments = (marketId: string) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { wallet } = useWallet();

  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('get-market-comments', {
        body: { marketId }
      });

      if (error) throw error;

      setComments(data.comments || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('Failed to load comments');
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addComment = async (content: string, position?: 'YES' | 'NO' | null, parentCommentId?: string) => {
    try {
      // Get current user or wallet info
      const { data: { user } } = await supabase.auth.getUser();
      const walletId = wallet.accountId; // Get wallet ID from context

      const { data, error } = await supabase.functions.invoke('create-comment', {
        body: {
          marketId,
          content,
          position,
          parentCommentId,
          walletId: !user ? walletId : undefined
        }
      });

      if (error) throw error;

      // Refresh comments to get the new comment
      await fetchComments();

      toast({
        title: "Success",
        description: "Comment posted successfully",
      });

      return data.comment;
    } catch (err: any) {
      console.error('Error adding comment:', err);
      
      // Check if this is an HTTP error from the edge function
      if (err instanceof FunctionsHttpError) {
        try {
          const errorData = await err.context.json();
          
          if (errorData?.moderation_error) {
            toast({
              title: "Comment Not Posted",
              description: errorData.error || "Your comment may contain inappropriate content. Please review our community guidelines and try again.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: errorData?.error || "Failed to post comment",
              variant: "destructive",
            });
          }
        } catch {
          toast({
            title: "Error",
            description: "Failed to post comment",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: err.message || "Failed to post comment",
          variant: "destructive",
        });
      }
      
      throw err;
    }
  };

  const toggleReaction = async (commentId: string, reactionType: 'like' | 'dislike') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const walletId = wallet.accountId;

      const { data, error } = await supabase.functions.invoke('toggle-reaction', {
        body: {
          commentId,
          reactionType,
          walletId: !user ? walletId : undefined
        }
      });

      if (error) throw error;

      // Update local state with new reaction counts
      setComments(prevComments => 
        prevComments.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              likes: data.likes,
              dislikes: data.dislikes
            };
          }
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map(reply => 
                reply.id === commentId 
                  ? { ...reply, likes: data.likes, dislikes: data.dislikes }
                  : reply
              )
            };
          }
          return comment;
        })
      );

    } catch (err: any) {
      console.error('Error toggling reaction:', err);
      toast({
        title: "Error",
        description: "Failed to update reaction",
        variant: "destructive",
      });
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    fetchComments();

    // Subscribe to new comments
    const commentsChannel = supabase
      .channel('market-comments-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'market_comments',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          fetchComments(); // Refresh comments when new ones are added
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comment_reactions'
        },
        () => {
          fetchComments(); // Refresh comments when reactions are added/changed
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comment_reactions'
        },
        () => {
          fetchComments(); // Refresh comments when reactions are removed
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(commentsChannel);
    };
  }, [marketId]);

  return {
    comments,
    loading,
    error,
    addComment,
    toggleReaction,
    refetch: fetchComments
  };
};