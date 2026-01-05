/**
 * Privacy policy constants
 * Centralized location for privacy-related configuration
 */

export const PRIVACY_POLICY_VERSION = '2026-01-05'

export const PRIVACY_CONSENT_STORAGE_KEY = 'elt.privacy.consent'

export interface PrivacyConsentRecord {
  policyVersion: string
  consentedAt: string // ISO timestamp
  userId: string // User ID for validation
}
