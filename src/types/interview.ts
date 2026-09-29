export type ExperienceLevel = 'fresher' | 'experienced';

export type InterviewMode = 'video' | 'audio';

export type InterviewScoreTier =
  | 'Executive Ready'
  | 'Strong Communicator'
  | 'Developing'
  | 'Needs Practice';

export interface InterviewScoreBreakdown {
  structure: number; // 0 - 100 (Opening, hook, body, closing)
  relevance: number; // 0 - 100 (Relevance to Fresher vs Experienced expectations)
  delivery: number;  // 0 - 100 (Confidence, flow, pacing, filler words)
  timing: number;    // 0 - 100 (Staying within 60s - 90s sweet spot)
}

export interface InterviewImprovement {
  id: string;
  category: 'Structure' | 'Content' | 'Delivery' | 'Pacing' | 'Confidence';
  priority: 'high' | 'medium' | 'low';
  title: string;
  critique: string;
  recommendation: string;
  exampleScript?: string;
}

export interface FillerWordCount {
  word: string;
  count: number;
}

export interface InterviewAnalysisResult {
  id?: string;
  user_id?: string;
  experience_level: ExperienceLevel;
  recording_mode: InterviewMode;
  target_role: string;
  duration_seconds: number;
  overall_score: number;
  score_tier: InterviewScoreTier;
  breakdown: InterviewScoreBreakdown;
  summary: string;
  strengths: string[];
  improvements: InterviewImprovement[];
  ideal_script_rewrite: string;
  key_takeaways: string[];
  filler_words?: FillerWordCount[];
  pacing_wpm_estimate?: number;
  created_at?: string;
}

export interface InterviewSessionRecord extends InterviewAnalysisResult {
  id: string;
  user_id: string;
  created_at: string;
}
