import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { walletId } = await req.json()
    
    if (!walletId) {
      return new Response(
        JSON.stringify({ error: 'Wallet ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Generating avatar for wallet:', walletId)

    // Generate deterministic colors based on wallet ID
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(walletId))
    const hashArray = Array.from(new Uint8Array(hash))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    // Extract values for avatar generation
    const hue1 = parseInt(hashHex.slice(0, 2), 16) * 360 / 255
    const hue2 = parseInt(hashHex.slice(2, 4), 16) * 360 / 255
    const saturation = 60 + (parseInt(hashHex.slice(4, 6), 16) * 40 / 255)
    const lightness = 40 + (parseInt(hashHex.slice(6, 8), 16) * 30 / 255)
    
    // Create SVG avatar with deterministic design
    const size = 200
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1},${saturation}%,${lightness}%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue2},${saturation}%,${lightness - 10}%);stop-opacity:1" />
        </linearGradient>
        <radialGradient id="grad2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:hsl(${hue2},${saturation}%,${lightness + 20}%);stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:hsl(${hue1},${saturation}%,${lightness}%);stop-opacity:1" />
        </radialGradient>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#grad1)" />
      <circle cx="${size * 0.3}" cy="${size * 0.3}" r="${size * 0.15}" fill="url(#grad2)" opacity="0.7" />
      <circle cx="${size * 0.7}" cy="${size * 0.7}" r="${size * 0.12}" fill="hsl(${hue1 + 60},${saturation}%,${lightness + 30}%)" opacity="0.6" />
      <circle cx="${size * 0.2}" cy="${size * 0.8}" r="${size * 0.08}" fill="hsl(${hue2 + 30},${saturation}%,${lightness + 40}%)" opacity="0.8" />
      <circle cx="${size * 0.8}" cy="${size * 0.2}" r="${size * 0.1}" fill="hsl(${hue1 - 30},${saturation}%,${lightness + 35}%)" opacity="0.7" />
      <polygon points="${size * 0.5},${size * 0.3} ${size * 0.7},${size * 0.6} ${size * 0.3},${size * 0.6}" 
               fill="hsl(${hue2 + 45},${saturation + 20}%,${lightness + 25}%)" opacity="0.9" />
    </svg>`

    // Convert SVG to blob and upload directly
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' })
    const svgArrayBuffer = await svgBlob.arrayBuffer()
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Upload SVG to storage
    const fileName = `avatar_${walletId.replace(/\./g, '_')}.svg`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(`avatars/${fileName}`, svgArrayBuffer, {
        contentType: 'image/svg+xml',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(`avatars/${fileName}`)

    // Save metadata to image_files table
    const { error: metadataError } = await supabase
      .from('image_files')
      .upsert({
        filename: fileName,
        url: publicUrl,
        alt_text: `Generated avatar for wallet ${walletId}`,
        keywords: ['avatar', 'generated', 'wallet']
      })

    if (metadataError) {
      console.error('Metadata error:', metadataError)
    }

    console.log('Avatar generated successfully:', publicUrl)

    return new Response(
      JSON.stringify({ 
        success: true, 
        avatarUrl: publicUrl,
        filename: fileName 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Avatar generation error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate avatar',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})