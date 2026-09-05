import {CVAnalysisResult, ScoreTier} from '../types/resume';
import {GEMINI_API_KEY} from '../config/env';

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

interface AnalyzeParams {
  cvText?: string;
  pdfBase64?: string;
  targetRole: string;
  jobDescription?: string;
}

const SYSTEM_PROMPT = `
You are an elite Tech Career Coach and ATS Resume Specialist.
Your job is to thoroughly analyze a candidate's CV against their target Job Role (and optional Job Description), score it rigorously, and provide actionable, high-impact recommendations to improve and maintain their CV.

You MUST respond strictly with a valid JSON object following this exact schema:
{
  "overall_score": number, // integer 0 to 100
  "score_tier": string, // One of: "Strong Match", "Competitive", "Developing", "Needs Work"
  "summary": string, // 2-3 sentences concise executive evaluation of candidate fit
  "breakdown": {
    "relevance": number, // integer 0 to 100 (experience & role alignment)
    "skills": number, // integer 0 to 100 (tech stack & required tool match)
    "impact": number, // integer 0 to 100 (quantifiable achievements, metrics, action verbs)
    "ats": number // integer 0 to 100 (readability, structure, ATS keyword density)
  },
  "strengths": [
    string // 3 to 5 clear highlights of what makes this CV stand out
  ],
  "improvements": [
    {
      "id": string, // "imp-1", "imp-2", etc.
      "priority": string, // "high", "medium", or "low"
      "section": string, // One of: "Summary", "Work Experience", "Skills", "Projects", "Education", "Formatting", "General"
      "title": string, // Short punchy advice (e.g., "Quantify impact in Project Lead role")
      "description": string, // Detailed explanation of what is lacking and how to fix it
      "example": string // Concrete "Before vs After" or rewrite example showing exactly what to write
    }
  ],
  "skills_matched": [
    string // Skills present in CV that directly match the target role/description
  ],
  "skills_missing": [
    string // Crucial skills/technologies expected for this role that are missing from CV
  ]
}

Scoring criteria:
- Strong Match: 85-100 (Well-tailored, metrics-heavy, deep stack alignment)
- Competitive: 70-84 (Solid background, minor gaps in metrics or key niche skills)
- Developing: 50-69 (Foundational skills present, lacks required seniority, depth, or formatting)
- Needs Work: 0-49 (Major mismatch with target role or poorly structured)

Be realistic, constructive, and highly specific in your rewrite recommendations so the user can immediately edit their CV.
`;

export async function analyzeCVWithAI({
  cvText,
  pdfBase64,
  targetRole,
  jobDescription,
}: AnalyzeParams): Promise<CVAnalysisResult> {
  const parts: Array<any> = [];

  // Add PDF inline data if provided
  if (pdfBase64) {
    parts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBase64,
      },
    });
  }

  // Construct text prompt
  let userContent = `TARGET JOB ROLE: ${targetRole}\n`;
  if (jobDescription && jobDescription.trim().length > 0) {
    userContent += `\nTARGET JOB DESCRIPTION:\n${jobDescription.trim()}\n`;
  }

  if (cvText && cvText.trim().length > 0) {
    userContent += `\nCANDIDATE CV CONTENT:\n${cvText.trim()}\n`;
  }

  userContent += `\nPlease analyze this CV for the role of "${targetRole}" according to the instructions and return the structured JSON.`;

  parts.push({text: userContent});

  const requestBody = {
    systemInstruction: {
      parts: [{text: SYSTEM_PROMPT}],
    },
    contents: [
      {
        role: 'user',
        parts: parts,
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  };

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No analysis generated from AI model');
    }

    const parsed = JSON.parse(text);

    // Validate and sanitize score tier
    let tier: ScoreTier = 'Competitive';
    if (parsed.overall_score >= 85) tier = 'Strong Match';
    else if (parsed.overall_score >= 70) tier = 'Competitive';
    else if (parsed.overall_score >= 50) tier = 'Developing';
    else tier = 'Needs Work';

    const result: CVAnalysisResult = {
      target_role: targetRole,
      job_description: jobDescription,
      overall_score: Math.min(100, Math.max(0, Math.round(parsed.overall_score || 0))),
      score_tier: (parsed.score_tier as ScoreTier) || tier,
      summary: parsed.summary || 'Resume analyzed against target role.',
      breakdown: {
        relevance: Math.min(100, Math.max(0, Math.round(parsed.breakdown?.relevance || 70))),
        skills: Math.min(100, Math.max(0, Math.round(parsed.breakdown?.skills || 70))),
        impact: Math.min(100, Math.max(0, Math.round(parsed.breakdown?.impact || 65))),
        ats: Math.min(100, Math.max(0, Math.round(parsed.breakdown?.ats || 75))),
      },
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvements: Array.isArray(parsed.improvements)
        ? parsed.improvements.map((imp: any, idx: number) => ({
            id: imp.id || `imp-${idx + 1}`,
            priority: imp.priority || 'medium',
            section: imp.section || 'General',
            title: imp.title || 'Improve CV bullet points',
            description: imp.description || '',
            example: imp.example,
            completed: false,
          }))
        : [],
      skills_matched: Array.isArray(parsed.skills_matched) ? parsed.skills_matched : [],
      skills_missing: Array.isArray(parsed.skills_missing) ? parsed.skills_missing : [],
    };

    return result;
  } catch (error: any) {
    console.error('Error analyzing CV:', error);
    throw error;
  }
}
