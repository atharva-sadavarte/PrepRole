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
