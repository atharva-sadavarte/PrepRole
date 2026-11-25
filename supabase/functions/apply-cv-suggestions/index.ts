import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `
You are an elite Resume Editor and Typographic Layout Specialist.
You are given:
1. The candidate's original resume PDF (attached visually so you see columns, bullets, headers, margins, and typography).
2. A structured array of EVERY extracted text line from the PDF with exact IDs ("p0_l0", "p0_l1", ...), coordinates (x, y), column width (colMaxWidth), fontSize, isBold, fontName, and exact line text.
3. Selected AI improvement suggestions and optional missing ATS skills to integrate into the resume.

YOUR TASK:
Generate surgical, in-place text replacements ("edits") mapped to exact "targetLineIds" so the existing PDF can be updated IN PLACE while preserving 100% of its original style, template, layout, colors, and font styling.

CRITICAL RULES:
1. Target ONLY the lines/bullets/paragraphs that genuinely need updates based on the selected suggestions and missing skills. Leave unaffected lines untouched.
2. Group lines that belong to the SAME single bullet point, summary paragraph, or skill category row into one edit's "targetLineIds" array (in top-to-bottom order). NEVER merge two separate bullet points or separate sections into one edit.
3. NEVER target contact details, candidate name, job titles/company names/dates, education degrees, or section headers (unless a suggestion explicitly asks to rename a section heading).
4. PRESERVE LEADING BULLET & BOLD LABEL PREFIXES:
   - If targetLineIds[0] starts with a bullet glyph like "• ", "- ", "▪ ", keep that exact bullet glyph at the start of "newText".
   - If the bullet dot is NOT inside targetLineIds[0].text (because it's rendered separately on the left), do NOT add a bullet glyph to "newText".
   - If targetLineIds[0] starts with a bold category label ending with ":" (e.g., "Backend & Cloud: Node.js, Express"), preserve that exact "Category:" prefix at the start of "newText" so the editor preserves bold styling on the label and regular styling on the values.
5. STRICT LAYOUT & FIT PRESERVATION:
   - Respect each block's original character count and "maxCharsPerLine" capacity.
   - Keep "newText" approximately the same visual length as the original block (ideally same number of lines, or at most +1 line if essential) by cutting weak filler words ("Responsible for", "Worked on", "Helped with") and replacing them with punchy action verbs, quantifiable impact, and target ATS keywords.
   - Do NOT invent fake employers, degrees, or fabricated company revenue numbers. When adding missing skills, integrate them honestly into the existing Skills section (or relevant existing project/experience wording).
6. Output STRICT valid JSON only:
{
  "edits": [
    {
      "id": "edit-1",
      "action": "replace",
      "targetLineIds": ["p0_l12", "p0_l13"],
      "newText": "string",
      "preserveBoldPrefix": true,
      "suggestionRef": "imp-1",
      "summary": "Brief 1-line description of what changed"
    }
  ],
  "changesSummary": [
    "Short user-friendly bullet summarizing each change applied to the PDF"
  ]
}
`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured in Supabase Secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header is required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token. Please sign in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      targetRole,
      jobDescription,
      pdfBase64,
      pagesLines,
      selectedImprovements,
      selectedSkills,
    } = await req.json();

    if (!pagesLines || !Array.isArray(pagesLines) || pagesLines.length === 0) {
      return new Response(
        JSON.stringify({ error: "pagesLines structure is required." }),
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

    const userPrompt = [
      `TARGET JOB ROLE: ${targetRole || "Software Professional"}`,
      jobDescription ? `TARGET JOB DESCRIPTION:\n${jobDescription}` : "",
      `SELECTED AI SUGGESTIONS TO APPLY:\n${JSON.stringify(selectedImprovements || [], null, 2)}`,
      selectedSkills && selectedSkills.length > 0
        ? `MISSING ATS SKILLS TO INTEGRATE:\n${JSON.stringify(selectedSkills)}`
        : "",
      `EXTRACTED PDF LINES (with exact IDs, column width, font size, and current text):\n${JSON.stringify(pagesLines)}`,
      `Return ONLY valid JSON with "edits" and "changesSummary" referencing exact targetLineIds from the extracted lines above.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    parts.push({ text: userPrompt });

    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.15,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error (${response.status})`, details: errText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    let rawText = candidate?.content?.parts?.[0]?.text;
    if (!rawText) {
      rawText = candidate?.content?.parts?.find((p: any) => p.text)?.text;
    }

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: "No edits generated by AI model." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanedText = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleanedText);

    const edits = Array.isArray(parsed.edits)
      ? parsed.edits
          .filter((e: any) => Array.isArray(e.targetLineIds) && e.targetLineIds.length > 0 && typeof e.newText === "string" && e.newText.trim().length > 0)
          .map((e: any, idx: number) => ({
            id: e.id || `edit-${idx + 1}`,
            action: e.action === "insert_after" ? "insert_after" : "replace",
            targetLineIds: e.targetLineIds.map((id: any) => String(id)),
            newText: String(e.newText).trim(),
            preserveBoldPrefix: e.preserveBoldPrefix !== false,
            suggestionRef: e.suggestionRef,
            summary: e.summary || "",
          }))
      : [];

    const changesSummary = Array.isArray(parsed.changesSummary)
      ? parsed.changesSummary.map((s: any) => String(s))
      : edits.map((e: any) => e.summary).filter(Boolean);

    return new Response(JSON.stringify({ edits, changesSummary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("apply-cv-suggestions exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
