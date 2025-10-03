import { 
  AIAnalysisResponse, 
  AIAnalysisRequest, 
  QuestionGenerationResponse, 
  TopicGenerationResponse, 
  TranscriptGenerationResponse,
  Question,
  FocusArea,
  DifficultyLevel,
  ListeningLanguage
} from '../../../lib/types'

// Sample AI analysis responses for wrong answer analysis
export const SAMPLE_AI_ANALYSIS_RESPONSES: Record<string, AIAnalysisResponse> = {
  // High confidence analysis for a clear mistake
  highConfidenceAnalysis: {
    analysis: "The student incorrectly identified the main topic as 'weather forecast' when the conversation was clearly about travel planning. This suggests difficulty in distinguishing between incidental details (weather being mentioned in context of travel) and the central theme of the conversation.",
    key_reason: "Confusion between supporting details and main topic",
    ability_tags: ["main-idea", "detail-comprehension"],
    signal_words: ["vacation", "travel plans", "leave Tuesday", "museum", "beach"],
    strategy: "Focus on identifying the overall purpose of the conversation rather than getting distracted by specific details mentioned. Look for repeated themes and the speakers' primary concerns.",
    related_sentences: [
      {
        quote: "Hi Sarah, are you ready for our vacation?",
        comment: "Opening sentence clearly establishes travel as the main topic"
      },
      {
        quote: "The weather forecast looks great for the whole week.",
        comment: "Weather is mentioned as supporting information for travel plans, not the main focus"
      }
    ],
    confidence: "high"
  },

  // Medium confidence analysis for inference question
  mediumConfidenceAnalysis: {
    analysis: "The student selected 'completely opposed' when the speaker's language indicated 'cautious optimism'. The speaker used qualifying phrases like 'might work' and 'we'll see' which suggest tentative support rather than strong opposition.",
    key_reason: "Misinterpretation of speaker's hedging language",
    ability_tags: ["speaker-attitude", "inference", "vocabulary"],
    signal_words: ["might work", "we'll see", "cautiously", "potential benefits"],
    strategy: "Pay attention to qualifying words and phrases that indicate uncertainty or conditional support. Words like 'might', 'could', 'potentially' often signal cautious attitudes rather than strong positions.",
    related_sentences: [
      {
        quote: "I believe this change might work well for our team.",
        comment: "The word 'might' indicates uncertainty and cautious optimism"
      },
      {
        quote: "I'm cautiously optimistic about the potential benefits.",
        comment: "Explicitly states cautious optimism rather than opposition"
      }
    ],
    confidence: "medium"
  },

  // Low confidence analysis for complex question
  lowConfidenceAnalysis: {
    analysis: "The student's response captured the basic causal relationship but missed the intermediate step of 'reduced office space demand'. This type of multi-step causal chain requires careful attention to the logical sequence presented in the passage.",
    key_reason: "Incomplete understanding of multi-step causal relationships",
    ability_tags: ["cause-effect", "detail-comprehension", "sequence"],
    signal_words: ["led to", "caused", "resulted in", "because of"],
    strategy: "When analyzing cause-and-effect relationships, look for intermediate steps between the initial cause and final effect. Create a mental map of the causal chain: A leads to B, which leads to C.",
    related_sentences: [
      {
        quote: "The increase in remote work led to reduced office space demand.",
        comment: "First step in the causal chain - remote work affects demand"
      },
      {
        quote: "which caused commercial real estate prices to decline.",
        comment: "Second step - reduced demand affects prices"
      }
    ],
    confidence: "low"
  },

  // Analysis for vocabulary-focused error
  vocabularyAnalysis: {
    analysis: "The student confused 'adoption rate' with 'adaptation rate', leading to misunderstanding of the statistical information. This demonstrates the importance of precise vocabulary comprehension in academic listening contexts.",
    key_reason: "Vocabulary confusion affecting comprehension",
    ability_tags: ["vocabulary", "number-information"],
    signal_words: ["adoption rate", "85%", "implementation", "usage statistics"],
    strategy: "When encountering technical or academic vocabulary, consider the context to determine precise meaning. 'Adoption' refers to taking up or starting to use something, while 'adaptation' refers to changing or adjusting.",
    related_sentences: [
      {
        quote: "with our recent study showing an 85% adoption rate among researchers",
        comment: "Adoption rate refers to the percentage of researchers who have started using the methodology"
      }
    ],
    confidence: "high"
  }
}

// Sample AI analysis requests for testing
export const SAMPLE_AI_ANALYSIS_REQUESTS: Record<string, AIAnalysisRequest> = {
  singleChoiceRequest: {
    questionType: "single",
    question: "What is the main topic of the conversation?",
    options: ["Travel plans", "Work schedule", "Weather forecast", "Restaurant menu"],
    userAnswer: "Weather forecast",
    correctAnswer: "Travel plans",
    transcript: "Hi Sarah, are you ready for our vacation? I think we should leave Tuesday afternoon to avoid the morning traffic. The weather forecast looks great for the whole week.",
    exerciseTopic: "Travel Planning",
    exerciseDifficulty: "A1",
    language: "en-US",
    attemptedAt: "2024-01-20T10:30:00Z"
  },

  shortAnswerRequest: {
    questionType: "short",
    question: "Explain the cause-and-effect relationship mentioned in the presentation.",
    userAnswer: "Remote work caused office prices to go down",
    correctAnswer: "The increase in remote work led to reduced office space demand, which caused commercial real estate prices to decline.",
    transcript: "The increase in remote work has fundamentally changed the commercial real estate market. As more companies adopt flexible work policies, the demand for traditional office space has decreased significantly. This reduced demand has led to a notable decline in commercial real estate prices across major metropolitan areas.",
    exerciseTopic: "Economic Trends",
    exerciseDifficulty: "B2",
    language: "en-US",
    attemptedAt: "2024-01-20T14:15:00Z"
  }
}

// Sample question generation responses
export const SAMPLE_QUESTION_GENERATION_RESPONSES: Record<string, QuestionGenerationResponse> = {
  // Successful generation with perfect focus coverage
  perfectCoverage: {
    success: true,
    questions: [
      {
        type: "single",
        question: "What is the main argument presented in the passage?",
        options: ["Technology is harmful", "Innovation drives progress", "Change is inevitable", "Research is expensive"],
        answer: "Innovation drives progress",
        focus_areas: ["main-idea"],
        explanation: "The speaker consistently emphasizes how technological innovation leads to societal advancement."
      },
      {
        type: "single",
        question: "According to the speaker, what percentage of companies have adopted remote work?",
        options: ["65%", "75%", "85%", "95%"],
        answer: "85%",
        focus_areas: ["number-information", "detail-comprehension"],
        explanation: "The speaker explicitly states '85% of companies have now adopted some form of remote work policy.'"
      }
    ],
    focusCoverage: {
      requested: ["main-idea", "number-information"],
      provided: ["main-idea", "number-information", "detail-comprehension"],
      coverage: 1.0,
      unmatchedTags: []
    },
    focusMatch: [
      {
        questionIndex: 0,
        matchedTags: ["main-idea"],
        confidence: "high"
      },
      {
        questionIndex: 1,
        matchedTags: ["number-information", "detail-comprehension"],
        confidence: "high"
      }
    ],
    attempts: 1
  },

  // Partial coverage with some degradation
  partialCoverage: {
    success: true,
    questions: [
      {
        type: "single",
        question: "What can be inferred about the speaker's opinion?",
        options: ["Strongly positive", "Neutral", "Cautiously optimistic", "Negative"],
        answer: "Cautiously optimistic",
        focus_areas: ["speaker-attitude", "inference"],
        explanation: "The speaker uses qualifying language that suggests measured optimism."
      }
    ],
    focusCoverage: {
      requested: ["speaker-attitude", "inference", "vocabulary"],
      provided: ["speaker-attitude", "inference"],
      coverage: 0.67,
      unmatchedTags: ["vocabulary"],
      partialMatches: [
        {
          tag: "vocabulary",
          confidence: 0.3,
          reason: "Some vocabulary-related content present but not explicitly tested"
        }
      ]
    },
    focusMatch: [
      {
        questionIndex: 0,
        matchedTags: ["speaker-attitude", "inference"],
        confidence: "medium"
      }
    ],
    attempts: 2,
    degradationReason: "Could not generate vocabulary-focused questions for this transcript"
  },

  // Failed generation
  failed: {
    success: false,
    questions: [],
    attempts: 3,
    degradationReason: "Transcript too short to generate meaningful questions for requested focus areas"
  }
}

// Sample topic generation responses
export const SAMPLE_TOPIC_GENERATION_RESPONSES: Record<string, TopicGenerationResponse> = {
  successful: {
    success: true,
    topics: [
      "Climate Change and Environmental Policy",
      "Renewable Energy Technologies",
      "Sustainable Urban Development",
      "Green Transportation Solutions",
      "Environmental Conservation Strategies"
    ],
    attempts: 1
  },

  partialSuccess: {
    success: true,
    topics: [
      "Digital Marketing Trends",
      "Social Media Analytics",
      "Consumer Behavior Online"
    ],
    attempts: 2,
    degradationReason: "Generated fewer topics than requested due to narrow domain constraints"
  },

  failed: {
    success: false,
    topics: [],
    attempts: 3,
    degradationReason: "Unable to generate appropriate topics for specified difficulty and language combination"
  }
}

// Sample transcript generation responses
export const SAMPLE_TRANSCRIPT_GENERATION_RESPONSES: Record<string, TranscriptGenerationResponse> = {
  successful: {
    success: true,
    transcript: "Good morning, everyone. Today I'd like to discuss the impact of artificial intelligence on modern healthcare systems. Over the past decade, we've witnessed remarkable advances in diagnostic accuracy, with AI-powered systems now capable of detecting certain conditions earlier than traditional methods. However, this technological progress also raises important questions about data privacy, professional autonomy, and the human element in patient care. As we move forward, it's crucial that we balance innovation with ethical considerations to ensure that these powerful tools serve to enhance, rather than replace, the fundamental human connections that define quality healthcare.",
    attempts: 1
  },

  degraded: {
    success: true,
    transcript: "The weather today is quite pleasant. It's sunny with a light breeze, perfect for outdoor activities. Many people are taking advantage of the nice conditions to go for walks in the park or have picnics with their families.",
    attempts: 2,
    degradationReason: "Generated simpler content due to complexity constraints for requested difficulty level"
  },

  failed: {
    success: false,
    transcript: "",
    attempts: 3,
    degradationReason: "Unable to generate appropriate transcript for specified topic and focus area combination"
  }
}

// Arrays for easy access
export const ALL_AI_ANALYSIS_RESPONSES = Object.values(SAMPLE_AI_ANALYSIS_RESPONSES)
export const ALL_AI_ANALYSIS_REQUESTS = Object.values(SAMPLE_AI_ANALYSIS_REQUESTS)
export const ALL_QUESTION_GENERATION_RESPONSES = Object.values(SAMPLE_QUESTION_GENERATION_RESPONSES)

// Helper functions for creating mock AI responses
export function createMockAIAnalysis(overrides: Partial<AIAnalysisResponse> = {}): AIAnalysisResponse {
  const baseAnalysis = SAMPLE_AI_ANALYSIS_RESPONSES.highConfidenceAnalysis
  return {
    ...baseAnalysis,
    ...overrides
  }
}

export function createMockQuestionGeneration(
  success: boolean = true,
  questionCount: number = 2,
  focusAreas: FocusArea[] = ["main-idea", "detail-comprehension"]
): QuestionGenerationResponse {
  if (!success) {
    return SAMPLE_QUESTION_GENERATION_RESPONSES.failed
  }

  const questions: Question[] = []
  for (let i = 0; i < questionCount; i++) {
    questions.push({
      type: "single",
      question: `Sample question ${i + 1}`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      answer: "Option A",
      focus_areas: [focusAreas[i % focusAreas.length]],
      explanation: `Explanation for question ${i + 1}`
    })
  }

  return {
    success: true,
    questions,
    focusCoverage: {
      requested: focusAreas,
      provided: focusAreas,
      coverage: 1.0,
      unmatchedTags: []
    },
    attempts: 1
  }
}

export function createMockTopicGeneration(
  success: boolean = true,
  topicCount: number = 5
): TopicGenerationResponse {
  if (!success) {
    return SAMPLE_TOPIC_GENERATION_RESPONSES.failed
  }

  const topics: string[] = []
  for (let i = 0; i < topicCount; i++) {
    topics.push(`Sample Topic ${i + 1}`)
  }

  return {
    success: true,
    topics,
    attempts: 1
  }
}

export function createMockTranscriptGeneration(
  success: boolean = true,
  topic: string = "Technology",
  difficulty: DifficultyLevel = "B1"
): TranscriptGenerationResponse {
  if (!success) {
    return SAMPLE_TRANSCRIPT_GENERATION_RESPONSES.failed
  }

  return {
    success: true,
    transcript: `This is a sample transcript about ${topic} at ${difficulty} level. It contains appropriate vocabulary and complexity for the specified difficulty level.`,
    attempts: 1
  }
}

// Helper to create AI analysis request from exercise data
export function createAIAnalysisRequest(
  question: Question,
  userAnswer: string,
  transcript: string,
  exerciseTopic: string,
  difficulty: DifficultyLevel = "B1",
  language: ListeningLanguage = "en-US"
): AIAnalysisRequest {
  return {
    questionType: question.type,
    question: question.question,
    options: question.options || undefined,
    userAnswer,
    correctAnswer: question.answer,
    transcript,
    exerciseTopic,
    exerciseDifficulty: difficulty,
    language,
    attemptedAt: new Date().toISOString()
  }
}