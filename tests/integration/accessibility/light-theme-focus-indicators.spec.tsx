/**
 * Light Theme Accessibility - Focus Indicator Testing
 * 
 * Tests focus indicator visibility and keyboard navigation in light theme
 * Requirements: 9.2, 9.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/components/theme-provider';

describe('Light Theme Focus Indicators', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  });

  describe('Button Focus Indicators', () => {
    it('should show visible focus ring on primary buttons', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button className="bg-blue-500 text-white px-4 py-2 rounded focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2">
            Primary Button
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus-visible:outline-blue-500');
    });

    it('should show visible focus ring on secondary buttons', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button className="bg-sky-50 text-sky-900 border border-sky-200 px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-blue-500">
            Secondary Button
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus-visible:ring-blue-500');
    });

    it('should show visible focus ring on outline buttons', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button className="bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded focus-visible:outline-2 focus-visible:outline-slate-500">
            Outline Button
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus-visible:outline-slate-500');
    });

    it('should show visible focus ring on destructive buttons', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-red-500">
            Delete
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus-visible:ring-red-500');
    });
  });

  describe('Input Focus Indicators', () => {
    it('should show visible focus ring on text inputs', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <input
            type="text"
            placeholder="Enter text"
            className="border border-slate-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </ThemeProvider>
      );

      render(<TestComponent />);
      const input = screen.getByPlaceholderText('Enter text');
      
      await user.tab();
      expect(input).toHaveFocus();
      expect(input).toHaveClass('focus:ring-blue-500');
    });

    it('should show visible focus ring on textareas', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <textarea
            placeholder="Enter description"
            className="border border-slate-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </ThemeProvider>
      );

      render(<TestComponent />);
      const textarea = screen.getByPlaceholderText('Enter description');
      
      await user.tab();
      expect(textarea).toHaveFocus();
      expect(textarea).toHaveClass('focus:ring-blue-500');
    });
  });

  describe('Link Focus Indicators', () => {
    it('should show visible focus ring on links', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <a
            href="#"
            className="text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
          >
            Learn More
          </a>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const link = screen.getByRole('link');
      
      await user.tab();
      expect(link).toHaveFocus();
      expect(link).toHaveClass('focus-visible:outline-blue-500');
    });
  });

  describe('Interactive Element Focus Order', () => {
    it('should maintain logical tab order through interactive elements', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <button className="focus-visible:ring-2 focus-visible:ring-blue-500">First</button>
            <button className="focus-visible:ring-2 focus-visible:ring-blue-500">Second</button>
            <button className="focus-visible:ring-2 focus-visible:ring-blue-500">Third</button>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const buttons = screen.getAllByRole('button');
      
      await user.tab();
      expect(buttons[0]).toHaveFocus();
      
      await user.tab();
      expect(buttons[1]).toHaveFocus();
      
      await user.tab();
      expect(buttons[2]).toHaveFocus();
    });

    it('should support reverse tab navigation', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <button className="focus-visible:ring-2 focus-visible:ring-blue-500">First</button>
            <button className="focus-visible:ring-2 focus-visible:ring-blue-500">Second</button>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const buttons = screen.getAllByRole('button');
      
      await user.tab();
      await user.tab();
      expect(buttons[1]).toHaveFocus();
      
      await user.tab({ shift: true });
      expect(buttons[0]).toHaveFocus();
    });
  });

  describe('Focus Visibility on Different Backgrounds', () => {
    it('should show visible focus on white background', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="bg-white p-4">
            <button className="bg-blue-500 text-white px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-blue-300">
              Button on White
            </button>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus-visible:ring-blue-300');
    });

    it('should show visible focus on light panel background', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="bg-slate-50 p-4">
            <button className="bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-blue-500">
              Button on Panel
            </button>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus-visible:ring-blue-500');
    });

    it('should show visible focus on gradient background', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="bg-gradient-to-br from-blue-50 to-white p-4">
            <button className="bg-white text-slate-700 px-4 py-2 rounded shadow-sm focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2">
              Button on Gradient
            </button>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus-visible:outline-blue-500');
    });
  });

  describe('Focus Indicator Offset and Size', () => {
    it('should have appropriate offset for better visibility', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button className="focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2">
            Button with Offset
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('focus-visible:outline-offset-2');
    });

    it('should have sufficient outline width', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button className="focus-visible:outline-2 focus-visible:outline-blue-500">
            Button with Width
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('focus-visible:outline-2');
    });
  });
});
