import {supabase} from '../lib/supabase';
import {UserQuota} from '../types/resume';

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(() => resolve(undefined), ms));

/**
 * Fetches the current user's scan quota and subscription status from Supabase.
 */
export async function getUserQuota(
  userId: string,
  retries = 2,
): Promise<UserQuota | null> {
  try {
    const {data, error} = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Handle transient PGRST303 clock skew
      if (
        retries > 0 &&
        (error.code === 'PGRST303' ||
          error.message?.toLowerCase().includes('future'))
      ) {
        await sleep(700);
        return getUserQuota(userId, retries - 1);
      }

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
  } catch (err: any) {
    if (retries > 0 && err?.message?.toLowerCase().includes('future')) {
      await sleep(700);
      return getUserQuota(userId, retries - 1);
    }
    console.warn('Could not fetch user quota:', err?.message || err);
    return {
      user_id: userId,
      plan_type: 'free',
      credits_remaining: 3,
      lifetime_scans_used: 0,
      pro_until: null,
    };
  }
}
