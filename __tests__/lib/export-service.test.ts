import { ExportService } from '@/lib/export-service'
import type { WrongAnswerItem } from '@/lib/types'

describe('ExportService', () => {
  const mockWrongAnswerItem: WrongAnswerItem = {
    answerId: 'answer-1',
    questionId: 'question-1',
    sessionId: 'session-1',
    session: {
      topic: 'Daily Conversation',
      difficulty: 'B1',
      language: 'en',
      createdAt: '2024-01-15T10:30:00Z'
    },
    question: {
      index: 0,
      type: 'multiple_choice',
      question: 'What did the speaker say about the weather?',
      options: ['It is sunny', 'It is raining', 'It is cloudy', 'It is snowy'],
      correctAnswer: 'It is raining',
      explanation: 'The speaker mentioned that it started raining in the morning.',
      transcript: 'Good morning! I hope you brought an umbrella today because it started raining heavily this morning.'
    },
    answer: {
      userAnswer: 'It is sunny',
      isCorrect: false,
      attemptedAt: '2024-01-15T10:35:00Z',
      aiAnalysis: {
        analysis: '您选择了"It is sunny"，但正确答案是"It is raining"。这是一个典型的听力细节理解错误。在听力材料中，说话者明确提到"it started raining heavily this morning"，这是一个关键的信息点。您可能没有注意到"raining"这个关键词，或者被其他信息干扰了注意力。',
        key_reason: '听力细节捕捉不准确',
        ability_tags: ['听力细节理解', '关键词识别', '天气词汇'],
        signal_words: ['raining', 'umbrella', 'morning'],
        strategy: '在听天气相关的对话时，要特别注意动词和形容词，如raining, sunny, cloudy等。同时注意相关的提示词，如umbrella通常暗示下雨。',
        related_sentences: [
          {
            quote: 'it started raining heavily this morning',
            comment: '这句话直接说明了天气状况是下雨，是回答问题的关键信息'
          }
        ],
        confidence: 'high' as const
      },
      aiAnalysisGeneratedAt: '2024-01-15T10:40:00Z',
      needsAnalysis: false
    }
  }

  const mockWrongAnswerItemWithoutAnalysis: WrongAnswerItem = {
    ...mockWrongAnswerItem,
    answerId: 'answer-2',
    answer: {
      ...mockWrongAnswerItem.answer,
      aiAnalysis: undefined,
      aiAnalysisGeneratedAt: undefined,
      needsAnalysis: true
    }
  }

  describe('exportToTXT', () => {
    it('should generate TXT content with AI analysis', async () => {
      const content = await ExportService.exportToTXT([mockWrongAnswerItem])
      
      expect(content).toContain('错题AI分析导出报告')
      expect(content).toContain('题目总数: 1')
      expect(content).toContain('已分析题目: 1')
      expect(content).toContain('未分析题目: 0')
      expect(content).toContain('Daily Conversation')
      expect(content).toContain('What did the speaker say about the weather?')
      expect(content).toContain('您的答案: It is sunny')
      expect(content).toContain('正确答案: It is raining')
      expect(content).toContain('【AI智能分析】')
      expect(content).toContain('听力细节捕捉不准确')
      expect(content).toContain('听力细节理解')
      expect(content).toContain('raining')
    })

    it('should handle items without AI analysis', async () => {
      const content = await ExportService.exportToTXT([mockWrongAnswerItemWithoutAnalysis])
      
      expect(content).toContain('题目总数: 1')
      expect(content).toContain('已分析题目: 0')
      expect(content).toContain('未分析题目: 1')
      expect(content).toContain('分析状态: 未生成')
      expect(content).toContain('该题目尚未进行AI分析')
    })

    it('should handle mixed items with and without analysis', async () => {
      const content = await ExportService.exportToTXT([
        mockWrongAnswerItem,
        mockWrongAnswerItemWithoutAnalysis
      ])
      
      expect(content).toContain('题目总数: 2')
      expect(content).toContain('已分析题目: 1')
      expect(content).toContain('未分析题目: 1')
    })

    it('should include transcript when option is enabled', async () => {
      const content = await ExportService.exportToTXT([mockWrongAnswerItem], {
        includeTranscript: true
      })
      
      expect(content).toContain('【听力材料】')
      expect(content).toContain('Good morning! I hope you brought an umbrella')
    })

    it('should exclude transcript when option is disabled', async () => {
      const content = await ExportService.exportToTXT([mockWrongAnswerItem], {
        includeTranscript: false
      })
      
      expect(content).not.toContain('【听力材料】')
    })
  })

  describe('generateFilename', () => {
    it('should generate filename with timestamp', () => {
      const filename = ExportService.generateFilename()
      
      expect(filename).toMatch(/^错题AI分析报告_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.txt$/)
    })
  })

  describe('getExportStatistics', () => {
    it('should calculate correct statistics', () => {
      const stats = ExportService.getExportStatistics([
        mockWrongAnswerItem,
        mockWrongAnswerItemWithoutAnalysis
      ])
      
      expect(stats.total).toBe(2)
      expect(stats.analyzed).toBe(1)
      expect(stats.unanalyzed).toBe(1)
      expect(stats.byDifficulty.B1).toBe(2)
      expect(stats.byLanguage.en).toBe(2)
      expect(stats.byType.multiple_choice).toBe(2)
    })
  })
})