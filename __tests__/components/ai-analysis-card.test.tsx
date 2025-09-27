import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AIAnalysisCard, AnalysisState } from '@/components/ai-analysis-card'
import type { AIAnalysisResponse } from '@/lib/types'

// Mock the bilingual text hook
vi.mock('@/hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({
    t: vi.fn((key: string) => {
      const mockTranslations: Record<string, string> = {
        'components.aiAnalysisCard.title': 'AI Analysis',
        'components.aiAnalysisCard.notGenerated': 'Analysis not generated',
        'components.aiAnalysisCard.generating': 'Generating analysis...',
        'components.aiAnalysisCard.analysisComplete': 'Analysis complete',
        'components.aiAnalysisCard.analysisFailed': 'Analysis failed',
        'components.aiAnalysisCard.generateAnalysis': 'Generate Analysis',
        'components.aiAnalysisCard.confidence.high': 'High',
        'components.aiAnalysisCard.confidence.medium': 'Medium',
        'components.aiAnalysisCard.confidence.low': 'Low',
        'components.aiAnalysisCard.detailedAnalysis': 'Detailed Analysis',
        'components.aiAnalysisCard.keyReason': 'Key Reason',
        'components.aiAnalysisCard.abilityTags': 'Ability Tags',
        'components.aiAnalysisCard.signalWords': 'Signal Words',
        'components.aiAnalysisCard.strategy': 'Strategy',
        'components.aiAnalysisCard.relatedSentences': 'Related Sentences',
        'components.aiAnalysisCard.errorMessage': 'Failed to generate analysis. Please try again.',
        'common.buttons.retry': 'Retry'
      }
      return mockTranslations[key] || key
    })
  })
}))

// Mock analysis data
const mockAnalysis: AIAnalysisResponse = {
  analysis: 'This is a detailed analysis of the mistake. The user misunderstood the context and selected the wrong option.',
  key_reason: 'Misunderstood the context',
  ability_tags: ['listening comprehension', 'vocabulary understanding', 'context analysis'],
  signal_words: ['hello', 'test', 'important'],
  strategy: 'Focus on key words and context clues to better understand the meaning.',
  related_sentences: [
    {
      quote: 'Hello, this is a test transcript.',
      comment: 'This sentence contains the key information needed to answer correctly.'
    },
    {
      quote: 'The speaker mentioned important details.',
      comment: 'Pay attention to emphasis and tone for better comprehension.'
    }
  ],
  confidence: 'high'
}

describe('AIAnalysisCard', () => {
  const mockOnGenerate = vi.fn()
  const mockOnRetry = vi.fn()
  const answerId = 'test-answer-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Not Generated State', () => {
    it('should render not generated state correctly', () => {
      render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.NOT_GENERATED}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      expect(screen.getByText('AI Analysis')).toBeInTheDocument()
      expect(screen.getByText('Analysis not generated')).toBeInTheDocument()
      expect(screen.getByText('Generate Analysis')).toBeInTheDocument()
      
      // Should not show expand/collapse button
      expect(screen.queryByRole('button', { name: /chevron/i })).not.toBeInTheDocument()
    })

    it('should call onGenerate when generate button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.NOT_GENERATED}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const generateButton = screen.getByText('Generate Analysis')
      await user.click(generateButton)

      expect(mockOnGenerate).toHaveBeenCalledWith(answerId)
      expect(mockOnGenerate).toHaveBeenCalledTimes(1)
    })

    it('should have correct styling for not generated state', () => {
      const { container } = render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.NOT_GENERATED}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const card = container.querySelector('.border-gray-300')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should render loading state correctly', () => {
      render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.LOADING}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      expect(screen.getByText('AI Analysis')).toBeInTheDocument()
      expect(screen.getByText('Generating analysis...')).toBeInTheDocument()
      
      // Should show loading spinner
      const spinner = screen.getByText('Generating analysis...')
      expect(spinner).toBeInTheDocument()
      
      // Check for the spinner class
      const spinnerIcon = document.querySelector('.animate-spin')
      expect(spinnerIcon).toBeInTheDocument()
      
      // Should not show generate or retry buttons
      expect(screen.queryByText('Generate Analysis')).not.toBeInTheDocument()
      expect(screen.queryByText('Retry')).not.toBeInTheDocument()
    })

    it('should have correct styling for loading state', () => {
      const { container } = render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.LOADING}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const card = container.querySelector('.border-blue-300')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Success State', () => {
    it('should render success state correctly', () => {
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mockAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      expect(screen.getByText('AI Analysis')).toBeInTheDocument()
      expect(screen.getByText('Analysis complete')).toBeInTheDocument()
      expect(screen.getByText('High')).toBeInTheDocument() // Confidence badge
      
      // Should show expand/collapse button
      const expandButton = screen.getByRole('button', { name: '' }) // ChevronDown has no accessible name
      expect(expandButton).toBeInTheDocument()
    })

    it('should show confidence badge with correct styling', () => {
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mockAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const confidenceBadge = screen.getByText('High')
      expect(confidenceBadge).toBeInTheDocument()
      expect(confidenceBadge.closest('.bg-green-100')).toBeInTheDocument()
    })

    it('should expand and show analysis content when clicked', async () => {
      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mockAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      // Initially collapsed
      expect(screen.queryByText('Detailed Analysis')).not.toBeInTheDocument()

      // Click expand button
      const expandButton = screen.getByRole('button', { name: '' })
      await user.click(expandButton)

      // Should show analysis content
      expect(screen.getByText('Detailed Analysis')).toBeInTheDocument()
      expect(screen.getByText(mockAnalysis.analysis)).toBeInTheDocument()
      expect(screen.getByText('Key Reason')).toBeInTheDocument()
      expect(screen.getByText(mockAnalysis.key_reason)).toBeInTheDocument()
    })

    it('should display ability tags correctly', async () => {
      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mockAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      // Expand to show content
      const expandButton = screen.getByRole('button', { name: '' })
      await user.click(expandButton)

      expect(screen.getByText('Ability Tags')).toBeInTheDocument()
      expect(screen.getByText('listening comprehension')).toBeInTheDocument()
      expect(screen.getByText('vocabulary understanding')).toBeInTheDocument()
      expect(screen.getByText('context analysis')).toBeInTheDocument()
    })

    it('should display signal words correctly', async () => {
      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mockAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      // Expand to show content
      const expandButton = screen.getByRole('button', { name: '' })
      await user.click(expandButton)

      expect(screen.getByText('Signal Words')).toBeInTheDocument()
      expect(screen.getByText('hello')).toBeInTheDocument()
      expect(screen.getByText('test')).toBeInTheDocument()
      expect(screen.getByText('important')).toBeInTheDocument()
    })

    it('should display strategy correctly', async () => {
      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mockAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      // Expand to show content
      const expandButton = screen.getByRole('button', { name: '' })
      await user.click(expandButton)

      expect(screen.getByText('Strategy')).toBeInTheDocument()
      expect(screen.getByText(mockAnalysis.strategy)).toBeInTheDocument()
    })

    it('should display related sentences correctly', async () => {
      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mockAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      // Expand to show content
      const expandButton = screen.getByRole('button', { name: '' })
      await user.click(expandButton)

      expect(screen.getByText('Related Sentences')).toBeInTheDocument()
      expect(screen.getByText('"Hello, this is a test transcript."')).toBeInTheDocument()
      expect(screen.getByText('This sentence contains the key information needed to answer correctly.')).toBeInTheDocument()
      expect(screen.getByText('"The speaker mentioned important details."')).toBeInTheDocument()
      expect(screen.getByText('Pay attention to emphasis and tone for better comprehension.')).toBeInTheDocument()
    })

    it('should collapse when expand button is clicked again', async () => {
      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mockAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const expandButton = screen.getByRole('button', { name: '' })
      
      // Expand
      await user.click(expandButton)
      expect(screen.getByText('Detailed Analysis')).toBeInTheDocument()

      // Collapse
      await user.click(expandButton)
      expect(screen.queryByText('Detailed Analysis')).not.toBeInTheDocument()
    })

    it('should have correct styling for success state', () => {
      const { container } = render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mockAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const card = container.querySelector('.border-green-300')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should render error state correctly', () => {
      render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.ERROR}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      expect(screen.getByText('AI Analysis')).toBeInTheDocument()
      expect(screen.getByText('Analysis failed')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
      
      // Should show expand button for error details
      const expandButton = screen.getByRole('button', { name: '' })
      expect(expandButton).toBeInTheDocument()
    })

    it('should call onRetry when retry button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.ERROR}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const retryButton = screen.getByText('Retry')
      await user.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalledWith(answerId)
      expect(mockOnRetry).toHaveBeenCalledTimes(1)
    })

    it('should show error message when expanded', async () => {
      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.ERROR}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      // Expand to show error details
      const expandButton = screen.getByRole('button', { name: '' })
      await user.click(expandButton)

      expect(screen.getByText('Failed to generate analysis. Please try again.')).toBeInTheDocument()
    })

    it('should have correct styling for error state', () => {
      const { container } = render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.ERROR}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const card = container.querySelector('.border-red-300')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Confidence Badge Variations', () => {
    it('should show medium confidence badge correctly', () => {
      const mediumConfidenceAnalysis = { ...mockAnalysis, confidence: 'medium' as const }
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={mediumConfidenceAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const confidenceBadge = screen.getByText('Medium')
      expect(confidenceBadge).toBeInTheDocument()
      expect(confidenceBadge.closest('.bg-yellow-100')).toBeInTheDocument()
    })

    it('should show low confidence badge correctly', () => {
      const lowConfidenceAnalysis = { ...mockAnalysis, confidence: 'low' as const }
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={lowConfidenceAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      const confidenceBadge = screen.getByText('Low')
      expect(confidenceBadge).toBeInTheDocument()
      expect(confidenceBadge.closest('.bg-red-100')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle analysis without optional fields', async () => {
      const minimalAnalysis: AIAnalysisResponse = {
        analysis: 'Basic analysis',
        key_reason: 'Basic reason',
        ability_tags: [],
        signal_words: [],
        strategy: '',
        related_sentences: [],
        confidence: 'medium'
      }

      const user = userEvent.setup()
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={minimalAnalysis}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      // Expand to show content
      const expandButton = screen.getByRole('button', { name: '' })
      await user.click(expandButton)

      // Should show main analysis and key reason
      expect(screen.getByText('Basic analysis')).toBeInTheDocument()
      expect(screen.getByText('Basic reason')).toBeInTheDocument()

      // Should not show empty sections
      expect(screen.queryByText('Ability Tags')).not.toBeInTheDocument()
      expect(screen.queryByText('Signal Words')).not.toBeInTheDocument()
      expect(screen.queryByText('Strategy')).not.toBeInTheDocument()
      expect(screen.queryByText('Related Sentences')).not.toBeInTheDocument()
    })

    it('should handle missing analysis prop in success state', () => {
      render(
        <AIAnalysisCard
          answerId={answerId}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      expect(screen.getByText('Analysis complete')).toBeInTheDocument()
      // Should not show confidence badge without analysis
      expect(screen.queryByText('High')).not.toBeInTheDocument()
    })

    it('should handle empty related sentences array', async () => {
      const analysisWithoutSentences = { ...mockAnalysis, related_sentences: [] }
      const user = userEvent.setup()
      
      render(
        <AIAnalysisCard
          answerId={answerId}
          analysis={analysisWithoutSentences}
          state={AnalysisState.SUCCESS}
          onGenerate={mockOnGenerate}
          onRetry={mockOnRetry}
        />
      )

      // Expand to show content
      const expandButton = screen.getByRole('button', { name: '' })
      await user.click(expandButton)

      // Should not show Related Sentences section
      expect(screen.queryByText('Related Sentences')).not.toBeInTheDocument()
    })
  })
})