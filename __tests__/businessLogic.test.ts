import {
  ROUND_SKELETON_CONFIG,
  AVAILABLE_LANGUAGES,
} from '../src/types/interviewCoach';
import {
  PITCH_SECTIONS,
  MAX_PERSONAL_PITCHES,
  MIN_PITCH_DURATION_SECONDS,
  MAX_PITCH_DURATION_SECONDS,
  getScoreBand,
} from '../src/types/pitchTrainer';
import {
  isValidSpokenSpeech,
  cleanSpokenTranscript,
} from '../src/utils/speechUtils';
import {
  getFallback10RoundQuestions,
  sanitize10RoundQuestions,
} from '../src/utils/interviewQuestions';

describe('Interview Coach Business Rules', () => {
  test('IC-13: Journey has exactly 10 rounds matching progressive difficulty skeleton', () => {
    expect(ROUND_SKELETON_CONFIG).toHaveLength(10);

    // R1 Warm-up
    expect(ROUND_SKELETON_CONFIG[0].level).toBe('warmup');
    expect(ROUND_SKELETON_CONFIG[0].levelLabel).toBe('Warm-up');

    // R2-R4 Easy
    expect(ROUND_SKELETON_CONFIG[1].level).toBe('easy');
    expect(ROUND_SKELETON_CONFIG[2].level).toBe('easy');
    expect(ROUND_SKELETON_CONFIG[3].level).toBe('easy');

    // R5-R8 Medium
    expect(ROUND_SKELETON_CONFIG[4].level).toBe('medium');
    expect(ROUND_SKELETON_CONFIG[5].level).toBe('medium');
    expect(ROUND_SKELETON_CONFIG[6].level).toBe('medium');
    expect(ROUND_SKELETON_CONFIG[7].level).toBe('medium');

    // R9-R10 Hard (R10 Real Interview)
    expect(ROUND_SKELETON_CONFIG[8].level).toBe('hard');
    expect(ROUND_SKELETON_CONFIG[9].level).toBe('hard');
    expect(ROUND_SKELETON_CONFIG[9].levelLabel).toBe('Real Interview');
  });

  test('IC-10: Available languages include English and Indian languages', () => {
    const codes = AVAILABLE_LANGUAGES.map(l => l.code);
    expect(codes).toContain('en-US');
    expect(codes).toContain('hi-IN');
  });

  test('IC-18: Question passes when AI score is >= 3.0', () => {
    const checkPassed = (score: number) => score >= 3.0;
    expect(checkPassed(2.9)).toBe(false);
    expect(checkPassed(3.0)).toBe(true);
    expect(checkPassed(4.5)).toBe(true);
  });
});

describe('Personal Pitch Trainer Business Rules', () => {
  test('PT-2: Max 5 personal pitches limit', () => {
    expect(MAX_PERSONAL_PITCHES).toBe(5);
  });

  test('PT-9: Notes follow exact 6-part pitch structure', () => {
    expect(PITCH_SECTIONS).toHaveLength(6);
    const keys = PITCH_SECTIONS.map(s => s.key);
    expect(keys).toEqual([
      'introduction',
      'goals',
      'workExperience',
      'skills',
      'achievements',
      'conclusion',
    ]);
  });

  test('PT-15: Pitch length is between 15s and 180s', () => {
    expect(MIN_PITCH_DURATION_SECONDS).toBe(15);
    expect(MAX_PITCH_DURATION_SECONDS).toBe(180);
  });

  test('PT-24: Five emoji score bands (<2, <3, <4, <5, 5)', () => {
    expect(getScoreBand(1.5).emoji).toBe('😟');
    expect(getScoreBand(2.5).emoji).toBe('😐');
    expect(getScoreBand(3.5).emoji).toBe('🙂');
    expect(getScoreBand(4.5).emoji).toBe('😃');
    expect(getScoreBand(5.0).emoji).toBe('🌟');
  });
});

describe('Audio Speech Detection and Transcript Cleaning', () => {
  test('rejects empty, null, and silence tokens as invalid speech', () => {
    expect(isValidSpokenSpeech('')).toBe(false);
    expect(isValidSpokenSpeech('   ')).toBe(false);
    expect(isValidSpokenSpeech(null)).toBe(false);
    expect(isValidSpokenSpeech(undefined)).toBe(false);
    expect(isValidSpokenSpeech('[NO_SPEECH]')).toBe(false);
    expect(isValidSpokenSpeech('[silence]')).toBe(false);
    expect(isValidSpokenSpeech('(ambient noise)')).toBe(false);
    expect(isValidSpokenSpeech('[inaudible]')).toBe(false);
  });

  test('rejects standalone timestamp hallucinations as invalid speech', () => {
    expect(isValidSpokenSpeech('00:03')).toBe(false);
    expect(isValidSpokenSpeech('0:03')).toBe(false);
    expect(isValidSpokenSpeech('[00:03]')).toBe(false);
    expect(isValidSpokenSpeech('(00:03)')).toBe(false);
    expect(isValidSpokenSpeech('00:00 - 00:03')).toBe(false);
    expect(isValidSpokenSpeech('00:00:03')).toBe(false);
  });

  test('accepts genuine human speech in various languages', () => {
    expect(isValidSpokenSpeech('Hello, I am a React Native developer.')).toBe(true);
    expect(isValidSpokenSpeech('नमस्ते, मैं सॉफ्टवेयर इंजीनियर हूँ')).toBe(true);
    expect(isValidSpokenSpeech('Je suis développeur')).toBe(true);
  });

  test('cleanSpokenTranscript strips timestamps and leaves speech, or returns empty', () => {
    expect(cleanSpokenTranscript('00:03')).toBe('');
    expect(cleanSpokenTranscript('[00:03]')).toBe('');
    expect(cleanSpokenTranscript('[NO_SPEECH]')).toBe('');
    expect(
      cleanSpokenTranscript('00:03 Hello I have five years of experience in mobile development.'),
    ).toBe('Hello I have five years of experience in mobile development.');
    expect(
      cleanSpokenTranscript('[00:02] I built high scale consumer apps [00:06]'),
    ).toBe('I built high scale consumer apps');
  });
});

describe('Interview Coach 10-Round Question Progression', () => {
  test('Warm-up question (Round 1) is always a Tell Me About Yourself question', () => {
    const rounds = getFallback10RoundQuestions('React Native Developer');
    expect(rounds).toHaveLength(10);
    expect(rounds[0].level).toBe('warmup');
    expect(rounds[0].roundNumber).toBe(1);
    expect(rounds[0].question.toLowerCase()).toContain('tell me about yourself');
  });

  test('All 10 questions have progressive difficulty: easy (2-4), medium (5-8), hard (9-10)', () => {
    const rounds = getFallback10RoundQuestions('React Native Developer');
    // R1 Warmup
    expect(rounds[0].level).toBe('warmup');
    // R2-R4 Easy
    expect(rounds[1].level).toBe('easy');
    expect(rounds[2].level).toBe('easy');
    expect(rounds[3].level).toBe('easy');
    // R5-R8 Medium
    expect(rounds[4].level).toBe('medium');
    expect(rounds[5].level).toBe('medium');
    expect(rounds[6].level).toBe('medium');
    expect(rounds[7].level).toBe('medium');
    // R9-R10 Hard
    expect(rounds[8].level).toBe('hard');
    expect(rounds[9].level).toBe('hard');
    expect(rounds[9].levelLabel).toBe('Real Interview');

    // Verify all 10 questions are unique
    const uniqueQuestions = new Set(rounds.map(r => r.question));
    expect(uniqueQuestions.size).toBe(10);
  });

  test('sanitize10RoundQuestions enforces Tell Me About Yourself for Round 1 if AI generates an off-topic question', () => {
    const mockAiQuestions = [
      {roundNumber: 1, question: 'What is your greatest weakness?', contextHint: 'Be honest'},
      {roundNumber: 2, question: 'What is React Native state?', contextHint: 'Explain hooks'},
      {roundNumber: 3, question: 'Walk me through your CI/CD.', contextHint: 'Explain Fastlane'},
      {roundNumber: 4, question: 'How do you do code reviews?', contextHint: 'Be collaborative'},
      {roundNumber: 5, question: 'Describe a difficult memory leak.', contextHint: 'Use STAR'},
      {roundNumber: 6, question: 'How do you choose between libraries?', contextHint: 'Trade-offs'},
      {roundNumber: 7, question: 'How do you handle scope creep?', contextHint: 'Communication'},
      {roundNumber: 8, question: 'How do you resolve a disagreement?', contextHint: 'Data-driven'},
      {roundNumber: 9, question: 'Describe a production crash.', contextHint: 'Triage'},
      {roundNumber: 10, question: 'How would you architect a bank app?', contextHint: 'Security'},
    ];

    const sanitized = sanitize10RoundQuestions(mockAiQuestions, 'React Native Developer');
    expect(sanitized[0].question.toLowerCase()).toContain('tell me about yourself');
    expect(sanitized[1].question).toBe('What is React Native state?');
    expect(sanitized[9].question).toBe('How would you architect a bank app?');
  });
});
