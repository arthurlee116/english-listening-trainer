import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateChallengeDialog } from '@/components/challenges/create-challenge-dialog'
import { useBilingualText } from '@/hooks/use-bilingual-text'
import { useToast } from '@/hooks/use-toast'

// Mock hooks
vi.mock('@/hooks/use-bilingual-text')
vi.mock('@/hooks/use-toast')

describe('CreateChallengeDialog', () => {
  const mockT = vi.fn()
  const mockToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useBilingualText).mockReturnValue({ t: mockT })
    vi.mocked(useToast).mockReturnValue({ toast: mockToast })
  })

  it('should render dialog when open', () => {
    mockT.mockImplementation((key) => `translated_${key}`)

    render(
      <CreateChallengeDialog
        open={true}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    )

    expect(screen.getByText('translated_challenges.createNew')).toBeInTheDocument()
    expect(screen.getByLabelText('translated_challenges.topic')).toBeInTheDocument()
    expect(screen.getByLabelText('translated_challenges.minDifficulty')).toBeInTheDocument()
    expect(screen.getByLabelText('translated_challenges.maxDifficulty')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(
      <CreateChallengeDialog
        open={false}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    )

    expect(screen.queryByText('challenges.createNew')).not.toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()
    mockT.mockImplementation((key) => `translated_${key}`)

    render(
      <CreateChallengeDialog
        open={true}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    )

    const submitButton = screen.getByRole('button', { name: /translated_common\.create/i })
    await user.click(submitButton)

    expect(mockToast).toHaveBeenCalledWith({
      title: 'translated_challenges.validation.title',
      description: 'translated_challenges.validation.required',
      variant: 'destructive'
    })
  })

  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    const mockOnSuccess = vi.fn()
    mockT.mockImplementation((key) => `translated_${key}`)

    // Mock successful API response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ challenge: { id: 'new-challenge' } })
      })
    ) as any

    render(
      <CreateChallengeDialog
        open={true}
        onOpenChange={() => {}}
        onSuccess={mockOnSuccess}
      />
    )

    // Fill form
    await user.type(screen.getByLabelText('translated_challenges.topic'), 'Business English')
    await user.selectOptions(screen.getByLabelText('translated_challenges.minDifficulty'), 'B1')
    await user.selectOptions(screen.getByLabelText('translated_challenges.maxDifficulty'), 'C1')
    await user.clear(screen.getByLabelText('translated_challenges.targetSessions'))
    await user.type(screen.getByLabelText('translated_challenges.targetSessions'), '10')

    // Submit
    const submitButton = screen.getByRole('button', { name: /translated_common\.create/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'Business English',
          minDifficulty: 'B1',
          maxDifficulty: 'C1',
          targetSessionCount: 10
        })
      })
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'translated_challenges.createSuccess',
      description: 'translated_challenges.createSuccessDesc'
    })

    expect(mockOnSuccess).toHaveBeenCalled()
  })

  it('should handle API errors', async () => {
    const user = userEvent.setup()
    mockT.mockImplementation((key) => `translated_${key}`)

    // Mock failed API response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Validation failed' })
      })
    ) as any

    render(
      <CreateChallengeDialog
        open={true}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    )

    // Fill minimal valid form
    await user.type(screen.getByLabelText('translated_challenges.topic'), 'Test Topic')
    await user.selectOptions(screen.getByLabelText('translated_challenges.minDifficulty'), 'A1')
    await user.selectOptions(screen.getByLabelText('translated_challenges.maxDifficulty'), 'B1')

    // Submit
    const submitButton = screen.getByRole('button', { name: /translated_common\.create/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'translated_challenges.createError',
        description: 'Validation failed',
        variant: 'destructive'
      })
    })
  })
})
