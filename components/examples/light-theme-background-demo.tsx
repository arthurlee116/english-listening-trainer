'use client';

import React from 'react';

/**
 * Demo component showcasing the enhanced background and layout system for light theme
 * Demonstrates the new .bg-app-light gradient background and .header-light styling
 */
export function LightThemeBackgroundDemo() {
  return (
    <div className="space-y-8 p-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary-light">Enhanced Background and Layout System</h2>
        <p className="text-secondary-light">
          This demo showcases the new light theme background and header styling components.
        </p>
      </div>

      {/* Main App Background Demo */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary-light">Main App Background (.bg-app-light)</h3>
        <div className="bg-app-light rounded-lg p-8 min-h-[200px] border border-slate-200">
          <div className="space-y-4">
            <h4 className="text-primary-light font-medium">Soft Gradient Background</h4>
            <p className="text-secondary-light">
              Subtle blue-to-white gradient (135deg direction) with high-brightness, low-saturation colors
              for visual lightness. Avoids dark color blocks as specified in requirements.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="light-panel">
                <h5 className="text-primary-light font-medium mb-2">Panel Content</h5>
                <p className="text-tertiary-light text-sm">
                  Content within the gradient background maintains excellent readability.
                </p>
              </div>
              <div className="glass-effect p-4">
                <h5 className="text-primary-light font-medium mb-2">Glass Effect</h5>
                <p className="text-tertiary-light text-sm">
                  Enhanced glass effect optimized for light backgrounds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header Demo */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary-light">Header Styling (.header-light)</h3>
        <div className="header-light rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h4 className="text-primary-light font-semibold">Application Header</h4>
              <nav className="flex items-center space-x-2">
                <button className="nav-button-light">Home</button>
                <button className="nav-button-light active">Practice</button>
                <button className="nav-button-light">History</button>
              </nav>
            </div>
            <div className="flex items-center space-x-2">
              <button className="nav-button-light">Settings</button>
              <button className="nav-button-light">Profile</button>
            </div>
          </div>
        </div>
        <p className="text-secondary-light text-sm">
          Header with bg-white/90, improved backdrop blur, and low-contrast light gray borders.
          Navigation buttons styled for light theme consistency.
        </p>
      </div>

      {/* Panel Background Variants */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary-light">Background Variants</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-panel-light rounded-lg p-4 border border-slate-200">
            <h4 className="text-primary-light font-medium mb-2">Panel Background</h4>
            <p className="text-tertiary-light text-sm">
              Alternative gradient for panels and cards with subtle variation.
            </p>
          </div>
          <div className="bg-content-light rounded-lg p-4 border border-slate-200">
            <h4 className="text-primary-light font-medium mb-2">Content Background</h4>
            <p className="text-tertiary-light text-sm">
              Minimal gradient for content areas with pure white center.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <h4 className="text-primary-light font-medium mb-2">Standard Background</h4>
            <p className="text-tertiary-light text-sm">
              Standard white background for comparison with gradient variants.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Demo */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary-light">Mobile Navigation (.mobile-nav-light)</h3>
        <div className="mobile-nav-light rounded-lg">
          <div className="flex items-center justify-around">
            <button className="mobile-nav-button-light active">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              </svg>
              <span>Home</span>
            </button>
            <button className="mobile-nav-button-light">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l6-6v13l-6 6z" />
              </svg>
              <span>Practice</span>
            </button>
            <button className="mobile-nav-button-light">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>History</span>
            </button>
            <button className="mobile-nav-button-light">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Profile</span>
            </button>
          </div>
        </div>
        <p className="text-secondary-light text-sm">
          Mobile navigation with backdrop blur and proper border treatments for light theme.
        </p>
      </div>

      {/* Requirements Verification */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary-light">Requirements Verification</h3>
        <div className="bg-panel-light rounded-lg p-4 border border-slate-200">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-primary-light font-medium">Requirement 1.1 & 1.2</p>
                <p className="text-secondary-light text-sm">
                  High-brightness, low-saturation light colors with subtle gradients. 
                  Avoids dark color blocks (blue-gray, brown-gray) for visual lightness.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-primary-light font-medium">Requirement 2.1 & 2.2</p>
                <p className="text-secondary-light text-sm">
                  Header maintains visual hierarchy with light backgrounds and reduced shadows.
                  Proper border treatments with low-contrast light gray.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-primary-light font-medium">Requirement 4.3 & 4.4</p>
                <p className="text-secondary-light text-sm">
                  Global separators use low-contrast light gray. Navigation styling 
                  maintains consistency with light theme design principles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LightThemeBackgroundDemo;