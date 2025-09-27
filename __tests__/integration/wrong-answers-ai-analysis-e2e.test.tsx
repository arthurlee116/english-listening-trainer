import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextRequest, NextResponse } from 'next/server'

// Mock Next.js router
const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
    }),
    usePathname: () => '/wrong-answers',
    useSearchParams: () => new URLSearchParams(),
}))

// Mock authentication
const mockUser = {
    userId: 'test-user-123',
    email: 'test@example.com',
    isAdmin: false
}

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn().mockResolvedValue(mockUser),
    getUser: vi.fn().mockResolvedValue(mockUser),
}))

// Mock database operations
const mockPrisma = {
    practiceSession: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
    practiceQuestion: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
    practiceAnswer: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
    },
    $transaction: vi.fn(),
}

vi.mock('@/lib/database', () => ({
    withDatabase: vi.fn((callback) => callback(mockPrisma)),
    prisma: mockPrisma,
}))

// Mock AI service
const mockAIAnalysis = {
    analysis: "这是一个详细的中文分析，解释了学生在听力理解方面的错误。学生没有正确理解对话中的关键信息，特别是关于时间和地点的细节。建议加强对话细节的捕捉能力。",
    key_reason: "细节理解缺失",
    ability_tags: ["听力细节捕捉", "时间信息理解", "地点信息理解"],
    signal_words: ["明天", "图书馆", "下午三点"],
    strategy: "在听对话时，要特别注意时间、地点等关键信息词，可以在听的过程中做简单记录。",
    related_sentences: [
        {
            quote: "我们明天下午三点在图书馆见面吧",
            comment: "这句话包含了正确答案所需的时间和地点信息"
        }
    ],
    confidence: "high" as const
}

vi.mock('@/lib/ai-analysis-service', () => ({
    analyzeWrongAnswer: vi.fn().mockResolvedValue(mockAIAnalysis),
    analyzeBatch: vi.fn(),
}))

// Mock rate limiter
vi.mock('@/lib/rate-limiter', () => ({
    checkRateLimit: vi.fn().mockResolvedValue(true),
    recordSuccessfulRequest: vi.fn(),
    recordFailedRequest: vi.fn(),
    aiServiceCircuitBreaker: {
        fire: vi.fn().mockResolvedValue(mockAIAnalysis),
    },
}))

// Mock concurrency service
vi.mock('@/lib/concurrency-service', () => ({
    processConcurrently: vi.fn(),
}))

// Mock export service
const mockExportService = {
    exportToTXT: vi.fn().mockResolvedValue('mock-file-content'),
    downloadFile: vi.fn(),
}

vi.mock('@/lib/export-service', () => ({
    ExportService: mockExportService
}))

// Import components after mocking
import { WrongAnswersBook } from '@/components/wrong-answers-book'
const { POST: importLegacyHandler } = await import('@/app/api/practice/import-legacy/route')
const { POST: analyzeHandler } = await import('@/app/api/ai/wrong-answers/analyze/route')
const { POST: analyzeBatchHandler } = await import('@/app/api/ai/wrong-answers/analyze-batch/route')
const { GET: listHandler } = await import('@/app/api/wrong-answers/list/route')

// Test data
const mockLegacyData = [
    {
        id: 'legacy-session-1',
        topic: 'Daily Conversation',
        difficulty: 'Beginner',
        language: 'Chinese',
        transcript: '今天天气很好，我们去公园散步吧。',
        questions: [
            {
                index: 0,
                type: 'multiple-choice',
                question: '他们打算去哪里？',
                options: ['商店', '公园', '学校', '医院'],
                correctAnswer: '公园',
                explanation: '对话中明确提到"去公园散步"',
            }
        ],
        answers: ['商店'],
        results: [{ is_correct: false, correct_answer: '公园', explanation: '对话中明确提到"去公园散步"' }],
        score: 0,
        createdAt: '2024-01-15T10:00:00Z'
    }
]

const mockWrongAnswers = [
    {
        answerId: 'answer-1',
        questionId: 'question-1',
        sessionId: 'session-1',
        session: {
            topic: 'Daily Conversation',
            difficulty: 'Beginner',
            language: 'Chinese',
            createdAt: '2024-01-15T10:00:00Z'
        },
        question: {
            index: 0,
            type: 'multiple-choice',
            question: '他们打算去哪里？',
            options: ['商店', '公园', '学校', '医院'],
            correctAnswer: '公园',
            explanation: '对话中明确提到"去公园散步"',
            transcript: '今天天气很好，我们去公园散步吧。'
        },
        answer: {
            userAnswer: '商店',
            isCorrect: false,
            attemptedAt: '2024-01-15T10:00:00Z',
            aiAnalysis: null,
            aiAnalysisGeneratedAt: null,
            needsAnalysis: true
        }
    }
]

describe('Wrong Answers AI Analysis - End-to-End Integration Tests', () => {
    const user = userEvent.setup()

    beforeEach(() => {
        vi.clearAllMocks()
        // Reset localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
            },
            writable: true,
        })
    })

    describe('Complete User Workflow - Legacy Migration to AI Analysis', () => {
        it('should handle complete workflow from legacy data detection to AI analysis generation', async () => {
            // Step 1: Mock localStorage with legacy data
            const mockLocalStorage = {
                getItem: vi.fn((key) => {
                    if (key === 'exerciseHistory') {
                        return JSON.stringify(mockLegacyData)
                    }
                    return null
                }),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
            }
            Object.defineProperty(window, 'localStorage', {
                value: mockLocalStorage,
                writable: true,
            })

            // Step 2: Mock successful import API response
            global.fetch = vi.fn().mockImplementation((url, options) => {
                if (url.includes('/api/practice/import-legacy')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            success: true,
                            imported: {
                                sessions: 1,
                                questions: 1,
                                answers: 1
                            }
                        })
                    })
                }
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: mockWrongAnswers
                        })
                    })
                }
                if (url.includes('/api/ai/wrong-answers/analyze')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(mockAIAnalysis)
                    })
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            // Step 3: Render the component
            render(<WrongAnswersBook onBack={() => { }} />)

            // Step 4: Wait for legacy data migration to complete
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/practice/import-legacy',
                    expect.objectContaining({
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessions: mockLegacyData })
                    })
                )
            })

            // Step 5: Verify localStorage is cleared after successful import
            await waitFor(() => {
                expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('exerciseHistory')
            })

            // Step 6: Wait for wrong answers to load
            await waitFor(() => {
                expect(screen.getByText('他们打算去哪里？')).toBeInTheDocument()
            })

            // Step 7: Verify wrong answer details are displayed
            expect(screen.getByText('商店')).toBeInTheDocument() // User's wrong answer
            expect(screen.getByText('公园')).toBeInTheDocument() // Correct answer

            // Step 8: Generate AI analysis
            const generateButton = screen.getByText('Generate Analysis')
            await user.click(generateButton)

            // Step 9: Wait for AI analysis to complete
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/ai/wrong-answers/analyze',
                    expect.objectContaining({
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
            })

            // Step 10: Verify AI analysis is displayed
            await waitFor(() => {
                expect(screen.getByText('细节理解缺失')).toBeInTheDocument()
                expect(screen.getByText('听力细节捕捉')).toBeInTheDocument()
            })
        })

        it('should handle legacy migration failure and retry mechanism', async () => {
            // Mock localStorage with legacy data
            const mockLocalStorage = {
                getItem: vi.fn((key) => {
                    if (key === 'exerciseHistory') {
                        return JSON.stringify(mockLegacyData)
                    }
                    return null
                }),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
            }
            Object.defineProperty(window, 'localStorage', {
                value: mockLocalStorage,
                writable: true,
            })

            // Mock failed import API response
            let importAttempts = 0
            global.fetch = vi.fn().mockImplementation((url, options) => {
                if (url.includes('/api/practice/import-legacy')) {
                    importAttempts++
                    if (importAttempts === 1) {
                        return Promise.resolve({
                            ok: false,
                            json: () => Promise.resolve({
                                error: 'Database connection failed'
                            })
                        })
                    } else {
                        return Promise.resolve({
                            ok: true,
                            json: () => Promise.resolve({
                                success: true,
                                imported: { sessions: 1, questions: 1, answers: 1 }
                            })
                        })
                    }
                }
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ wrongAnswers: mockWrongAnswers })
                    })
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            render(<WrongAnswersBook onBack={() => { }} />)

            // Wait for first failed import attempt
            await waitFor(() => {
                expect(importAttempts).toBe(1)
            })

            // Verify localStorage data is preserved after failure
            expect(mockLocalStorage.removeItem).not.toHaveBeenCalled()

            // Look for retry notification or button
            await waitFor(() => {
                expect(screen.getByText(/migration failed/i) || screen.getByText(/retry/i)).toBeInTheDocument()
            })

            // Trigger retry
            const retryButton = screen.getByText(/retry/i)
            await user.click(retryButton)

            // Wait for successful retry
            await waitFor(() => {
                expect(importAttempts).toBe(2)
                expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('exerciseHistory')
            })
        })
    })

    describe('Concurrent Batch Processing Scenarios', () => {
        it('should handle batch analysis with mixed success and failure results', async () => {
            const multipleWrongAnswers = Array.from({ length: 5 }, (_, i) => ({
                ...mockWrongAnswers[0],
                answerId: `answer-${i + 1}`,
                questionId: `question-${i + 1}`,
                question: {
                    ...mockWrongAnswers[0].question,
                    question: `测试问题 ${i + 1}？`
                }
            }))

            // Mock batch analysis with mixed results
            global.fetch = vi.fn().mockImplementation((url, options) => {
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: multipleWrongAnswers
                        })
                    })
                }
                if (url.includes('/api/ai/wrong-answers/analyze-batch')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            success: [
                                { answerId: 'answer-1', ...mockAIAnalysis },
                                { answerId: 'answer-2', ...mockAIAnalysis },
                                { answerId: 'answer-4', ...mockAIAnalysis },
                            ],
                            failed: [
                                { answerId: 'answer-3', error: 'AI service timeout' },
                                { answerId: 'answer-5', error: 'Rate limit exceeded' },
                            ]
                        })
                    })
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            render(<WrongAnswersBook onBack={() => { }} />)

            // Wait for wrong answers to load
            await waitFor(() => {
                expect(screen.getByText('测试问题 1？')).toBeInTheDocument()
            })

            // Click batch generate button
            const batchButton = screen.getByText('Batch Generate All Analysis')
            await user.click(batchButton)

            // Confirm batch processing
            const confirmButton = screen.getByText('Confirm')
            await user.click(confirmButton)

            // Wait for batch processing to complete
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/ai/wrong-answers/analyze-batch',
                    expect.objectContaining({
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            answerIds: ['answer-1', 'answer-2', 'answer-3', 'answer-4', 'answer-5']
                        })
                    })
                )
            })

            // Verify success/failure summary is displayed
            await waitFor(() => {
                expect(screen.getByText(/3 successful/i)).toBeInTheDocument()
                expect(screen.getByText(/2 failed/i)).toBeInTheDocument()
            })

            // Verify retry buttons are available for failed items
            expect(screen.getAllByText(/retry/i)).toHaveLength(2)
        })

        it('should handle concurrent processing limits and queue management', async () => {
            // Create a large number of wrong answers to test concurrency limits
            const manyWrongAnswers = Array.from({ length: 150 }, (_, i) => ({
                ...mockWrongAnswers[0],
                answerId: `answer-${i + 1}`,
                questionId: `question-${i + 1}`,
            }))

            let batchRequestCount = 0
            global.fetch = vi.fn().mockImplementation((url, options) => {
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: manyWrongAnswers
                        })
                    })
                }
                if (url.includes('/api/ai/wrong-answers/analyze-batch')) {
                    batchRequestCount++
                    const body = JSON.parse(options.body)
                    // Verify batch size doesn't exceed 100
                    expect(body.answerIds.length).toBeLessThanOrEqual(100)

                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            success: body.answerIds.map(id => ({ answerId: id, ...mockAIAnalysis })),
                            failed: []
                        })
                    })
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            render(<WrongAnswersBook onBack={() => { }} />)

            // Wait for wrong answers to load
            await waitFor(() => {
                expect(screen.getByText('Batch Generate All Analysis')).toBeInTheDocument()
            })

            // Start batch processing
            const batchButton = screen.getByText('Batch Generate All Analysis')
            await user.click(batchButton)

            const confirmButton = screen.getByText('Confirm')
            await user.click(confirmButton)

            // Wait for processing to complete
            await waitFor(() => {
                // Should make 2 batch requests (100 + 50)
                expect(batchRequestCount).toBe(2)
            }, { timeout: 10000 })

            // Verify all items were processed
            await waitFor(() => {
                expect(screen.getByText(/150 successful/i)).toBeInTheDocument()
            })
        })
    })

    describe('Cross-Device Synchronization with Database Storage', () => {
        it('should synchronize data across different browser sessions', async () => {
            // Simulate first device/session
            const session1WrongAnswers = [
                {
                    ...mockWrongAnswers[0],
                    answerId: 'answer-session1',
                    answer: {
                        ...mockWrongAnswers[0].answer,
                        aiAnalysis: mockAIAnalysis,
                        aiAnalysisGeneratedAt: '2024-01-15T11:00:00Z'
                    }
                }
            ]

            global.fetch = vi.fn().mockImplementation((url) => {
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: session1WrongAnswers
                        })
                    })
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            const { unmount } = render(<WrongAnswersBook onBack={() => { }} />)

            // Wait for data to load in first session
            await waitFor(() => {
                expect(screen.getByText('细节理解缺失')).toBeInTheDocument()
            })

            unmount()

            // Simulate second device/session with updated data
            const session2WrongAnswers = [
                ...session1WrongAnswers,
                {
                    ...mockWrongAnswers[0],
                    answerId: 'answer-session2',
                    questionId: 'question-session2',
                    question: {
                        ...mockWrongAnswers[0].question,
                        question: '新设备上的问题？'
                    }
                }
            ]

            global.fetch = vi.fn().mockImplementation((url) => {
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: session2WrongAnswers
                        })
                    })
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            render(<WrongAnswersBook onBack={() => { }} />)

            // Verify both old and new data are present
            await waitFor(() => {
                expect(screen.getByText('他们打算去哪里？')).toBeInTheDocument() // Original question
                expect(screen.getByText('新设备上的问题？')).toBeInTheDocument() // New question
                expect(screen.getByText('细节理解缺失')).toBeInTheDocument() // Existing analysis
            })
        })

        it('should handle database conflicts and maintain data consistency', async () => {
            // Mock database transaction failure and retry
            let transactionAttempts = 0

            global.fetch = vi.fn().mockImplementation((url, options) => {
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: mockWrongAnswers
                        })
                    })
                }
                if (url.includes('/api/ai/wrong-answers/analyze')) {
                    transactionAttempts++
                    if (transactionAttempts === 1) {
                        return Promise.resolve({
                            ok: false,
                            json: () => Promise.resolve({
                                error: 'Database transaction conflict'
                            })
                        })
                    } else {
                        return Promise.resolve({
                            ok: true,
                            json: () => Promise.resolve(mockAIAnalysis)
                        })
                    }
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            render(<WrongAnswersBook onBack={() => { }} />)

            // Wait for wrong answers to load
            await waitFor(() => {
                expect(screen.getByText('Generate Analysis')).toBeInTheDocument()
            })

            // Attempt to generate analysis
            const generateButton = screen.getByText('Generate Analysis')
            await user.click(generateButton)

            // Wait for first attempt to fail and retry to succeed
            await waitFor(() => {
                expect(transactionAttempts).toBe(2)
            })

            // Verify analysis is eventually displayed
            await waitFor(() => {
                expect(screen.getByText('细节理解缺失')).toBeInTheDocument()
            })
        })

        it('should handle offline/online state transitions', async () => {
            // Mock online state
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: true,
            })

            global.fetch = vi.fn().mockImplementation((url) => {
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: mockWrongAnswers
                        })
                    })
                }
                return Promise.reject(new Error('Network error'))
            })

            render(<WrongAnswersBook onBack={() => { }} />)

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByText('他们打算去哪里？')).toBeInTheDocument()
            })

            // Simulate going offline
            Object.defineProperty(navigator, 'onLine', {
                value: false,
            })

            // Mock network failure
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

            // Try to generate analysis while offline
            const generateButton = screen.getByText('Generate Analysis')
            await user.click(generateButton)

            // Should show offline error
            await waitFor(() => {
                expect(screen.getByText(/network error/i) || screen.getByText(/offline/i)).toBeInTheDocument()
            })

            // Simulate coming back online
            Object.defineProperty(navigator, 'onLine', {
                value: true,
            })

            global.fetch = vi.fn().mockImplementation((url) => {
                if (url.includes('/api/ai/wrong-answers/analyze')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(mockAIAnalysis)
                    })
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            // Retry should now work
            const retryButton = screen.getByText(/retry/i)
            await user.click(retryButton)

            await waitFor(() => {
                expect(screen.getByText('细节理解缺失')).toBeInTheDocument()
            })
        })
    })

    describe('Export Functionality Integration', () => {
        it('should export complete analysis data including AI insights', async () => {
            const wrongAnswersWithAnalysis = [
                {
                    ...mockWrongAnswers[0],
                    answer: {
                        ...mockWrongAnswers[0].answer,
                        aiAnalysis: mockAIAnalysis,
                        aiAnalysisGeneratedAt: '2024-01-15T11:00:00Z'
                    }
                }
            ]

            // Mock file download
            const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
            const mockRevokeObjectURL = vi.fn()
            global.URL.createObjectURL = mockCreateObjectURL
            global.URL.revokeObjectURL = mockRevokeObjectURL

            // Mock link click for download
            const mockClick = vi.fn()
            const mockLink = {
                href: '',
                download: '',
                click: mockClick,
            }
            vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)

            global.fetch = vi.fn().mockImplementation((url) => {
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: wrongAnswersWithAnalysis
                        })
                    })
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            render(<WrongAnswersBook onBack={() => { }} />)

            // Wait for data to load
            await waitFor(() => {
                expect(screen.getByText('Export Analysis as TXT')).toBeInTheDocument()
            })

            // Click export button
            const exportButton = screen.getByText('Export Analysis as TXT')
            await user.click(exportButton)

            // Verify file download was triggered
            await waitFor(() => {
                expect(mockCreateObjectURL).toHaveBeenCalled()
                expect(mockClick).toHaveBeenCalled()
            })

            // Verify filename includes timestamp
            expect(mockLink.download).toMatch(/wrong-answers-analysis-\d{8}-\d{6}\.txt/)
        })
    })

    describe('Error Recovery and Resilience', () => {
        it('should recover from AI service failures gracefully', async () => {
            let aiAttempts = 0

            global.fetch = vi.fn().mockImplementation((url, options) => {
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: mockWrongAnswers
                        })
                    })
                }
                if (url.includes('/api/ai/wrong-answers/analyze')) {
                    aiAttempts++
                    if (aiAttempts <= 2) {
                        return Promise.resolve({
                            ok: false,
                            json: () => Promise.resolve({
                                error: 'AI service temporarily unavailable'
                            })
                        })
                    } else {
                        return Promise.resolve({
                            ok: true,
                            json: () => Promise.resolve(mockAIAnalysis)
                        })
                    }
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            render(<WrongAnswersBook onBack={() => { }} />)

            // Wait for wrong answers to load
            await waitFor(() => {
                expect(screen.getByText('Generate Analysis')).toBeInTheDocument()
            })

            // First attempt should fail
            const generateButton = screen.getByText('Generate Analysis')
            await user.click(generateButton)

            await waitFor(() => {
                expect(screen.getByText(/ai service.*unavailable/i) || screen.getByText(/retry/i)).toBeInTheDocument()
            })

            // Second attempt should also fail
            const retryButton = screen.getByText(/retry/i)
            await user.click(retryButton)

            await waitFor(() => {
                expect(aiAttempts).toBe(2)
            })

            // Third attempt should succeed
            const retryButton2 = screen.getByText(/retry/i)
            await user.click(retryButton2)

            await waitFor(() => {
                expect(screen.getByText('细节理解缺失')).toBeInTheDocument()
            })
        })

        it('should handle partial data corruption and recovery', async () => {
            // Mock corrupted data scenario
            const corruptedWrongAnswers = [
                {
                    ...mockWrongAnswers[0],
                    answer: {
                        ...mockWrongAnswers[0].answer,
                        aiAnalysis: {
                            // Missing required fields
                            analysis: "部分分析内容",
                            // key_reason missing
                            ability_tags: null,
                            confidence: "invalid_value"
                        }
                    }
                }
            ]

            global.fetch = vi.fn().mockImplementation((url) => {
                if (url.includes('/api/wrong-answers/list')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            wrongAnswers: corruptedWrongAnswers
                        })
                    })
                }
                if (url.includes('/api/ai/wrong-answers/analyze')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(mockAIAnalysis)
                    })
                }
                return Promise.reject(new Error('Unexpected fetch call'))
            })

            render(<WrongAnswersBook onBack={() => { }} />)

            // Should handle corrupted data gracefully
            await waitFor(() => {
                expect(screen.getByText('部分分析内容')).toBeInTheDocument()
            })

            // Should allow regeneration of analysis
            const regenerateButton = screen.getByText(/regenerate/i) || screen.getByText(/generate analysis/i)
            await user.click(regenerateButton)

            // Should replace corrupted data with valid analysis
            await waitFor(() => {
                expect(screen.getByText('细节理解缺失')).toBeInTheDocument()
            })
        })
    })
})
