import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BilingualText } from '@/components/ui/bilingual-text'

// Mock the useBilingualText hook
vi.mock('@/hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({
    t: vi.fn((key: string, options?: any) => {
      // Mock translations for testing
      const mockTranslations: Record<string, string> = {
        'common.buttons.generate': 'Generate 生成',
        'common.labels.duration': options?.withUnit 
          ? `Duration 时长${options.withParentheses ? ` (${options.withUnit})` : ` ${options.withUnit}`}`
          : 'Duration 时长',
        'components.audioPlayer.play': 'Play 播放',
      }
      return mockTranslations[key] || key
    }),
    formatBilingual: vi.fn((en: string, zh: string, options?: any) => {
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

// Mock console methods
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('BilingualText', () => {
  beforeEach(() => {
    mockConsoleWarn.mockClear()
  })

  describe('rendering with translation key', () => {
    it('should render text using translation key', () => {
      render(<BilingualText translationKey="common.buttons.generate" />)
      expect(screen.getByText('Generate 生成')).toBeInTheDocument()
    })

    it('should render text with unit using translation key', () => {
      render(<BilingualText translationKey="common.labels.duration" unit="min" />)
      expect(screen.getByText('Duration 时长 min')).toBeInTheDocument()
    })

    it('should render text with unit in parentheses', () => {
      render(
        <BilingualText 
          translationKey="common.labels.duration" 
          unit="min" 
          options={{ withParentheses: true }}
        />
      )
      expect(screen.getByText('Duration 时长 (min)')).toBeInTheDocument()
    })
  })

  describe('rendering with direct en/zh props', () => {
    it('should render text using en and zh props', () => {
      render(<BilingualText en="Hello" zh="你好" />)
      expect(screen.getByText('Hello 你好')).toBeInTheDocument()
    })

    it('should render text with unit using en/zh props', () => {
      render(<BilingualText en="Duration" zh="时长" unit="min" />)
      expect(screen.getByText('Duration 时长 min')).toBeInTheDocument()
    })

    it('should render text with custom separator', () => {
      render(
        <BilingualText 
          en="Hello" 
          zh="你好" 
          options={{ separator: ' | ' }}
        />
      )
      expect(screen.getByText('Hello | 你好')).toBeInTheDocument()
    })
  })

  describe('fallback behavior', () => {
    it('should show English text when Chinese is missing', () => {
      render(<BilingualText en="Hello" />)
      expect(screen.getByText('Hello')).toBeInTheDocument()
    })

    it('should show Chinese text when English is missing', () => {
      render(<BilingualText zh="你好" />)
      expect(screen.getByText('你好')).toBeInTheDocument()
    })

    it('should show fallback message when both are missing', () => {
      render(<BilingualText />)
      expect(screen.getByText('[Missing Translation]')).toBeInTheDocument()
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'BilingualText: Missing both translation key and en/zh props'
      )
    })

    it('should prioritize translation key over en/zh props', () => {
      render(
        <BilingualText 
          translationKey="common.buttons.generate"
          en="Override English"
          zh="覆盖中文"
        />
      )
      expect(screen.getByText('Generate 生成')).toBeInTheDocument()
    })
  })

  describe('HTML element rendering', () => {
    it('should render as span by default', () => {
      render(<BilingualText en="Hello" zh="你好" />)
      const element = screen.getByText('Hello 你好')
      expect(element.tagName).toBe('SPAN')
    })

    it('should render as specified HTML element', () => {
      render(<BilingualText en="Hello" zh="你好" as="h1" />)
      const element = screen.getByText('Hello 你好')
      expect(element.tagName).toBe('H1')
    })

    it('should render as div', () => {
      render(<BilingualText en="Hello" zh="你好" as="div" />)
      const element = screen.getByText('Hello 你好')
      expect(element.tagName).toBe('DIV')
    })

    it('should render as button', () => {
      render(<BilingualText en="Click" zh="点击" as="button" />)
      const element = screen.getByText('Click 点击')
      expect(element.tagName).toBe('BUTTON')
    })
  })

  describe('CSS classes and styling', () => {
    it('should apply custom className', () => {
      render(<BilingualText en="Hello" zh="你好" className="custom-class" />)
      const element = screen.getByText('Hello 你好')
      expect(element).toHaveClass('custom-class')
    })

    it('should merge multiple classes', () => {
      render(
        <BilingualText 
          en="Hello" 
          zh="你好" 
          className="class1 class2" 
        />
      )
      const element = screen.getByText('Hello 你好')
      expect(element).toHaveClass('class1')
      expect(element).toHaveClass('class2')
    })
  })

  describe('additional props', () => {
    it('should pass through additional props', () => {
      render(
        <BilingualText 
          en="Hello" 
          zh="你好" 
          data-testid="bilingual-text"
          aria-label="Greeting"
        />
      )
      const element = screen.getByTestId('bilingual-text')
      expect(element).toHaveAttribute('aria-label', 'Greeting')
    })

    it('should handle onClick events', () => {
      const handleClick = vi.fn()
      render(
        <BilingualText 
          en="Click" 
          zh="点击" 
          as="button"
          onClick={handleClick}
        />
      )
      const button = screen.getByText('Click 点击')
      button.click()
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('complex formatting scenarios', () => {
    it('should handle complex translation keys with nested paths', () => {
      render(<BilingualText translationKey="components.audioPlayer.play" />)
      expect(screen.getByText('Play 播放')).toBeInTheDocument()
    })

    it('should handle special characters in text', () => {
      render(<BilingualText en="Test & Co." zh="测试 & 公司" />)
      expect(screen.getByText('Test & Co. 测试 & 公司')).toBeInTheDocument()
    })

    it('should handle numbers and symbols', () => {
      render(<BilingualText en="Level 1" zh="级别 1" />)
      expect(screen.getByText('Level 1 级别 1')).toBeInTheDocument()
    })

    it('should handle empty strings gracefully', () => {
      render(<BilingualText en="" zh="" />)
      // When both en and zh are empty strings, they are falsy so component shows fallback
      expect(screen.getByText('[Missing Translation]')).toBeInTheDocument()
    })
  })
})