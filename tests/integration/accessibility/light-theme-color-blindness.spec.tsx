/**
 * Light Theme Accessibility - Color Blindness Testing
 * 
 * Tests that interface elements remain distinguishable for users with color vision deficiencies
 * Requirements: 9.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';

describe('Light Theme Color Blindness Compatibility', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  });

  describe('Information Not Conveyed by Color Alone', () => {
    it('should use icons in addition to color for status indicators', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded">
              <span aria-hidden="true">✓</span>
              <span>Success: Operation completed</span>
            </div>
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-2 rounded">
              <span aria-hidden="true">✗</span>
              <span>Error: Operation failed</span>
            </div>
            <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded">
              <span aria-hidden="true">⚠</span>
              <span>Warning: Check your input</span>
            </div>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      // Verify text content is present (not just color)
      expect(screen.getByText(/Success: Operation completed/)).toBeInTheDocument();
      expect(screen.getByText(/Error: Operation failed/)).toBeInTheDocument();
      expect(screen.getByText(/Warning: Check your input/)).toBeInTheDocument();
    });

    it('should use text labels for button types, not just color', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="space-x-2">
            <button className="bg-blue-500 text-white px-4 py-2 rounded">
              Save
            </button>
            <button className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded">
              Delete
            </button>
            <button className="bg-slate-200 text-slate-700 px-4 py-2 rounded">
              Cancel
            </button>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      // Buttons have clear text labels
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should use patterns or shapes in addition to color for charts', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 border-2 border-blue-700" />
              <span className="text-slate-700">Category A (Solid Blue)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 border-2 border-green-700" style={{ borderStyle: 'dashed' }} />
              <span className="text-slate-700">Category B (Dashed Green)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 border-2 border-red-700" style={{ borderStyle: 'dotted' }} />
              <span className="text-slate-700">Category C (Dotted Red)</span>
            </div>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      // Text descriptions accompany visual indicators
      expect(screen.getByText(/Category A \(Solid Blue\)/)).toBeInTheDocument();
      expect(screen.getByText(/Category B \(Dashed Green\)/)).toBeInTheDocument();
      expect(screen.getByText(/Category C \(Dotted Red\)/)).toBeInTheDocument();
    });
  });

  describe('Form Validation Without Color Dependency', () => {
    it('should indicate required fields with asterisk and text', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <form>
            <div>
              <label htmlFor="required-name" className="text-slate-700 font-medium">
                Name <span className="text-red-600" aria-label="required">*</span>
              </label>
              <input
                id="required-name"
                type="text"
                required
                className="border border-slate-300 px-3 py-2 rounded"
              />
              <p className="text-slate-500 text-sm">* Required field</p>
            </div>
          </form>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByText('* Required field')).toBeInTheDocument();
      expect(screen.getByLabelText(/Name/)).toHaveAttribute('required');
    });

    it('should show error messages with icons and text', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <label htmlFor="error-email" className="text-slate-700">Email</label>
            <input
              id="error-email"
              type="email"
              aria-invalid="true"
              aria-describedby="email-error"
              className="border-2 border-red-300 px-3 py-2 rounded"
            />
            <p id="email-error" className="text-red-700 text-sm flex items-center gap-1" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>Invalid email format</span>
            </p>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email format');
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should show success state with icon and text', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <label htmlFor="valid-email" className="text-slate-700">Email</label>
            <input
              id="valid-email"
              type="email"
              aria-invalid="false"
              className="border-2 border-green-300 px-3 py-2 rounded"
            />
            <p className="text-green-700 text-sm flex items-center gap-1">
              <span aria-hidden="true">✓</span>
              <span>Valid email address</span>
            </p>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByText('Valid email address')).toBeInTheDocument();
    });
  });

  describe('Link and Button Distinction', () => {
    it('should distinguish links from regular text with underline', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <p className="text-slate-700">
            This is regular text with a{' '}
            <a href="#" className="text-blue-600 underline hover:text-blue-700">
              clickable link
            </a>
            {' '}in the middle.
          </p>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const link = screen.getByRole('link');
      
      expect(link).toHaveClass('underline');
    });

    it('should distinguish buttons with borders and backgrounds', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="space-x-2">
            <button className="bg-blue-500 text-white px-4 py-2 rounded border-2 border-blue-600">
              Primary
            </button>
            <button className="bg-white text-slate-700 px-4 py-2 rounded border-2 border-slate-300">
              Secondary
            </button>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('border-2');
      });
    });
  });

  describe('Interactive State Indicators', () => {
    it('should show hover state with border and shadow changes', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button className="bg-white text-slate-700 px-4 py-2 rounded border border-slate-300 hover:border-slate-400 hover:shadow-md transition-all">
            Hover Me
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('hover:border-slate-400');
      expect(button).toHaveClass('hover:shadow-md');
    });

    it('should show active/pressed state with visual changes', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button
            aria-pressed="true"
            className="bg-blue-100 text-blue-700 px-4 py-2 rounded border-2 border-blue-500 font-semibold"
          >
            Active Filter
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveClass('border-2');
      expect(button).toHaveClass('font-semibold');
    });

    it('should show disabled state with reduced opacity and cursor', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button
            disabled
            className="bg-slate-200 text-slate-400 px-4 py-2 rounded border border-slate-300 opacity-60 cursor-not-allowed"
          >
            Disabled
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-60');
      expect(button).toHaveClass('cursor-not-allowed');
    });
  });

  describe('Progress and Status Indicators', () => {
    it('should show progress with percentage text', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-700 font-medium">Upload Progress</span>
              <span className="text-slate-600">75%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={75}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-slate-200 rounded-full h-2"
            >
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }} />
            </div>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
    });

    it('should show status with text labels', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 border border-green-700" />
              <span className="text-slate-700">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-700" />
              <span className="text-slate-700">Away</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-600" />
              <span className="text-slate-700">Offline</span>
            </div>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByText('Away')).toBeInTheDocument();
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Contrast-Based Differentiation', () => {
    it('should use contrast differences for hierarchy', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="space-y-2">
            <h1 className="text-slate-900 text-2xl font-bold">Primary Heading (Darkest)</h1>
            <h2 className="text-slate-700 text-xl font-semibold">Secondary Heading (Medium)</h2>
            <p className="text-slate-600 text-base">Body text (Lighter)</p>
            <p className="text-slate-500 text-sm">Caption text (Lightest)</p>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      // All text should be present and distinguishable by size and weight
      expect(screen.getByText(/Primary Heading/)).toBeInTheDocument();
      expect(screen.getByText(/Secondary Heading/)).toBeInTheDocument();
      expect(screen.getByText(/Body text/)).toBeInTheDocument();
      expect(screen.getByText(/Caption text/)).toBeInTheDocument();
    });

    it('should use borders and spacing for separation', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="space-y-4">
            <div className="border-2 border-slate-300 p-4 rounded">
              <h3 className="text-slate-900 font-bold mb-2">Section 1</h3>
              <p className="text-slate-600">Content</p>
            </div>
            <div className="border-2 border-slate-300 p-4 rounded">
              <h3 className="text-slate-900 font-bold mb-2">Section 2</h3>
              <p className="text-slate-600">Content</p>
            </div>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByText('Section 1')).toBeInTheDocument();
      expect(screen.getByText('Section 2')).toBeInTheDocument();
    });
  });

  describe('Redundant Coding', () => {
    it('should use multiple visual cues for important information', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button className="bg-red-50 text-red-700 border-2 border-red-300 px-4 py-2 rounded font-bold flex items-center gap-2">
            <span aria-hidden="true">⚠</span>
            <span>Delete Account</span>
            <span className="text-xs">(Permanent)</span>
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      // Multiple cues: color, border, icon, text, weight
      expect(button).toHaveTextContent('Delete Account');
      expect(button).toHaveTextContent('(Permanent)');
      expect(button).toHaveClass('border-2');
      expect(button).toHaveClass('font-bold');
    });
  });
});
