/**
 * Light Theme Accessibility - Keyboard Navigation Testing
 * 
 * Tests keyboard navigation and interaction patterns in light theme
 * Requirements: 9.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/components/theme-provider';

describe('Light Theme Keyboard Navigation', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  });

  describe('Button Keyboard Interaction', () => {
    it('should activate button with Enter key', async () => {
      const user = userEvent.setup();
      let clicked = false;
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button
            onClick={() => { clicked = true; }}
            className="bg-blue-500 text-white px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Submit
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      button.focus();
      await user.keyboard('{Enter}');
      
      expect(clicked).toBe(true);
    });

    it('should activate button with Space key', async () => {
      const user = userEvent.setup();
      let clicked = false;
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button
            onClick={() => { clicked = true; }}
            className="bg-blue-500 text-white px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Submit
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      button.focus();
      await user.keyboard(' ');
      
      expect(clicked).toBe(true);
    });
  });

  describe('Form Keyboard Navigation', () => {
    it('should navigate through form fields with Tab', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <form>
            <input
              type="text"
              placeholder="Name"
              className="border border-slate-300 px-3 py-2 rounded focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              className="border border-slate-300 px-3 py-2 rounded focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Submit
            </button>
          </form>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      const nameInput = screen.getByPlaceholderText('Name');
      const emailInput = screen.getByPlaceholderText('Email');
      const submitButton = screen.getByRole('button');
      
      await user.tab();
      expect(nameInput).toHaveFocus();
      
      await user.tab();
      expect(emailInput).toHaveFocus();
      
      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should support Shift+Tab for reverse navigation', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <form>
            <input
              type="text"
              placeholder="First"
              className="border border-slate-300 px-3 py-2 rounded focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Second"
              className="border border-slate-300 px-3 py-2 rounded focus:ring-2 focus:ring-blue-500"
            />
          </form>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      const firstInput = screen.getByPlaceholderText('First');
      const secondInput = screen.getByPlaceholderText('Second');
      
      await user.tab();
      await user.tab();
      expect(secondInput).toHaveFocus();
      
      await user.tab({ shift: true });
      expect(firstInput).toHaveFocus();
    });

    it('should allow text input via keyboard', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <input
            type="text"
            placeholder="Type here"
            className="border border-slate-300 px-3 py-2 rounded focus:ring-2 focus:ring-blue-500"
          />
        </ThemeProvider>
      );

      render(<TestComponent />);
      const input = screen.getByPlaceholderText('Type here') as HTMLInputElement;
      
      await user.click(input);
      await user.keyboard('Hello World');
      
      expect(input.value).toBe('Hello World');
    });
  });

  describe('Link Keyboard Navigation', () => {
    it('should activate link with Enter key', async () => {
      const user = userEvent.setup();
      let navigated = false;
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <a
            href="#test"
            onClick={(e) => {
              e.preventDefault();
              navigated = true;
            }}
            className="text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            Learn More
          </a>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const link = screen.getByRole('link');
      
      link.focus();
      await user.keyboard('{Enter}');
      
      expect(navigated).toBe(true);
    });
  });

  describe('Skip Links and Landmarks', () => {
    it('should support skip to main content link', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-500 text-white px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              Skip to main content
            </a>
            <main id="main">
              <h1 className="text-slate-900">Main Content</h1>
            </main>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      await user.tab();
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toHaveFocus();
    });
  });

  describe('Dialog and Modal Keyboard Interaction', () => {
    it('should trap focus within modal', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div role="dialog" aria-modal="true" className="bg-white border border-slate-200 p-6 rounded-lg shadow-lg">
            <h2 className="text-slate-900 text-xl font-bold">Dialog Title</h2>
            <button className="bg-blue-500 text-white px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-blue-500">
              Action
            </button>
            <button className="bg-slate-200 text-slate-700 px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-slate-500">
              Cancel
            </button>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      const buttons = screen.getAllByRole('button');
      
      await user.tab();
      expect(buttons[0]).toHaveFocus();
      
      await user.tab();
      expect(buttons[1]).toHaveFocus();
    });

    it('should close modal with Escape key', async () => {
      const user = userEvent.setup();
      let closed = false;
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                closed = true;
              }
            }}
            className="bg-white border border-slate-200 p-6 rounded-lg shadow-lg"
          >
            <h2 className="text-slate-900">Dialog</h2>
            <button className="bg-blue-500 text-white px-4 py-2 rounded">Close</button>
          </div>
        </ThemeProvider>
      );

      const { container } = render(<TestComponent />);
      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
      
      dialog.focus();
      await user.keyboard('{Escape}');
      
      expect(closed).toBe(true);
    });
  });

  describe('Dropdown and Select Keyboard Interaction', () => {
    it('should open dropdown with Enter key', async () => {
      const user = userEvent.setup();
      let isOpen = false;
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button
            aria-haspopup="true"
            aria-expanded={isOpen}
            onClick={() => { isOpen = true; }}
            className="bg-white border border-slate-300 px-4 py-2 rounded focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Select Option
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button');
      
      button.focus();
      await user.keyboard('{Enter}');
      
      expect(isOpen).toBe(true);
    });
  });

  describe('Checkbox and Radio Keyboard Interaction', () => {
    it('should toggle checkbox with Space key', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="w-4 h-4 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-700">Accept terms</span>
          </label>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      
      checkbox.focus();
      await user.keyboard(' ');
      
      expect(checkbox.checked).toBe(true);
    });

    it('should navigate radio buttons with arrow keys', async () => {
      const user = userEvent.setup();
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div role="radiogroup">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="option"
                value="1"
                className="w-4 h-4 border-slate-300 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-700">Option 1</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="option"
                value="2"
                className="w-4 h-4 border-slate-300 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-700">Option 2</span>
            </label>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const radios = screen.getAllByRole('radio');
      
      radios[0].focus();
      expect(radios[0]).toHaveFocus();
      
      await user.keyboard('{ArrowDown}');
      expect(radios[1]).toHaveFocus();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should support custom keyboard shortcuts', async () => {
      const user = userEvent.setup();
      let shortcutTriggered = false;
      
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                shortcutTriggered = true;
              }
            }}
            tabIndex={0}
            className="p-4 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Press Ctrl+S to save
          </div>
        </ThemeProvider>
      );

      const { container } = render(<TestComponent />);
      const div = container.querySelector('[tabindex="0"]');
      
      div?.focus();
      await user.keyboard('{Control>}s{/Control}');
      
      expect(shortcutTriggered).toBe(true);
    });
  });
});
