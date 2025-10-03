"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * Demo component showcasing the new light theme typography system
 * This component demonstrates all the new text classes and their proper usage
 */
export const LightThemeTypographyDemo = () => {
  return (
    <div className="space-y-6 p-6">
      <Card className="glass-effect p-6">
        <h2 className="heading-primary-light mb-4">Light Theme Typography System</h2>
        
        {/* Heading Hierarchy */}
        <div className="space-y-4 mb-6">
          <h1 className="heading-primary-light">Primary Heading (H1)</h1>
          <h2 className="heading-secondary-light">Secondary Heading (H2)</h2>
          <h3 className="heading-tertiary-light">Tertiary Heading (H3)</h3>
        </div>

        {/* Body Text Hierarchy */}
        <div className="space-y-4 mb-6">
          <p className="body-primary-light">
            This is primary body text using the .body-primary-light class. It provides excellent readability 
            with deep gray color (#1A1A1A) that meets WCAG AA contrast requirements (12.63:1 ratio).
          </p>
          
          <p className="body-secondary-light">
            This is secondary body text using .body-secondary-light class. It uses #4A4A4A color 
            for subtitles and auxiliary text with good contrast (7.54:1 ratio).
          </p>
          
          <p className="body-small-light">
            This is small body text using .body-small-light class with tertiary color for less prominent content.
          </p>
        </div>

        {/* Labels and Captions */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="label-light">Form Label Example</label>
            <p className="caption-light mt-1">This is caption text for additional context</p>
          </div>
        </div>

        {/* Interactive Elements */}
        <div className="space-y-4 mb-6">
          <p className="body-primary-light">
            Here is an example of a <a href="#" className="link-light">text link</a> within body content.
          </p>
          
          <Button className="button-text-light">
            Button with Light Theme Text
          </Button>
        </div>

        {/* Status Messages */}
        <div className="space-y-3 mb-6">
          <p className="success-text-light">✓ Success message with appropriate green coloring</p>
          <p className="warning-text-light">⚠ Warning message with yellow coloring</p>
          <p className="error-text-light">✗ Error message with red coloring</p>
          <p className="info-text-light">ℹ Info message with blue coloring</p>
        </div>

        {/* Contrast Ratios Information */}
        <div className="bg-slate-50 p-4 rounded-lg">
          <h4 className="heading-tertiary-light mb-3">Accessibility Compliance</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <Badge variant="outline" className="mb-2">Primary Text</Badge>
              <p className="text-primary-light">Contrast: 12.63:1 ✓ WCAG AA</p>
            </div>
            <div>
              <Badge variant="outline" className="mb-2">Secondary Text</Badge>
              <p className="text-secondary-light">Contrast: 7.54:1 ✓ WCAG AA</p>
            </div>
            <div>
              <Badge variant="outline" className="mb-2">Tertiary Text</Badge>
              <p className="text-tertiary-light">Contrast: 5.74:1 ✓ WCAG AA</p>
            </div>
            <div>
              <Badge variant="outline" className="mb-2">Muted Text</Badge>
              <p className="text-muted-light">Contrast: 3.94:1 (Use carefully)</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

LightThemeTypographyDemo.displayName = "LightThemeTypographyDemo"