/**
 * Light Theme Accessibility - Screen Reader Compatibility Testing
 * 
 * Tests semantic structure and ARIA attributes for screen reader compatibility
 * Requirements: 9.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';

describe('Light Theme Screen Reader Compatibility', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  });

  describe('Semantic Structure Preservation', () => {
    it('should maintain proper heading hierarchy', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <article>
            <h1 className="text-slate-900 text-3xl font-bold">Main Title</h1>
            <section>
              <h2 className="text-slate-800 text-2xl font-semibold">Section Title</h2>
              <h3 className="text-slate-700 text-xl font-medium">Subsection</h3>
            </section>
          </article>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });
      const h3 = screen.getByRole('heading', { level: 3 });
      
      expect(h1).toBeInTheDocument();
      expect(h2).toBeInTheDocument();
      expect(h3).toBeInTheDocument();
    });

    it('should use semantic article and section elements', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <article className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-slate-900">Article Title</h2>
            <section className="mt-4">
              <h3 className="text-slate-800">Section</h3>
              <p className="text-slate-600">Content</p>
            </section>
          </article>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByRole('article')).toBeInTheDocument();
      // Sections without accessible names don't have implicit role
      const article = screen.getByRole('article');
      expect(within(article).getByText('Section')).toBeInTheDocument();
    });

    it('should use semantic navigation elements', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <nav className="bg-slate-50 border-b border-slate-200" aria-label="Main navigation">
            <ul className="flex gap-4">
              <li><a href="#" className="text-blue-600">Home</a></li>
              <li><a href="#" className="text-blue-600">About</a></li>
            </ul>
          </nav>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(nav).toBeInTheDocument();
    });
  });

  describe('ARIA Labels and Descriptions', () => {
    it('should provide accessible names for interactive elements', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <button aria-label="Close dialog" className="text-slate-700">×</button>
            <button aria-label="Open menu" className="text-slate-700">☰</button>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    });

    it('should use aria-describedby for additional context', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <label htmlFor="username" className="text-slate-700">Username</label>
            <input
              id="username"
              type="text"
              aria-describedby="username-help"
              className="border border-slate-300 px-3 py-2 rounded"
            />
            <p id="username-help" className="text-slate-500 text-sm">
              Must be 3-20 characters
            </p>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const input = screen.getByLabelText('Username');
      
      expect(input).toHaveAttribute('aria-describedby', 'username-help');
      expect(screen.getByText('Must be 3-20 characters')).toBeInTheDocument();
    });

    it('should use aria-labelledby for complex labels', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <div id="section-title" className="text-slate-900 font-bold">
              Personal Information
            </div>
            <div role="group" aria-labelledby="section-title" className="mt-4 space-y-4">
              <input type="text" placeholder="First Name" className="border border-slate-300 px-3 py-2 rounded" />
              <input type="text" placeholder="Last Name" className="border border-slate-300 px-3 py-2 rounded" />
            </div>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const group = screen.getByRole('group');
      
      expect(group).toHaveAttribute('aria-labelledby', 'section-title');
    });
  });

  describe('Live Regions and Dynamic Content', () => {
    it('should announce status messages with aria-live', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div
            role="status"
            aria-live="polite"
            className="bg-green-50 text-green-700 border border-green-200 px-4 py-3 rounded"
          >
            Form saved successfully
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const status = screen.getByRole('status');
      
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveTextContent('Form saved successfully');
    });

    it('should announce alerts with role="alert"', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div
            role="alert"
            className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded"
          >
            Error: Please fix the form errors
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const alert = screen.getByRole('alert');
      
      expect(alert).toHaveTextContent('Error: Please fix the form errors');
    });

    it('should use aria-atomic for complete announcements', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-slate-700"
          >
            <span>Loading: </span>
            <span>75%</span>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const status = screen.getByRole('status');
      
      expect(status).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('Form Accessibility', () => {
    it('should associate labels with form controls', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <form>
            <div>
              <label htmlFor="email" className="text-slate-700">Email Address</label>
              <input
                id="email"
                type="email"
                className="border border-slate-300 px-3 py-2 rounded"
              />
            </div>
          </form>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const input = screen.getByLabelText('Email Address');
      
      expect(input).toHaveAttribute('type', 'email');
    });

    it('should indicate required fields', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <label htmlFor="required-field" className="text-slate-700">
              Name <span aria-label="required" className="text-red-600">*</span>
            </label>
            <input
              id="required-field"
              type="text"
              required
              aria-required="true"
              className="border border-slate-300 px-3 py-2 rounded"
            />
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('should indicate invalid fields with aria-invalid', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div>
            <label htmlFor="invalid-email" className="text-slate-700">Email</label>
            <input
              id="invalid-email"
              type="email"
              aria-invalid="true"
              aria-describedby="email-error"
              className="border border-red-300 px-3 py-2 rounded"
            />
            <p id="email-error" className="text-red-700 text-sm" role="alert">
              Please enter a valid email
            </p>
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const input = screen.getByLabelText('Email');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email');
    });
  });

  describe('Button and Link Semantics', () => {
    it('should use button elements for actions', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button
            type="button"
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Save Changes
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button', { name: 'Save Changes' });
      
      expect(button.tagName).toBe('BUTTON');
    });

    it('should use link elements for navigation', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <a
            href="/about"
            className="text-blue-600 hover:text-blue-700"
          >
            About Us
          </a>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const link = screen.getByRole('link', { name: 'About Us' });
      
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/about');
    });

    it('should indicate button state with aria-pressed', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <button
            aria-pressed="true"
            className="bg-blue-100 text-blue-700 border border-blue-300 px-4 py-2 rounded"
          >
            Bold
          </button>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const button = screen.getByRole('button', { name: 'Bold' });
      
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Image Alternative Text', () => {
    it('should provide descriptive alt text for informative images', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <img
            src="/chart.png"
            alt="Bar chart showing 50% increase in sales over last quarter"
            className="border border-slate-200 rounded"
          />
        </ThemeProvider>
      );

      render(<TestComponent />);
      const img = screen.getByAltText('Bar chart showing 50% increase in sales over last quarter');
      
      expect(img).toBeInTheDocument();
    });

    it('should use empty alt for decorative images', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <img
            src="/decoration.svg"
            alt=""
            aria-hidden="true"
            className="opacity-20"
          />
        </ThemeProvider>
      );

      const { container } = render(<TestComponent />);
      const img = container.querySelector('img');
      
      expect(img).toHaveAttribute('alt', '');
      expect(img).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Table Accessibility', () => {
    it('should use proper table structure with headers', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <table className="border border-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="text-slate-900 px-4 py-2">Name</th>
                <th scope="col" className="text-slate-900 px-4 py-2">Email</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-slate-700 px-4 py-2">John Doe</td>
                <td className="text-slate-700 px-4 py-2">john@example.com</td>
              </tr>
            </tbody>
          </table>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const table = screen.getByRole('table');
      
      expect(table).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
    });

    it('should provide table caption for context', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <table className="border border-slate-200">
            <caption className="text-slate-900 font-bold text-left mb-2">
              User List
            </caption>
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="text-slate-900 px-4 py-2">Name</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-slate-700 px-4 py-2">John</td>
              </tr>
            </tbody>
          </table>
        </ThemeProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByText('User List')).toBeInTheDocument();
    });
  });

  describe('Loading and Busy States', () => {
    it('should indicate loading state with aria-busy', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div aria-busy="true" aria-label="Loading content" className="text-slate-700">
            <span>Loading...</span>
          </div>
        </ThemeProvider>
      );

      const { container } = render(<TestComponent />);
      const loadingDiv = container.querySelector('[aria-busy="true"]');
      
      expect(loadingDiv).toHaveAttribute('aria-busy', 'true');
      expect(loadingDiv).toHaveAttribute('aria-label', 'Loading content');
    });

    it('should provide progress information', () => {
      const TestComponent = () => (
        <ThemeProvider attribute="class" defaultTheme="light">
          <div
            role="progressbar"
            aria-valuenow={75}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
            className="bg-slate-200 rounded-full h-2"
          >
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }} />
          </div>
        </ThemeProvider>
      );

      render(<TestComponent />);
      const progressbar = screen.getByRole('progressbar');
      
      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });
  });
});
