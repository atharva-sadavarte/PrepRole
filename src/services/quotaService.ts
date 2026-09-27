import {supabase} from '../lib/supabase';
import {UserQuota} from '../types/resume';

/**
 * Fetches the current user's scan quota and subscription status from Supabase.
 */
export async function getUserQuota(userId: string): Promise<UserQuota | null> {
  try {
    const {data, error} = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no row exists yet, return default free quota
      console.warn('Could not fetch user quota:', error.message);
      return {
        user_id: userId,
        plan_type: 'free',
        credits_remaining: 3,
        lifetime_scans_used: 0,
        pro_until: null,
      };
    }

    return data as UserQuota;
  } catch (err) {
    console.error('Error in getUserQuota:', err);
    return null;
  }
}
