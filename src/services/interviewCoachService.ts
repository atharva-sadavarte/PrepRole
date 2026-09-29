import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import {
  InterviewJourney,
  JourneyRound,
  InterviewAttempt,
  JobRoleValidationResponse,
  SocraticMessage,
  ROUND_SKELETON_CONFIG,
} from '../types/interviewCoach';
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
  JOURNEYS: '@preprole_interview_journeys',
  ATTEMPTS: '@preprole_interview_attempts',
  AUTO_RESUME_SUPPRESSED: '@preprole_auto_resume_suppressed',
  EXIT_SURVEY_DISMISSED: '@preprole_exit_survey_dismissed',
  LANGUAGE_PREF: '@preprole_interview_lang',
};

// In-memory session suppression flag (per app launch)
let isAutoResumeSuppressedThisSession = false;

export function setAutoResumeSuppressed(suppressed: boolean) {
  isAutoResumeSuppressedThisSession = suppressed;
}

export function isAutoResumeSuppressed(): boolean {
  return isAutoResumeSuppressedThisSession;
}

/**
 * AI Socratic Dialogue for Job Role Validation
 */
export async function validateJobRoleSocratic(
  history: SocraticMessage[],
  newMessage: string,
  language: string = 'en-US',
  learnerCountry: string = 'India',
): Promise<JobRoleValidationResponse> {
  const promptHistory = history.map(m => `${m.role === 'user' ? 'Candidate' : 'Coach'}: ${m.content}`).join('\n');

  const systemInstruction = `
You are an expert Socratic Career Coach conducting an intake dialogue with a job candidate.
Your goal is to identify and confirm their EXACT target job title and domain (e.g. "Senior React Native Engineer", "Associate Product Manager", "Backend Java Developer", "Cloud DevOps Engineer").
Learner Country: ${learnerCountry}
Language: ${language}

RULES:
1. If the candidate gives a vague role (e.g. "developer", "engineer", "tech job", "manager"), ask 1 brief, smart clarifying question to narrow down seniority, tech stack, or specialization. Keep "end" = false.
2. If the role is sufficiently clear and specific, normalize it into an official professional industry title (in "final_title"), write a concise 1-2 sentence jobDescription, give an encouraging 1-sentence confirmation message, and set "end" = true.
3. If what they typed is gibberish or not a job role, explain politely what you need and set "end" = false.

STRICT JSON OUTPUT FORMAT ONLY:
{
  "end": boolean,
  "final_title": string | null,
  "user_title": string,
  "message": string,
  "jobDescription": string | null
}
`;

  const userContent = `PREVIOUS CONVERSATION:\n${promptHistory}\n\nCandidate's New Input: "${newMessage}"`;

  try {
    const data = await callGeminiApi({
      systemInstruction: {parts: [{text: systemInstruction}]},
      contents: [{role: 'user', parts: [{text: userContent}]}],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      const parsed = JSON.parse(rawText.trim());
      return {
        end: !!parsed.end,
        final_title: parsed.final_title || undefined,
        user_title: parsed.user_title || newMessage,
        message: parsed.message || 'Great! Let us begin your interview journey.',
        jobDescription: parsed.jobDescription || undefined,
      };
    }
  } catch (e) {
    console.warn('validateJobRoleSocratic AI call failed, using fallback heuristic:', e);
  }

  // Fallback heuristic if offline or error
  const cleanInput = newMessage.trim();
  const isSpecific = cleanInput.length >= 4 && cleanInput.split(' ').length >= 2;
  if (isSpecific) {
    return {
      end: true,
      final_title: cleanInput,
      user_title: cleanInput,
      message: `Excellent! We will prepare you thoroughly for the "${cleanInput}" role across all 10 rounds.`,
      jobDescription: `Target preparation for ${cleanInput} focusing on foundational competencies, technical trade-offs, and behavioral excellence.`,
    };
  } else {
    return {
      end: false,
      user_title: cleanInput,
      message: `Could you tell me a bit more about your preferred stack or specialization for "${cleanInput}"? (e.g. Frontend, Backend, or Mobile?)`,
    };
  }
}

import {
  getFallback10RoundQuestions,
  sanitize10RoundQuestions,
} from '../utils/interviewQuestions';
export {getFallback10RoundQuestions, sanitize10RoundQuestions};

/**
 * Generate 10-round questions skeleton for confirmed job role
 */
export async function generate10RoundQuestions(
  jobRole: string,
  language: string = 'en-US',
  learnerCountry: string = 'India',
): Promise<JourneyRound[]> {
  const prompt = `
You are an expert technical interviewer and executive talent recruiter.
Generate exactly 10 structured, realistic interview questions for a candidate targeting the role: "${jobRole}".
Country: ${learnerCountry}
Language: ${language}

STRICT PROGRESSIVE DIFFICULTY CRITERIA:
- Round 1 [Warm-up]: MUST be the classic "Tell me about yourself" introductory question tailored specifically to the ${jobRole} role (e.g., "Tell me about yourself, your background, and why you are interested in this position as a ${jobRole}.").
- Rounds 2-4 [Easy]: Foundational core knowledge & standard workflows:
  * Round 2 (Easy): Core technical tools, foundational principles, and daily frameworks for ${jobRole}.
  * Round 3 (Easy): Standard development/implementation workflow from user story to shipping features.
  * Round 4 (Easy): Team collaboration, constructive code reviews, and daily task prioritization.
- Rounds 5-8 [Medium]: Realistic problem solving, architecture & conflict resolution:
  * Round 5 (Medium): Debugging a complex technical bug, memory leak, or performance bottleneck in ${jobRole}.
  * Round 6 (Medium): Evaluating architectural trade-offs between competing solutions or libraries.
  * Round 7 (Medium): Handling unexpected scope changes or shifting deadlines near a major launch.
  * Round 8 (Medium): Resolving a technical disagreement with a peer, designer, or product manager.
- Rounds 9-10 [Hard]: High-stakes crisis management and definitive trial:
  * Round 9 (Hard): Production incident or system outage triage, root-cause isolation, and preventative safeguards.
  * Round 10 (Hard - Real Interview): The ultimate final interview challenge—designing a high-scale, resilient system architecture from scratch under real-world constraints.

STRICT JSON OUTPUT FORMAT:
{
  "questions": [
    {
      "roundNumber": 1,
      "level": "warmup",
      "question": "Tell me about yourself, your background, and why you are interested in this position as a ${jobRole}.",
      "contextHint": "Coaching tip explaining what recruiters listen for and how to structure the response (Present-Past-Future or STAR).",
      "sampleAnswer": "A 4-5 star exemplary answer demonstrating structure and depth."
    },
    ... (exactly 10 items, roundNumber 1 to 10)
  ]
}
`;

  try {
    const data = await callGeminiApi({
      contents: [{role: 'user', parts: [{text: prompt}]}],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      const parsed = JSON.parse(rawText.trim());
      if (Array.isArray(parsed.questions) && parsed.questions.length === 10) {
        return sanitize10RoundQuestions(parsed.questions, jobRole);
      }
    }
  } catch (err) {
    console.warn('generate10RoundQuestions AI call failed, using fallback:', err);
  }

  // Fallback 10-round questions generator with unique, progressive questions
  return getFallback10RoundQuestions(jobRole);
}

import {isValidSpokenSpeech, cleanSpokenTranscript} from '../utils/speechUtils';
export {isValidSpokenSpeech, cleanSpokenTranscript};

/**
 * Transcribes user speech recording using Gemini 3.6 Flash multimodal audio
 */
export async function transcribeUserAudioWithGemini(
  audioBase64?: string,
  language: string = 'en-US',
): Promise<string> {
  if (!audioBase64 || audioBase64.trim().length === 0) {
    return '';
  }

  const prompt = `You are an elite, highly accurate Speech-to-Text audio transcriber.
Listen to this audio recording carefully and transcribe the candidate's exact spoken speech word-for-word in English (or their spoken language).
Rules:
1. Transcribe all audible words, including conversational sentences, technical terms, and self-introductions.
2. Even if there are pauses, ambient room noise, or slight accents, transcribe the human voice accurately.
3. Output ONLY the transcribed words.
4. Do NOT wrap in quotes, do NOT add explanations, timestamps, markdown, or commentary.
5. If and only if the recording contains absolute silence with zero human speech, respond with: [NO_SPEECH]`;

  try {
    const data = await callGeminiApi({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/mp4',
                data: audioBase64,
              },
            },
            {text: prompt},
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    });

    const parts = data?.candidates?.[0]?.content?.parts || [];
    let rawText = '';
    for (const part of parts) {
      if (part?.text) {
        rawText += part.text + ' ';
      }
    }

    return cleanSpokenTranscript(rawText);
  } catch (err) {
    console.warn('transcribeUserAudioWithGemini error:', err);
    throw err;
  }
}

/**
 * Grade user's answer for a specific round using Gemini AI multimodal analysis
 */
export async function gradeInterviewAttempt(
  jobRole: string,
  roundNumber: number,
  question: string,
  userResponseText: string,
  durationSeconds: number = 60,
  audioBase64?: string,
): Promise<{
  score: number; // 1 to 5
  passed: boolean; // score >= 3.0
  ratings: {structure: number; relevance: number; delivery: number};
  feedback: string;
  strengths: string[];
  improvements: string[];
  sampleAnswer: string;
  audioMetrics?: {
    vocalConfidence: string;
    speechPace: string;
    audioClarity: string;
  };
}> {
  const prompt = `
You are an expert Executive Interview Coach and Hiring Manager.
Evaluate the candidate's real interview attempt for the role of "${jobRole}".
Round: Round ${roundNumber} (Scale 1 to 10 progressive roadmap)
Interview Question: "${question}"
Candidate's Spoken Answer: "${userResponseText}"
Duration: ${durationSeconds} seconds

AUDIO & MULTIMODAL EVALUATION:
Listen directly to the candidate's provided audio recording (if attached). Analyze:
1. Vocal delivery: Confidence, enthusiasm, hesitation/filler words ("um", "uh"), pauses.
2. Pace and clarity: Whether they spoke too fast, too slow, or at an executive pace.
3. Content & Structure: Did they structure with STAR or Situation/Action/Result? Did they address the "${jobRole}" role directly?

SCORING RULES:
1. Score from 1.0 to 5.0 (e.g. 3.2, 3.8, 4.2). PASS THRESHOLD >= 3.0.
2. ratings breakdown (each 1.0 to 5.0):
   - structure: Opening, logical flow, crisp conclusion.
   - relevance: Role-specific technical depth and alignment for ${jobRole}.
   - delivery: Vocal presence, speech pacing, clarity, lack of filler words.
3. feedback: Direct, highly personalized coaching feedback referencing their exact words and vocal tone.
4. strengths: 2-3 specific positives about their answer.
5. improvements: 2-3 high-leverage coaching recommendations.
6. sampleAnswer: A gold-standard model answer for this exact question.
7. audioMetrics: { "vocalConfidence": "High / Moderate / Developing", "speechPace": "e.g. 130 WPM (Optimal)", "audioClarity": "Crisp & Clear / Soft / Background Noise" }

STRICT JSON OUTPUT FORMAT ONLY:
{
  "score": number,
  "ratings": {
    "structure": number,
    "relevance": number,
    "delivery": number
  },
  "feedback": "string",
  "strengths": ["string", "string"],
  "improvements": ["string", "string"],
  "sampleAnswer": "string",
  "audioMetrics": {
    "vocalConfidence": "string",
    "speechPace": "string",
    "audioClarity": "string"
  }
}
`;

  try {
    const parts: Array<any> = [];
    if (audioBase64 && audioBase64.length > 50) {
      parts.push({
        inlineData: {
          mimeType: 'audio/mp4',
          data: audioBase64,
        },
      });
    }
    parts.push({text: prompt});

    const data = await callGeminiApi({
      contents: [{role: 'user', parts}],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: 'application/json',
      },
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      const parsed = cleanJson(rawText);
      const score = Math.min(5, Math.max(1, Number(parsed.score) || 3.0));
        return {
          score,
          passed: score >= 3.0,
          ratings: {
            structure: Math.min(5, Math.max(1, Number(parsed.ratings?.structure) || score)),
            relevance: Math.min(5, Math.max(1, Number(parsed.ratings?.relevance) || score)),
            delivery: Math.min(5, Math.max(1, Number(parsed.ratings?.delivery) || score)),
          },
          feedback: parsed.feedback || 'Good attempt. Focus on structuring your points clearly.',
          strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : ['Clear articulation of thoughts'],
          improvements: Array.isArray(parsed.improvements) && parsed.improvements.length > 0 ? parsed.improvements : ['Add more quantifiable achievements'],
          sampleAnswer: parsed.sampleAnswer || 'In this scenario, emphasize practical examples and business outcomes.',
          audioMetrics: parsed.audioMetrics || {
            vocalConfidence: 'Moderate',
            speechPace: '125 WPM (Optimal)',
            audioClarity: 'Clear',
          },
        };
      }
  } catch (err) {
    console.warn('gradeInterviewAttempt AI call failed, using heuristic evaluation:', err);
  }

  // Offline heuristic scoring
  const wordCount = userResponseText.trim().split(/\s+/).length;
  let fallbackScore = 3.2;
  if (wordCount < 15) fallbackScore = 2.0;
  else if (wordCount < 40) fallbackScore = 2.8;
  else if (wordCount > 70) fallbackScore = 4.2;
  else fallbackScore = 3.5;

  return {
    score: fallbackScore,
    passed: fallbackScore >= 3.0,
    ratings: {
      structure: Math.round(fallbackScore),
      relevance: Math.round(fallbackScore),
      delivery: Math.round(fallbackScore),
    },
    feedback:
      fallbackScore >= 3.0
        ? 'Well articulated with solid relevance to the role. Keep refining your opening hook.'
        : 'Your answer needs more depth and structured examples. Practice speaking for 60 to 90 seconds.',
    strengths: ['Relevant domain perspective', 'Confidence in delivery'],
    improvements: ['Structure answers with Situation, Task, Action, Result', 'Include more specific examples'],
    sampleAnswer: `When addressing this question for ${jobRole}, open with a direct answer, back it up with a real project example, and close with the positive impact achieved.`,
    audioMetrics: {
      vocalConfidence: fallbackScore >= 3.0 ? 'High' : 'Needs Work',
      speechPace: '120 WPM',
      audioClarity: 'Recorded',
    },
  };
}

/**
 * Check if Warm-up (R1) is skippable for returning user
 */
export async function checkR1Skippable(userId: string): Promise<boolean> {
  try {
    const journeys = await getUserJourneys(userId);
    // If user has at least one other journey where R1 was completed, they can skip
    const hasCompletedAnyR1 = journeys.some(j =>
      j.rounds.some(r => r.roundNumber === 1 && (r.status === 'completed' || r.status === 'skipped'))
    );
    return hasCompletedAnyR1;
  } catch (e) {
    return false;
  }
}

/**
 * Save or update journey
 */
export async function saveInterviewJourney(
  journey: InterviewJourney,
): Promise<InterviewJourney> {
  const updatedJourney = {
    ...journey,
    updatedAt: new Date().toISOString(),
  };

  // 1. Try Supabase
  try {
    await supabase.from('interview_journeys').upsert({
      id: updatedJourney.id,
      user_id: updatedJourney.userId,
      job_role: updatedJourney.jobRole,
      language: updatedJourney.language,
      learner_country: updatedJourney.learnerCountry,
      status: updatedJourney.status,
      current_round_number: updatedJourney.currentRoundNumber,
      rounds: updatedJourney.rounds,
      updated_at: updatedJourney.updatedAt,
    });
  } catch (e) {
    console.warn('Supabase save error for interview journey:', e);
  }

  // 2. Persist to local cache
  try {
    const all = await getUserJourneys(journey.userId);
    const filtered = all.filter(j => j.id !== journey.id);
    const combined = [updatedJourney, ...filtered];
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.JOURNEYS}_${journey.userId}`,
      JSON.stringify(combined),
    );
  } catch (err) {
    console.warn('AsyncStorage cache error for journey:', err);
  }

  return updatedJourney;
}

/**
 * Get all journeys for a user
 */
export async function getUserJourneys(userId: string): Promise<InterviewJourney[]> {
  try {
    const {data, error} = await supabase
      .from('interview_journeys')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', {ascending: false});

    if (!error && data && data.length > 0) {
      const mapped: InterviewJourney[] = data.map(row => ({
        id: row.id,
        userId: row.user_id,
        jobRole: row.job_role,
        language: row.language,
        learnerCountry: row.learner_country,
        status: row.status,
        currentRoundNumber: row.current_round_number,
        rounds: Array.isArray(row.rounds) ? row.rounds : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      // Sync local cache
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.JOURNEYS}_${userId}`,
        JSON.stringify(mapped),
      );
      return mapped;
    }
  } catch (e) {
    console.warn('Failed to load journeys from Supabase, loading from cache:', e);
  }

  // Read local cache
  try {
    const local = await AsyncStorage.getItem(`${STORAGE_KEYS.JOURNEYS}_${userId}`);
    if (local) {
      return JSON.parse(local) as InterviewJourney[];
    }
  } catch {}

  return [];
}

/**
 * Get journey by ID
 */
export async function getJourneyById(
  userId: string,
  journeyId: string,
): Promise<InterviewJourney | null> {
  const all = await getUserJourneys(userId);
  return all.find(j => j.id === journeyId) || null;
}

/**
 * Find existing journey for normalized job role
 */
export async function findExistingJourneyForRole(
  userId: string,
  jobRole: string,
): Promise<InterviewJourney | null> {
  const all = await getUserJourneys(userId);
  const normalizedTarget = jobRole.trim().toLowerCase();
  return (
    all.find(
      j => j.jobRole.trim().toLowerCase() === normalizedTarget && j.status === 'inProgress',
    ) || null
  );
}

/**
 * Get latest in-progress journey (for auto-resume)
 */
export async function getLatestInProgressJourney(
  userId: string,
): Promise<InterviewJourney | null> {
  if (isAutoResumeSuppressed()) {
    return null;
  }
  const all = await getUserJourneys(userId);
  return all.find(j => j.status === 'inProgress') || null;
}

/**
 * Delete a journey
 */
export async function deleteInterviewJourney(
  userId: string,
  journeyId: string,
): Promise<boolean> {
  try {
    await supabase.from('interview_journeys').delete().eq('id', journeyId);
  } catch (e) {
    console.warn('Supabase delete error:', e);
  }

  try {
    const all = await getUserJourneys(userId);
    const updated = all.filter(j => j.id !== journeyId);
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.JOURNEYS}_${userId}`,
      JSON.stringify(updated),
    );
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Save an interview attempt
 */
export async function saveInterviewAttempt(
  userId: string,
  attempt: InterviewAttempt,
): Promise<void> {
  try {
    await supabase.from('interview_journey_attempts').insert({
      id: attempt.id,
      journey_id: attempt.journeyId,
      user_id: userId,
      round_number: attempt.roundNumber,
      question: attempt.question,
      user_response_text: attempt.userResponseText,
      audio_url: attempt.audioUri || null,
      duration_seconds: attempt.durationSeconds,
      score: attempt.score,
      passed: attempt.passed,
      ratings: attempt.ratings,
      feedback: attempt.feedback,
      strengths: attempt.strengths,
      improvements: attempt.improvements,
      sample_answer: attempt.sampleAnswer,
      created_at: attempt.createdAt,
    });
  } catch (e) {
    console.warn('Supabase attempt save error:', e);
  }

  try {
    const key = `${STORAGE_KEYS.ATTEMPTS}_${attempt.journeyId}`;
    const raw = await AsyncStorage.getItem(key);
    const existing: InterviewAttempt[] = raw ? JSON.parse(raw) : [];
    existing.unshift(attempt);
    await AsyncStorage.setItem(key, JSON.stringify(existing));
  } catch (err) {
    console.warn('AsyncStorage attempt cache error:', err);
  }
}

/**
 * Get all attempts for a journey
 */
export async function getAttemptsForJourney(
  journeyId: string,
): Promise<InterviewAttempt[]> {
  try {
    const {data} = await supabase
      .from('interview_journey_attempts')
      .select('*')
      .eq('journey_id', journeyId)
      .order('created_at', {ascending: false});

    if (data && data.length > 0) {
      return data.map(r => ({
        id: r.id,
        journeyId: r.journey_id,
        roundNumber: r.round_number,
        question: r.question,
        userResponseText: r.user_response_text,
        audioUri: r.audio_url || undefined,
        durationSeconds: r.duration_seconds,
        score: Number(r.score),
        passed: !!r.passed,
        ratings: r.ratings || {structure: 3, relevance: 3, delivery: 3},
        feedback: r.feedback,
        strengths: r.strengths || [],
        improvements: r.improvements || [],
        sampleAnswer: r.sample_answer,
        createdAt: r.created_at,
      }));
    }
  } catch {}

  try {
    const key = `${STORAGE_KEYS.ATTEMPTS}_${journeyId}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}

  return [];
}
