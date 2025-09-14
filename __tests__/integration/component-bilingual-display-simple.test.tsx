import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BilingualText } from '@/components/ui/bilingual-text'

describe('Component Bilingual Display Integration (Simplified)', () => {
  describe('multiple component rendering', () => {
    it('should render multiple bilingual components consistently', () => {
      render(
        <div>
          <BilingualText translationKey="common.buttons.generate" data-testid="generate-btn" />
          <BilingualText translationKey="common.buttons.history" data-testid="history-btn" />
          <BilingualText translationKey="common.labels.difficulty" data-testid="difficulty-label" />
          <BilingualText en="Custom Text" zh="自定义文本" data-testid="custom-text" />
        </div>
      )

      expect(screen.getByTestId('generate-btn')).toHaveTextContent('Generate 生成')
      expect(screen.getByTestId('history-btn')).toHaveTextContent('History 历史')
      expect(screen.getByTestId('difficulty-label')).toHaveTextContent('Difficulty Level 难度级别')
      expect(screen.getByTestId('custom-text')).toHaveTextContent('Custom Text 自定义文本')
    })

    it('should handle mixed translation approaches consistently', () => {
      render(
        <div>
          <BilingualText translationKey="common.buttons.generate" data-testid="key-based" />
          <BilingualText en="Direct English" zh="直接中文" data-testid="direct-text" />
          <BilingualText translationKey="common.labels.duration" unit="min" data-testid="with-unit" />
        </div>
      )

      // All should follow consistent bilingual formatting
      const elements = [
        screen.getByTestId('key-based'),
        screen.getByTestId('direct-text'),
        screen.getByTestId('with-unit')
      ]

      elements.forEach(element => {
        const text = element.textContent || ''
        // Should contain both English and Chinese characters
        expect(text).toMatch(/[A-Za-z].*[\u4e00-\u9fff]/)
      })
    })

    it('should maintain formatting consistency across different HTML elements', () => {
      render(
        <div>
          <BilingualText en="Button Text" zh="按钮文本" as="button" data-testid="button-element" />
          <BilingualText en="Heading Text" zh="标题文本" as="h1" data-testid="heading-element" />
          <BilingualText en="Paragraph Text" zh="段落文本" as="p" data-testid="paragraph-element" />
          <BilingualText en="Span Text" zh="跨度文本" as="span" data-testid="span-element" />
        </div>
      )

      expect(screen.getByTestId('button-element').tagName).toBe('BUTTON')
      expect(screen.getByTestId('heading-element').tagName).toBe('H1')
      expect(screen.getByTestId('paragraph-element').tagName).toBe('P')
      expect(screen.getByTestId('span-element').tagName).toBe('SPAN')

      // All should have consistent bilingual formatting
      expect(screen.getByTestId('button-element')).toHaveTextContent('Button Text 按钮文本')
      expect(screen.getByTestId('heading-element')).toHaveTextContent('Heading Text 标题文本')
      expect(screen.getByTestId('paragraph-element')).toHaveTextContent('Paragraph Text 段落文本')
      expect(screen.getByTestId('span-element')).toHaveTextContent('Span Text 跨度文本')
    })
  })

  describe('error handling across components', () => {
    it('should handle missing translations consistently', () => {
      render(
        <div>
          <BilingualText translationKey="missing.key1" data-testid="missing1" />
          <BilingualText translationKey="missing.key2" data-testid="missing2" />
          <BilingualText en="Valid English" zh="有效中文" data-testid="valid-text" />
          <BilingualText translationKey="missing.key3" data-testid="missing3" />
        </div>
      )

      expect(screen.getByTestId('missing1')).toHaveTextContent('missing.key1')
      expect(screen.getByTestId('missing2')).toHaveTextContent('missing.key2')
      expect(screen.getByTestId('valid-text')).toHaveTextContent('Valid English 有效中文')
      expect(screen.getByTestId('missing3')).toHaveTextContent('missing.key3')
    })

    it('should handle partial data consistently', () => {
      render(
        <div>
          <BilingualText en="Only English" data-testid="english-only" />
          <BilingualText zh="只有中文" data-testid="chinese-only" />
          <BilingualText data-testid="no-data" />
          <BilingualText en="Complete" zh="完整" data-testid="complete" />
        </div>
      )

      expect(screen.getByTestId('english-only')).toHaveTextContent('Only English')
      expect(screen.getByTestId('chinese-only')).toHaveTextContent('只有中文')
      expect(screen.getByTestId('no-data')).toHaveTextContent('[Missing Translation]')
      expect(screen.getByTestId('complete')).toHaveTextContent('Complete 完整')
    })
  })

  describe('formatting consistency', () => {
    it('should handle units consistently across components', () => {
      render(
        <div>
          <BilingualText en="Duration" zh="时长" unit="min" data-testid="duration" />
          <BilingualText en="Speed" zh="速度" unit="km/h" options={{ withParentheses: true }} data-testid="speed" />
          <BilingualText en="Temperature" zh="温度" unit="°C" data-testid="temperature" />
        </div>
      )

      expect(screen.getByTestId('duration')).toHaveTextContent('Duration 时长 min')
      expect(screen.getByTestId('speed')).toHaveTextContent('Speed 速度 (km/h)')
      expect(screen.getByTestId('temperature')).toHaveTextContent('Temperature 温度 °C')
    })

    it('should handle custom separators consistently', () => {
      render(
        <div>
          <BilingualText en="Test1" zh="测试1" data-testid="default-sep" />
          <BilingualText en="Test2" zh="测试2" options={{ separator: ' | ' }} data-testid="pipe-sep" />
          <BilingualText en="Test3" zh="测试3" options={{ separator: ' - ' }} data-testid="dash-sep" />
        </div>
      )

      expect(screen.getByTestId('default-sep')).toHaveTextContent('Test1 测试1')
      expect(screen.getByTestId('pipe-sep')).toHaveTextContent('Test2 | 测试2')
      expect(screen.getByTestId('dash-sep')).toHaveTextContent('Test3 - 测试3')
    })
  })

  describe('performance with multiple components', () => {
    it('should handle many components efficiently', () => {
      const components = Array.from({ length: 20 }, (_, i) => (
        <BilingualText 
          key={i}
          en={`Item ${i}`} 
          zh={`项目 ${i}`} 
          data-testid={`item-${i}`}
        />
      ))

      render(<div>{components}</div>)

      // Check first, middle, and last items
      expect(screen.getByTestId('item-0')).toHaveTextContent('Item 0 项目 0')
      expect(screen.getByTestId('item-10')).toHaveTextContent('Item 10 项目 10')
      expect(screen.getByTestId('item-19')).toHaveTextContent('Item 19 项目 19')
    })

    it('should handle rapid re-renders without issues', () => {
      const { rerender } = render(
        <BilingualText en="Initial" zh="初始" data-testid="rerender-test" />
      )

      // Simulate multiple re-renders
      for (let i = 1; i <= 5; i++) {
        rerender(
          <BilingualText en={`Updated ${i}`} zh={`更新 ${i}`} data-testid="rerender-test" />
        )
      }

      expect(screen.getByTestId('rerender-test')).toHaveTextContent('Updated 5 更新 5')
    })
  })

  describe('accessibility integration', () => {
    it('should maintain accessibility attributes across components', () => {
      render(
        <div>
          <BilingualText 
            en="Button" 
            zh="按钮" 
            as="button"
            aria-label="Custom button label"
            data-testid="accessible-button"
          />
          <BilingualText 
            en="Link" 
            zh="链接" 
            as="a"
            role="link"
            tabIndex={0}
            data-testid="accessible-link"
          />
        </div>
      )

      const button = screen.getByTestId('accessible-button')
      const link = screen.getByTestId('accessible-link')

      expect(button).toHaveAttribute('aria-label', 'Custom button label')
      expect(button).toHaveTextContent('Button 按钮')

      expect(link).toHaveAttribute('role', 'link')
      expect(link).toHaveAttribute('tabIndex', '0')
      expect(link).toHaveTextContent('Link 链接')
    })
  })

  describe('edge cases in component integration', () => {
    it('should handle special characters across components', () => {
      render(
        <div>
          <BilingualText en="Text & Symbols" zh="文本 & 符号" data-testid="ampersand" />
          <BilingualText en={'Quotes "test"'} zh={'引号 "测试"'} data-testid="quotes" />
          <BilingualText en="Math: ∑∞" zh="数学: ∑∞" data-testid="math" />
          <BilingualText en="Emoji 🎉" zh="表情 🎉" data-testid="emoji" />
        </div>
      )

      expect(screen.getByTestId('ampersand')).toHaveTextContent('Text & Symbols 文本 & 符号')
      expect(screen.getByTestId('quotes')).toHaveTextContent('Quotes "test" 引号 "测试"')
      expect(screen.getByTestId('math')).toHaveTextContent('Math: ∑∞ 数学: ∑∞')
      expect(screen.getByTestId('emoji')).toHaveTextContent('Emoji 🎉 表情 🎉')
    })

    it('should handle very long text content', () => {
      const longEn = 'This is a very long English text that should still be formatted correctly with bilingual display'
      const longZh = '这是一段很长的中文文本，应该与英文一起正确格式化显示'

      render(
        <BilingualText 
          en={longEn} 
          zh={longZh} 
          data-testid="long-text" 
        />
      )

      expect(screen.getByTestId('long-text')).toHaveTextContent(`${longEn} ${longZh}`)
    })
  })
})