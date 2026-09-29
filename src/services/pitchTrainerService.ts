import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import {
  PersonalPitch,
  PitchNotes,
  PitchAnalysisResult,
  PitchSectionKey,
  MAX_PERSONAL_PITCHES,
  getScoreBand,
} from '../types/pitchTrainer';
import {callGeminiApi} from './geminiClient';

function cleanJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
}

const STORAGE_KEYS = {
  PITCHES: '@preprole_pitch_trainer_pitches',
  NOTES_DRAFT_PREFIX: '@preprole_pitch_notes_draft_',
  HIDE_PRE_TIPS: '@preprole_pitch_hide_tips',
};

export const INITIAL_PITCH_NOTES: PitchNotes = {
  introduction: '',
  goals: '',
  workExperience: '',
  skills: '',
  achievements: '',
  conclusion: '',
};

/**
 * Validate and normalize target job role
 */
export async function validatePitchJobRole(
  rawRole: string,
  country: string = 'India',
): Promise<{valid: boolean; normalizedRole: string; reason?: string}> {
  const clean = rawRole.trim();
  if (clean.length < 2) {
    return {valid: false, normalizedRole: clean, reason: 'Please enter a job title.'};
  }

  const prompt = `
Validate and normalize this job title for an applicant in ${country}:
User Input: "${clean}"

STRICT JSON OUTPUT:
{
  "valid": boolean,
  "normalizedRole": "string", // Official, clean industry standard job title
  "reason": "string" // brief reason if invalid
}
`;

  try {
    const data = await callGeminiApi({
      contents: [{role: 'user', parts: [{text: prompt}]}],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      const parsed = JSON.parse(rawText.trim());
      return {
        valid: !!parsed.valid,
        normalizedRole: parsed.normalizedRole || clean,
        reason: parsed.reason,
      };
    }
  } catch (e) {
    console.warn('validatePitchJobRole AI failed, using fallback:', e);
  }

  // Fallback: capitalize words
  const normalized = clean
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return {valid: true, normalizedRole: normalized};
}

/**
 * Save notes draft locally per language
 */
export async function saveLocalNotesDraft(
  language: string,
  notes: PitchNotes,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.NOTES_DRAFT_PREFIX}${language}`,
      JSON.stringify(notes),
    );
  } catch (err) {
    console.warn('saveLocalNotesDraft error:', err);
  }
}

/**
 * Get local notes draft for a specific language
 */
export async function getLocalNotesDraft(language: string): Promise<PitchNotes> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_KEYS.NOTES_DRAFT_PREFIX}${language}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {...INITIAL_PITCH_NOTES};
}

/**
 * Get all pitches for user
 */
export async function getPersonalPitches(userId: string): Promise<PersonalPitch[]> {
  try {
    const {data, error} = await supabase
      .from('pitch_trainer_pitches')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', {ascending: false});

    if (!error && data && data.length > 0) {
      const mapped: PersonalPitch[] = data.map(r => ({
        id: r.id,
        userId: r.user_id,
        status: r.status,
        jobRole: r.job_role,
        language: r.language,
        notes: r.notes || {...INITIAL_PITCH_NOTES},
        transcript: r.transcript || '',
        durationSeconds: r.duration_seconds || 0,
        videoUrl: r.video_url || undefined,
        audioUri: r.audio_url || undefined,
        recordingMode: r.recording_mode || 'video',
        analysis: r.analysis || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      await AsyncStorage.setItem(
        `${STORAGE_KEYS.PITCHES}_${userId}`,
        JSON.stringify(mapped),
      );
      return mapped;
    }
  } catch (e) {
    console.warn('getPersonalPitches Supabase error, loading cache:', e);
  }

  try {
    const local = await AsyncStorage.getItem(`${STORAGE_KEYS.PITCHES}_${userId}`);
    if (local) return JSON.parse(local);
  } catch {}

  return [];
}

/**
 * Get saved pitches (status: 'saved')
 */
export async function getSavedPitches(userId: string): Promise<PersonalPitch[]> {
  const all = await getPersonalPitches(userId);
  return all.filter(p => p.status === 'saved');
}

/**
 * Get active draft pitch if one exists (Rule PT-3: only one draft at a time)
 */
export async function getPitchDraft(userId: string): Promise<PersonalPitch | null> {
  const all = await getPersonalPitches(userId);
  return all.find(p => p.status === 'draft') || null;
}

/**
 * Get up to 4 unique roles from previous pitches (excluding drafts)
 */
export async function getPreviousRoles(userId: string): Promise<string[]> {
  const all = await getPersonalPitches(userId);
  const roles = all
    .filter(p => p.status !== 'draft' && p.jobRole)
    .map(p => p.jobRole.trim());
  const unique = Array.from(new Set(roles));
  return unique.slice(0, 4);
}

/**
 * Create or initialize draft pitch
 */
export async function createPitchDraft(
  userId: string,
  jobRole: string,
  language: string,
  notes: PitchNotes,
  recordingMode: 'video' | 'audio' = 'video',
): Promise<PersonalPitch> {
  const newPitch: PersonalPitch = {
    id: `pitch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId,
    status: 'draft',
    jobRole,
    language,
    notes,
    transcript: '',
    durationSeconds: 0,
    recordingMode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const {data} = await supabase
      .from('pitch_trainer_pitches')
      .insert({
        user_id: userId,
        status: 'draft',
        job_role: jobRole,
        language,
        notes,
        transcript: '',
        duration_seconds: 0,
        recording_mode: recordingMode,
      })
      .select()
      .single();

    if (data) {
      newPitch.id = data.id;
      newPitch.createdAt = data.created_at;
      newPitch.updatedAt = data.updated_at;
    }
  } catch (e) {
    console.warn('createPitchDraft Supabase error:', e);
  }

  // Update local storage
  const all = await getPersonalPitches(userId);
  const updated = [newPitch, ...all.filter(p => p.id !== newPitch.id && p.status !== 'draft')];
  await AsyncStorage.setItem(`${STORAGE_KEYS.PITCHES}_${userId}`, JSON.stringify(updated));

  return newPitch;
}

/**
 * Update an existing pitch
 */
export async function updatePitch(
  userId: string,
  pitchId: string,
  updates: Partial<PersonalPitch>,
): Promise<PersonalPitch> {
  const all = await getPersonalPitches(userId);
  const existing = all.find(p => p.id === pitchId);
  const updatedPitch: PersonalPitch = {
    ...(existing || {
      id: pitchId,
      userId,
      status: 'draft',
      jobRole: 'General',
      language: 'en-US',
      notes: {...INITIAL_PITCH_NOTES},
      transcript: '',
      durationSeconds: 0,
      recordingMode: 'video',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  try {
    await supabase.from('pitch_trainer_pitches').upsert({
      id: updatedPitch.id,
      user_id: userId,
      status: updatedPitch.status,
      job_role: updatedPitch.jobRole,
      language: updatedPitch.language,
      notes: updatedPitch.notes,
      transcript: updatedPitch.transcript,
      duration_seconds: updatedPitch.durationSeconds,
      video_url: updatedPitch.videoUrl || null,
      audio_url: updatedPitch.audioUri || null,
      recording_mode: updatedPitch.recordingMode,
      overall_score: updatedPitch.analysis?.overallRating || null,
      score_tier: updatedPitch.analysis?.scoreBandLabel || null,
      analysis: updatedPitch.analysis || null,
      updated_at: updatedPitch.updatedAt,
    });
  } catch (e) {
    console.warn('updatePitch Supabase error:', e);
  }

  const nextList = [updatedPitch, ...all.filter(p => p.id !== pitchId)];
  await AsyncStorage.setItem(`${STORAGE_KEYS.PITCHES}_${userId}`, JSON.stringify(nextList));

  return updatedPitch;
}

/**
 * Delete a pitch (e.g. Discard or user delete)
 */
export async function deletePitch(userId: string, pitchId: string): Promise<boolean> {
  try {
    await supabase.from('pitch_trainer_pitches').delete().eq('id', pitchId);
  } catch (e) {
    console.warn('deletePitch Supabase error:', e);
  }

  const all = await getPersonalPitches(userId);
  const filtered = all.filter(p => p.id !== pitchId);
  await AsyncStorage.setItem(`${STORAGE_KEYS.PITCHES}_${userId}`, JSON.stringify(filtered));
  return true;
}

/**
 * AI Pitch Analysis across all 6 sections
 */
export async function analyzePersonalPitch(
  pitch: PersonalPitch,
): Promise<PitchAnalysisResult> {
  const prompt = `
You are an executive Speech and Pitch Coach analyzing a candidate's personal elevator pitch for the role of "${pitch.jobRole}".
Recording Mode: ${pitch.recordingMode}
Spoken Pitch Transcript: "${pitch.transcript}"
Candidate's Prepared Notes:
- Introduction: "${pitch.notes.introduction}"
- Goals: "${pitch.notes.goals}"
- Work Experience: "${pitch.notes.workExperience}"
- Skills: "${pitch.notes.skills}"
- Achievements: "${pitch.notes.achievements}"
- Conclusion: "${pitch.notes.conclusion}"

Evaluate each section on a 1.0 to 5.0 scale.
If a section was completely skipped or not spoken, mark "covered": false, and score: 1.0.
Calculate overallRating (1.0 to 5.0 average of covered sections).

STRICT JSON OUTPUT FORMAT:
{
  "overallRating": number, // 1.0 to 5.0
  "sectionScores": {
    "introduction": {"score": number, "feedback": "string", "covered": boolean},
    "goals": {"score": number, "feedback": "string", "covered": boolean},
    "workExperience": {"score": number, "feedback": "string", "covered": boolean},
    "skills": {"score": number, "feedback": "string", "covered": boolean},
    "achievements": {"score": number, "feedback": "string", "covered": boolean},
    "conclusion": {"score": number, "feedback": "string", "covered": boolean}
  },
  "strengths": ["string", "string", "string"],
  "improvements": ["string", "string"],
  "idealPitchScript": "string" // A full, polished 60-90 second rewrite script the candidate can speak word-for-word
}
`;

  try {
    const data = await callGeminiApi({
      contents: [{role: 'user', parts: [{text: prompt}]}],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      const parsed = cleanJson(rawText);
      const overall = Math.min(5, Math.max(1, Number(parsed.overallRating) || 3.5));
      const band = getScoreBand(overall);
      return {
        overallRating: overall,
        scoreBandEmoji: band.emoji,
        scoreBandLabel: band.label,
        sectionScores: parsed.sectionScores,
        strengths: parsed.strengths || ['Good presence and confidence'],
        improvements: parsed.improvements || ['Tie achievements directly to business impact'],
        idealPitchScript: parsed.idealPitchScript || 'Hi, I am passionate about engineering robust systems...',
      };
    }
  } catch (err) {
    console.warn('analyzePersonalPitch AI error, using fallback evaluation:', err);
  }

  // Fallback analysis
  const overall = 3.6;
  const band = getScoreBand(overall);
  const sections: PitchSectionKey[] = [
    'introduction',
    'goals',
    'workExperience',
    'skills',
    'achievements',
    'conclusion',
  ];
  const sectionScores: any = {};
  sections.forEach(sec => {
    sectionScores[sec] = {
      score: 3.5,
      feedback: `Solid coverage of your ${sec}. Adding more specific metrics will elevate your impression.`,
      covered: true,
    };
  });

  return {
    overallRating: overall,
    scoreBandEmoji: band.emoji,
    scoreBandLabel: band.label,
    sectionScores,
    strengths: [
      'Strong opening clarity',
      'Articulated relevant domain strengths',
      'Confident delivery cadence',
    ],
    improvements: [
      'Quantify your achievements with numbers/percentages',
      'Make your closing call-to-action more assertive',
    ],
    idealPitchScript: `Hello! I am a professional focused on ${pitch.jobRole}. Over the past years, I have spearheaded impactful initiatives, honed my core technical competencies, and delivered measurable results. I am excited to bring this problem-solving mindset and dedication to your organization.`,
  };
}

/**
 * Generate public shareable URL for pitch
 */
export function getPitchShareUrl(pitchId: string, language: string = 'en'): string {
  const langKey = language.split('-')[0] || 'en';
  return `https://preprole.app/${langKey}/view-pitch/${pitchId}`;
}
