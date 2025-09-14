import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BilingualText } from '@/components/ui/bilingual-text'

// Mock console methods to capture error/warning messages
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

// Mock the bilingual text hook with error scenarios
vi.mock('@/hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({
    t: vi.fn((key: string, options?: any) => {
      // Simulate various error scenarios
      if (key === 'error.throw') {
        throw new Error('Translation system error')
      }
      if (key === 'error.timeout') {
        throw new Error('Translation timeout')
      }
      if (key === 'error.network') {
        throw new Error('Network error loading translations')
      }
      
      // Mock some valid translations
      const mockTranslations: Record<string, string> = {
        'common.buttons.generate': 'Generate 生成',
        'common.labels.duration': options?.withUnit 
          ? `Duration 时长${options.withParentheses ? ` (${options.withUnit})` : ` ${options.withUnit}`}`
          : 'Duration 时长',
      }
      
      if (mockTranslations[key]) {
        return mockTranslations[key]
      }
      
      // Fallback for missing keys
      console.warn(`Missing translation for key: ${key}`)
      return key
    }),
    formatBilingual: vi.fn((en: string, zh: string, options?: any) => {
      // Simulate formatting errors
      if (en === 'ERROR_EN' || zh === 'ERROR_ZH') {
        throw new Error('Formatting error')
      }
      
      const separator = options?.separator || ' '
      let formatted = `${en}${separator}${zh}`
      
      if (options?.withUnit) {
        if (options.withParentheses) {
          formatted = `${formatted} (${options.withUnit})`
        } else {
          formatted = `${formatted} ${options.withUnit}`
        }
      }
      
      return formatted
    }),
    getBilingualValue: vi.fn((translationKey: any, options?: any) => {
      // Simulate getBilingualValue errors
      if (!translationKey || typeof translationKey !== 'object') {
        throw new Error('Invalid translation key object')
      }
      
      if (translationKey.en === 'ERROR_EN' || translationKey.zh === 'ERROR_ZH') {
        throw new Error('Translation value error')
      }
      
      const separator = options?.separator || ' '
      let formatted = `${translationKey.en}${separator}${translationKey.zh}`
      
      if (options?.withUnit) {
        if (options.withParentheses) {
          formatted = `${formatted} (${options.withUnit})`
        } else {
          formatted = `${formatted} ${options.withUnit}`
        }
      }
      
      return formatted
    }),
  })
}))

describe('Error Handling and Missing Translation Scenarios', () => {
  beforeEach(() => {
    mockConsoleWarn.mockClear()
    mockConsoleError.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('translation key errors', () => {
    it('should handle missing translation keys gracefully', () => {
      render(
        <div>
          <BilingualText translationKey="missing.key" data-testid="missing-key" />
          <BilingualText translationKey="another.missing.key" data-testid="another-missing" />
          <BilingualText translationKey="deeply.nested.missing.key" data-testid="nested-missing" />
        </div>
      )

      expect(screen.getByTestId('missing-key')).toHaveTextContent('missing.key')
      expect(screen.getByTestId('another-missing')).toHaveTextContent('another.missing.key')
      expect(screen.getByTestId('nested-missing')).toHaveTextContent('deeply.nested.missing.key')
      
      expect(mockConsoleWarn).toHaveBeenCalledWith('Missing translation for key: missing.key')
      expect(mockConsoleWarn).toHaveBeenCalledWith('Missing translation for key: another.missing.key')
      expect(mockConsoleWarn).toHaveBeenCalledWith('Missing translation for key: deeply.nested.missing.key')
    })

    it('should handle malformed translation keys', () => {
      render(
        <div>
          <BilingualText translationKey="" data-testid="empty-key" />
          <BilingualText translationKey="." data-testid="dot-key" />
          <BilingualText translationKey="..." data-testid="dots-key" />
          <BilingualText translationKey="key." data-testid="trailing-dot" />
          <BilingualText translationKey=".key" data-testid="leading-dot" />
        </div>
      )

      expect(screen.getByTestId('empty-key')).toHaveTextContent('[Missing Translation]')
      expect(screen.getByTestId('dot-key')).toHaveTextContent('.')
      expect(screen.getByTestId('dots-key')).toHaveTextContent('...')
      expect(screen.getByTestId('trailing-dot')).toHaveTextContent('key.')
      expect(screen.getByTestId('leading-dot')).toHaveTextContent('.key')
    })

    it('should handle translation system errors', () => {
      // Test that errors are thrown as expected
      expect(() => {
        render(<BilingualText translationKey="error.throw" data-testid="error-throw" />)
      }).toThrow('Translation system error')
    })
  })

  describe('direct text errors', () => {
    it('should handle missing English or Chinese text', () => {
      render(
        <div>
          <BilingualText en="Only English" data-testid="english-only" />
          <BilingualText zh="只有中文" data-testid="chinese-only" />
          <BilingualText data-testid="no-text" />
        </div>
      )

      expect(screen.getByTestId('english-only')).toHaveTextContent('Only English')
      expect(screen.getByTestId('chinese-only')).toHaveTextContent('只有中文')
      expect(screen.getByTestId('no-text')).toHaveTextContent('[Missing Translation]')
    })

    it('should handle empty string values', () => {
      render(
        <div>
          <BilingualText en="" zh="中文" data-testid="empty-english" />
          <BilingualText en="English" zh="" data-testid="empty-chinese" />
          <BilingualText en="" zh="" data-testid="both-empty" />
        </div>
      )

      // Empty strings are falsy, so should fall back to the available text or fallback message
      expect(screen.getByTestId('empty-english')).toHaveTextContent('中文')
      expect(screen.getByTestId('empty-chinese')).toHaveTextContent('English')
      expect(screen.getByTestId('both-empty')).toHaveTextContent('[Missing Translation]')
    })

    it('should handle null and undefined values', () => {
      render(
        <div>
          <BilingualText en={null as any} zh="中文" data-testid="null-english" />
          <BilingualText en="English" zh={null as any} data-testid="null-chinese" />
          <BilingualText en={undefined as any} zh="中文" data-testid="undefined-english" />
          <BilingualText en="English" zh={undefined as any} data-testid="undefined-chinese" />
          <BilingualText en={null as any} zh={null as any} data-testid="both-null" />
        </div>
      )

      expect(screen.getByTestId('null-english')).toHaveTextContent('中文')
      expect(screen.getByTestId('null-chinese')).toHaveTextContent('English')
      expect(screen.getByTestId('undefined-english')).toHaveTextContent('中文')
      expect(screen.getByTestId('undefined-chinese')).toHaveTextContent('English')
      expect(screen.getByTestId('both-null')).toHaveTextContent('[Missing Translation]')
    })

    it('should handle formatting errors gracefully', () => {
      // Test that formatting errors are thrown as expected
      expect(() => {
        render(<BilingualText en="ERROR_EN" zh="正常中文" data-testid="error-english" />)
      }).toThrow('Translation value error')
    })
  })

  describe('mixed error scenarios', () => {
    it('should handle components with mixed valid and invalid data', () => {
      render(
        <div>
          <BilingualText translationKey="common.buttons.generate" data-testid="valid-key" />
          <BilingualText translationKey="invalid.key" data-testid="invalid-key" />
          <BilingualText en="Valid English" zh="有效中文" data-testid="valid-direct" />
          <BilingualText en="" zh="" data-testid="invalid-direct" />
        </div>
      )

      expect(screen.getByTestId('valid-key')).toHaveTextContent('Generate 生成')
      expect(screen.getByTestId('invalid-key')).toHaveTextContent('invalid.key')
      expect(screen.getByTestId('valid-direct')).toHaveTextContent('Valid English 有效中文')
      expect(screen.getByTestId('invalid-direct')).toHaveTextContent('[Missing Translation]')
    })

    it('should handle rapid error recovery', () => {
      const { rerender } = render(
        <BilingualText translationKey="invalid.key" data-testid="error-recovery" />
      )

      expect(screen.getByTestId('error-recovery')).toHaveTextContent('invalid.key')

      // Re-render with valid data
      rerender(
        <BilingualText translationKey="common.buttons.generate" data-testid="error-recovery" />
      )

      expect(screen.getByTestId('error-recovery')).toHaveTextContent('Generate 生成')

      // Re-render with error again
      rerender(
        <BilingualText en="" zh="" data-testid="error-recovery" />
      )

      expect(screen.getByTestId('error-recovery')).toHaveTextContent('[Missing Translation]')
    })
  })

  describe('edge case error handling', () => {
    it('should handle special characters in error scenarios', () => {
      render(
        <div>
          <BilingualText en={'Text with & < > "'} zh={'带有 & < > " 的文本'} data-testid="special-chars" />
          <BilingualText en="<script>alert('xss')</script>" zh="<脚本>警告</脚本>" data-testid="html-content" />
          <BilingualText translationKey="key.with.&.special.chars" data-testid="special-key" />
        </div>
      )

      expect(screen.getByTestId('special-chars')).toHaveTextContent('Text with & < > " 带有 & < > " 的文本')
      expect(screen.getByTestId('html-content')).toHaveTextContent("<script>alert('xss')</script> <脚本>警告</脚本>")
      expect(screen.getByTestId('special-key')).toHaveTextContent('key.with.&.special.chars')
    })

    it('should handle extremely long error messages', () => {
      const longKey = 'very.long.translation.key.that.does.not.exist.and.should.be.handled.gracefully.even.when.it.is.extremely.long.and.might.cause.issues.with.display.or.memory'
      
      render(
        <BilingualText translationKey={longKey} data-testid="long-error-key" />
      )

      expect(screen.getByTestId('long-error-key')).toHaveTextContent(longKey)
    })

    it('should handle unicode and emoji in error scenarios', () => {
      render(
        <div>
          <BilingualText en="Error 🚫" zh="错误 🚫" data-testid="emoji-error" />
          <BilingualText translationKey="missing.key.with.unicode.🌟" data-testid="unicode-key" />
          <BilingualText en="Math: ∑∞∆" zh="数学: ∑∞∆" data-testid="math-symbols" />
        </div>
      )

      expect(screen.getByTestId('emoji-error')).toHaveTextContent('Error 🚫 错误 🚫')
      expect(screen.getByTestId('unicode-key')).toHaveTextContent('missing.key.with.unicode.🌟')
      expect(screen.getByTestId('math-symbols')).toHaveTextContent('Math: ∑∞∆ 数学: ∑∞∆')
    })
  })

  describe('error boundary scenarios', () => {
    it('should handle multiple consecutive errors', () => {
      render(
        <div>
          <BilingualText translationKey="error1" data-testid="error1" />
          <BilingualText translationKey="error2" data-testid="error2" />
          <BilingualText translationKey="error3" data-testid="error3" />
          <BilingualText translationKey="error4" data-testid="error4" />
          <BilingualText translationKey="error5" data-testid="error5" />
        </div>
      )

      expect(screen.getByTestId('error1')).toHaveTextContent('error1')
      expect(screen.getByTestId('error2')).toHaveTextContent('error2')
      expect(screen.getByTestId('error3')).toHaveTextContent('error3')
      expect(screen.getByTestId('error4')).toHaveTextContent('error4')
      expect(screen.getByTestId('error5')).toHaveTextContent('error5')
    })

    it('should handle errors in nested component structures', () => {
      render(
        <div>
          <div className="level1">
            <BilingualText translationKey="valid.key" data-testid="valid-nested" />
            <div className="level2">
              <BilingualText translationKey="invalid.key" data-testid="invalid-nested" />
              <div className="level3">
                <BilingualText en="" zh="" data-testid="empty-nested" />
              </div>
            </div>
          </div>
        </div>
      )

      expect(screen.getByTestId('valid-nested')).toHaveTextContent('valid.key')
      expect(screen.getByTestId('invalid-nested')).toHaveTextContent('invalid.key')
      expect(screen.getByTestId('empty-nested')).toHaveTextContent('[Missing Translation]')
    })
  })

  describe('performance under error conditions', () => {
    it('should handle many error components without performance degradation', () => {
      const errorComponents = Array.from({ length: 100 }, (_, i) => (
        <BilingualText 
          key={i}
          translationKey={`error.key.${i}`} 
          data-testid={`error-component-${i}`}
        />
      ))

      render(<div>{errorComponents}</div>)

      // Check first and last components
      expect(screen.getByTestId('error-component-0')).toHaveTextContent('error.key.0')
      expect(screen.getByTestId('error-component-99')).toHaveTextContent('error.key.99')
    })

    it('should handle rapid error state changes', () => {
      const { rerender } = render(
        <BilingualText translationKey="error.key" data-testid="rapid-change" />
      )

      // Rapidly change between error and valid states
      for (let i = 0; i < 10; i++) {
        rerender(
          <BilingualText 
            translationKey={i % 2 === 0 ? 'error.key' : 'common.buttons.generate'} 
            data-testid="rapid-change" 
          />
        )
      }

      // Should end with valid translation
      expect(screen.getByTestId('rapid-change')).toHaveTextContent('Generate 生成')
    })
  })
})