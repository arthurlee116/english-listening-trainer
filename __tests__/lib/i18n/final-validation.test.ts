import { describe, it, expect } from 'vitest';
import { formatBilingualText } from '@/lib/i18n/config';
import { useBilingualText } from '@/hooks/use-bilingual-text';
import { BilingualTextAuditor } from '../../../scripts/audit-bilingual-text';
import { renderHook } from '@testing-library/react';

describe('Final Bilingual System Validation', () => {
  describe('Core Functionality', () => {
    it('should format basic bilingual text correctly', () => {
      const result = formatBilingualText('Hello', '你好');
      expect(result).toBe('Hello 你好');
    });

    it('should format text with units correctly', () => {
      const result = formatBilingualText('Duration', '时长', {
        withUnit: 'min',
        withParentheses: true
      });
      expect(result).toBe('Duration 时长 (min)');
    });

    it('should handle custom separators', () => {
      const result = formatBilingualText('Yes', '是', { separator: ' / ' });
      expect(result).toBe('Yes / 是');
    });
  });

  describe('Hook Integration', () => {
    it('should provide translation function', () => {
      const { result } = renderHook(() => useBilingualText());
      expect(typeof result.current.t).toBe('function');
      expect(typeof result.current.formatBilingual).toBe('function');
      expect(typeof result.current.getBilingualValue).toBe('function');
    });

    it('should handle missing translations gracefully', () => {
      const { result } = renderHook(() => useBilingualText());
      const translation = result.current.t('nonexistent.key');
      expect(translation).toBe('nonexistent.key');
    });
  });

  describe('Translation Quality', () => {
    it('should have consistent ellipsis formatting', () => {
      const { result } = renderHook(() => useBilingualText());
      
      // These should work without throwing errors
      expect(() => result.current.t('common.placeholders.searchExercises')).not.toThrow();
      expect(() => result.current.t('components.questionInterface.writeAnswerPlaceholder')).not.toThrow();
    });

    it('should handle difficulty levels correctly', () => {
      const { result } = renderHook(() => useBilingualText());
      
      // Test difficulty level formatting
      const difficulty = result.current.formatBilingual('A1 - Beginner', 'A1 - 初学者');
      expect(difficulty).toBe('A1 - Beginner A1 - 初学者');
    });

    it('should handle duration formatting correctly', () => {
      const { result } = renderHook(() => useBilingualText());
      
      const duration = result.current.formatBilingual('1 minute', '1分钟', {
        withUnit: '~120 words 词',
        withParentheses: true
      });
      expect(duration).toBe('1 minute 1分钟 (~120 words 词)');
    });
  });

  describe('Performance Validation', () => {
    it('should cache repeated translations', () => {
      const { result } = renderHook(() => useBilingualText());
      
      // First call
      const start1 = performance.now();
      const result1 = result.current.formatBilingual('Test', '测试');
      const time1 = performance.now() - start1;
      
      // Second call (should be cached)
      const start2 = performance.now();
      const result2 = result.current.formatBilingual('Test', '测试');
      const time2 = performance.now() - start2;
      
      expect(result1).toBe(result2);
      // Second call should be faster (cached)
      expect(time2).toBeLessThan(time1);
    });

    it('should handle large numbers of translations efficiently', () => {
      const { result } = renderHook(() => useBilingualText());
      
      const start = performance.now();
      
      // Generate many translations
      for (let i = 0; i < 100; i++) {
        result.current.formatBilingual(`Test ${i}`, `测试 ${i}`);
      }
      
      const time = performance.now() - start;
      
      // Should complete within reasonable time (less than 100ms)
      expect(time).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed translation keys gracefully', () => {
      const { result } = renderHook(() => useBilingualText());
      
      expect(() => result.current.t('')).not.toThrow();
      expect(() => result.current.t('.')).not.toThrow();
      expect(() => result.current.t('...')).not.toThrow();
    });

    it('should handle special characters in text', () => {
      const result1 = formatBilingualText('Hello "World"', '你好"世界"');
      expect(result1).toBe('Hello "World" 你好"世界"');
      
      const result2 = formatBilingualText("Hello 'World'", "你好'世界'");
      expect(result2).toBe("Hello 'World' 你好'世界'");
      
      const result3 = formatBilingualText('Hello & World', '你好 & 世界');
      expect(result3).toBe('Hello & World 你好 & 世界');
    });
  });

  describe('Audit System', () => {
    it('should validate translation structure', async () => {
      const auditor = new BilingualTextAuditor();
      const result = await auditor.audit();
      
      // Should have high coverage
      expect(result.validKeys).toBeGreaterThan(300);
      expect(result.totalKeys).toBeGreaterThan(300);
      
      // Should have no critical issues
      expect(result.invalidKeys.length).toBe(0);
      expect(result.emptyTranslations.length).toBe(0);
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should handle common UI patterns', () => {
      const { result } = renderHook(() => useBilingualText());
      
      // Button text
      const buttonText = result.current.formatBilingual('Submit', '提交');
      expect(buttonText).toBe('Submit 提交');
      
      // Loading states
      const loadingText = result.current.formatBilingual('Loading', '加载中', {
        withUnit: '...',
        withParentheses: false
      });
      expect(loadingText).toBe('Loading 加载中 ...');
      
      // Form labels
      const labelText = result.current.formatBilingual('Email Address', '邮箱地址');
      expect(labelText).toBe('Email Address 邮箱地址');
    });

    it('should handle status messages correctly', () => {
      const { result } = renderHook(() => useBilingualText());
      
      const successMsg = result.current.formatBilingual('Success', '成功');
      const errorMsg = result.current.formatBilingual('Error', '错误');
      const warningMsg = result.current.formatBilingual('Warning', '警告');
      
      expect(successMsg).toBe('Success 成功');
      expect(errorMsg).toBe('Error 错误');
      expect(warningMsg).toBe('Warning 警告');
    });
  });
});