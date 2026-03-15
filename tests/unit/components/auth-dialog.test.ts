import { describe, expect, it } from 'vitest'

import { getAuthDialogErrors } from '@/components/auth-dialog'

describe('getAuthDialogErrors', () => {
  const baseFormData = {
    email: 'user@example.com',
    password: 'weak',
    name: '',
    confirmPassword: 'weak',
  }

  const weakPasswordValidation = {
    isValid: false,
    errors: ['至少8位字符', '包含大写字母', '包含数字'],
  }

  it('allows login with a weak but non-empty password', () => {
    const errors = getAuthDialogErrors({
      activeTab: 'login',
      formData: baseFormData,
      isValidEmail: true,
      passwordValidation: weakPasswordValidation,
      privacyConsent: false,
      privacyConsentMessage: '请阅读并同意隐私说明',
    })

    expect(errors.password).toBe('')
  })

  it('still enforces password strength for registration', () => {
    const errors = getAuthDialogErrors({
      activeTab: 'register',
      formData: baseFormData,
      isValidEmail: true,
      passwordValidation: weakPasswordValidation,
      privacyConsent: true,
      privacyConsentMessage: '请阅读并同意隐私说明',
    })

    expect(errors.password).toContain('密码需要')
  })
})
