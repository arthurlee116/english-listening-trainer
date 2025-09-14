import { describe, it, expect } from 'vitest'
import { isValidTranslationKey, getFallbackText } from '@/lib/i18n/utils'

// Import translation files directly for testing
import commonTranslations from '@/lib/i18n/translations/common.json'
import componentsTranslations from '@/lib/i18n/translations/components.json'
import pagesTranslations from '@/lib/i18n/translations/pages.json'

describe('Translation Coverage', () => {
  describe('translation file structure validation', () => {
    const validateTranslationObject = (obj: any, path = ''): string[] => {
      const errors: string[] = []
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key
        
        if (value && typeof value === 'object') {
          if ('en' in value && 'zh' in value) {
            // This is a translation key object
            if (!isValidTranslationKey(value)) {
              errors.push(`Invalid translation key at ${currentPath}: missing or empty en/zh values`)
            }
          } else {
            // This is a nested object, recurse
            errors.push(...validateTranslationObject(value, currentPath))
          }
        } else {
          errors.push(`Invalid structure at ${currentPath}: expected object with en/zh or nested object`)
        }
      }
      
      return errors
    }

    it('should have valid structure in common translations', () => {
      const errors = validateTranslationObject(commonTranslations, 'common')
      expect(errors).toEqual([])
    })

    it('should have valid structure in components translations', () => {
      const errors = validateTranslationObject(componentsTranslations, 'components')
      expect(errors).toEqual([])
    })

    it('should have valid structure in pages translations', () => {
      const errors = validateTranslationObject(pagesTranslations, 'pages')
      expect(errors).toEqual([])
    })
  })

  describe('translation completeness', () => {
    const checkTranslationCompleteness = (obj: any, path = ''): string[] => {
      const missing: string[] = []
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key
        
        if (value && typeof value === 'object') {
          if ('en' in value && 'zh' in value) {
            // Check if both languages have non-empty values
            if (!value.en || typeof value.en !== 'string' || value.en.trim() === '') {
              missing.push(`Missing English translation at ${currentPath}`)
            }
            if (!value.zh || typeof value.zh !== 'string' || value.zh.trim() === '') {
              missing.push(`Missing Chinese translation at ${currentPath}`)
            }
          } else {
            // Recurse into nested objects
            missing.push(...checkTranslationCompleteness(value, currentPath))
          }
        }
      }
      
      return missing
    }

    it('should have complete translations in common file', () => {
      const missing = checkTranslationCompleteness(commonTranslations, 'common')
      expect(missing).toEqual([])
    })

    it('should have complete translations in components file', () => {
      const missing = checkTranslationCompleteness(componentsTranslations, 'components')
      expect(missing).toEqual([])
    })

    it('should have complete translations in pages file', () => {
      const missing = checkTranslationCompleteness(pagesTranslations, 'pages')
      expect(missing).toEqual([])
    })
  })

  describe('required translation keys', () => {
    const requiredCommonKeys = [
      'buttons.generate',
      'buttons.history',
      'buttons.admin',
      'labels.difficulty',
      'labels.duration',
      'labels.topic',
      'messages.loading',
      'messages.error',
      'messages.success'
    ]

    const requiredComponentKeys = [
      'audioPlayer.play',
      'audioPlayer.pause',
      'audioPlayer.loading',
      'questionInterface.submitAnswers',
      'resultsDisplay.yourResults',
      'resultsDisplay.correct'
    ]

    const requiredPageKeys = [
      'home.title',
      'assessment.title',
      'history.title'
    ]

    it('should have all required common translation keys', () => {
      requiredCommonKeys.forEach(key => {
        const value = key.split('.').reduce((obj, k) => obj?.[k], commonTranslations)
        expect(value).toBeDefined()
        expect(isValidTranslationKey(value)).toBe(true)
      })
    })

    it('should have all required component translation keys', () => {
      requiredComponentKeys.forEach(key => {
        const value = key.split('.').reduce((obj, k) => obj?.[k], componentsTranslations)
        expect(value).toBeDefined()
        expect(isValidTranslationKey(value)).toBe(true)
      })
    })

    it('should have all required page translation keys', () => {
      requiredPageKeys.forEach(key => {
        const value = key.split('.').reduce((obj, k) => obj?.[k], pagesTranslations)
        expect(value).toBeDefined()
        expect(isValidTranslationKey(value)).toBe(true)
      })
    })
  })

  describe('translation key consistency', () => {
    it('should have consistent formatting across all translation keys', () => {
      const checkFormatting = (obj: any, path = ''): string[] => {
        const issues: string[] = []
        
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key
          
          if (value && typeof value === 'object' && 'en' in value && 'zh' in value) {
            // Check for common formatting issues
            if (value.en.startsWith(' ') || value.en.endsWith(' ')) {
              issues.push(`English text has leading/trailing spaces at ${currentPath}`)
            }
            if (value.zh.startsWith(' ') || value.zh.endsWith(' ')) {
              issues.push(`Chinese text has leading/trailing spaces at ${currentPath}`)
            }
            
            // Check for empty strings
            if (value.en === '') {
              issues.push(`Empty English text at ${currentPath}`)
            }
            if (value.zh === '') {
              issues.push(`Empty Chinese text at ${currentPath}`)
            }
          } else if (value && typeof value === 'object') {
            issues.push(...checkFormatting(value, currentPath))
          }
        }
        
        return issues
      }

      const commonIssues = checkFormatting(commonTranslations, 'common')
      const componentIssues = checkFormatting(componentsTranslations, 'components')
      const pageIssues = checkFormatting(pagesTranslations, 'pages')
      
      const allIssues = [...commonIssues, ...componentIssues, ...pageIssues]
      expect(allIssues).toEqual([])
    })
  })
})

describe('Translation Utilities', () => {
  describe('isValidTranslationKey', () => {
    it('should return true for valid translation key', () => {
      const validKey = { en: 'Hello', zh: '你好' }
      expect(isValidTranslationKey(validKey)).toBe(true)
    })

    it('should return false for missing English', () => {
      const invalidKey = { zh: '你好' }
      expect(isValidTranslationKey(invalidKey)).toBe(false)
    })

    it('should return false for missing Chinese', () => {
      const invalidKey = { en: 'Hello' }
      expect(isValidTranslationKey(invalidKey)).toBe(false)
    })

    it('should return false for empty strings', () => {
      const invalidKey = { en: '', zh: '' }
      expect(isValidTranslationKey(invalidKey)).toBe(false)
    })

    it('should return false for null values', () => {
      const invalidKey = { en: null, zh: null }
      expect(isValidTranslationKey(invalidKey)).toBe(false)
    })

    it('should return false for non-object input', () => {
      expect(isValidTranslationKey('string')).toBe(false)
      expect(isValidTranslationKey(null)).toBe(false)
      expect(isValidTranslationKey(undefined)).toBe(false)
      expect(isValidTranslationKey(123)).toBe(false)
    })
  })

  describe('getFallbackText', () => {
    it('should return key by default', () => {
      const fallback = getFallbackText('test.key')
      expect(fallback).toBe('test.key')
    })

    it('should return custom placeholder when specified', () => {
      const fallback = getFallbackText('test.key', { showPlaceholder: 'Custom Placeholder' })
      expect(fallback).toBe('Custom Placeholder')
    })

    it('should return translation missing when showKey is false', () => {
      const fallback = getFallbackText('test.key', { showKey: false })
      expect(fallback).toBe('[Translation Missing]')
    })

    it('should prioritize placeholder over showKey setting', () => {
      const fallback = getFallbackText('test.key', { 
        showKey: false, 
        showPlaceholder: 'Priority Placeholder' 
      })
      expect(fallback).toBe('Priority Placeholder')
    })
  })
})