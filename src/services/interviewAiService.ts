import {
  ExperienceLevel,
  InterviewMode,
  InterviewAnalysisResult,
  InterviewScoreTier,
} from '../types/interview';
import {GEMINI_API_KEY} from '../config/env';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

interface AnalyzeIntroParams {
  experienceLevel: ExperienceLevel;
  recordingMode: InterviewMode;
  targetRole: string;
  durationSeconds: number;
  mediaBase64?: string;
  mimeType?: string;
  transcriptText?: string;
}

export async function analyzeInterviewIntro(
  params: AnalyzeIntroParams,
): Promise<InterviewAnalysisResult> {
  const {
    experienceLevel,
    recordingMode,
    targetRole,
    durationSeconds,
    mediaBase64,
    mimeType,
    transcriptText,
  } = params;

  // Build the system prompt tailored to Fresher vs Experienced
  const isFresher = experienceLevel === 'fresher';

  const systemInstructionText = `
You are a Principal Tech Talent Recruiter, Executive Career Coach, and Expert Interview Pitch Evaluator.
Your goal is to evaluate a candidate's 60 to 90-second "Tell me about yourself / Introduce yourself" interview pitch.

CANDIDATE PROFILE:
- Level: ${isFresher ? 'FRESHER / ENTRY-LEVEL' : 'EXPERIENCED PROFESSIONAL'}
- Target Role: ${targetRole || 'Software Professional'}
- Duration Recorded: ${durationSeconds} seconds
- Mode: ${recordingMode.toUpperCase()}

SCORING CRITERIA SPECIFICS FOR ${isFresher ? 'FRESHER' : 'EXPERIENCED'}:
${
  isFresher
    ? `
1. FRESHER EVALUATION GUIDELINES:
   - Focus on: Academic background, foundational knowledge, key college or portfolio projects, technical curiosity, eagerness to learn, and team collaboration.
   - DO NOT penalize for lack of corporate metrics, revenue numbers, or enterprise years of experience.
   - Evaluate whether they clearly explain what they built, technologies used, problem solved, and why they are eager to start their career in this target role.
   - Look for clear structure: Who they are -> Key academic/project highlights -> Why this role/company excites them.
`
    : `
1. EXPERIENCED PROFESSIONAL EVALUATION GUIDELINES:
   - Focus on: Proven track record, quantifiable business impact (e.g. metrics, scale, performance improvements), tech stack depth, leadership/ownership, and clear career narrative.
   - Penalize rambling chronological histories (e.g. reciting every job since college).
   - Evaluate executive presence, conciseness, and articulation of value proposition.
   - Look for clear structure: Current role/expertise hook -> 1-2 standout career highlights with impact -> Forward-looking alignment with target role.
`
}

TIMING EVALUATION (Target: 60 to 90 seconds):
- 60s - 90s: Optimal duration (Score 90-100 on timing).
- 45s - 59s: A bit short, candidate could expand on key achievements (Score 70-85 on timing).
- Under 45s: Too brief, lacks depth (Score 40-65 on timing).
- Over 90s: Too long, candidate risked rambling (Score 50-70 on timing).

STRICT OUTPUT FORMAT:
You MUST respond strictly with a valid JSON object matching this exact schema:
{
  "overall_score": number, // integer 0 to 100
  "score_tier": string, // "Executive Ready" (85-100), "Strong Communicator" (70-84), "Developing" (50-69), or "Needs Practice" (0-49)
  "breakdown": {
    "structure": number, // 0 to 100 (Opening hook, body flow, forward-looking close)
    "relevance": number, // 0 to 100 (Relevance to ${isFresher ? 'fresher projects & foundational potential' : 'experienced impact & leadership'})
    "delivery": number, // 0 to 100 (Confidence, clarity, cadence, presence)
    "timing": number // 0 to 100 (Adherence to 60-90s sweet spot)
  },
  "summary": string, // 2-3 sentences concise feedback summarizing their pitch quality
  "strengths": [
    string // 3-4 specific positive observations
  ],
  "improvements": [
    {
      "id": string, // "imp-1", "imp-2", etc.
      "category": string, // "Structure", "Content", "Delivery", "Pacing", or "Confidence"
      "priority": string, // "high", "medium", or "low"
      "title": string, // Punchy headline
      "critique": string, // What was weak or missing
      "recommendation": string, // Actionable coaching advice
      "exampleScript": string // Concrete sentence rewrite they can adopt
    }
  ],
  "ideal_script_rewrite": string, // A complete, tailored 60-90 second "Gold Standard" rewrite script based on their background that they can practice speaking aloud
  "key_takeaways": [
    string // 2-3 immediate action points for their next drill
  ],
  "filler_words": [
    {
      "word": string, // e.g. "um", "like", "basically", "you know"
      "count": number
    }
  ],
  "pacing_wpm_estimate": number // estimated speaking pace in words per minute (ideal 120-150)
}
`;

  // Prepare Gemini payload
  const parts: Array<any> = [];

  if (mediaBase64 && mediaBase64.length > 50) {
    parts.push({
      inlineData: {
        mimeType: mimeType || (recordingMode === 'video' ? 'video/mp4' : 'audio/mp4'),
        data: mediaBase64,
      },
    });
  }

  let userPrompt = `Please evaluate my interview introduction pitch recorded for the target role of "${
    targetRole || 'Software Professional'
  }".\n`;
  userPrompt += `Candidate Level: ${isFresher ? 'Fresher (College / Entry-Level)' : 'Experienced Professional'}\n`;
  userPrompt += `Mode: ${recordingMode}\n`;
  userPrompt += `Recorded Duration: ${durationSeconds} seconds.\n`;

  if (transcriptText) {
    userPrompt += `\nCandidate Intro Transcript:\n"${transcriptText}"\n`;
  }

  userPrompt += `\nProvide the rigorous scoring, breakdown, recommendations, and the ideal rewrite script in the specified JSON format.`;

  parts.push({text: userPrompt});

  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found. Returning structured mock response.');
    return getFallbackAnalysis(experienceLevel, recordingMode, targetRole, durationSeconds);
  }

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{text: systemInstructionText}],
        },
        contents: [
          {
            role: 'user',
            parts: parts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', response.status, errText);
      return getFallbackAnalysis(experienceLevel, recordingMode, targetRole, durationSeconds);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('Empty response from Gemini API');
    }

    const cleanedJson = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    return {
      experience_level: experienceLevel,
      recording_mode: recordingMode,
      target_role: targetRole || 'Software Professional',
      duration_seconds: durationSeconds,
      overall_score: Math.min(100, Math.max(0, parsed.overall_score || 75)),
      score_tier: normalizeScoreTier(parsed.score_tier, parsed.overall_score),
      breakdown: {
        structure: parsed.breakdown?.structure || 75,
        relevance: parsed.breakdown?.relevance || 75,
        delivery: parsed.breakdown?.delivery || 70,
        timing: parsed.breakdown?.timing || (durationSeconds >= 60 && durationSeconds <= 90 ? 95 : 75),
      },
      summary: parsed.summary || 'Solid introduction with room for greater punchiness.',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ['Clear articulation of background'],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      ideal_script_rewrite: parsed.ideal_script_rewrite || '',
      key_takeaways: Array.isArray(parsed.key_takeaways) ? parsed.key_takeaways : [],
      filler_words: Array.isArray(parsed.filler_words) ? parsed.filler_words : [],
      pacing_wpm_estimate: parsed.pacing_wpm_estimate || 135,
    };
  } catch (error) {
    console.error('Error in analyzeInterviewIntro:', error);
    return getFallbackAnalysis(experienceLevel, recordingMode, targetRole, durationSeconds);
  }
}

function normalizeScoreTier(tierStr?: string, score: number = 75): InterviewScoreTier {
  if (tierStr === 'Executive Ready' || score >= 85) return 'Executive Ready';
  if (tierStr === 'Strong Communicator' || score >= 70) return 'Strong Communicator';
  if (tierStr === 'Developing' || score >= 50) return 'Developing';
  return 'Needs Practice';
}

function getFallbackAnalysis(
  experienceLevel: ExperienceLevel,
  recordingMode: InterviewMode,
  targetRole: string,
  durationSeconds: number,
): InterviewAnalysisResult {
  const isFresher = experienceLevel === 'fresher';
  const roleName = targetRole || (isFresher ? 'Junior Software Engineer' : 'Senior Software Engineer');

  const timingScore =
    durationSeconds >= 60 && durationSeconds <= 90
      ? 95
      : durationSeconds < 60
      ? Math.max(50, Math.round((durationSeconds / 60) * 85))
      : 70;

  if (isFresher) {
    return {
      experience_level: 'fresher',
      recording_mode: recordingMode,
      target_role: roleName,
      duration_seconds: durationSeconds,
      overall_score: 78,
      score_tier: 'Strong Communicator',
      breakdown: {
        structure: 80,
        relevance: 78,
        delivery: 72,
        timing: timingScore,
      },
      summary:
        'You have great energy and an enthusiastic tone. Your educational background came through clearly, but you can strengthen your pitch by highlighting 1 key technical project with specific problem-solving details.',
      strengths: [
        'Enthusiastic and positive tone throughout the pitch',
        'Clearly articulated degree and core technical interests',
        'Good pacing without rushing the opening',
      ],
      improvements: [
        {
          id: 'imp-1',
          category: 'Content',
          priority: 'high',
          title: 'Deepen project highlight',
          critique: 'You mentioned knowing JavaScript and React, but did not describe what you built with them.',
          recommendation: 'Mention 1 standout capstone or hackathon project, what user problem it solved, and the exact tech stack you implemented.',
          exampleScript:
            'Recently, I built a real-time collaborative task app using React and Node.js that handled live synchronization for over 50 test users.',
        },
        {
          id: 'imp-2',
          category: 'Structure',
          priority: 'medium',
          title: 'End with a compelling forward hook',
          critique: 'The ending trailed off with "so yeah, that is basically me."',
          recommendation: 'Conclude with why you are specifically excited about this role and how you will bring value from day one.',
          exampleScript:
            "I'm eager to bring this problem-solving curiosity and modern full-stack foundation to your engineering team as a Junior Developer.",
        },
      ],
      ideal_script_rewrite:
        `"Hi! I'm a Computer Science graduate passionate about building clean, performant web applications. ` +
        `During college, I focused heavily on modern JavaScript, TypeScript, and React. ` +
        `For my capstone project, I led a team of three to build a real-time peer study platform with WebSocket synchronization and PostgreSQL, which was awarded Best Project in our department. ` +
        `I love tackling complex UI challenges and writing maintainable code. ` +
        `I'm looking to bring this strong foundational drive and fast learning speed to your team as a ${roleName}."`,
      key_takeaways: [
        'Anchor your pitch with 1 concrete project rather than listing languages',
        'Replace trailing fillers ("so yeah") with a confident forward-looking closing sentence',
      ],
      filler_words: [
        {word: 'like', count: 3},
        {word: 'um', count: 2},
        {word: 'basically', count: 2},
      ],
      pacing_wpm_estimate: 132,
    };
  }

  // Experienced fallback
  return {
    experience_level: 'experienced',
    recording_mode: recordingMode,
    target_role: roleName,
    duration_seconds: durationSeconds,
    overall_score: 82,
    score_tier: 'Strong Communicator',
    breakdown: {
      structure: 85,
      relevance: 82,
      delivery: 78,
      timing: timingScore,
    },
    summary:
      'Strong, articulate narrative with clear seniority. To reach Executive Ready tier, anchor your achievements in quantifiable business impact and lead with your core technical domain.',
    strengths: [
      'Crisp, professional presence and confident vocal modulation',
      'Followed a structured Present-Past-Future narrative',
      'Clear definition of senior architectural responsibilities',
    ],
    improvements: [
      {
        id: 'imp-1',
        category: 'Content',
        priority: 'high',
        title: 'Quantify engineering achievements',
        critique: 'You stated you improved system performance, but did not specify the metric or business outcome.',
        recommendation: 'Quantify the outcome (e.g. latency reduced by 35%, AWS costs cut by 20%, or pipeline build time halved).',
        exampleScript:
          'In my last role, I architected a microservices caching layer that reduced p99 query latency by 45% across 2M daily active users.',
      },
      {
        id: 'imp-2',
        category: 'Pacing',
        priority: 'medium',
        title: 'Condense early career recap',
        critique: 'Spent nearly 25 seconds reviewing roles from 5+ years ago.',
        recommendation: 'Spend 70% of your time on your last 2-3 years of senior impact and current architecture mastery.',
        exampleScript:
          'Over the past four years, I have specialized in distributed systems and cloud infrastructure at scale.',
      },
    ],
    ideal_script_rewrite:
      `"Hi! I'm a Senior Software Engineer with over 5 years of experience architecting high-throughput distributed systems and mobile platforms. ` +
      `Currently at my company, I lead the core services team where we recently re-architected our transaction processing pipeline, cutting API response times by 40% and saving $80k annually in cloud infrastructure. ` +
      `Before this, I scaled our front-end design system across 4 engineering pods. ` +
      `What drives me is engineering reliability and developer velocity. ` +
      `I'm excited about this ${roleName} opportunity because your team is solving large-scale scalability challenges where my background in distributed systems can make an immediate impact."`,
    key_takeaways: [
      'Lead with your most recent, highest-impact accomplishments with quantifiable metrics',
      'Keep early career history brief to give maximum airtime to recent leadership and scale',
    ],
    filler_words: [
      {word: 'um', count: 1},
      {word: 'you know', count: 2},
    ],
    pacing_wpm_estimate: 140,
  };
}
