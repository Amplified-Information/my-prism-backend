import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModerationResult {
  is_flagged: boolean;
  reason: string;
  categories: string[];
}

async function moderateContent(content: string): Promise<ModerationResult> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.warn('LOVABLE_API_KEY not configured, skipping moderation');
    return { is_flagged: false, reason: '', categories: [] };
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a context-aware content moderation assistant for an adult prediction market platform. Analyze the user's comment and determine if it contains genuinely harmful content.

FLAG these (truly harmful):
- Racist, ethnic, or religious slurs
- Hate speech targeting protected groups (race, religion, gender, sexuality, disability)
- Threatening or violent content (death threats, wishes of harm)
- Sexual or explicit content
- Targeted harassment or personal attacks against specific users
- Doxxing or sharing personal information

ALLOW these (acceptable):
- Profanity used casually or to express frustration ("this fucking market", "holy shit", "damn it")
- Strong opinions and heated debate
- Criticism of ideas, predictions, or market positions
- Mild insults in context of banter ("you're crazy if you think...")
- Expressing disappointment or excitement with colorful language

Be lenient - this is an adult platform. Only flag content that is genuinely harmful, hateful, or threatening. Casual profanity is perfectly acceptable.`
          },
          {
            role: 'user',
            content: `Analyze this comment for inappropriate content:\n\n"${content}"`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'moderate_content',
              description: 'Returns the moderation result for the analyzed content',
              parameters: {
                type: 'object',
                properties: {
                  is_flagged: {
                    type: 'boolean',
                    description: 'True if the content violates community guidelines'
                  },
                  reason: {
                    type: 'string',
                    description: 'Brief explanation of why content was flagged (empty if not flagged)'
                  },
                  categories: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Categories of violation (e.g., "racism", "hate_speech", "threats", "harassment")'
                  }
                },
                required: ['is_flagged', 'reason', 'categories'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'moderate_content' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      // On API error, allow the comment through (fail open)
      return { is_flagged: false, reason: '', categories: [] };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      console.log('Moderation result:', result);
      return result;
    }

    return { is_flagged: false, reason: '', categories: [] };
  } catch (error) {
    console.error('Moderation error:', error);
    // On error, allow the comment through (fail open)
    return { is_flagged: false, reason: '', categories: [] };
  }
}

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

    const { marketId, content, position, parentCommentId, walletId } = await req.json();

    if (!marketId || !content) {
      return new Response(
        JSON.stringify({ error: 'Market ID and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Content validation
    if (content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Comment cannot be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (content.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Comment too long (max 2000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user
    const { data: { user } } = await supabaseClient.auth.getUser();

    // Moderate content with AI
    console.log('Moderating comment content...');
    const moderationResult = await moderateContent(content.trim());

    if (moderationResult.is_flagged) {
      console.log('Comment flagged by moderation:', moderationResult);
      
      // Log the flagged comment using service role client
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await serviceClient.from('flagged_comments').insert({
        market_id: marketId,
        wallet_id: walletId || null,
        user_id: user?.id || null,
        content: content.trim(),
        moderation_reason: moderationResult.reason,
        moderation_categories: moderationResult.categories
      });

      return new Response(
        JSON.stringify({ 
          error: 'Your comment could not be posted as it may contain inappropriate content. Please follow our community guidelines and try again.',
          moderation_error: true,
          reason: moderationResult.reason
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const commentData: Record<string, unknown> = {
      market_id: marketId,
      content: content.trim(),
      position: position || null,
      parent_comment_id: parentCommentId || null,
    };

    // Set user_id if authenticated, otherwise use wallet_id
    if (user) {
      commentData.user_id = user.id;
    } else if (walletId) {
      commentData.wallet_id = walletId;
    } else {
      return new Response(
        JSON.stringify({ error: 'Must be authenticated or provide wallet ID' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: comment, error } = await supabaseClient
      .from('market_comments')
      .insert(commentData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create comment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the comment to match expected format
    const transformedComment = {
      id: comment.id,
      author: comment.wallet_id || 'Anonymous',
      walletId: comment.wallet_id,
      content: comment.content,
      timestamp: new Date(comment.created_at),
      likes: 0,
      dislikes: 0,
      position: comment.position,
      replies: []
    };

    return new Response(
      JSON.stringify({ comment: transformedComment }),
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
