import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `
You are an elite Tech Career Coach and ATS Resume Specialist.
Your job is to thoroughly analyze a candidate's real CV against their target Job Role (and optional Job Description), score it rigorously, and provide actionable, high-impact recommendations to improve and maintain their CV.

CRITICAL CANDIDATE IDENTITY & EXTRACTION RULES:
1. You MUST read the candidate's ACTUAL name directly from the provided CV document or text.
2. In the "summary" field, address the candidate by their REAL name from their CV (e.g. if the CV header is "Atharva Sadavarte", write "Atharva Sadavarte demonstrates..." or "Atharva presents...").
3. NEVER invent, hallucinate, or use sample/placeholder names (such as "Alex Chen", "John Doe", or generic mock names). If no name is discernible, refer to "The candidate".
4. Strictly evaluate the actual companies, projects, educational credentials, and skill sets present in the provided document or text. Do NOT assume or invent experience.

You MUST respond strictly with a valid JSON object following this exact schema:
{
  "overall_score": number, // integer 0 to 100
  "score_tier": string, // One of: "Strong Match", "Competitive", "Developing", "Needs Work"
  "summary": string, // 2-3 sentences concise executive evaluation of candidate fit, using their real name
  "breakdown": {
    "relevance": number, // integer 0 to 100 (experience & role alignment)
    "skills": number, // integer 0 to 100 (tech stack & required tool match)
    "impact": number, // integer 0 to 100 (quantifiable achievements, metrics, action verbs)
    "ats": number // integer 0 to 100 (readability, structure, ATS keyword density)
  },
  "strengths": [
    string // 3 to 5 clear highlights of what makes this specific candidate stand out
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured in Supabase Secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { cvText, pdfBase64, targetRole, jobDescription } = await req.json();

    if (!targetRole || typeof targetRole !== "string") {
      return new Response(
        JSON.stringify({ error: "targetRole is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cvText && !pdfBase64) {
      return new Response(
        JSON.stringify({ error: "Either cvText or pdfBase64 must be provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts: Array<any> = [];

    if (pdfBase64) {
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      });
    }

    let userContent = `STRICT INSTRUCTION: Analyze ONLY the real candidate CV provided below or in the attached PDF document. Extract and address the candidate by their actual name in the executive summary. Do NOT hallucinate sample names like Alex Chen.\n\nTARGET JOB ROLE: ${targetRole}\n`;
    if (jobDescription && jobDescription.trim().length > 0) {
      userContent += `\nTARGET JOB DESCRIPTION:\n${jobDescription.trim()}\n`;
    }

    if (cvText && cvText.trim().length > 0) {
      userContent += `\nCANDIDATE CV CONTENT:\n${cvText.trim()}\n`;
    }

    userContent += `\nPlease analyze this actual candidate CV for the role of "${targetRole}" according to the instructions and return the structured JSON.`;

    parts.push({ text: userContent });

    const requestBody = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: parts,
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    };

    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini API error (${response.status}):`, errText);
      return new Response(
        JSON.stringify({
          error: `Gemini API error (${response.status})`,
          details: errText,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    let rawText = candidate?.content?.parts?.[0]?.text;

    if (!rawText) {
      // Look for any part with text
      const textPart = candidate?.content?.parts?.find((p: any) => p.text);
      rawText = textPart?.text;
    }

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: "No analysis generated from AI model." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip any unexpected markdown wrap
    const cleanedText = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleanedText);

    let tier = "Competitive";
    const score = Math.min(100, Math.max(0, Math.round(parsed.overall_score || 0)));
    if (score >= 85) tier = "Strong Match";
    else if (score >= 70) tier = "Competitive";
    else if (score >= 50) tier = "Developing";
    else tier = "Needs Work";

    const result = {
      target_role: targetRole,
      job_description: jobDescription,
      overall_score: score,
      score_tier: parsed.score_tier || tier,
      summary: parsed.summary || "Resume analyzed against target role.",
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
            priority: imp.priority || "medium",
            section: imp.section || "General",
            title: imp.title || "Improve CV bullet points",
            description: imp.description || "",
            example: imp.example,
            completed: false,
          }))
        : [],
      skills_matched: Array.isArray(parsed.skills_matched) ? parsed.skills_matched : [],
      skills_missing: Array.isArray(parsed.skills_missing) ? parsed.skills_missing : [],
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Function exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
