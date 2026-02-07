import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a deterministic avatar for a wallet ID
 * @param walletId The Hedera wallet ID (e.g., "0.0.123456")
 * @returns Promise<string | null> The avatar URL or null if generation failed
 */
export async function generateWalletAvatar(walletId: string): Promise<string | null> {
  try {
    console.log('Generating avatar for wallet:', walletId);
    
    // Call the edge function to generate avatar
    const { data, error } = await supabase.functions.invoke('generate-avatar', {
      body: { walletId }
    });
    
    if (error) {
      console.error('Avatar generation error:', error);
      return null;
    }
    
    if (data?.success && data?.avatarUrl) {
      console.log('Avatar generated successfully:', data.avatarUrl);
      return data.avatarUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to generate avatar:', error);
    return null;
  }
}

/**
 * Gets an existing avatar URL for a wallet from hedera_wallets table
 * @param walletId The Hedera wallet ID
 * @returns Promise<string | null> The existing avatar URL or null
 */
export async function getExistingWalletAvatar(walletId: string): Promise<string | null> {
  try {
    // Get avatar directly from hedera_wallets table using persona_color as a proxy
    // (avatars are stored in image_files and referenced by wallet)
    const { data } = await supabase
      .from('image_files')
      .select('url')
      .eq('filename', `avatar-${walletId}.svg`)
      .maybeSingle();
    
    return data?.url || null;
  } catch (error) {
    console.error('Failed to check existing avatar:', error);
    return null;
  }
}

/**
 * Updates a wallet's avatar URL in the image_files table
 * @param walletId The wallet ID
 * @param avatarUrl The avatar URL
 * @returns Promise<boolean> Success status
 */
export async function updateWalletAvatar(walletId: string, avatarUrl: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('image_files')
      .upsert({
        filename: `avatar-${walletId}.svg`,
        url: avatarUrl,
        alt_text: `Avatar for wallet ${walletId}`,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'filename'
      });
    
    if (error) {
      console.error('Failed to update wallet avatar:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to update wallet avatar:', error);
    return false;
  }
}
