import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import {InterviewAnalysisResult, InterviewSessionRecord} from '../types/interview';

const LOCAL_SESSIONS_KEY = '@preprole_interview_sessions';

/**
 * Saves an interview analysis session to Supabase (and local storage as offline cache)
 */
export async function saveInterviewSession(
  userId: string,
  analysis: InterviewAnalysisResult,
): Promise<InterviewSessionRecord> {
  const sessionRecord: InterviewSessionRecord = {
    ...analysis,
    id: analysis.id || `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    created_at: analysis.created_at || new Date().toISOString(),
  };

  // 1. Try Supabase insert
  try {
    const {data, error} = await supabase
      .from('interview_sessions')
      .insert({
        user_id: userId,
        experience_level: analysis.experience_level,
        recording_mode: analysis.recording_mode,
        target_role: analysis.target_role,
        duration_seconds: analysis.duration_seconds,
        overall_score: analysis.overall_score,
        score_tier: analysis.score_tier,
        breakdown: analysis.breakdown,
        summary: analysis.summary,
        strengths: analysis.strengths,
        improvements: analysis.improvements,
        ideal_script_rewrite: analysis.ideal_script_rewrite,
        key_takeaways: analysis.key_takeaways,
        filler_words: analysis.filler_words || [],
        pacing_wpm_estimate: analysis.pacing_wpm_estimate || 130,
      })
      .select()
      .single();

    if (error) {
      console.warn('Supabase save error (falling back to local cache):', error.message);
    } else if (data) {
      sessionRecord.id = data.id;
      sessionRecord.created_at = data.created_at;
    }
  } catch (err) {
    console.warn('Supabase exception saving interview session:', err);
  }

  // 2. Always persist to local AsyncStorage cache
  try {
    const cached = await getLocalInterviewSessions(userId);
    const updated = [sessionRecord, ...cached.filter(s => s.id !== sessionRecord.id)];
    await AsyncStorage.setItem(
      `${LOCAL_SESSIONS_KEY}_${userId}`,
      JSON.stringify(updated.slice(0, 50)),
    );
  } catch (err) {
    console.warn('Failed to cache interview session locally:', err);
  }

  return sessionRecord;
}

/**
 * Retrieves all previous interview sessions for the user
 */
export async function getUserInterviewSessions(
  userId: string,
): Promise<InterviewSessionRecord[]> {
  try {
    const {data, error} = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', {ascending: false});

    if (!error && data && data.length > 0) {
      // Update local cache
      try {
        await AsyncStorage.setItem(
          `${LOCAL_SESSIONS_KEY}_${userId}`,
          JSON.stringify(data),
        );
      } catch {}
      return data as InterviewSessionRecord[];
    }
  } catch (err) {
    console.warn('Failed to fetch interview sessions from Supabase, loading local:', err);
  }

  return await getLocalInterviewSessions(userId);
}

/**
 * Fallback to read locally stored sessions
 */
async function getLocalInterviewSessions(
  userId: string,
): Promise<InterviewSessionRecord[]> {
  try {
    const json = await AsyncStorage.getItem(`${LOCAL_SESSIONS_KEY}_${userId}`);
    if (json) {
      return JSON.parse(json) as InterviewSessionRecord[];
    }
  } catch (err) {
    console.warn('Failed to read local interview sessions:', err);
  }
  return [];
}
