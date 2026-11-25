import {supabase} from '../lib/supabase';
import {GEMINI_API_KEY} from '../config/env';
import {callGeminiApi} from './geminiClient';
import {
  CVImprovement,
  GeneratedUpdatedPdfInfo,
  PdfDocumentStructure,
  PdfEditInstruction,
  PdfEditPlanResponse,
  ResumeAnalysisRecord,
} from '../types/resume';
import {
  applyPdfEdits,
  extractPdfStructure,
  getPdfBase64,
} from './pdfService';
import {resolveMatchingFontFiles} from './fontResolverService';
import {
  ensureLocalPdfUri,
  saveUpdatedPdfRecord,
  uploadResumeFile,
} from './resumeService';

const APPLY_SYSTEM_PROMPT = `
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

export interface GenerateUpdatedPdfParams {
  userId: string;
  analysis: ResumeAnalysisRecord;
  selectedImprovements: CVImprovement[];
  selectedMissingSkills: string[];
  preferredOriginalLocalUri?: string | null;
  onProgress?: (stepMessage: string) => void;
}

function buildCompactPagesLines(structure: PdfDocumentStructure) {
  return structure.pages.map(page => ({
    pageIndex: page.pageIndex,
    width: Math.round(page.width),
    height: Math.round(page.height),
    lines: page.lines.map(l => ({
      id: l.id,
      x: Math.round(l.x),
      y: Math.round(l.yBaseline),
      width: Math.round(l.width),
      colMaxWidth: Math.round(l.colMaxWidth),
      maxCharsPerLine: Math.max(
        12,
        Math.floor(l.colMaxWidth / Math.max(4.5, l.fontSize * 0.48)),
      ),
      fontSize: Number(l.fontSize.toFixed(1)),
      fontName: l.cleanFamily,
      isBold: l.isBold,
      text: l.text,
    })),
  }));
}

async function generateEditsViaEdgeOrFallback(params: {
  targetRole: string;
  jobDescription?: string;
  pdfBase64: string;
  pagesLines: ReturnType<typeof buildCompactPagesLines>;
  selectedImprovements: CVImprovement[];
  selectedMissingSkills: string[];
}): Promise<PdfEditPlanResponse> {
  const payloadBody = {
    targetRole: params.targetRole,
    jobDescription: params.jobDescription,
    pdfBase64: params.pdfBase64,
    pagesLines: params.pagesLines,
    selectedImprovements: params.selectedImprovements.map(i => ({
      id: i.id,
      priority: i.priority,
      section: i.section,
      title: i.title,
      description: i.description,
      example: i.example,
    })),
    selectedSkills: params.selectedMissingSkills,
  };

  try {
    const {data, error} = await supabase.functions.invoke(
      'apply-cv-suggestions',
      {body: payloadBody},
    );

    if (!error && data && Array.isArray(data.edits)) {
      return data as PdfEditPlanResponse;
    }
    if (error) {
      console.warn(
        'apply-cv-suggestions edge function unavailable, checking local fallback:',
        error.message,
      );
    }
  } catch (err: any) {
    console.warn(
      'apply-cv-suggestions edge call failed, checking local fallback:',
      err?.message || err,
    );
  }

  // Fallback to direct Gemini client when configured locally
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Could not connect to AI PDF editor service. Please check your internet connection or ensure the apply-cv-suggestions Edge Function is deployed.',
    );
  }

  const userPrompt = [
    `TARGET JOB ROLE: ${params.targetRole}`,
    params.jobDescription
      ? `TARGET JOB DESCRIPTION:\n${params.jobDescription}`
      : '',
    `SELECTED AI SUGGESTIONS TO APPLY:\n${JSON.stringify(
      payloadBody.selectedImprovements,
      null,
      2,
    )}`,
    params.selectedMissingSkills.length > 0
      ? `MISSING ATS SKILLS TO INTEGRATE:\n${JSON.stringify(
          params.selectedMissingSkills,
        )}`
      : '',
    `EXTRACTED PDF LINES (with exact IDs, column width, font size, and current text):\n${JSON.stringify(
      params.pagesLines,
    )}`,
    `Return ONLY valid JSON with "edits" and "changesSummary" referencing exact targetLineIds from the extracted lines above.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const geminiRes = await callGeminiApi(
    {
      systemInstruction: {parts: [{text: APPLY_SYSTEM_PROMPT}]},
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: params.pdfBase64,
              },
            },
            {text: userPrompt},
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.15,
      },
    },
    {preferredModel: 'gemini-3.6-flash', timeoutMs: 45000},
  );

  const candidate = geminiRes?.candidates?.[0];
  let rawText = candidate?.content?.parts?.[0]?.text;
  if (!rawText) {
    rawText = candidate?.content?.parts?.find((p: any) => p.text)?.text;
  }
  if (!rawText) {
    throw new Error('No PDF edits were generated by the AI model.');
  }

  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned);

  const edits: PdfEditInstruction[] = Array.isArray(parsed.edits)
    ? parsed.edits
        .filter(
          (e: any) =>
            Array.isArray(e.targetLineIds) &&
            e.targetLineIds.length > 0 &&
            typeof e.newText === 'string' &&
            e.newText.trim().length > 0,
        )
        .map((e: any, idx: number) => ({
          id: e.id || `edit-${idx + 1}`,
          action: e.action === 'insert_after' ? 'insert_after' : 'replace',
          targetLineIds: e.targetLineIds.map((id: any) => String(id)),
          newText: String(e.newText).trim(),
          preserveBoldPrefix: e.preserveBoldPrefix !== false,
          suggestionRef: e.suggestionRef,
          summary: e.summary || '',
        }))
    : [];

  const changesSummary: string[] = Array.isArray(parsed.changesSummary)
    ? parsed.changesSummary.map((s: any) => String(s))
    : edits.map(e => e.summary || '').filter(Boolean);

  return {edits, changesSummary};
}

function buildUpdatedFileName(originalName?: string | null): string {
  const base = (originalName || 'Resume.pdf')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${base}_Updated.pdf`;
}

export async function generateUpdatedResumePdf({
  userId,
  analysis,
  selectedImprovements,
  selectedMissingSkills,
  preferredOriginalLocalUri,
  onProgress,
}: GenerateUpdatedPdfParams): Promise<GeneratedUpdatedPdfInfo> {
  if (
    selectedImprovements.length === 0 &&
    selectedMissingSkills.length === 0
  ) {
    throw new Error(
      'Please select at least one AI suggestion or missing skill to apply.',
    );
  }

  onProgress?.('Fetching your original uploaded PDF...');
  const localOrigUri = await ensureLocalPdfUri(
    analysis.id,
    analysis.file_url,
    preferredOriginalLocalUri,
    'orig',
    analysis.file_name,
  );

  onProgress?.('Inspecting PDF layout, columns & font styles...');
  const structure = await extractPdfStructure(localOrigUri);
  const totalLines = structure.pages.reduce(
    (sum, p) => sum + p.lines.length,
    0,
  );
  if (totalLines === 0) {
    throw new Error(
      'This PDF appears to be an image-only scan with no selectable text layer. Please upload a text-based PDF (exported from Word, Google Docs, Canva, or LaTeX) to apply inline style-preserving edits.',
    );
  }

  onProgress?.('Matching original fonts & preparing AI edits...');
  const [fontPaths, pdfBase64] = await Promise.all([
    resolveMatchingFontFiles(structure.fonts),
    getPdfBase64(localOrigUri),
  ]);

  const compactPagesLines = buildCompactPagesLines(structure);

  onProgress?.('Mapping AI suggestions cleanly to your sections...');
  const plan = await generateEditsViaEdgeOrFallback({
    targetRole: analysis.target_role,
    jobDescription: analysis.job_description,
    pdfBase64,
    pagesLines: compactPagesLines,
    selectedImprovements,
    selectedMissingSkills,
  });

  if (!plan.edits || plan.edits.length === 0) {
    throw new Error(
      'AI could not map any safe inline edits for the selected suggestions. Try selecting different suggestions.',
    );
  }

  onProgress?.('Applying edits in your exact PDF style & fonts...');
  const updatedFileName = buildUpdatedFileName(analysis.file_name);
  const editRes = await applyPdfEdits(
    localOrigUri,
    plan.edits,
    fontPaths,
    `${analysis.id}_${updatedFileName}`,
  );

  if (editRes.appliedCount === 0) {
    throw new Error(
      'No lines matched in the PDF document. Please try regenerating.',
    );
  }

  onProgress?.('Saving updated PDF to your PrepRole library...');
  let storagePath: string | null = null;
  try {
    const uploaded = await uploadResumeFile(
      userId,
      editRes.outputUri,
      updatedFileName,
      'application/pdf',
    );
    if (uploaded?.path) {
      storagePath = uploaded.path;
    }
  } catch (uploadErr) {
    console.warn('Could not upload updated PDF to Supabase Storage:', uploadErr);
  }

  const info: GeneratedUpdatedPdfInfo = {
    localUri: editRes.outputUri,
    fileName: updatedFileName,
    storagePath,
    appliedCount: editRes.appliedCount,
    changesSummary:
      plan.changesSummary.length > 0
        ? plan.changesSummary
        : [`Applied ${editRes.appliedCount} AI improvements inline`],
    fontMatchDetails: editRes.fontMatchDetails || [],
    generatedAt: new Date().toISOString(),
  };

  await saveUpdatedPdfRecord(analysis.id, info);

  return info;
}
