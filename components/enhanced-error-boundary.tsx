"use client"

// Compatibility shim: route all imports to the bilingual-capable boundary.
export {
  BilingualEnhancedErrorBoundary as EnhancedErrorBoundary,
  withEnhancedErrorBoundary,
  useAsyncErrorHandler,
} from "@/components/bilingual-enhanced-error-boundary"

export { default } from "@/components/bilingual-enhanced-error-boundary"
