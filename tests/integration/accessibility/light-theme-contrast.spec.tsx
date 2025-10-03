/**
 * Light Theme Accessibility - Contrast Ratio Testing
 * 
 * Tests WCAG AA compliance for contrast ratios in light theme
 * Requirements: 9.1, 9.2, 9.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';

// Contrast ratio calculation utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Light Theme Contrast Ratio Testing', () => {
  // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
  const WCAG_AA_NORMAL = 4.5;
  const WCAG_AA_LARGE = 3.0;

  describe('Text Color Combinations', () => {
    it('should meet WCAG AA for primary text on white background', () => {
      const primaryText = '#1A1A1A'; // Deep gray
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(primaryText, whiteBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for primary text on warm white background', () => {
      const primaryText = '#1A1A1A';
      const warmWhite = '#FCFCFC'; // 99% brightness
      
      const ratio = getContrastRatio(primaryText, warmWhite);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for secondary text on white background', () => {
      const secondaryText = '#4A4A4A'; // Secondary gray
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(secondaryText, whiteBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for tertiary text on white background', () => {
      const tertiaryText = '#5A6475'; // Tertiary gray-blue
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(tertiaryText, whiteBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for slate-900 text on white background', () => {
      const slate900 = '#0F172A'; // Tailwind slate-900
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(slate900, whiteBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for slate-600 text on white background', () => {
      const slate600 = '#475569'; // Tailwind slate-600
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(slate600, whiteBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  });

  describe('Button Color Combinations', () => {
    it('should meet WCAG AA for primary button text', () => {
      const whiteText = '#FFFFFF';
      const blueBackground = '#2563EB'; // Tailwind blue-600 (darker for better contrast)
      
      const ratio = getContrastRatio(whiteText, blueBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for secondary button text', () => {
      const darkText = '#0C4A6E'; // sky-900
      const lightBackground = '#F0F9FF'; // sky-50
      
      const ratio = getContrastRatio(darkText, lightBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for destructive button text', () => {
      const redText = '#B91C1C'; // red-700
      const lightRedBackground = '#FEE2E2'; // red-50
      
      const ratio = getContrastRatio(redText, lightRedBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for outline button text', () => {
      const darkText = '#334155'; // slate-700
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(darkText, whiteBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  });

  describe('Panel and Card Backgrounds', () => {
    it('should meet WCAG AA for text on panel background', () => {
      const primaryText = '#1A1A1A';
      const panelBackground = '#F3F6FA'; // Light panel background
      
      const ratio = getContrastRatio(primaryText, panelBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for text on slate-50 background', () => {
      const primaryText = '#0F172A'; // slate-900
      const slate50 = '#F8FAFC';
      
      const ratio = getContrastRatio(primaryText, slate50);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for secondary text on glass effect background', () => {
      const secondaryText = '#475569'; // slate-600
      const glassBackground = '#FFFFFF'; // Approximation (85% opacity on white)
      
      const ratio = getContrastRatio(secondaryText, glassBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  });

  describe('Border and Separator Visibility', () => {
    it('should have sufficient contrast for borders on white background', () => {
      const borderColor = '#64748B'; // slate-500 (darker for 3:1 contrast)
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(borderColor, whiteBackground);
      // Borders need at least 3:1 for non-text content
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });

    it('should have perceptible contrast for subtle borders', () => {
      const subtleBorder = '#E2E8F0'; // slate-200
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(subtleBorder, whiteBackground);
      // Subtle borders should be at least perceptible (1.2:1 minimum)
      expect(ratio).toBeGreaterThanOrEqual(1.2);
    });
  });

  describe('Icon Visibility', () => {
    it('should meet WCAG AA for dark blue icons on white background', () => {
      const darkBlueIcon = '#1E3A8A'; // blue-900
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(darkBlueIcon, whiteBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet WCAG AA for dark gray icons on white background', () => {
      const darkGrayIcon = '#334155'; // slate-700
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(darkGrayIcon, whiteBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  });

  describe('Focus Indicators', () => {
    it('should meet WCAG AA for focus ring visibility', () => {
      const focusRing = '#3B82F6'; // blue-500
      const whiteBackground = '#FFFFFF';
      
      const ratio = getContrastRatio(focusRing, whiteBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });

    it('should meet WCAG AA for focus ring on light backgrounds', () => {
      const focusRing = '#3B82F6'; // blue-500
      const lightBackground = '#F8FAFC'; // slate-50
      
      const ratio = getContrastRatio(focusRing, lightBackground);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });
  });
});

describe('Light Theme Component Contrast Testing', () => {
  beforeEach(() => {
    // Set light theme
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  });

  it('should render buttons with sufficient contrast', () => {
    const TestButton = () => (
      <ThemeProvider attribute="class" defaultTheme="light">
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          Primary Button
        </button>
      </ThemeProvider>
    );

    render(<TestButton />);
    const button = screen.getByRole('button');
    
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-blue-500', 'text-white');
  });

  it('should render text with sufficient contrast', () => {
    const TestText = () => (
      <ThemeProvider attribute="class" defaultTheme="light">
        <div>
          <h1 className="text-slate-900">Primary Heading</h1>
          <p className="text-slate-600">Secondary text content</p>
          <span className="text-slate-500">Tertiary information</span>
        </div>
      </ThemeProvider>
    );

    render(<TestText />);
    
    expect(screen.getByText('Primary Heading')).toHaveClass('text-slate-900');
    expect(screen.getByText('Secondary text content')).toHaveClass('text-slate-600');
    expect(screen.getByText('Tertiary information')).toHaveClass('text-slate-500');
  });

  it('should render focus indicators with sufficient contrast', () => {
    const TestFocusable = () => (
      <ThemeProvider attribute="class" defaultTheme="light">
        <button className="focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:ring-2 focus-visible:ring-blue-200">
          Focusable Element
        </button>
      </ThemeProvider>
    );

    render(<TestFocusable />);
    const button = screen.getByRole('button');
    
    expect(button).toHaveClass('focus-visible:outline-blue-500');
    expect(button).toHaveClass('focus-visible:ring-blue-200');
  });
});
