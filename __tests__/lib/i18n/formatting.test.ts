import { describe, it, expect } from 'vitest'
import { 
  formatBilingualText, 
  formatWithUnit, 
  getDifficultyLabel, 
  getDurationLabel,
  difficultyLevels,
  durationOptions
} from '@/lib/i18n/utils'

describe('Bilingual Formatting', () => {
  describe('formatBilingualText', () => {
    it('should format with default separator', () => {
      const result = formatBilingualText('Hello', '你好')
      expect(result).toBe('Hello 你好')
    })

    it('should format with custom separator', () => {
      const result = formatBilingualText('Hello', '你好', ' | ')
      expect(result).toBe('Hello | 你好')
    })

    it('should handle empty strings', () => {
      const result = formatBilingualText('', '')
      expect(result).toBe(' ')
    })

    it('should handle special characters', () => {
      const result = formatBilingualText('Test & Co.', '测试 & 公司')
      expect(result).toBe('Test & Co. 测试 & 公司')
    })

    it('should handle unicode characters', () => {
      const result = formatBilingualText('Café', '咖啡馆')
      expect(result).toBe('Café 咖啡馆')
    })
  })

  describe('formatWithUnit', () => {
    it('should format text with unit in parentheses', () => {
      const result = formatWithUnit('Duration 时长', 'min')
      expect(result).toBe('Duration 时长 (min)')
    })

    it('should handle empty unit', () => {
      const result = formatWithUnit('Duration 时长', '')
      expect(result).toBe('Duration 时长 ()')
    })

    it('should handle complex units', () => {
      const result = formatWithUnit('Speed 速度', 'km/h')
      expect(result).toBe('Speed 速度 (km/h)')
    })
  })

  describe('difficulty level formatting', () => {
    it('should have all expected difficulty levels', () => {
      const expectedLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      const actualLevels = difficultyLevels.map(d => d.level)
      expect(actualLevels).toEqual(expectedLevels)
    })

    it('should format A1 difficulty correctly', () => {
      const result = getDifficultyLabel('A1')
      expect(result).toBe('A1 - Beginner A1 - 初学者')
    })

    it('should format B1 difficulty correctly', () => {
      const result = getDifficultyLabel('B1')
      expect(result).toBe('B1 - Intermediate B1 - 中级')
    })

    it('should format C2 difficulty correctly', () => {
      const result = getDifficultyLabel('C2')
      expect(result).toBe('C2 - Proficient C2 - 精通级')
    })

    it('should handle unknown difficulty level', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = getDifficultyLabel('X1')
      expect(result).toBe('X1')
      expect(consoleSpy).toHaveBeenCalledWith('Unknown difficulty level: X1')
      consoleSpy.mockRestore()
    })

    it('should have valid translation keys for all difficulty levels', () => {
      difficultyLevels.forEach(difficulty => {
        expect(difficulty.translation.en).toBeTruthy()
        expect(difficulty.translation.zh).toBeTruthy()
        expect(typeof difficulty.translation.en).toBe('string')
        expect(typeof difficulty.translation.zh).toBe('string')
      })
    })
  })

  describe('duration formatting', () => {
    it('should have all expected duration options', () => {
      const expectedDurations = ['1min', '2min', '3min', '5min']
      const actualDurations = durationOptions.map(d => d.value)
      expect(actualDurations).toEqual(expectedDurations)
    })

    it('should format 1 minute duration correctly', () => {
      const result = getDurationLabel('1min')
      expect(result).toBe('1 minute 1分钟 (~120 words 词)')
    })

    it('should format 3 minute duration correctly', () => {
      const result = getDurationLabel('3min')
      expect(result).toBe('3 minutes 3分钟 (~360 words 词)')
    })

    it('should format 5 minute duration correctly', () => {
      const result = getDurationLabel('5min')
      expect(result).toBe('5 minutes 5分钟 (~600 words 词)')
    })

    it('should handle unknown duration value', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = getDurationLabel('10min')
      expect(result).toBe('10min')
      expect(consoleSpy).toHaveBeenCalledWith('Unknown duration value: 10min')
      consoleSpy.mockRestore()
    })

    it('should have correct word counts for all durations', () => {
      const expectedWordCounts = {
        '1min': 120,
        '2min': 240,
        '3min': 360,
        '5min': 600
      }

      durationOptions.forEach(duration => {
        expect(duration.wordCount).toBe(expectedWordCounts[duration.value as keyof typeof expectedWordCounts])
      })
    })

    it('should have valid translation keys for all duration options', () => {
      durationOptions.forEach(duration => {
        expect(duration.translation.en).toBeTruthy()
        expect(duration.translation.zh).toBeTruthy()
        expect(typeof duration.translation.en).toBe('string')
        expect(typeof duration.translation.zh).toBe('string')
      })
    })
  })

  describe('special formatting scenarios', () => {
    it('should handle measurement units correctly', () => {
      const measurements = [
        { en: 'Length', zh: '长度', unit: 'cm' },
        { en: 'Weight', zh: '重量', unit: 'kg' },
        { en: 'Temperature', zh: '温度', unit: '°C' },
        { en: 'Volume', zh: '体积', unit: 'L' }
      ]

      measurements.forEach(({ en, zh, unit }) => {
        const formatted = formatBilingualText(en, zh)
        const withUnit = formatWithUnit(formatted, unit)
        expect(withUnit).toBe(`${en} ${zh} (${unit})`)
      })
    })

    it('should handle time-based units', () => {
      const timeUnits = [
        { en: 'Duration', zh: '时长', unit: 'min' },
        { en: 'Interval', zh: '间隔', unit: 'sec' },
        { en: 'Period', zh: '周期', unit: 'hours' },
        { en: 'Delay', zh: '延迟', unit: 'ms' }
      ]

      timeUnits.forEach(({ en, zh, unit }) => {
        const formatted = formatBilingualText(en, zh)
        const withUnit = formatWithUnit(formatted, unit)
        expect(withUnit).toBe(`${en} ${zh} (${unit})`)
      })
    })

    it('should handle complex unit expressions', () => {
      const complexUnits = [
        'km/h',
        'm/s²',
        'kWh',
        'MB/s',
        '°F',
        '%'
      ]

      complexUnits.forEach(unit => {
        const formatted = formatBilingualText('Value', '数值')
        const withUnit = formatWithUnit(formatted, unit)
        expect(withUnit).toBe(`Value 数值 (${unit})`)
      })
    })

    it('should maintain formatting consistency across different text lengths', () => {
      const testCases = [
        { en: 'A', zh: '甲' },
        { en: 'Short', zh: '短' },
        { en: 'Medium length text', zh: '中等长度文本' },
        { en: 'This is a very long text that should still format correctly', zh: '这是一个很长的文本，应该仍然能够正确格式化' }
      ]

      testCases.forEach(({ en, zh }) => {
        const formatted = formatBilingualText(en, zh)
        expect(formatted).toBe(`${en} ${zh}`)
        
        const withUnit = formatWithUnit(formatted, 'unit')
        expect(withUnit).toBe(`${en} ${zh} (unit)`)
      })
    })
  })
})