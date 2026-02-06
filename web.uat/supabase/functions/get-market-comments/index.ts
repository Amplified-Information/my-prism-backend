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

    let marketId: string;

    if (req.method === 'GET') {
      // Handle GET request with query parameter
      const url = new URL(req.url);
      marketId = url.searchParams.get('marketId') || '';
    } else {
      // Handle POST request with body
      const body = await req.json();
      marketId = body.marketId || '';
    }

    if (!marketId) {
      return new Response(
        JSON.stringify({ error: 'Market ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch comments with reaction counts
    const { data: comments, error } = await supabaseClient
      .from('market_comments')
      .select(`
        *,
        reactions:comment_reactions(reaction_type),
        replies:market_comments!parent_comment_id(
          *,
          reactions:comment_reactions(reaction_type)
        )
      `)
      .eq('market_id', marketId)
      .eq('is_active', true)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching comments:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch comments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all unique wallet IDs to fetch persona data
    const walletIds = new Set<string>();
    comments?.forEach(comment => {
      if (comment.wallet_id) walletIds.add(comment.wallet_id);
      comment.replies?.forEach((reply: any) => {
        if (reply.wallet_id) walletIds.add(reply.wallet_id);
      });
    });

    // Fetch persona data for all wallets
    let walletPersonas: Record<string, { persona_name: string | null; persona_color: string | null }> = {};
    if (walletIds.size > 0) {
      const { data: wallets } = await supabaseClient
        .from('hedera_wallets')
        .select('account_id, persona_name, persona_color')
        .in('account_id', Array.from(walletIds));
      
      wallets?.forEach(wallet => {
        walletPersonas[wallet.account_id] = {
          persona_name: wallet.persona_name,
          persona_color: wallet.persona_color
        };
      });
    }

    // Transform the data to match the expected format
    const transformedComments = comments?.map(comment => {
      const persona = comment.wallet_id ? walletPersonas[comment.wallet_id] : null;
      return {
        id: comment.id,
        author: persona?.persona_name || comment.wallet_id || 'Anonymous',
        walletId: comment.wallet_id,
        personaName: persona?.persona_name || null,
        personaColor: persona?.persona_color || null,
        content: comment.content,
        timestamp: new Date(comment.created_at),
        likes: comment.reactions?.filter((r: any) => r.reaction_type === 'like').length || 0,
        dislikes: comment.reactions?.filter((r: any) => r.reaction_type === 'dislike').length || 0,
        position: comment.position,
        replies: comment.replies?.map((reply: any) => {
          const replyPersona = reply.wallet_id ? walletPersonas[reply.wallet_id] : null;
          return {
            id: reply.id,
            author: replyPersona?.persona_name || reply.wallet_id || 'Anonymous',
            walletId: reply.wallet_id,
            personaName: replyPersona?.persona_name || null,
            personaColor: replyPersona?.persona_color || null,
            content: reply.content,
            timestamp: new Date(reply.created_at),
            likes: reply.reactions?.filter((r: any) => r.reaction_type === 'like').length || 0,
            dislikes: reply.reactions?.filter((r: any) => r.reaction_type === 'dislike').length || 0,
            position: reply.position
          };
        }) || []
      };
    }) || [];

    return new Response(
      JSON.stringify({ comments: transformedComments }),
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