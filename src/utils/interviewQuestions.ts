import {JourneyRound, ROUND_SKELETON_CONFIG} from '../types/interviewCoach';

/**
 * Returns 10 distinct, structured fallback interview questions
 * with progressive difficulty: Warmup (Tell me about yourself), Easy (2-4), Medium (5-8), Hard (9-10)
 */
export function getFallback10RoundQuestions(jobRole: string): JourneyRound[] {
  return [
    {
      roundNumber: 1,
      level: 'warmup',
      levelLabel: 'Warm-up',
      question: `Tell me about yourself, your background, and why you are interested in this position as a ${jobRole}.`,
      contextHint:
        'Use the Present, Past, Future framework. Highlight your core strengths and keep your response under 90 seconds.',
      sampleAnswer: `I am an experienced professional passionate about ${jobRole}. In my current work, I focus on delivering high-impact, reliable solutions. Previously, I built a strong technical foundation working on complex systems and collaborating with agile teams. I am excited about this role because it allows me to solve meaningful problems at scale.`,
      status: 'inProgress',
      attemptsCount: 0,
    },
    {
      roundNumber: 2,
      level: 'easy',
      levelLabel: 'Easy',
      question: `What are the core foundational tools, technologies, and principles you rely on most in your day-to-day work as a ${jobRole}?`,
      contextHint:
        'Mention 2-3 specific technical frameworks or tools you use daily and explain why they are critical.',
      sampleAnswer: `In my day-to-day work as a ${jobRole}, I rely on modern component architecture, strict type safety, modular design patterns, and automated test runners to ensure our codebase remains clean and maintainable.`,
      status: 'locked',
      attemptsCount: 0,
    },
    {
      roundNumber: 3,
      level: 'easy',
      levelLabel: 'Easy',
      question: `Can you walk me through your typical workflow when planning and developing a new feature as a ${jobRole}?`,
      contextHint:
        'Cover requirement breakdown, architectural planning, incremental implementation, and quality testing.',
      sampleAnswer: `I start by reviewing user stories and clarifying acceptance criteria with stakeholders. Then I design the component and data flow hierarchy. I implement iteratively with unit tests, followed by peer review and QA verification before release.`,
      status: 'locked',
      attemptsCount: 0,
    },
    {
      roundNumber: 4,
      level: 'easy',
      levelLabel: 'Easy',
      question: `How do you collaborate with cross-functional teammates and ensure code quality through code reviews in ${jobRole}?`,
      contextHint:
        'Highlight constructive technical communication, active listening, and engineering standards.',
      sampleAnswer: `I treat code reviews as an essential collaboration opportunity. I write clear PR descriptions, provide constructive feedback focusing on readability and edge cases, and align closely with design and QA early in each sprint.`,
      status: 'locked',
      attemptsCount: 0,
    },
    {
      roundNumber: 5,
      level: 'medium',
      levelLabel: 'Medium',
      question: `Tell me about a complex technical bug, performance bottleneck, or edge case you encountered as a ${jobRole}. How did you diagnose and resolve it?`,
      contextHint:
        'Use the STAR method (Situation, Task, Action, Result). Describe your profiling tools and methodology.',
      sampleAnswer: `During a high-traffic release, we observed uncharacteristic frame drops and memory spikes. I utilized performance profilers to isolate memory leaks caused by uncleaned subscriptions and redundant re-renders. By refactoring state flow and memoizing expensive operations, we reduced render latency by 55%.`,
      status: 'locked',
      attemptsCount: 0,
    },
    {
      roundNumber: 6,
      level: 'medium',
      levelLabel: 'Medium',
      question: `How do you evaluate technical trade-offs when designing a feature or choosing between different architectural patterns for ${jobRole}?`,
      contextHint:
        'Discuss criteria such as scalability, maintainability, team velocity, bundle size, and long-term tech debt.',
      sampleAnswer: `I evaluate trade-offs based on developer ergonomics, runtime performance, maintainability, and community support. I often create lightweight spikes or benchmarks before committing to major architectural shifts.`,
      status: 'locked',
      attemptsCount: 0,
    },
    {
      roundNumber: 7,
      level: 'medium',
      levelLabel: 'Medium',
      question: `Describe a situation where project requirements or deadlines shifted unexpectedly. How did you adapt your approach?`,
      contextHint:
        'Focus on calm prioritization, risk assessment, stakeholder transparency, and phased delivery.',
      sampleAnswer: `When critical client requirements shifted two weeks before launch, I met with the product manager and tech lead to re-scope non-essential deliverables into a subsequent phase. We delivered the core functionality on schedule with zero critical defects.`,
      status: 'locked',
      attemptsCount: 0,
    },
    {
      roundNumber: 8,
      level: 'medium',
      levelLabel: 'Medium',
      question: `Tell me about a time you had a difference of technical opinion with a team member or stakeholder. How did you reach a resolution?`,
      contextHint:
        'Emphasize objective benchmarking, data-backed discussions, and prioritizing the end-user experience.',
      sampleAnswer: `A teammate and I disagreed on whether to introduce a complex state library. We agreed to build two small prototypes and measure load times, bundle size, and test complexity. The simpler approach proved faster and easier to maintain, so we reached a consensus based on objective data.`,
      status: 'locked',
      attemptsCount: 0,
    },
    {
      roundNumber: 9,
      level: 'hard',
      levelLabel: 'Hard',
      question: `Describe a high-stakes production incident or critical breakdown you handled as a ${jobRole}. Walk me through your triage, mitigation, communication, and post-mortem.`,
      contextHint:
        'Demonstrate executive composure, rapid root-cause isolation, and preventative safeguards.',
      sampleAnswer: `During a major release, an unhandled network failure cascade affected checkout flows. I immediately coordinated a hotfix rollback, communicated live status updates to customer support, isolated the unhandled exception, and implemented automated end-to-end regression tests and circuit breaker fallbacks.`,
      status: 'locked',
      attemptsCount: 0,
    },
    {
      roundNumber: 10,
      level: 'hard',
      levelLabel: 'Real Interview',
      question: `As a senior ${jobRole}, how would you architect a mission-critical, enterprise-scale system from scratch while balancing high availability, security, and scalability?`,
      contextHint:
        'This is the definitive final trial. Demonstrate end-to-end mastery across architecture, resilience, monitoring, and engineering leadership.',
      sampleAnswer: `I would design a decoupled, modular architecture adhering to clear domain boundaries. I would enforce end-to-end type safety, automated CI/CD pipelines with strict performance budgets, real-time observability and crash reporting, and graceful offline degradation.`,
      status: 'locked',
      attemptsCount: 0,
    },
  ];
}

/**
 * Ensures that Round 1 is always a classic "Tell me about yourself" question,
 * and ensures that each round matches the 1-10 difficulty progression.
 */
export function sanitize10RoundQuestions(
  rawQuestions: any[],
  jobRole: string,
): JourneyRound[] {
  if (!Array.isArray(rawQuestions) || rawQuestions.length !== 10) {
    return getFallback10RoundQuestions(jobRole);
  }

  return rawQuestions.map((q: any, index: number) => {
    const skeleton = ROUND_SKELETON_CONFIG[index];
    let questionText = typeof q.question === 'string' ? q.question.trim() : '';

    // Enforce "Tell me about yourself" for Round 1 Warm-up
    if (index === 0) {
      if (
        !questionText ||
        !/tell me about yourself|introduce yourself|walk me through your background|walk me through your resume/i.test(
          questionText,
        )
      ) {
        questionText = `Tell me about yourself, your background, and why you are interested in this position as a ${jobRole}.`;
      }
    }

    const fallbackRounds = getFallback10RoundQuestions(jobRole);
    const fallback = fallbackRounds[index];

    return {
      roundNumber: skeleton.roundNumber,
      level: skeleton.level,
      levelLabel: skeleton.levelLabel,
      question: questionText || fallback.question,
      contextHint:
        q.contextHint?.trim() ||
        (index === 0
          ? 'Use the Present, Past, Future framework. Highlight your core strengths and keep your response under 90 seconds.'
          : fallback.contextHint),
      sampleAnswer: q.sampleAnswer?.trim() || fallback.sampleAnswer,
      status: index === 0 ? 'inProgress' : 'locked',
      score: undefined,
      attemptsCount: 0,
    };
  });
}
