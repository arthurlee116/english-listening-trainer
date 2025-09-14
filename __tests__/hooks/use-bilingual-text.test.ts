import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBilingualText } from '@/hooks/use-bilingual-text'

// Mock console methods to avoid noise in tests
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('useBilingualText', () => {
  beforeEach(() => {
    mockConsoleWarn.mockClear()
    mockConsoleError.mockClear()
  })

  describe('formatBilingual', () => {
    it('should format bilingual text with default separator', () => {
      const { result } = renderHook(() => useBilingualText())
      const formatted = result.current.formatBilingual('Hello', '你好')
      expect(formatted).toBe('Hello 你好')
    })

    it('should format bilingual text with custom separator', () => {
      const { result } = renderHook(() => useBilingualText())
      const formatted = result.current.formatBilingual('Hello', '你好', { separator: ' - ' })
      expect(formatted).toBe('Hello - 你好')
    })

    it('should format bilingual text with unit', () => {
      const { result } = renderHook(() => useBilingualText())
      const formatted = result.current.formatBilingual('Duration', '时长', { withUnit: 'min' })
      expect(formatted).toBe('Duration 时长 min')
    })

    it('should format bilingual text with unit in parentheses', () => {
      const { result } = renderHook(() => useBilingualText())
      const formatted = result.current.formatBilingual('Duration', '时长', { 
        withUnit: 'min', 
        withParentheses: true 
      })
      expect(formatted).toBe('Duration 时长 (min)')
    })

    it('should handle empty strings', () => {
      const { result } = renderHook(() => useBilingualText())
      const formatted = result.current.formatBilingual('', '')
      expect(formatted).toBe(' ')
    })

    it('should handle special characters', () => {
      const { result } = renderHook(() => useBilingualText())
      const formatted = result.current.formatBilingual('Test & Co.', '测试 & 公司')
      expect(formatted).toBe('Test & Co. 测试 & 公司')
    })
  })

  describe('getBilingualValue', () => {
    it('should format TranslationKey object correctly', () => {
      const { result } = renderHook(() => useBilingualText())
      const translationKey = { en: 'Generate', zh: '生成' }
      const formatted = result.current.getBilingualValue(translationKey)
      expect(formatted).toBe('Generate 生成')
    })

    it('should format TranslationKey object with options', () => {
      const { result } = renderHook(() => useBilingualText())
      const translationKey = { en: 'Duration', zh: '时长' }
      const formatted = result.current.getBilingualValue(translationKey, { 
        withUnit: 'min',
        withParentheses: true 
      })
      expect(formatted).toBe('Duration 时长 (min)')
    })
  })

  describe('t (translation function)', () => {
    it('should return translation for valid common key', () => {
      const { result } = renderHook(() => useBilingualText())
      const translation = result.current.t('common.buttons.generate')
      expect(translation).toBe('Generate 生成')
    })

    it('should return translation for valid components key', () => {
      const { result } = renderHook(() => useBilingualText())
      const translation = result.current.t('components.audioPlayer.play')
      expect(translation).toBe('Play 播放')
    })

    it('should return translation for valid pages key', () => {
      const { result } = renderHook(() => useBilingualText())
      const translation = result.current.t('pages.home.title')
      expect(translation).toBe('English Listening Trainer 英语听力训练器')
    })

    it('should handle nested keys without prefix', () => {
      const { result } = renderHook(() => useBilingualText())
      const translation = result.current.t('buttons.generate')
      expect(translation).toBe('Generate 生成')
    })

    it('should return key as fallback for missing translation', () => {
      const { result } = renderHook(() => useBilingualText())
      const translation = result.current.t('nonexistent.key')
      expect(translation).toBe('nonexistent.key')
      expect(mockConsoleWarn).toHaveBeenCalledWith('Missing translation for key: nonexistent.key')
    })

    it('should handle translation with formatting options', () => {
      const { result } = renderHook(() => useBilingualText())
      const translation = result.current.t('common.labels.duration', { 
        withUnit: 'min',
        withParentheses: true 
      })
      expect(translation).toBe('Duration 时长 (min)')
    })

    it('should handle malformed translation keys gracefully', () => {
      const { result } = renderHook(() => useBilingualText())
      const translation = result.current.t('common.buttons.malformed')
      expect(translation).toBe('common.buttons.malformed')
    })

    it('should handle custom separator in options', () => {
      const { result } = renderHook(() => useBilingualText())
      const translation = result.current.t('common.buttons.generate', { separator: ' | ' })
      expect(translation).toBe('Generate | 生成')
    })
  })

  describe('error handling', () => {
    it('should handle errors gracefully and return key', () => {
      const { result } = renderHook(() => useBilingualText())
      
      // Test with a malformed key that would cause an error
      const translation = result.current.t('test.key.with.error')
      expect(translation).toBe('test.key.with.error')
      expect(mockConsoleWarn).toHaveBeenCalledWith('Missing translation for key: test.key.with.error')
    })
  })

  describe('edge cases', () => {
    it('should handle very long text strings', () => {
      const { result } = renderHook(() => useBilingualText())
      const longEn = 'A'.repeat(1000)
      const longZh = '中'.repeat(1000)
      const formatted = result.current.formatBilingual(longEn, longZh)
      expect(formatted).toBe(`${longEn} ${longZh}`)
    })

    it('should handle unicode characters correctly', () => {
      const { result } = renderHook(() => useBilingualText())
      const formatted = result.current.formatBilingual('Café', '咖啡馆')
      expect(formatted).toBe('Café 咖啡馆')
    })

    it('should handle numbers and special symbols', () => {
      const { result } = renderHook(() => useBilingualText())
      const formatted = result.current.formatBilingual('Level 1', '级别 1')
      expect(formatted).toBe('Level 1 级别 1')
    })
  })
})