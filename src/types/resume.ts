export type ScoreTier =
  | 'Needs Work'
  | 'Developing'
  | 'Competitive'
  | 'Strong Match';

export type PriorityLevel = 'high' | 'medium' | 'low';

export interface ScoreBreakdown {
  relevance: number; // 0 - 100
  skills: number;    // 0 - 100
  impact: number;    // 0 - 100
  ats: number;       // 0 - 100
}

export interface CVImprovement {
  id: string;
  priority: PriorityLevel;
  section:
    | 'Summary'
    | 'Work Experience'
    | 'Skills'
    | 'Projects'
    | 'Education'
    | 'Formatting'
    | 'General';
  title: string;
  description: string;
  example?: string;
  completed?: boolean;
}

export interface CVAnalysisResult {
  id?: string;
  user_id?: string;
  target_role: string;
  job_description?: string;
  file_name?: string;
  file_url?: string;
  updated_file_name?: string | null;
  updated_file_url?: string | null;
  updated_summary_of_changes?: string[];
  updated_at?: string | null;
  overall_score: number;
  score_tier: ScoreTier;
  breakdown: ScoreBreakdown;
  summary: string;
  strengths: string[];
  improvements: CVImprovement[];
  skills_matched: string[];
  skills_missing: string[];
  credits_remaining?: number;
  plan_type?: 'free' | 'pro';
  created_at?: string;
}

export interface ResumeAnalysisRecord extends CVAnalysisResult {
  id: string;
  user_id: string;
  created_at: string;
}

export interface PdfStyledRun {
  text: string;
  x: number;
  width: number;
  fontName: string;
  cleanFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isSerif: boolean;
  isMono: boolean;
  fontWeight: number;
  colorHex: string;
}

export interface PdfExtractedLine {
  id: string;
  pageIndex: number;
  x: number;
  yBaseline: number;
  width: number;
  colLeft: number;
  colRight: number;
  colMaxWidth: number;
  fontSize: number;
  fontName: string;
  cleanFamily: string;
  isBold: boolean;
  isItalic: boolean;
  isSerif: boolean;
  isMono: boolean;
  fontWeight: number;
  colorHex: string;
  lineSpacing: number;
  leadingBullet: string;
  text: string;
  runs: PdfStyledRun[];
}

export interface PdfExtractedFontSignature {
  styleKey: string;
  cleanFamily: string;
  canonicalFamily: string;
  isBold: boolean;
  isItalic: boolean;
  isSerif: boolean;
  isMono: boolean;
  fontWeight: number;
}

export interface PdfExtractedPage {
  pageIndex: number;
  width: number;
  height: number;
  lines: PdfExtractedLine[];
}

export interface PdfDocumentStructure {
  pageCount: number;
  pages: PdfExtractedPage[];
  fonts: PdfExtractedFontSignature[];
}

export interface PdfEditInstruction {
  id: string;
  action: 'replace' | 'insert_after';
  targetLineIds: string[];
  newText: string;
  preserveBoldPrefix?: boolean;
  suggestionRef?: string;
  summary?: string;
}

export interface PdfEditPlanResponse {
  edits: PdfEditInstruction[];
  changesSummary: string[];
}

export interface GeneratedUpdatedPdfInfo {
  localUri: string;
  fileName: string;
  storagePath?: string | null;
  appliedCount: number;
  changesSummary: string[];
  fontMatchDetails: string[];
  generatedAt: string;
}

export interface UserQuota {
  user_id: string;
  plan_type: 'free' | 'pro';
  credits_remaining: number;
  lifetime_scans_used: number;
  pro_until?: string | null;
  created_at?: string;
  updated_at?: string;
}
