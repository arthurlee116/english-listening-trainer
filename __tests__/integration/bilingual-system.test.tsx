import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BilingualText } from '@/components/ui/bilingual-text'
import { I18nProvider } from '@/components/providers/i18n-provider'

// Mock the i18n provider
const MockI18nProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="i18n-provider">{children}</div>
}

// Mock console methods
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('Bilingual System Integration', () => {
  beforeEach(() => {
    mockConsoleWarn.mockClear()
    mockConsoleError.mockClear()
  })

  describe('component integration', () => {
    it('should render multiple BilingualText components consistently', () => {
      render(
        <div>
          <BilingualText en="Generate" zh="生成" data-testid="button1" />
          <BilingualText en="History" zh="历史" data-testid="button2" />
          <BilingualText en="Admin" zh="管理" data-testid="button3" />
        </div>
      )

      expect(screen.getByTestId('button1')).toHaveTextContent('Generate 生成')
      expect(screen.getByTestId('button2')).toHaveTextContent('History 历史')
      expect(screen.getByTestId('button3')).toHaveTextContent('Admin 管理')
    })

    it('should handle mixed translation key and direct text usage', () => {
      render(
        <div>
          <BilingualText translationKey="common.buttons.generate" data-testid="key-based" />
          <BilingualText en="Custom Text" zh="自定义文本" data-testid="direct-text" />
        </div>
      )

      expect(screen.getByTestId('key-based')).toHaveTextContent('Generate 生成')
      expect(screen.getByTestId('direct-text')).toHaveTextContent('Custom Text 自定义文本')
    })

    it('should maintain consistent formatting across different HTML elements', () => {
      render(
        <div>
          <BilingualText en="Span Text" zh="跨度文本" as="span" data-testid="span-element" />
          <BilingualText en="Button Text" zh="按钮文本" as="button" data-testid="button-element" />
          <BilingualText en="Heading Text" zh="标题文本" as="h1" data-testid="heading-element" />
          <BilingualText en="Div Text" zh="块级文本" as="div" data-testid="div-element" />
        </div>
      )

      expect(screen.getByTestId('span-element').tagName).toBe('SPAN')
      expect(screen.getByTestId('button-element').tagName).toBe('BUTTON')
      expect(screen.getByTestId('heading-element').tagName).toBe('H1')
      expect(screen.getByTestId('div-element').tagName).toBe('DIV')

      // All should have consistent bilingual formatting
      expect(screen.getByTestId('span-element')).toHaveTextContent('Span Text 跨度文本')
      expect(screen.getByTestId('button-element')).toHaveTextContent('Button Text 按钮文本')
      expect(screen.getByTestId('heading-element')).toHaveTextContent('Heading Text 标题文本')
      expect(screen.getByTestId('div-element')).toHaveTextContent('Div Text 块级文本')
    })

    it('should handle complex nested component structures', () => {
      render(
        <div>
          <div className="header">
            <BilingualText en="Main Title" zh="主标题" as="h1" data-testid="main-title" />
            <BilingualText en="Subtitle" zh="副标题" as="h2" data-testid="subtitle" />
          </div>
          <div className="content">
            <BilingualText en="Content Text" zh="内容文本" as="p" data-testid="content" />
            <div className="buttons">
              <BilingualText en="Save" zh="保存" as="button" data-testid="save-btn" />
              <BilingualText en="Cancel" zh="取消" as="button" data-testid="cancel-btn" />
            </div>
          </div>
        </div>
      )

      expect(screen.getByTestId('main-title')).toHaveTextContent('Main Title 主标题')
      expect(screen.getByTestId('subtitle')).toHaveTextContent('Subtitle 副标题')
      expect(screen.getByTestId('content')).toHaveTextContent('Content Text 内容文本')
      expect(screen.getByTestId('save-btn')).toHaveTextContent('Save 保存')
      expect(screen.getByTestId('cancel-btn')).toHaveTextContent('Cancel 取消')
    })
  })

  describe('error handling and fallbacks', () => {
    it('should handle missing translation keys gracefully', () => {
      render(
        <div>
          <BilingualText translationKey="nonexistent.key" data-testid="missing-key" />
          <BilingualText translationKey="another.missing.key" data-testid="another-missing" />
        </div>
      )

      expect(screen.getByTestId('missing-key')).toHaveTextContent('nonexistent.key')
      expect(screen.getByTestId('another-missing')).toHaveTextContent('another.missing.key')
    })

    it('should handle partial translation data', () => {
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

    it('should handle malformed translation keys', () => {
      render(
        <div>
          <BilingualText translationKey="" data-testid="empty-key" />
          <BilingualText translationKey="..." data-testid="dots-key" />
          <BilingualText translationKey="key.with.too.many.dots.that.dont.exist" data-testid="long-key" />
        </div>
      )

      expect(screen.getByTestId('empty-key')).toHaveTextContent('[Missing Translation]')
      expect(screen.getByTestId('dots-key')).toHaveTextContent('...')
      expect(screen.getByTestId('long-key')).toHaveTextContent('key.with.too.many.dots.that.dont.exist')
    })

    it('should handle special characters and edge cases', () => {
      render(
        <div>
          <BilingualText en="Text with & symbols" zh="带有 & 符号的文本" data-testid="special-chars" />
          <BilingualText en="<script>alert('xss')</script>" zh="<脚本>警告('xss')</脚本>" data-testid="html-content" />
          <BilingualText en="Line 1\nLine 2" zh="第一行\n第二行" data-testid="multiline" />
        </div>
      )

      expect(screen.getByTestId('special-chars')).toHaveTextContent('Text with & symbols 带有 & 符号的文本')
      expect(screen.getByTestId('html-content')).toHaveTextContent("<script>alert('xss')</script> <脚本>警告('xss')</脚本>")
      expect(screen.getByTestId('multiline')).toHaveTextContent('Line 1\\nLine 2 第一行\\n第二行')
    })
  })

  describe('formatting consistency', () => {
    it('should maintain consistent separator usage', () => {
      render(
        <div>
          <BilingualText en="Test1" zh="测试1" data-testid="default-separator" />
          <BilingualText en="Test2" zh="测试2" options={{ separator: ' | ' }} data-testid="custom-separator" />
          <BilingualText en="Test3" zh="测试3" options={{ separator: ' - ' }} data-testid="dash-separator" />
        </div>
      )

      expect(screen.getByTestId('default-separator')).toHaveTextContent('Test1 测试1')
      expect(screen.getByTestId('custom-separator')).toHaveTextContent('Test2 | 测试2')
      expect(screen.getByTestId('dash-separator')).toHaveTextContent('Test3 - 测试3')
    })

    it('should handle unit formatting consistently', () => {
      render(
        <div>
          <BilingualText en="Duration" zh="时长" unit="min" data-testid="simple-unit" />
          <BilingualText 
            en="Speed" 
            zh="速度" 
            unit="km/h" 
            options={{ withParentheses: true }} 
            data-testid="complex-unit" 
          />
          <BilingualText 
            en="Temperature" 
            zh="温度" 
            unit="°C" 
            options={{ withParentheses: true }} 
            data-testid="symbol-unit" 
          />
        </div>
      )

      expect(screen.getByTestId('simple-unit')).toHaveTextContent('Duration 时长 min')
      expect(screen.getByTestId('complex-unit')).toHaveTextContent('Speed 速度 (km/h)')
      expect(screen.getByTestId('symbol-unit')).toHaveTextContent('Temperature 温度 (°C)')
    })

    it('should handle long text content appropriately', () => {
      const longEnglish = 'This is a very long English text that should still be formatted correctly with the Chinese translation'
      const longChinese = '这是一段很长的中文文本，应该与英文翻译一起正确格式化'

      render(
        <BilingualText 
          en={longEnglish} 
          zh={longChinese} 
          data-testid="long-text" 
        />
      )

      expect(screen.getByTestId('long-text')).toHaveTextContent(`${longEnglish} ${longChinese}`)
    })
  })

  describe('accessibility and screen reader compatibility', () => {
    it('should maintain proper ARIA attributes', () => {
      render(
        <div>
          <BilingualText 
            en="Button" 
            zh="按钮" 
            as="button"
            aria-label="Custom aria label"
            data-testid="aria-button"
          />
          <BilingualText 
            en="Link" 
            zh="链接" 
            as="a"
            role="link"
            data-testid="aria-link"
          />
        </div>
      )

      expect(screen.getByTestId('aria-button')).toHaveAttribute('aria-label', 'Custom aria label')
      expect(screen.getByTestId('aria-link')).toHaveAttribute('role', 'link')
    })

    it('should support keyboard navigation for interactive elements', () => {
      const handleClick = vi.fn()
      const handleKeyDown = vi.fn()

      render(
        <BilingualText 
          en="Interactive" 
          zh="交互式" 
          as="button"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          data-testid="interactive-element"
        />
      )

      const button = screen.getByTestId('interactive-element')
      
      fireEvent.click(button)
      expect(handleClick).toHaveBeenCalledTimes(1)

      fireEvent.keyDown(button, { key: 'Enter' })
      expect(handleKeyDown).toHaveBeenCalledTimes(1)
    })

    it('should handle focus management correctly', () => {
      render(
        <div>
          <BilingualText 
            en="Focusable" 
            zh="可聚焦" 
            as="button"
            tabIndex={0}
            data-testid="focusable-element"
          />
          <BilingualText 
            en="Not Focusable" 
            zh="不可聚焦" 
            as="div"
            tabIndex={-1}
            data-testid="non-focusable-element"
          />
        </div>
      )

      const focusableElement = screen.getByTestId('focusable-element')
      const nonFocusableElement = screen.getByTestId('non-focusable-element')

      expect(focusableElement).toHaveAttribute('tabIndex', '0')
      expect(nonFocusableElement).toHaveAttribute('tabIndex', '-1')
    })
  })

  describe('performance and memory considerations', () => {
    it('should handle rapid re-renders without memory leaks', () => {
      const { rerender } = render(
        <BilingualText en="Initial" zh="初始" data-testid="rerender-test" />
      )

      // Simulate multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <BilingualText en={`Updated ${i}`} zh={`更新 ${i}`} data-testid="rerender-test" />
        )
      }

      expect(screen.getByTestId('rerender-test')).toHaveTextContent('Updated 9 更新 9')
    })

    it('should handle large numbers of components efficiently', () => {
      const components = Array.from({ length: 50 }, (_, i) => (
        <BilingualText 
          key={i}
          en={`Item ${i}`} 
          zh={`项目 ${i}`} 
          data-testid={`item-${i}`}
        />
      ))

      render(<div>{components}</div>)

      // Check first and last items
      expect(screen.getByTestId('item-0')).toHaveTextContent('Item 0 项目 0')
      expect(screen.getByTestId('item-49')).toHaveTextContent('Item 49 项目 49')
    })
  })

  describe('edge cases and stress testing', () => {
    it('should handle extremely long translation keys', () => {
      const longKey = 'very.long.translation.key.with.many.nested.levels.that.might.not.exist.in.the.translation.files'
      
      render(
        <BilingualText translationKey={longKey} data-testid="long-key-test" />
      )

      expect(screen.getByTestId('long-key-test')).toHaveTextContent(longKey)
    })

    it('should handle unicode and emoji characters', () => {
      render(
        <div>
          <BilingualText en="Hello 👋" zh="你好 👋" data-testid="emoji-test" />
          <BilingualText en="Café ☕" zh="咖啡 ☕" data-testid="unicode-test" />
          <BilingualText en="Math: ∑∞" zh="数学: ∑∞" data-testid="math-symbols" />
        </div>
      )

      expect(screen.getByTestId('emoji-test')).toHaveTextContent('Hello 👋 你好 👋')
      expect(screen.getByTestId('unicode-test')).toHaveTextContent('Café ☕ 咖啡 ☕')
      expect(screen.getByTestId('math-symbols')).toHaveTextContent('Math: ∑∞ 数学: ∑∞')
    })

    it('should handle null and undefined values gracefully', () => {
      render(
        <div>
          <BilingualText en={null as any} zh="中文" data-testid="null-english" />
          <BilingualText en="English" zh={undefined as any} data-testid="undefined-chinese" />
          <BilingualText en={null as any} zh={undefined as any} data-testid="both-null" />
        </div>
      )

      expect(screen.getByTestId('null-english')).toHaveTextContent('中文')
      expect(screen.getByTestId('undefined-chinese')).toHaveTextContent('English')
      expect(screen.getByTestId('both-null')).toHaveTextContent('[Missing Translation]')
    })
  })
})