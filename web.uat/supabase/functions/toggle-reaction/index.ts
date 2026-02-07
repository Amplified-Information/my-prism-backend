import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { commentId, reactionType, walletId } = await req.json();

    if (!commentId || !reactionType) {
      return new Response(
        JSON.stringify({ error: 'Comment ID and reaction type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['like', 'dislike'].includes(reactionType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid reaction type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user
    const { data: { user } } = await supabaseClient.auth.getUser();

    const reactionData: any = {
      comment_id: commentId,
      reaction_type: reactionType,
    };

    // Set user_id if authenticated, otherwise use wallet_id
    if (user) {
      reactionData.user_id = user.id;
    } else if (walletId) {
      reactionData.wallet_id = walletId;
    } else {
      return new Response(
        JSON.stringify({ error: 'Must be authenticated or provide wallet ID' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has a reaction on this comment
    const whereClause = user 
      ? { comment_id: commentId, user_id: user.id }
      : { comment_id: commentId, wallet_id: walletId };

    const { data: existingReaction } = await supabaseClient
      .from('comment_reactions')
      .select('*')
      .match(whereClause)
      .single();

    let result;

    if (existingReaction) {
      if (existingReaction.reaction_type === reactionType) {
        // Remove reaction if clicking the same type
        const { error } = await supabaseClient
          .from('comment_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) {
          console.error('Error removing reaction:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to remove reaction' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        result = { action: 'removed', reactionType };
      } else {
        // Update reaction type
        const { error } = await supabaseClient
          .from('comment_reactions')
          .update({ reaction_type: reactionType })
          .eq('id', existingReaction.id);

        if (error) {
          console.error('Error updating reaction:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to update reaction' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        result = { action: 'updated', reactionType };
      }
    } else {
      // Create new reaction
      const { error } = await supabaseClient
        .from('comment_reactions')
        .insert(reactionData);

      if (error) {
        console.error('Error creating reaction:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create reaction' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      result = { action: 'created', reactionType };
    }

    // Get updated reaction counts
    const { data: reactions } = await supabaseClient
      .from('comment_reactions')
      .select('reaction_type')
      .eq('comment_id', commentId);

    const likes = reactions?.filter(r => r.reaction_type === 'like').length || 0;
    const dislikes = reactions?.filter(r => r.reaction_type === 'dislike').length || 0;

    return new Response(
      JSON.stringify({ 
        ...result,
        likes,
        dislikes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});