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
  overall_score: number;
  score_tier: ScoreTier;
  breakdown: ScoreBreakdown;
  summary: string;
  strengths: string[];
  improvements: CVImprovement[];
  skills_matched: string[];
  skills_missing: string[];
  created_at?: string;
}

export interface ResumeAnalysisRecord extends CVAnalysisResult {
  id: string;
  user_id: string;
  created_at: string;
}
