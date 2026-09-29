export type RoundLevel = 'warmup' | 'easy' | 'medium' | 'hard';

export type RoundStatus = 'locked' | 'inProgress' | 'completed' | 'failed' | 'skipped';

export interface JourneyRound {
  roundNumber: number; // 1 to 10
  level: RoundLevel;
  levelLabel: string; // e.g. "Warm-up", "Easy", "Medium", "Real Interview"
  question: string;
  contextHint?: string;
  sampleAnswer?: string;
  status: RoundStatus;
  score?: number; // 1 to 5
  isSkipped?: boolean;
  attemptsCount: number;
}

export interface SocraticMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface JobRoleValidationResponse {
  final_title?: string;
  user_title: string;
  message: string;
  jobDescription?: string;
  end: boolean;
}

export interface InterviewAttemptRatings {
  structure: number; // 1 to 5
  relevance: number; // 1 to 5
  delivery: number;  // 1 to 5
}

export interface InterviewAttempt {
  id: string;
  journeyId: string;
  roundNumber: number;
  question: string;
  userResponseText: string;
  audioUri?: string;
  durationSeconds: number;
  score: number; // 1 to 5
  passed: boolean; // score >= 3
  ratings: InterviewAttemptRatings;
  feedback: string;
  strengths: string[];
  improvements: string[];
  sampleAnswer: string;
  audioMetrics?: {
    vocalConfidence: string;
    speechPace: string;
    audioClarity: string;
  };
  createdAt: string;
}

export interface InterviewJourney {
  id: string;
  userId: string;
  jobRole: string; // AI normalized final_title
  language: string;
  learnerCountry: string;
  status: 'inProgress' | 'completed';
  currentRoundNumber: number; // 1 to 10
  rounds: JourneyRound[];
  createdAt: string;
  updatedAt: string;
}

export const ROUND_SKELETON_CONFIG: {
  roundNumber: number;
  level: RoundLevel;
  levelLabel: string;
}[] = [
  {roundNumber: 1, level: 'warmup', levelLabel: 'Warm-up'},
  {roundNumber: 2, level: 'easy', levelLabel: 'Easy'},
  {roundNumber: 3, level: 'easy', levelLabel: 'Easy'},
  {roundNumber: 4, level: 'easy', levelLabel: 'Easy'},
  {roundNumber: 5, level: 'medium', levelLabel: 'Medium'},
  {roundNumber: 6, level: 'medium', levelLabel: 'Medium'},
  {roundNumber: 7, level: 'medium', levelLabel: 'Medium'},
  {roundNumber: 8, level: 'medium', levelLabel: 'Medium'},
  {roundNumber: 9, level: 'hard', levelLabel: 'Hard'},
  {roundNumber: 10, level: 'hard', levelLabel: 'Real Interview'},
];

export const AVAILABLE_LANGUAGES = [
  {code: 'en-US', label: 'English (US)'},
  {code: 'en-IN', label: 'English (India)'},
  {code: 'hi-IN', label: 'Hindi'},
  {code: 'es-ES', label: 'Spanish'},
  {code: 'fr-FR', label: 'French'},
  {code: 'de-DE', label: 'German'},
];
