export type PitchSectionKey =
  | 'introduction'
  | 'goals'
  | 'workExperience'
  | 'skills'
  | 'achievements'
  | 'conclusion';

export interface PitchSectionInfo {
  key: PitchSectionKey;
  title: string;
  placeholder: string;
  promptGuidance: string;
}

export const PITCH_SECTIONS: PitchSectionInfo[] = [
  {
    key: 'introduction',
    title: 'Introduction',
    placeholder: 'Introduce your name, current focus, and what drives you...',
    promptGuidance: 'Briefly state who you are, your current professional baseline, and your core passion.',
  },
  {
    key: 'goals',
    title: 'Goals',
    placeholder: 'What are your career objectives for this target role?',
    promptGuidance: 'Explain why you are pursuing this specific role and what milestones you aim to achieve.',
  },
  {
    key: 'workExperience',
    title: 'Work Experience',
    placeholder: 'Highlight relevant past roles, key projects, or internships...',
    promptGuidance: 'Summarize your most impactful experience, technologies used, and real-world responsibilities.',
  },
  {
    key: 'skills',
    title: 'Skills',
    placeholder: 'What technical and soft skills make you stand out?',
    promptGuidance: 'List 3-4 high-value competencies directly relevant to the job requirements.',
  },
  {
    key: 'achievements',
    title: 'Achievements',
    placeholder: 'Share quantifiable results, awards, shipped products, or metrics...',
    promptGuidance: 'Mention concrete outcomes (e.g. reduced latency by 30%, led team of 4, ranked top 5%).',
  },
  {
    key: 'conclusion',
    title: 'Conclusion',
    placeholder: 'Close with an enthusiastic call-to-action or summary of your value...',
    promptGuidance: 'Reiterate why you are the ideal fit and express eagerness for next steps.',
  },
];

export type PitchStatus = 'draft' | 'submitted' | 'analyzed' | 'analyzed_failed' | 'saved';

export interface PitchNotes {
  introduction: string;
  goals: string;
  workExperience: string;
  skills: string;
  achievements: string;
  conclusion: string;
}

export interface SectionAnalysisScore {
  score: number; // 1 to 5
  feedback: string;
  covered: boolean;
}

export interface PitchAnalysisResult {
  overallRating: number; // 1 to 5
  scoreBandEmoji: string; // 😟 | 😐 | 🙂 | 😃 | 🌟
  scoreBandLabel: string;
  sectionScores: Record<PitchSectionKey, SectionAnalysisScore>;
  strengths: string[];
  improvements: string[];
  idealPitchScript: string;
}

export interface PersonalPitch {
  id: string;
  userId: string;
  status: PitchStatus;
  jobRole: string; // Normalized role
  language: string;
  notes: PitchNotes;
  transcript: string;
  durationSeconds: number;
  videoUrl?: string;
  audioUri?: string;
  recordingMode: 'video' | 'audio';
  analysis?: PitchAnalysisResult;
  createdAt: string;
  updatedAt: string;
}

export const MAX_PERSONAL_PITCHES = 5;
export const MIN_PITCH_DURATION_SECONDS = 15;
export const MAX_PITCH_DURATION_SECONDS = 180;

export const PITCH_SCORE_BANDS = [
  {maxScore: 2.0, emoji: '😟', label: 'Needs Practice'},
  {maxScore: 3.0, emoji: '😐', label: 'Developing'},
  {maxScore: 4.0, emoji: '🙂', label: 'Strong Communicator'},
  {maxScore: 4.9, emoji: '😃', label: 'Executive Ready'},
  {maxScore: 5.0, emoji: '🌟', label: 'World-Class Pitch'},
];

export function getScoreBand(score: number): {emoji: string; label: string} {
  if (score < 2.0) return {emoji: '😟', label: 'Needs Practice'};
  if (score < 3.0) return {emoji: '😐', label: 'Developing'};
  if (score < 4.0) return {emoji: '🙂', label: 'Strong Communicator'};
  if (score < 5.0) return {emoji: '😃', label: 'Executive Ready'};
  return {emoji: '🌟', label: 'World-Class Pitch'};
}
