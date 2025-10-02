import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createMockExercise,
  createMockAIAnalysisResponse,
  createMockQuestion,
} from './mock-utils';
import type {
  AIAnalysisResponse,
  Question,
  QuestionGenerationResponse,
  TopicGenerationResponse,
  TranscriptGenerationResponse,
} from '@/lib/types';

// =============== Mock Response Data ===============

const mockQuestionsResponse: QuestionGenerationResponse = {
  success: true,
  questions: [
    createMockQuestion({
      question: 'What is the main topic discussed in the audio?',
      focus_areas: ['main-idea'],
    }),
    createMockQuestion({
      type: 'short',
      question: 'What specific benefits are mentioned?',
      options: null,
      answer: 'Improved efficiency and cost reduction',
      focus_areas: ['detail-comprehension'],
    }),
  ],
  focusCoverage: {
    requested: ['main-idea', 'detail-comprehension'],
    provided: ['main-idea', 'detail-comprehension'],
    coverage: 1.0,
    unmatchedTags: [],
  },
  focusMatch: [
    {
      questionIndex: 0,
      matchedTags: ['main-idea'],
      confidence: 'high',
    },
    {
      questionIndex: 1,
      matchedTags: ['detail-comprehension'],
      confidence: 'high',
    },
  ],
};

const mockTopicsResponse: TopicGenerationResponse = {
  success: true,
  topics: [
    'Technology and Innovation',
    'Sustainable Business Practices',
    'Remote Work Challenges',
    'Digital Marketing Strategies',
    'Healthcare Technology Advances',
  ],
};

const mockTranscriptResponse: TranscriptGenerationResponse = {
  success: true,
  transcript: 'In today\'s rapidly evolving business landscape, companies are increasingly adopting sustainable practices to reduce their environmental impact. This shift towards sustainability is not just about corporate responsibility, but also about long-term profitability and competitive advantage.',
};

const mockGradingResponse = {
  success: true,
  results: [
    {
      type: 'single',
      user_answer: 'Technology trends',
      correct_answer: 'Technology trends',
      is_correct: true,
      question_id: 0,
    },
    {
      type: 'short',
      user_answer: 'Improved efficiency',
      correct_answer: 'Improved efficiency and cost reduction',
      is_correct: false,
      question_id: 1,
      score: 6,
      short_feedback: 'Partially correct, but missing cost reduction aspect.',
    },
  ],
};

const mockAIAnalysisResponse: AIAnalysisResponse = createMockAIAnalysisResponse();

const mockPracticeSaveResponse = {
  success: true,
  sessionId: 'saved-session-123',
  message: 'Practice session saved successfully',
};

const mockTTSResponse = {
  success: true,
  audioUrl: '/api/tts/audio-123.wav',
  duration: 45.2,
};

// =============== Request Handlers ===============

export const handlers = [
  // AI Question Generation
  http.post('/api/ai/questions', async ({ request }) => {
    const body = await request.json() as any;
    
    // Simulate different responses based on request parameters
    if (body.focusAreas?.includes('inference')) {
      return HttpResponse.json({
        ...mockQuestionsResponse,
        questions: [
          createMockQuestion({
            question: 'What can be inferred about the speaker\'s attitude?',
            focus_areas: ['inference', 'speaker-attitude'],
          }),
        ],
      });
    }
    
    // Simulate failure scenario
    if (body.topic === 'FAIL_TEST') {
      return HttpResponse.json(
        { success: false, error: 'Failed to generate questions' },
        { status: 500 }
      );
    }
    
    return HttpResponse.json(mockQuestionsResponse);
  }),

  // AI Topic Generation
  http.post('/api/ai/topics', async ({ request }) => {
    const body = await request.json() as any;
    
    // Simulate different topics based on difficulty
    if (body.difficulty === 'C2') {
      return HttpResponse.json({
        ...mockTopicsResponse,
        topics: [
          'Advanced Quantum Computing Applications',
          'Philosophical Implications of AI Ethics',
          'Macroeconomic Policy Analysis',
        ],
      });
    }
    
    return HttpResponse.json(mockTopicsResponse);
  }),

  // AI Transcript Generation
  http.post('/api/ai/transcript', async ({ request }) => {
    const body = await request.json() as any;
    
    // Simulate different transcripts based on topic
    if (body.topic?.includes('Technology')) {
      return HttpResponse.json({
        ...mockTranscriptResponse,
        transcript: 'Artificial intelligence and machine learning technologies are revolutionizing various industries. From healthcare to finance, these innovations are creating new opportunities while also presenting unique challenges that organizations must navigate carefully.',
      });
    }
    
    return HttpResponse.json(mockTranscriptResponse);
  }),

  // AI Grading
  http.post('/api/ai/grade', async ({ request }) => {
    const body = await request.json() as any;
    
    // Simulate grading based on answers
    const results = body.answers?.map((answer: any, index: number) => ({
      type: answer.type || 'single',
      user_answer: answer.answer,
      correct_answer: body.questions?.[index]?.answer || 'Correct answer',
      is_correct: answer.answer === body.questions?.[index]?.answer,
      question_id: index,
      score: answer.type === 'short' ? Math.floor(Math.random() * 5) + 6 : null,
      short_feedback: answer.type === 'short' ? 'Good understanding shown.' : null,
    })) || mockGradingResponse.results;
    
    return HttpResponse.json({
      success: true,
      results,
    });
  }),

  // Wrong Answer AI Analysis
  http.post('/api/ai/wrong-answers', async ({ request }) => {
    const body = await request.json() as any;
    
    // Simulate analysis based on question type
    if (body.questionType === 'inference') {
      return HttpResponse.json({
        ...mockAIAnalysisResponse,
        analysis: 'The user struggled with inferential reasoning, focusing too much on explicit information rather than implied meanings.',
        ability_tags: ['inference', 'critical-thinking'],
      });
    }
    
    return HttpResponse.json(mockAIAnalysisResponse);
  }),

  // Practice Session Save
  http.post('/api/practice/save', async ({ request }) => {
    const body = await request.json() as any;
    
    // Simulate validation error
    if (!body.exerciseData) {
      return HttpResponse.json(
        { success: false, error: 'Missing exercise data' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json(mockPracticeSaveResponse);
  }),

  // Practice History
  http.get('/api/practice/history', () => {
    const mockHistory = Array.from({ length: 5 }, (_, i) => 
      createMockExercise({ id: `history-${i}` })
    );
    
    return HttpResponse.json({
      success: true,
      history: mockHistory,
    });
  }),

  // TTS Audio Generation
  http.post('/api/tts', async ({ request }) => {
    const body = await request.json() as any;
    
    // Simulate different responses based on text length
    if (body.text?.length > 1000) {
      return HttpResponse.json(
        { success: false, error: 'Text too long' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json(mockTTSResponse);
  }),

  // Health Check
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }),

  // Wrong Answers List
  http.get('/api/wrong-answers/list', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    // Generate mock wrong answers
    const mockWrongAnswers = Array.from({ length: limit }, (_, i) => ({
      id: `wrong-${page}-${i}`,
      questionData: createMockQuestion(),
      userAnswer: 'Wrong answer',
      correctAnswer: 'Correct answer',
      topic: 'Test Topic',
      difficulty: 'B1',
      createdAt: new Date().toISOString(),
    }));
    
    return HttpResponse.json({
      success: true,
      wrongAnswers: mockWrongAnswers,
      pagination: {
        page,
        limit,
        total: 50,
        totalPages: 5,
      },
    });
  }),
];

// =============== Server Setup ===============

export const server = setupServer(...handlers);

// =============== Test Utilities ===============

/**
 * Override a specific API endpoint for a test
 */
export function mockApiEndpoint(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  response: any,
  status: number = 200
) {
  const handler = http[method](path, () => {
    return HttpResponse.json(response, { status });
  });
  
  server.use(handler);
}

/**
 * Simulate API failure for testing error handling
 */
export function mockApiFailure(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  status: number = 500,
  error: string = 'Internal Server Error'
) {
  const handler = http[method](path, () => {
    return HttpResponse.json({ error }, { status });
  });
  
  server.use(handler);
}

/**
 * Simulate network timeout
 */
export function mockApiTimeout(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  delay: number = 5000
) {
  const handler = http[method](path, async () => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return HttpResponse.json({ error: 'Request timeout' }, { status: 408 });
  });
  
  server.use(handler);
}

/**
 * Mock successful AI question generation with specific focus areas
 */
export function mockAIQuestionGeneration(focusAreas: string[], questions: Question[]) {
  const handler = http.post('/api/ai/questions', () => {
    return HttpResponse.json({
      success: true,
      questions,
      focusCoverage: {
        requested: focusAreas,
        provided: focusAreas,
        coverage: 1.0,
        unmatchedTags: [],
      },
    });
  });
  
  server.use(handler);
}

/**
 * Mock TTS service with custom audio response
 */
export function mockTTSService(audioUrl: string, duration: number = 30) {
  const handler = http.post('/api/tts', () => {
    return HttpResponse.json({
      success: true,
      audioUrl,
      duration,
    });
  });
  
  server.use(handler);
}

/**
 * Reset all API mocks to default handlers
 */
export function resetApiMocks() {
  server.resetHandlers(...handlers);
}

/**
 * Setup MSW for tests
 */
export function setupApiMocks() {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });
}