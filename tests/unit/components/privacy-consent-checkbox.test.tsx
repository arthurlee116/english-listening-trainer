import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PrivacyConsentCheckbox } from '@/components/auth/privacy-consent-checkbox'

vi.mock('@/components/ui/bilingual-text', () => ({
  BilingualText: ({ translationKey }: { translationKey: string }) => <span>{translationKey}</span>
}))

describe('PrivacyConsentCheckbox', () => {
  it('lets the user agree directly from the privacy dialog', async () => {
    const user = userEvent.setup()
    const handleCheckedChange = vi.fn()

    render(
      <PrivacyConsentCheckbox
        checked={false}
        onCheckedChange={handleCheckedChange}
      />
    )

    expect(screen.getByTestId('privacy-consent-checkbox')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'components.authDialog.privacyConsent.reviewAndAgreeButton' }))
    await user.click(screen.getByRole('button', { name: 'components.authDialog.privacyConsent.agreeButton' }))

    expect(handleCheckedChange).toHaveBeenCalledWith(true)
  })
})
