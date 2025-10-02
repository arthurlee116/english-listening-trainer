import React from 'react'

/**
 * Demo component showcasing the new light theme button variants
 * This component demonstrates all the implemented button styles
 */
export const LightThemeButtonsDemo = () => {
  return (
    <div className="p-8 space-y-6 bg-white">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Light Theme Button Variants</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Primary Buttons</h3>
          <div className="flex gap-4 flex-wrap">
            <button className="btn-primary-light">Primary Button</button>
            <button className="btn-primary-light" disabled>Disabled Primary</button>
            <button className="btn-primary-light loading">Loading...</button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Secondary Buttons</h3>
          <div className="flex gap-4 flex-wrap">
            <button className="btn-secondary-light">Secondary Button</button>
            <button className="btn-secondary-light" disabled>Disabled Secondary</button>
            <button className="btn-secondary-light loading">Loading...</button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Outline Buttons</h3>
          <div className="flex gap-4 flex-wrap">
            <button className="btn-outline-light">Outline Button</button>
            <button className="btn-outline-light" disabled>Disabled Outline</button>
            <button className="btn-outline-light loading">Loading...</button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Destructive Buttons</h3>
          <div className="flex gap-4 flex-wrap">
            <button className="btn-destructive-light">Delete Item</button>
            <button className="btn-destructive-light" disabled>Disabled Delete</button>
            <button className="btn-destructive-light loading">Deleting...</button>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-slate-50 rounded-lg">
        <h4 className="text-md font-semibold text-slate-700 mb-2">Features Implemented:</h4>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>✅ Softer blue colors for primary buttons</li>
          <li>✅ Sky-blue color scheme for secondary buttons</li>
          <li>✅ Improved visibility for outline buttons on light backgrounds</li>
          <li>✅ Reduced visual pressure for destructive buttons</li>
          <li>✅ Enhanced hover states with darker borders and backgrounds</li>
          <li>✅ Smooth transition animations</li>
          <li>✅ Accessibility-compliant focus indicators</li>
          <li>✅ Disabled and loading states</li>
        </ul>
      </div>
    </div>
  )
}

export default LightThemeButtonsDemo