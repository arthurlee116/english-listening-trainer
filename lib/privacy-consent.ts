import { PRIVACY_CONSENT_STORAGE_KEY, PRIVACY_POLICY_VERSION, type PrivacyConsentRecord } from '@/lib/constants/privacy'

/**
 * Check if user has consented to privacy policy in current session
 * Validates both policy version and user ID match
 */
export function hasCurrentSessionConsent(userId: string): boolean {
  if (typeof window === 'undefined') return false

  try {
    const stored = localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY)
    if (!stored) return false

    const consent: PrivacyConsentRecord = JSON.parse(stored)

    // Validate: must match current user and current policy version
    return consent.userId === userId && consent.policyVersion === PRIVACY_POLICY_VERSION
  } catch (error) {
    console.warn('Failed to parse consent record:', error)
    localStorage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
    return false
  }
}

/**
 * Clear consent record (called on logout)
 */
export function clearConsent(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
}

/**
 * Get current consent record if exists
 */
export function getConsentRecord(): PrivacyConsentRecord | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/**
 * Save consent record to localStorage
 */
export function saveConsent(userId: string): void {
  if (typeof window === 'undefined') return

  const consentRecord: PrivacyConsentRecord = {
    policyVersion: PRIVACY_POLICY_VERSION,
    consentedAt: new Date().toISOString(),
    userId
  }

  localStorage.setItem(PRIVACY_CONSENT_STORAGE_KEY, JSON.stringify(consentRecord))
}
