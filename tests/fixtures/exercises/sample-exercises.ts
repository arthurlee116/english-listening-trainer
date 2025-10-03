import { Exercise, Question, GradingResult, DifficultyLevel, ListeningLanguage, FocusArea, FocusCoverage } from '../../../lib/types'

// Sample questions for different focus areas and difficulty levels
export const SAMPLE_QUESTIONS: Record<string, Question[]> = {
  beginner: [
    {
      type: "single",
      question: "What is the main topic of the conversation?",
      options: ["Travel plans", "Work schedule", "Weather forecast", "Restaurant menu"],
      answer: "Travel plans",
      focus_areas: ["main-idea"],
      explanation: "The speakers discuss their upcoming vacation plans throughout the conversation."
    },
    {
      type: "single", 
      question: "When are they planning to leave?",
      options: ["Monday morning", "Tuesday afternoon", "Wednesday evening", "Friday night"],
      answer: "Tuesday afternoon",
      focus_areas: ["time-reference", "detail-comprehension"],
      explanation: "The speaker clearly states 'We should leave Tuesday afternoon to avoid traffic.'"
    }
  ],
  intermediate: [
    {
      type: "single",
      question: "What can be inferred about the speaker's attitude towards the new policy?",
      options: ["Strongly supportive", "Cautiously optimistic", "Completely opposed", "Indifferent"],
      answer: "Cautiously optimistic",
      focus_areas: ["speaker-attitude", "inference"],
      explanation: "The speaker uses phrases like 'it might work' and 'we'll see' indicating cautious optimism."
    },
    {
      type: "short",
      question: "Explain the cause-and-effect relationship mentioned in the presentation.",
      options: null,
      answer: "The increase in remote work led to reduced office space demand, which caused commercial real estate prices to decline.",
      focus_areas: ["cause-effect", "detail-comprehension"],
      explanation: "The speaker explicitly connects remote work trends to real estate market changes."
    }
  ],
  advanced: [
    {
      type: "single",
      question: "Which of the following best describes the comparison made between the two research methodologies?",
      options: [
        "Quantitative methods are superior in all aspects",
        "Qualitative approaches provide deeper insights but lack statistical validity", 
        "Both methods have complementary strengths and limitations",
        "The choice depends solely on available resources"
      ],
      answer: "Both methods have complementary strengths and limitations",
      focus_areas: ["comparison", "inference", "main-idea"],
      explanation: "The speaker presents a balanced view, highlighting how each method serves different research purposes."
    },
    {
      type: "short",
      question: "Analyze the speaker's use of numerical data to support their argument.",
      options: null,
      answer: "The speaker cites three key statistics: 85% adoption rate, 40% cost reduction, and 2.3x efficiency improvement to demonstrate the technology's measurable impact across different metrics.",
      focus_areas: ["number-information", "inference"],
      explanation: "Multiple numerical references are used strategically to build a compelling evidence-based argument."
    }
  ]
}

// Sample grading results corresponding to the questions
export const SAMPLE_GRADING_RESULTS: Record<string, GradingResult[]> = {
  beginner: [
    {
      type: "single",
      user_answer: "Travel plans",
      correct_answer: "Travel plans", 
      is_correct: true,
      question_id: 0,
      error_tags: []
    },
    {
      type: "single",
      user_answer: "Monday morning",
      correct_answer: "Tuesday afternoon",
      is_correct: false,
      question_id: 1,
      error_tags: ["time-reference", "attention-to-detail"],
      error_analysis: "Student confused the departure day, likely due to not paying close attention to temporal references."
    }
  ],
  intermediate: [
    {
      type: "single", 
      user_answer: "Cautiously optimistic",
      correct_answer: "Cautiously optimistic",
      is_correct: true,
      question_id: 0,
      error_tags: []
    },
    {
      type: "short",
      user_answer: "Remote work caused office prices to go down",
      correct_answer: "The increase in remote work led to reduced office space demand, which caused commercial real estate prices to decline.",
      is_correct: false,
      question_id: 1,
      score: 6,
      short_feedback: "Correct basic understanding but lacks detail about the intermediate step (reduced demand).",
      error_tags: ["cause-effect", "detail-comprehension"],
      error_analysis: "Student grasped the main causal relationship but missed the intermediate mechanism."
    }
  ],
  advanced: [
    {
      type: "single",
      user_answer: "Both methods have complementary strengths and limitations", 
      correct_answer: "Both methods have complementary strengths and limitations",
      is_correct: true,
      question_id: 0,
      error_tags: []
    },
    {
      type: "short",
      user_answer: "The speaker uses statistics like 85% and 40% to prove their point about technology benefits.",
      correct_answer: "The speaker cites three key statistics: 85% adoption rate, 40% cost reduction, and 2.3x efficiency improvement to demonstrate the technology's measurable impact across different metrics.",
      is_correct: false,
      question_id: 1,
      score: 7,
      short_feedback: "Good identification of key statistics but missed the third metric and the analytical framework.",
      error_tags: ["number-information", "completeness"],
      error_analysis: "Student correctly identified most numerical data but didn't capture the full scope of the evidence presented."
    }
  ]
}

// Sample focus coverage data
export const SAMPLE_FOCUS_COVERAGE: Record<string, FocusCoverage> = {
  perfect: {
    requested: ["main-idea", "detail-comprehension"],
    provided: ["main-idea", "detail-comprehension"],
    coverage: 1.0,
    unmatchedTags: []
  },
  partial: {
    requested: ["main-idea", "detail-comprehension", "inference"],
    provided: ["main-idea", "inference"],
    coverage: 0.67,
    unmatchedTags: ["detail-comprehension"],
    partialMatches: [
      {
        tag: "detail-comprehension",
        confidence: 0.3,
        reason: "Some detail-oriented questions present but not explicitly tagged"
      }
    ]
  },
  poor: {
    requested: ["vocabulary", "cause-effect", "sequence"],
    provided: ["main-idea"],
    coverage: 0.0,
    unmatchedTags: ["vocabulary", "cause-effect", "sequence"]
  }
}

// Comprehensive sample exercises with various configurations
export const SAMPLE_EXERCISES: Record<string, Exercise> = {
  // Basic beginner exercise
  beginnerTravel: {
    id: "exercise-beginner-travel-001",
    difficulty: "A1" as DifficultyLevel,
    language: "en-US" as ListeningLanguage,
    topic: "Travel Planning",
    transcript: "Hi Sarah, are you ready for our vacation? I think we should leave Tuesday afternoon to avoid the morning traffic. The weather forecast looks great for the whole week. We can visit the museum on Wednesday and go to the beach on Thursday. What do you think about the restaurant reservations?",
    questions: SAMPLE_QUESTIONS.beginner,
    answers: { 0: "Travel plans", 1: "Monday morning" },
    results: SAMPLE_GRADING_RESULTS.beginner,
    createdAt: "2024-01-15T10:30:00Z",
    totalDurationSec: 180,
    focusAreas: ["main-idea", "time-reference", "detail-comprehension"],
    focusCoverage: SAMPLE_FOCUS_COVERAGE.perfect,
    specializedMode: true,
    perFocusAccuracy: {
      "main-idea": 100,
      "time-reference": 0,
      "detail-comprehension": 50
    }
  },

  // Intermediate business exercise
  intermediateBusiness: {
    id: "exercise-intermediate-business-002", 
    difficulty: "B1" as DifficultyLevel,
    language: "en-GB" as ListeningLanguage,
    topic: "Workplace Policy Changes",
    transcript: "Good morning everyone. I'd like to discuss the new remote work policy that will be implemented next month. While there are certainly challenges to consider, I believe this change might work well for our team. We'll need to establish clear communication protocols and ensure everyone has the necessary technology. The initial feedback from the pilot program has been quite encouraging, though we'll see how it scales across the entire organization. I'm cautiously optimistic about the potential benefits, including improved work-life balance and reduced commuting costs.",
    questions: SAMPLE_QUESTIONS.intermediate,
    answers: { 0: "Cautiously optimistic", 1: "Remote work caused office prices to go down" },
    results: SAMPLE_GRADING_RESULTS.intermediate,
    createdAt: "2024-01-16T14:45:00Z",
    totalDurationSec: 240,
    focusAreas: ["speaker-attitude", "inference", "cause-effect"],
    focusCoverage: SAMPLE_FOCUS_COVERAGE.partial,
    specializedMode: true,
    perFocusAccuracy: {
      "speaker-attitude": 100,
      "inference": 100,
      "cause-effect": 60
    }
  },

  // Advanced academic exercise
  advancedAcademic: {
    id: "exercise-advanced-academic-003",
    difficulty: "C1" as DifficultyLevel,
    language: "en-US" as ListeningLanguage,
    topic: "Research Methodology Comparison",
    transcript: "Today's lecture focuses on the comparative analysis of quantitative versus qualitative research methodologies. While quantitative methods excel in providing statistical validity and reproducibility, with our recent study showing an 85% adoption rate among researchers, qualitative approaches offer deeper contextual insights that numbers alone cannot capture. The implementation of mixed-method approaches has demonstrated a 40% cost reduction in research projects while achieving a 2.3x efficiency improvement in data collection. Rather than viewing these methodologies as competing paradigms, we should recognize that both have complementary strengths and limitations. The choice of methodology should align with research objectives, available resources, and the nature of the phenomena being investigated.",
    questions: SAMPLE_QUESTIONS.advanced,
    answers: { 0: "Both methods have complementary strengths and limitations", 1: "The speaker uses statistics like 85% and 40% to prove their point about technology benefits." },
    results: SAMPLE_GRADING_RESULTS.advanced,
    createdAt: "2024-01-17T09:15:00Z",
    totalDurationSec: 300,
    focusAreas: ["comparison", "inference", "number-information"],
    focusCoverage: SAMPLE_FOCUS_COVERAGE.perfect,
    specializedMode: true,
    perFocusAccuracy: {
      "comparison": 100,
      "inference": 100,
      "number-information": 70
    }
  },

  // Non-specialized mode exercise
  generalPractice: {
    id: "exercise-general-practice-004",
    difficulty: "B2" as DifficultyLevel,
    language: "en-US" as ListeningLanguage,
    topic: "Environmental Conservation",
    transcript: "Climate change represents one of the most pressing challenges of our time. Scientists have observed a consistent pattern of rising global temperatures over the past century. The primary cause is the increased concentration of greenhouse gases in the atmosphere, particularly carbon dioxide from fossil fuel combustion. This has led to melting ice caps, rising sea levels, and more frequent extreme weather events. However, there are reasons for optimism. Renewable energy technologies have become increasingly cost-effective, and many countries have committed to ambitious carbon reduction targets.",
    questions: [
      {
        type: "single",
        question: "According to the passage, what is the primary cause of climate change?",
        options: ["Melting ice caps", "Greenhouse gases from fossil fuels", "Rising sea levels", "Extreme weather events"],
        answer: "Greenhouse gases from fossil fuels",
        focus_areas: ["cause-effect", "main-idea"]
      }
    ],
    answers: { 0: "Greenhouse gases from fossil fuels" },
    results: [
      {
        type: "single",
        user_answer: "Greenhouse gases from fossil fuels",
        correct_answer: "Greenhouse gases from fossil fuels",
        is_correct: true,
        question_id: 0
      }
    ],
    createdAt: "2024-01-18T16:20:00Z",
    totalDurationSec: 200,
    specializedMode: false
  },

  // Exercise with missing duration (for fallback testing)
  noDurationExercise: {
    id: "exercise-no-duration-005",
    difficulty: "A2" as DifficultyLevel,
    language: "es" as ListeningLanguage,
    topic: "Daily Routine",
    transcript: "Buenos días. Me llamo María y voy a hablar sobre mi rutina diaria. Me levanto a las siete de la mañana todos los días. Primero, me ducho y desayuno. Luego, voy al trabajo en autobús. Trabajo en una oficina desde las nueve hasta las cinco. Por la tarde, voy al gimnasio o salgo con mis amigos.",
    questions: [
      {
        type: "single",
        question: "¿A qué hora se levanta María?",
        options: ["A las seis", "A las siete", "A las ocho", "A las nueve"],
        answer: "A las siete",
        focus_areas: ["time-reference", "detail-comprehension"]
      }
    ],
    answers: { 0: "A las siete" },
    results: [
      {
        type: "single",
        user_answer: "A las siete",
        correct_answer: "A las siete",
        is_correct: true,
        question_id: 0
      }
    ],
    createdAt: "2024-01-19T11:00:00Z",
    // totalDurationSec is intentionally missing for fallback testing
    focusAreas: ["time-reference", "detail-comprehension"],
    specializedMode: true
  }
}

// Exercise arrays for different scenarios
export const BEGINNER_EXERCISES = [SAMPLE_EXERCISES.beginnerTravel]
export const INTERMEDIATE_EXERCISES = [SAMPLE_EXERCISES.intermediateBusiness]
export const ADVANCED_EXERCISES = [SAMPLE_EXERCISES.advancedAcademic]
export const ALL_SAMPLE_EXERCISES = Object.values(SAMPLE_EXERCISES)

// Helper function to create exercise with custom overrides
export function createMockExercise(overrides: Partial<Exercise> = {}): Exercise {
  const baseExercise = SAMPLE_EXERCISES.beginnerTravel
  return {
    ...baseExercise,
    ...overrides,
    id: overrides.id || `mock-exercise-${Date.now()}`,
    createdAt: overrides.createdAt || new Date().toISOString()
  }
}

// Helper function to create exercise with specific focus areas
export function createExerciseWithFocusAreas(focusAreas: FocusArea[], difficulty: DifficultyLevel = "B1"): Exercise {
  return createMockExercise({
    difficulty,
    focusAreas,
    specializedMode: true,
    focusCoverage: {
      requested: focusAreas,
      provided: focusAreas,
      coverage: 1.0,
      unmatchedTags: []
    }
  })
}